"""The Claude client (services.claude): the real Anthropic SDK against a fake Messages API.

The fake sits at the HTTP transport, so these tests run what production runs (streaming, the
SDK's retries, pause_turn continuations, structured results and error handling) without a network call.
"""

import asyncio
import json
import logging
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

import config
from services import claude, results
from services.claude import (
    AIError,
    AIIncomplete,
    AIRefused,
    AIRejected,
    AITimeout,
    AIUnavailable,
    Prompt,
    generate_result,
)

SEARCH = {"type": "server_tool_use", "id": "srvtoolu_01", "name": "web_search", "input": {"query": "audio plugin pricing"}}
SEARCH_RESULT = {
    "type": "web_search_tool_result",
    "tool_use_id": "srvtoolu_01",
    "content": [{
        "type": "web_search_result", "url": "https://plugins.example/pricing", "title": "Pricing",
        "encrypted_content": "c2VhcmNoLXJlc3VsdA", "page_age": None,
    }],
}
THINKING = {"type": "thinking", "thinking": "", "signature": "c2lnbmF0dXJl"}


class Summary(results.Result):
    summary: str
    points: list[str]


SUMMARY = {"summary": "Plugin prices start at $49.", "points": ["Subscriptions are common"]}
PROMPT = Prompt(instructions="You are a pricing analyst.", context="# Brand Context\nBrand: Launch Ops", details="# Today's Date: September 16, 2026")


def _submit(result: dict | str, tool_id: str = "toolu_01") -> dict:
    return {"type": "tool_use", "id": tool_id, "name": claude.SUBMIT_TOOL, "input": result}


def _sse(events: list[dict]) -> bytes:
    return "".join(f"event: {event['type']}\ndata: {json.dumps(event)}\n\n" for event in events).encode()


def _start(model: str = "claude-sonnet-5") -> dict:
    return {
        "type": "message_start",
        "message": {
            "id": "msg_test", "type": "message", "role": "assistant", "model": model, "content": [],
            "stop_reason": None, "stop_sequence": None, "usage": {"input_tokens": 120, "output_tokens": 1},
        },
    }


def _message(blocks: list[dict], stop_reason: str = "end_turn", model: str = "claude-sonnet-5", usage: dict | None = None) -> httpx2.Response:
    """A streamed Messages API response carrying these content blocks. A tool input given as a string
    is streamed exactly as it is, valid JSON or not."""
    events = [_start(model)]
    for index, block in enumerate(blocks):
        if block["type"] == "text":
            events.append({"type": "content_block_start", "index": index, "content_block": {"type": "text", "text": ""}})
            events.append({"type": "content_block_delta", "index": index, "delta": {"type": "text_delta", "text": block["text"]}})
        elif block["type"] == "thinking":
            events.append({"type": "content_block_start", "index": index, "content_block": {**block, "signature": ""}})
            events.append({"type": "content_block_delta", "index": index, "delta": {"type": "signature_delta", "signature": block["signature"]}})
        elif block["type"] in ("server_tool_use", "tool_use"):
            partial = block["input"] if isinstance(block["input"], str) else json.dumps(block["input"])
            events.append({"type": "content_block_start", "index": index, "content_block": {**block, "input": {}}})
            events.append({"type": "content_block_delta", "index": index, "delta": {"type": "input_json_delta", "partial_json": partial}})
        else:
            events.append({"type": "content_block_start", "index": index, "content_block": block})
        events.append({"type": "content_block_stop", "index": index})
    events.append({
        "type": "message_delta", "delta": {"stop_reason": stop_reason, "stop_sequence": None},
        "usage": {"output_tokens": 480, **(usage or {})},
    })
    events.append({"type": "message_stop"})
    return _stream_response(_sse(events))


def _stream_response(body: bytes) -> httpx2.Response:
    return httpx2.Response(200, headers={"content-type": "text/event-stream", "request-id": "req_test"}, content=body)


def _answer(result: dict, **kwargs) -> httpx2.Response:
    """An answer in the requested response format: thinking, then the result as JSON text."""
    return _message([THINKING, {"type": "text", "text": json.dumps(result)}], **kwargs)


def _submitted(result: dict, **kwargs) -> httpx2.Response:
    """Research that ends by submitting its result."""
    return _message([{"type": "text", "text": "Here's what I found."}, _submit(result)], stop_reason="tool_use", **kwargs)


def _error(status: int, error_type: str, message: str, headers: dict | None = None) -> httpx2.Response:
    return httpx2.Response(status, headers=headers, json={"type": "error", "error": {"type": error_type, "message": message}})


@pytest.fixture
def anthropic_api(monkeypatch):
    """A fake Anthropic Messages API behind the real SDK client.

    Append responses to .responses: an httpx2.Response, an exception to raise, or an async
    function of the request. Every request is recorded in .requests with its JSON body and headers.
    """
    api = SimpleNamespace(responses=[], requests=[])

    async def handler(request: httpx2.Request) -> httpx2.Response:
        api.requests.append(SimpleNamespace(body=json.loads(request.content), headers=request.headers))
        assert api.responses, "the code made more Anthropic API requests than the test expected"
        response = api.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        if callable(response):
            return await response(request)
        return response

    transport = httpx2.MockTransport(handler)
    monkeypatch.setattr(
        claude, "_client",
        lambda api_key: claude._new_client(api_key, http_client=anthropic.DefaultAsyncHttpxClient(transport=transport)),
    )
    monkeypatch.setattr(config.get_settings(), "anthropic_api_key", "sk-ant-test-key")
    # The SDK waits 0.5 to 8 s between retries of failed connections; tests don't need to wait.
    monkeypatch.setattr(anthropic._base_client, "INITIAL_RETRY_DELAY", 0.0)
    monkeypatch.setattr(anthropic._base_client, "MAX_RETRY_DELAY", 0.0)
    return api


async def _generate(**kwargs) -> dict:
    return await generate_result(PROMPT, "Execute this workflow.", Summary, **kwargs)


# ─── Requests ───


async def test_streams_the_request_in_the_results_format_and_returns_the_result(anthropic_api):
    anthropic_api.responses.append(_answer(SUMMARY))

    result = await _generate()

    assert result == SUMMARY
    [request] = anthropic_api.requests
    assert request.body["stream"] is True
    assert request.body["model"] == "claude-sonnet-5"
    assert request.body["messages"] == [{"role": "user", "content": "Execute this workflow."}]
    assert request.body["max_tokens"] == claude.DEFAULT_MAX_TOKENS
    assert request.body["output_config"] == {"format": {"type": "json_schema", "schema": anthropic.transform_schema(Summary)}}
    assert request.headers["x-api-key"] == "sk-ant-test-key"
    # One answer, so nothing past the system prompt is worth caching
    assert not {"tools", "cache_control"} & request.body.keys()
    # Current models reject sampling parameters; only models with server-side fallbacks opt in to them
    assert not {"temperature", "top_p", "top_k", "fallbacks"} & request.body.keys()
    assert "anthropic-beta" not in request.headers


async def test_the_system_prompt_is_cached_in_its_stable_parts(anthropic_api):
    anthropic_api.responses += [_answer(SUMMARY), _answer(SUMMARY)]

    await _generate()
    await generate_result(Prompt(instructions="You are a pricing analyst."), "go", Summary)

    full, instructions_only = (request.body["system"] for request in anthropic_api.requests)
    assert full == [
        {"type": "text", "text": f"You are a pricing analyst.\n\n{claude.PLACEHOLDER_RULE}", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "# Brand Context\nBrand: Launch Ops", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "# Today's Date: September 16, 2026"},
    ]
    assert instructions_only == full[:1]


def test_run_details_leave_out_empty_sections_and_end_with_todays_date():
    details = claude.run_details(claude.section("Additional Notes", "Indie budget"), claude.section("Contact Information", " \n"))
    notes, date = details.split("\n\n")
    assert notes == "# Additional Notes\nIndie budget"
    assert date.startswith("# Today's Date: ")
    assert claude.run_details().startswith("# Today's Date: ")


async def test_the_default_model_is_the_configured_one(anthropic_api, monkeypatch):
    monkeypatch.setattr(config.get_settings(), "claude_model", "claude-sonnet-4-6")
    anthropic_api.responses.append(_answer(SUMMARY, model="claude-sonnet-4-6"))

    await _generate(max_tokens=2048)

    assert anthropic_api.requests[0].body["model"] == "claude-sonnet-4-6"
    assert anthropic_api.requests[0].body["max_tokens"] == 2048


def test_default_models_are_current_generation():
    settings = config.Settings(_env_file=None)
    assert settings.claude_model == "claude-sonnet-5"
    assert settings.claude_report_model == "claude-opus-5"


async def test_research_searches_the_web_and_submits_its_result_with_a_strict_tool(anthropic_api):
    anthropic_api.responses.append(_submitted(SUMMARY))

    result = await _generate(web_search=True)

    assert result == SUMMARY
    [request] = anthropic_api.requests
    assert request.body["tools"] == [
        {"type": "web_search_20260209", "name": "web_search"},
        {
            "name": "submit_result",
            "description": "Submit the finished result of this operation. Call it once, when your research is complete.",
            "input_schema": anthropic.transform_schema(Summary),
            "strict": True,
            "eager_input_streaming": True,
        },
    ]
    # Web search cites its sources, and citations can't be combined with a response format
    assert "output_config" not in request.body
    # The turn grows with every resume, so its end is cached as it goes
    assert request.body["cache_control"] == {"type": "ephemeral"}
    assert request.body["system"][0]["text"].endswith(claude.SUBMIT_INSTRUCTION)


async def test_web_search_uses_the_basic_tool_on_other_models(anthropic_api):
    anthropic_api.responses.append(_submitted(SUMMARY, model="claude-haiku-4-5"))

    await _generate(web_search=True, model="claude-haiku-4-5")

    assert anthropic_api.requests[0].body["tools"][0] == {"type": "web_search_20250305", "name": "web_search"}


@pytest.mark.parametrize("model", ["claude-opus-5", "claude-fable-5-1"])
async def test_models_that_can_decline_opt_in_to_server_side_fallbacks(anthropic_api, model):
    anthropic_api.responses.append(_answer(SUMMARY, model=model))

    await _generate(model=model)

    [request] = anthropic_api.requests
    assert request.body["model"] == model
    assert request.body["fallbacks"] == "default"
    assert request.headers["anthropic-beta"] == "server-side-fallback-2026-07-01"


# ─── Results ───


async def test_a_result_is_stored_in_the_shape_results_always_had(anthropic_api):
    announcement = {
        "email_version": "Email", "blog_version": "Blog", "press_release_version": "Press",
        "social_versions": [{"platform": "linkedin", "content": "Post"}],
    }
    anthropic_api.responses.append(_answer(announcement))

    result = await generate_result(PROMPT, "go", results.AnnouncementResult)

    assert result["social_versions"] == {"linkedin": "Post"}


async def test_an_answer_split_across_text_blocks_is_joined_exactly(anthropic_api):
    # Citations once split an answer mid-JSON, and joining the pieces with anything at all broke it
    written = json.dumps(SUMMARY)
    anthropic_api.responses.append(_message([
        {"type": "text", "text": written[:20]}, {"type": "text", "text": written[20:]},
    ]))

    assert await _generate() == SUMMARY


async def test_a_cut_off_answer_is_not_a_result(anthropic_api, caplog):
    caplog.set_level(logging.WARNING, logger="services.claude")
    anthropic_api.responses.append(_message([{"type": "text", "text": '{"summary": "Plugin pri'}], stop_reason="max_tokens"))

    with pytest.raises(AIIncomplete) as raised:
        await _generate()

    assert (raised.value.status_code, raised.value.retryable) == (502, False)
    assert str(raised.value) == "The AI's answer was too long and was cut off. Try again with narrower instructions."
    assert "max_tokens" in caplog.text


async def test_an_answer_without_the_results_fields_is_an_error(anthropic_api, caplog):
    anthropic_api.responses.append(_answer({"summary": "No points"}))

    with pytest.raises(AIError) as raised:
        await _generate()

    assert type(raised.value) is AIError
    assert raised.value.retryable is True
    assert str(raised.value) == "The AI's result didn't have the expected structure. Try again."
    assert "Summary didn't validate" in caplog.text


# ─── Web research: pause_turn, and submitting the result ───


async def test_a_turn_paused_during_web_search_is_resumed(anthropic_api):
    anthropic_api.responses += [
        _message([{"type": "text", "text": "Searching."}, SEARCH], stop_reason="pause_turn"),
        _message([SEARCH_RESULT, _submit(SUMMARY)], stop_reason="tool_use"),
    ]

    assert await _generate(web_search=True) == SUMMARY

    first, second = anthropic_api.requests
    # The paused turn goes back as the assistant message; no extra "continue" message is added.
    assert len(second.body["messages"]) == 2
    assert second.body["messages"][0] == {"role": "user", "content": "Execute this workflow."}
    assert second.body["messages"][1]["role"] == "assistant"
    assert [block["type"] for block in second.body["messages"][1]["content"]] == ["text", "server_tool_use"]
    assert second.body["tools"] == first.body["tools"]
    assert second.body["system"] == first.body["system"]


async def test_each_resume_sends_the_whole_turn_so_far(anthropic_api):
    anthropic_api.responses += [
        _message([SEARCH], stop_reason="pause_turn"),
        _message([SEARCH_RESULT, {**SEARCH, "id": "srvtoolu_02"}], stop_reason="pause_turn"),
        _submitted(SUMMARY),
    ]

    assert await _generate(web_search=True) == SUMMARY

    third = anthropic_api.requests[2]
    assert [block["type"] for block in third.body["messages"][1]["content"]] == [
        "server_tool_use", "web_search_tool_result", "server_tool_use",
    ]


async def test_research_that_keeps_pausing_is_stopped(anthropic_api):
    anthropic_api.responses += [_message([SEARCH], stop_reason="pause_turn") for _ in range(claude.MAX_CONTINUATIONS + 1)]

    with pytest.raises(AITimeout) as raised:
        await _generate(web_search=True)

    assert str(raised.value) == "The web research for this operation didn't finish. Try again, or narrow the instructions."
    assert len(anthropic_api.requests) == claude.MAX_CONTINUATIONS + 1


async def test_research_that_ends_without_submitting_is_asked_for_its_result_once(anthropic_api):
    anthropic_api.responses += [
        _message([SEARCH, SEARCH_RESULT, {"type": "text", "text": "Prices start at $49."}]),
        _submitted(SUMMARY),
    ]

    assert await _generate(web_search=True) == SUMMARY

    first, second = anthropic_api.requests
    assert [message["role"] for message in second.body["messages"]] == ["user", "assistant", "user"]
    assert [block["type"] for block in second.body["messages"][1]["content"]] == ["server_tool_use", "web_search_tool_result", "text"]
    assert second.body["messages"][2] == {"role": "user", "content": claude.SUBMIT_REMINDER}
    assert (second.body["system"], second.body["tools"]) == (first.body["system"], first.body["tools"])


async def test_research_that_never_submits_a_result_is_an_error(anthropic_api):
    anthropic_api.responses += [_message([{"type": "text", "text": "Prices start at $49."}]) for _ in range(2)]

    with pytest.raises(AIError) as raised:
        await _generate(web_search=True)

    assert type(raised.value) is AIError
    assert raised.value.retryable is True
    assert str(raised.value) == "The AI finished without returning a result. Try again."
    assert len(anthropic_api.requests) == 2


async def test_the_last_submission_in_a_turn_is_the_result(anthropic_api):
    first_draft = {**SUMMARY, "summary": "A first draft"}
    anthropic_api.responses.append(_message([_submit(first_draft), _submit(SUMMARY, "toolu_02")], stop_reason="tool_use"))

    assert await _generate(web_search=True) == SUMMARY


class Researched(results.Result):
    summary: str
    sources: list[results.Source]


def _search_result(url: str, title: str, page_age: str | None = None, tool_use_id: str = "srvtoolu_01") -> dict:
    return {
        "type": "web_search_tool_result", "tool_use_id": tool_use_id,
        "content": [{"type": "web_search_result", "url": url, "title": title, "encrypted_content": "ZW5j", "page_age": page_age}],
    }


async def test_research_keeps_only_the_sources_its_searches_returned(anthropic_api):
    anthropic_api.responses.append(_message([
        SEARCH,
        _search_result("https://plugins.example/pricing", "Plugin pricing 2026", "September 2, 2026"),
        _submit({"summary": "Prices start at $49.", "sources": [
            {"title": "Pricing", "url": "https://Plugins.example/pricing/"},
            {"title": "A page no search returned", "url": "https://invented.example/report"},
            {"title": "Pricing again", "url": "https://plugins.example/pricing"},
        ]}),
    ], stop_reason="tool_use"))

    result = await generate_result(PROMPT, "go", Researched, web_search=True)

    # As the search returned it, once
    assert result["sources"] == [{"title": "Plugin pricing 2026", "url": "https://plugins.example/pricing", "page_age": "September 2, 2026"}]


async def test_sources_can_come_from_any_part_of_the_research(anthropic_api):
    anthropic_api.responses += [
        _message([SEARCH, _search_result("https://first.example/a", "First")], stop_reason="pause_turn"),
        _message([{"type": "text", "text": "Done searching."}]),
        _message([
            {**SEARCH, "id": "srvtoolu_02"}, _search_result("https://second.example/b", "Second", tool_use_id="srvtoolu_02"),
            _submit({"summary": "Two sources.", "sources": [
                {"title": "Second", "url": "https://second.example/b"}, {"title": "First", "url": "https://first.example/a"},
            ]}),
        ], stop_reason="tool_use"),
    ]

    result = await generate_result(PROMPT, "go", Researched, web_search=True)

    assert [source["url"] for source in result["sources"]] == ["https://second.example/b", "https://first.example/a"]


async def test_a_submission_cut_off_by_the_token_limit_is_not_used(anthropic_api):
    anthropic_api.responses.append(_message([_submit('{"summary": "Plugin prices start at $49.", "poi')], stop_reason="max_tokens"))

    with pytest.raises(AIIncomplete):
        await _generate(web_search=True)

    assert len(anthropic_api.requests) == 1, "an answer that ran out of room isn't asked for again"


@pytest.mark.parametrize("streamed_input", [
    # The SDK's tolerant parser keeps what it can of this, which then doesn't validate
    '{"summary": "Plugin prices" start at $49.}',
    # and can't parse this at all
    "Plugin prices start at $49.",
])
async def test_a_submission_that_isnt_json_is_an_error(anthropic_api, streamed_input):
    anthropic_api.responses.append(_message([_submit(streamed_input)], stop_reason="tool_use"))

    with pytest.raises(AIError) as raised:
        await _generate(web_search=True)

    assert str(raised.value) == "The AI's result didn't have the expected structure. Try again."


# ─── Failures ───


async def test_missing_api_key_means_the_service_is_unavailable(anthropic_api, monkeypatch):
    monkeypatch.setattr(config.get_settings(), "anthropic_api_key", "")

    with pytest.raises(AIUnavailable) as raised:
        await _generate()

    assert (raised.value.status_code, raised.value.retryable) == (503, False)
    assert str(raised.value) == "The AI service isn't available: ANTHROPIC_API_KEY not configured"
    assert anthropic_api.requests == []


async def test_a_declined_request_is_a_refusal(anthropic_api):
    anthropic_api.responses.append(_message([], stop_reason="refusal"))

    with pytest.raises(AIRefused) as raised:
        await _generate()

    assert (raised.value.status_code, raised.value.retryable) == (422, False)
    assert str(raised.value) == "The AI declined this request. Change the instructions or the project details and try again."


@pytest.mark.parametrize(("status", "error_type", "provider_message", "error_class", "status_code", "message"), [
    (401, "authentication_error", "invalid x-api-key", AIUnavailable, 503,
     "The AI service isn't available: the Anthropic API key was rejected."),
    (403, "permission_error", "not allowed", AIUnavailable, 503,
     "The AI service isn't available: the Anthropic API key doesn't have access to this request."),
    (404, "not_found_error", "model: claude-sonnet-5", AIUnavailable, 503,
     "The AI service isn't available: the model claude-sonnet-5 wasn't found. Check CLAUDE_MODEL and CLAUDE_REPORT_MODEL."),
    (400, "invalid_request_error", "prompt is too long: 1200000 tokens > 1000000 maximum", AIRejected, 502,
     "The AI provider rejected the request (HTTP 400): prompt is too long: 1200000 tokens > 1000000 maximum"),
])
async def test_rejected_requests_explain_what_went_wrong(
    anthropic_api, status, error_type, provider_message, error_class, status_code, message,
):
    anthropic_api.responses.append(_error(status, error_type, provider_message))

    with pytest.raises(AIError) as raised:
        await _generate()

    assert type(raised.value) is error_class
    assert raised.value.status_code == status_code
    assert raised.value.retryable is False, "sending the same request again won't change the answer"
    assert str(raised.value) == message
    assert len(anthropic_api.requests) == 1, "client errors are not retried"


async def test_an_overloaded_provider_is_retried(anthropic_api):
    anthropic_api.responses += [_error(529, "overloaded_error", "Overloaded", {"retry-after-ms": "1"}), _answer(SUMMARY)]

    assert await _generate() == SUMMARY
    assert len(anthropic_api.requests) == 2


@pytest.mark.parametrize(("status", "error_type"), [(529, "overloaded_error"), (429, "rate_limit_error"), (500, "api_error")])
async def test_provider_errors_that_outlast_the_retries(anthropic_api, status, error_type):
    anthropic_api.responses += [
        _error(status, error_type, "try later", {"retry-after-ms": "1"}) for _ in range(claude.MAX_RETRIES + 1)
    ]

    with pytest.raises(AIError) as raised:
        await _generate()

    assert type(raised.value) is AIError
    assert (raised.value.status_code, raised.value.retryable) == (502, True)
    assert str(raised.value) == f"The AI provider returned an error (HTTP {status}). Try again in a few minutes."
    assert len(anthropic_api.requests) == claude.MAX_RETRIES + 1


async def test_an_error_in_the_middle_of_a_stream(anthropic_api):
    body = _sse([_start(), {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}])
    anthropic_api.responses.append(_stream_response(body))

    with pytest.raises(AIError) as raised:
        await _generate()

    assert type(raised.value) is AIError
    assert str(raised.value) == "The AI provider returned an error (HTTP 529). Try again in a few minutes."


async def test_a_connection_that_drops_mid_stream(anthropic_api):
    class DroppedStream(httpx2.AsyncByteStream):
        async def __aiter__(self):
            yield _sse([_start()])
            raise httpx2.RemoteProtocolError("peer closed connection without sending complete message body")

    anthropic_api.responses.append(
        httpx2.Response(200, headers={"content-type": "text/event-stream"}, stream=DroppedStream()),
    )

    with pytest.raises(AIError) as raised:
        await _generate()

    assert type(raised.value) is AIError
    assert str(raised.value) == "The connection to the AI provider dropped. Try again in a few minutes."


async def test_an_unreachable_provider(anthropic_api):
    anthropic_api.responses += [httpx2.ConnectError("connection refused") for _ in range(claude.MAX_RETRIES + 1)]

    with pytest.raises(AIError) as raised:
        await _generate()

    assert type(raised.value) is AIError
    assert str(raised.value) == "Couldn't reach the AI provider. Try again in a few minutes."
    assert len(anthropic_api.requests) == claude.MAX_RETRIES + 1


async def test_a_request_that_times_out(anthropic_api):
    anthropic_api.responses += [httpx2.ReadTimeout("timed out") for _ in range(claude.MAX_RETRIES + 1)]

    with pytest.raises(AITimeout) as raised:
        await _generate()

    assert (raised.value.status_code, raised.value.retryable) == (504, True)
    assert str(raised.value) == "The AI request timed out. Operations with web research can take several minutes; try again."


async def test_the_whole_call_has_a_deadline(anthropic_api, monkeypatch):
    monkeypatch.setattr(claude, "CALL_DEADLINE_SECONDS", 0.05)

    async def slow(request):
        await asyncio.sleep(5)
        return _answer(SUMMARY)

    anthropic_api.responses.append(slow)

    with pytest.raises(AITimeout) as raised:
        await _generate()

    assert str(raised.value) == "The AI request timed out. Operations with web research can take several minutes; try again."


# ─── Usage ledger ───


async def test_every_response_is_recorded_in_the_organisations_ledger(anthropic_api, client, register, auth, create_product):
    from decimal import Decimal

    import database
    from services.claude import UsageContext

    token, user = await register("ana@example.com")
    product = await create_product(token)
    org_id = product["org_id"]
    paused = _message([SEARCH], stop_reason="pause_turn", usage={"server_tool_use": {"web_search_requests": 1}})
    anthropic_api.responses += [paused, _submitted(SUMMARY, usage={"cache_read_input_tokens": 1000})]

    await _generate(web_search=True, usage=UsageContext(org_id=org_id, user_id=user["id"], product_id=product["id"], operation="trend"))

    pool = await database.get_pool()
    rows = await pool.fetch("SELECT * FROM ai_usage ORDER BY id")
    assert [
        (r["operation"], r["model"], r["input_tokens"], r["output_tokens"], r["cache_read_input_tokens"],
         r["web_search_requests"], r["stop_reason"], r["request_id"])
        for r in rows
    ] == [
        ("trend", "claude-sonnet-5", 120, 480, 0, 1, "pause_turn", "req_test"),
        ("trend", "claude-sonnet-5", 120, 480, 1000, 0, "tool_use", "req_test"),
    ]
    # $2 per million input tokens, $10 per million output tokens, $0.20 per million cached tokens read,
    # and $10 per 1,000 web searches
    assert [r["cost_usd"] for r in rows] == [Decimal("0.015040"), Decimal("0.005240")]
    assert {str(r["org_id"]) for r in rows} == {org_id}


async def test_a_ledger_that_cant_be_written_doesnt_lose_the_answer(anthropic_api, client, caplog):
    from services.claude import UsageContext

    anthropic_api.responses.append(_answer(SUMMARY))
    missing_org = UsageContext(org_id="00000000-0000-4000-8000-000000000000", user_id="", product_id=None, operation="seo")

    assert await _generate(usage=missing_org) == SUMMARY
    assert "Couldn't record AI usage for seo" in caplog.text
