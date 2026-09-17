"""Claude AI service for LaunchOps: the API client, brand context and prompts.

generate_result() is the only way the app talks to Claude. It uses the official Anthropic SDK and:

- asks for the operation's structured result (services/results.py) and validates it before returning it:
  operations without web search get a response format; operations that search the web end by calling a
  strict submit_result tool, because web search always cites and citations can't be combined with a
  response format (docs/PHASE1_DESIGN.md D11);
- sends the system prompt in parts, most stable first, and caches the stable parts (D13);
- streams every request, so long web-research reports never hit an HTTP read timeout;
- lets the SDK retry rate limits, overloads and failed connections (MAX_RETRIES);
- resumes turns that server-side web search paused (stop_reason "pause_turn"), up to MAX_CONTINUATIONS;
- stops the whole call, retries and resumes included, after CALL_DEADLINE_SECONDS;
- records every API response in the organisation's usage ledger (D12);
- raises AIError subclasses whose message is written for the person running the operation.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import cache, lru_cache
from urllib.parse import urlsplit, urlunsplit

import anthropic
import httpx2
from pydantic import ValidationError

from config import get_settings
from services import results
from services import usage as ledger

logger = logging.getLogger(__name__)

# Room for adaptive thinking plus a full result. Market analysis asks for more.
DEFAULT_MAX_TOKENS = 16_000
MAX_RETRIES = 3
# Server-side web search pauses a turn after 10 of its own steps; each resume allows 10 more.
MAX_CONTINUATIONS = 5
# A job attempt is stopped after JOB_TIMEOUT_MINUTES (15 by default), so every call ends well before that.
CALL_DEADLINE_SECONDS = 10 * 60

# Models that support web search with dynamic filtering. Any other model gets the basic tool.
DYNAMIC_WEB_SEARCH_MODELS = frozenset({
    "claude-opus-5", "claude-fable-5", "claude-sonnet-5",
    "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6",
})
# Models whose safety classifiers can decline a request. They opt in to Anthropic re-running a
# declined request on its recommended fallback model instead of returning the refusal.
SERVER_FALLBACK_MODELS = frozenset({"claude-opus-5", "claude-fable-5-1"})
SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01"

# A prompt cache entry (5 minutes, renewed by every read)
CACHE_POINT = {"type": "ephemeral"}
SUBMIT_TOOL = "submit_result"
# Stop reasons that mean the answer was cut off before it was complete
CUT_OFF = frozenset({"max_tokens", "model_context_window_exceeded"})

# The HTTP status an error event in the middle of a stream stands for (the stream itself was a 200).
STREAM_ERROR_STATUS = {
    "invalid_request_error": 400,
    "authentication_error": 401,
    "permission_error": 403,
    "not_found_error": 404,
    "request_too_large": 413,
    "rate_limit_error": 429,
    "api_error": 500,
    "overloaded_error": 529,
}

TIMEOUT_MESSAGE = "The AI request timed out. Operations with web research can take several minutes; try again."
UNFINISHED_RESEARCH_MESSAGE = "The web research for this operation didn't finish. Try again, or narrow the instructions."
REFUSAL_MESSAGE = "The AI declined this request. Change the instructions or the project details and try again."
RETRY_LATER_MESSAGE = "The AI provider returned an error (HTTP {status}). Try again in a few minutes."
CUT_OFF_MESSAGE = "The AI's answer was too long and was cut off. Try again with narrower instructions."
NO_RESULT_MESSAGE = "The AI finished without returning a result. Try again."
MALFORMED_RESULT_MESSAGE = "The AI's result didn't have the expected structure. Try again."

# Part of every operation's cached instructions
PLACEHOLDER_RULE = (
    "Never output placeholder text like '[current date]', '[City]', or '[Company Name]'. "
    "Always use the actual values provided in the context below."
)
SUBMIT_INSTRUCTION = (
    f"When your research is complete, call the {SUBMIT_TOOL} tool once with the complete result. "
    "The tool's input is the result, so don't write the result out as a message as well. "
    "In sources, list the pages from your searches that the result relies on, with each URL exactly as the search returned it."
)
SUBMIT_REMINDER = f"Call {SUBMIT_TOOL} now with the complete result, based on your research so far."


@dataclass(frozen=True)
class UsageContext:
    """Who a call is for, so its usage lands in the organisation's ledger (services/usage.py)."""

    org_id: str
    user_id: str
    product_id: str | None
    operation: str


@dataclass(frozen=True)
class Prompt:
    """A system prompt in three parts, most stable first, so the API can cache the stable ones (D13)."""

    #: What the operation does. The same for every project, so its cache serves every project.
    instructions: str
    #: The brand, company and project (build_brand_context): the same for every run on a project, and cached.
    context: str = ""
    #: This run's material, such as a scraped page, notes and today's date (run_details). Never cached.
    details: str = ""

    def text(self) -> str:
        return "\n\n".join(part for part in (self.instructions, self.context, self.details) if part)


class AIError(Exception):
    """An AI call that produced no usable result. The message is written for the person who ran the operation.

    status_code is the HTTP status a request/response endpoint answers with. retryable says whether running
    the operation again later might succeed, so background jobs know whether to try again.
    """

    status_code = 502
    retryable = True


class AIUnavailable(AIError):
    """LaunchOps can't use the AI service: no API key, a rejected key, or a model that isn't available."""

    status_code = 503
    retryable = False


class AITimeout(AIError):
    """The call ran out of time, or web research didn't finish within MAX_CONTINUATIONS resumes."""

    status_code = 504


class AIRefused(AIError):
    """The model declined the request (and so did its fallback, where the model has one)."""

    status_code = 422
    retryable = False


class AIRejected(AIError):
    """The API rejected the request itself as invalid, which sending it again won't change."""

    retryable = False


class AIIncomplete(AIError):
    """The answer reached its length limit before the result was complete."""

    retryable = False


def _new_client(api_key: str, http_client: httpx2.AsyncClient | None = None) -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=api_key, max_retries=MAX_RETRIES, http_client=http_client)


@lru_cache(maxsize=2)
def _client(api_key: str) -> anthropic.AsyncAnthropic:
    """One client, and so one connection pool, per API key for the life of the process."""
    return _new_client(api_key)


def web_search_tool(model: str) -> dict:
    """The server-side web search tool in the newest version the model supports."""
    tool_type = "web_search_20260209" if model in DYNAMIC_WEB_SEARCH_MODELS else "web_search_20250305"
    return {"type": tool_type, "name": "web_search"}


@cache
def result_schema(result_type: type[results.Result]) -> dict:
    """The JSON schema of a result, in the form structured outputs accept. Built once, so every request
    sends identical bytes and the prompt cache holds."""
    return anthropic.transform_schema(result_type)


def submit_tool(result_type: type[results.Result]) -> dict:
    """The strict tool a web-research operation calls with its finished result."""
    return {
        "name": SUBMIT_TOOL,
        "description": "Submit the finished result of this operation. Call it once, when your research is complete.",
        "input_schema": result_schema(result_type),
        "strict": True,
        # A result can run to thousands of tokens: stream it as it's written rather than after the API has
        # buffered all of it. The input is validated here instead (_submission, _validated).
        "eager_input_streaming": True,
    }


def system_blocks(prompt: Prompt, *, web_search: bool) -> list[dict]:
    """The system prompt as text blocks, with a cache point after the instructions and after the context."""
    instructions = f"{prompt.instructions}\n\n{PLACEHOLDER_RULE}"
    if web_search:
        instructions += f"\n\n{SUBMIT_INSTRUCTION}"
    blocks = [{"type": "text", "text": instructions, "cache_control": CACHE_POINT}]
    if prompt.context:
        blocks.append({"type": "text", "text": prompt.context, "cache_control": CACHE_POINT})
    if prompt.details:
        blocks.append({"type": "text", "text": prompt.details})
    return blocks


def section(heading: str, body: str) -> str:
    """A headed section of a prompt's details, or nothing when there's nothing under the heading."""
    return f"# {heading}\n{body}" if body.strip() else ""


def run_details(*sections: str) -> str:
    """The part of a prompt that belongs to one run: the given sections (see section()), then today's date."""
    return "\n\n".join([*(part for part in sections if part), f"# Today's Date: {datetime.now(UTC):%B %d, %Y}"])


async def generate_result(
    prompt: Prompt,
    user_message: str,
    result_type: type[results.Result],
    *,
    web_search: bool = False,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    model: str | None = None,
    usage: UsageContext | None = None,
) -> dict:
    """Ask Claude for an operation's result and return it validated, as it's stored (Result.stored).

    model defaults to CLAUDE_MODEL. With `usage`, every API response is recorded in the ledger.
    Raises AIError (or a subclass) when there's no complete, valid result.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise AIUnavailable("The AI service isn't available: ANTHROPIC_API_KEY not configured")
    model = model or settings.claude_model

    request: dict = {"model": model, "max_tokens": max_tokens, "system": system_blocks(prompt, web_search=web_search)}
    if web_search:
        request["tools"] = [web_search_tool(model), submit_tool(result_type)]
        # Each resume and follow-up sends the whole turn so far again; cache it as it grows
        request["cache_control"] = CACHE_POINT
    else:
        request["output_config"] = {"format": {"type": "json_schema", "schema": result_schema(result_type)}}
    if model in SERVER_FALLBACK_MODELS:
        request["betas"] = [SERVER_FALLBACK_BETA]
        request["fallbacks"] = "default"

    question = {"role": "user", "content": user_message}
    retrieved: dict[str, dict] = {}
    try:
        async with asyncio.timeout(CALL_DEADLINE_SECONDS):
            client = _client(settings.anthropic_api_key)
            if web_search:
                answer = await _researched(client, request, question, usage, retrieved)
            else:
                answer = await _formatted(client, request, question, usage)
    except TimeoutError:
        raise AITimeout(TIMEOUT_MESSAGE) from None
    result = _validated(result_type, answer)
    if "sources" in result:
        result["sources"] = _verified_sources(result["sources"], retrieved)
    return result


async def _formatted(client: anthropic.AsyncAnthropic, request: dict, question: dict, usage: UsageContext | None) -> str:
    """An operation without web search answers with the result as JSON text, in the requested format."""
    turn, message = await _converse(client, request, [question], usage)
    if message.stop_reason in CUT_OFF:
        raise AIIncomplete(CUT_OFF_MESSAGE)
    return _answer_text(turn)


async def _researched(
    client: anthropic.AsyncAnthropic, request: dict, question: dict, usage: UsageContext | None, retrieved: dict[str, dict],
) -> dict:
    """An operation with web search ends its research by calling submit_result with the result. If it ends
    without calling it, Claude is asked once, in the same conversation, to submit what it found.
    Every page the searches returned is added to `retrieved`."""
    turn, message = await _converse(client, request, [question], usage)
    retrieved.update(_retrieved_pages(turn))
    submitted = _submission(turn, message)
    if submitted is None:
        logger.info("Claude finished its research without submitting a result; asking for it")
        reminder = [question, {"role": "assistant", "content": turn}, {"role": "user", "content": SUBMIT_REMINDER}]
        turn, message = await _converse(client, request, reminder, usage)
        retrieved.update(_retrieved_pages(turn))
        submitted = _submission(turn, message)
    if submitted is None:
        raise AIError(NO_RESULT_MESSAGE)
    return submitted


def _page_key(url: str) -> str:
    """A URL in the form used to match a listed source to a search result: case-insensitive scheme and
    host, no trailing slash or fragment."""
    parts = urlsplit(url.strip())
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), parts.query, ""))


def _retrieved_pages(turn: list) -> dict[str, dict]:
    """The pages web search returned during a turn, as sources, by _page_key."""
    pages: dict[str, dict] = {}
    for block in turn:
        if block.type == "web_search_tool_result" and isinstance(block.content, list):
            for page in block.content:
                pages.setdefault(_page_key(page.url), {"title": page.title, "url": page.url, "page_age": page.page_age})
    return pages


def _verified_sources(listed: list[dict], retrieved: dict[str, dict]) -> list[dict]:
    """The sources a result lists that its searches actually returned, once each and as the search returned
    them. A page no search returned can't be checked, so it isn't kept."""
    verified: dict[str, dict] = {}
    for source in listed:
        key = _page_key(source["url"])
        if key in retrieved:
            verified.setdefault(key, retrieved[key])
    if len(verified) < len(listed):
        logger.info("Kept %d of the %d sources listed; the rest weren't among the pages searched", len(verified), len(listed))
    return list(verified.values())


def _submission(turn: list, message) -> dict | None:
    """The input of the turn's submit_result call, or None. A turn that was cut off has no usable result:
    its last tool input can be incomplete even when it parses."""
    if message.stop_reason in CUT_OFF:
        raise AIIncomplete(CUT_OFF_MESSAGE)
    calls = [block for block in turn if block.type == "tool_use" and block.name == SUBMIT_TOOL]
    return calls[-1].input if calls else None


def _validated(result_type: type[results.Result], answer: str | dict) -> dict:
    try:
        if isinstance(answer, str):
            result = result_type.model_validate_json(answer)
        else:
            result = result_type.model_validate(answer)
    except ValidationError as error:
        logger.warning("Claude's %s didn't validate: %s", result_type.__name__, error)
        raise AIError(MALFORMED_RESULT_MESSAGE) from None
    return result.stored()


async def _converse(client: anthropic.AsyncAnthropic, request: dict, messages: list[dict], usage: UsageContext | None):
    """Run the request, resuming it while server-side tools pause the turn.

    Returns every content block of Claude's turn, across resumes, and the last message.
    """
    turn: list = []
    for resumes in range(MAX_CONTINUATIONS + 1):
        sent = [*messages, {"role": "assistant", "content": turn}] if turn else messages
        message, request_id = await _stream(client, {**request, "messages": sent})
        if usage:
            await ledger.record(usage, message.model, message.usage, message.stop_reason, request_id)
        turn.extend(message.content)
        logger.info(
            "Claude %s answered: stop_reason=%s input_tokens=%s cache_read_input_tokens=%s output_tokens=%s resumes=%d request_id=%s",
            message.model, message.stop_reason, message.usage.input_tokens,
            getattr(message.usage, "cache_read_input_tokens", None), message.usage.output_tokens, resumes, request_id,
        )
        if message.stop_reason == "refusal":
            raise AIRefused(REFUSAL_MESSAGE)
        if message.stop_reason != "pause_turn":
            if message.stop_reason in CUT_OFF:
                logger.warning(
                    "Claude's answer was cut off (stop_reason=%s, max_tokens=%s)", message.stop_reason, request["max_tokens"],
                )
            return turn, message
    raise AITimeout(UNFINISHED_RESEARCH_MESSAGE)


async def _stream(client: anthropic.AsyncAnthropic, request: dict):
    """One streamed Messages API request: (final message, request id). Every failure becomes an AIError."""
    try:
        async with client.beta.messages.stream(**request) as stream:
            return await stream.get_final_message(), stream.request_id
    except anthropic.APIStatusError as error:
        raise _status_error(error, request["model"]) from error
    except anthropic.APITimeoutError as error:
        raise AITimeout(TIMEOUT_MESSAGE) from error
    except anthropic.APIConnectionError as error:
        raise AIError("Couldn't reach the AI provider. Try again in a few minutes.") from error
    except httpx2.TimeoutException as error:
        raise AITimeout(TIMEOUT_MESSAGE) from error
    except httpx2.TransportError as error:
        # Raised while reading a stream that had already started, which the SDK doesn't retry or wrap
        raise AIError("The connection to the AI provider dropped. Try again in a few minutes.") from error
    except ValueError as error:
        # A streamed tool input that isn't valid JSON (eager input streaming leaves the checking to the client)
        raise AIError(MALFORMED_RESULT_MESSAGE) from error


def _status_error(error: anthropic.APIStatusError, model: str) -> AIError:
    body = error.body if isinstance(error.body, dict) else {}
    details = body.get("error") if isinstance(body.get("error"), dict) else {}
    status = error.status_code
    if status < 400:
        # An error event inside a stream that started with 200
        status = STREAM_ERROR_STATUS.get(details.get("type"), 500)
    if status == 401:
        return AIUnavailable("The AI service isn't available: the Anthropic API key was rejected.")
    if status == 403:
        return AIUnavailable("The AI service isn't available: the Anthropic API key doesn't have access to this request.")
    if status == 404:
        return AIUnavailable(
            f"The AI service isn't available: the model {model} wasn't found. Check CLAUDE_MODEL and CLAUDE_REPORT_MODEL."
        )
    if status in (400, 413, 422):
        reason = details.get("message") or "the request isn't valid"
        return AIRejected(f"The AI provider rejected the request (HTTP {status}): {reason}")
    return AIError(RETRY_LATER_MESSAGE.format(status=status))


def _answer_text(blocks: list) -> str:
    """The text of an answer in a response format, leaving out its thinking."""
    return "".join(block.text for block in blocks if block.type == "text")


# ──────────────────────────────────────────────
# BRAND CONTEXT BUILDER
# The brand voice, company, product and output
# preferences behind every operation's prompt.
# ──────────────────────────────────────────────


def build_brand_context(
    product: dict,
    brand: dict | None = None,
    prefs: dict | None = None,
    brand_override: dict | None = None,
) -> str:
    """Build the brand context part of a prompt (Prompt.context).

    brand_override: a full brand row from the brands table, used when a
    product has an assigned brand. Takes priority over global brand settings.
    Nothing here changes from one run to the next, so the API can cache it.
    """
    brand = brand or {}
    prefs = prefs or {}

    # If a brand is assigned to this product, use its data
    b = brand_override or brand
    # Company details come from the assigned brand if available, else from product
    company = {}
    if brand_override:
        company = {
            "company_name": brand_override.get("company_name", ""),
            "location": brand_override.get("location", ""),
            "founded": brand_override.get("founded", ""),
            "industry": brand_override.get("industry", ""),
            "company_size": brand_override.get("company_size", ""),
            "founder_name": brand_override.get("founder_name", ""),
            "founder_title": brand_override.get("founder_title", ""),
            "phone": brand_override.get("phone", ""),
            "email": brand_override.get("email", ""),
            "boilerplate": brand_override.get("boilerplate", ""),
        }
    else:
        company = product.get("company_details") or {}

    # Handle keywords/avoid as either list or JSONB
    kw = b.get("keywords", [])
    if isinstance(kw, str):
        kw = [kw]
    avoid = b.get("avoid", [])
    if isinstance(avoid, str):
        avoid = [avoid]

    sections = [
        "# Brand Context",
        f"Brand: {b.get('name', '')}",
        f"Tagline: {b.get('tagline', '')}",
        f"Elevator: {b.get('elevator', '')}",
        f"Tone: {b.get('tone', 'professional')}",
        f"Keywords to weave in: {', '.join(kw)}",
        f"Phrases to AVOID: {', '.join(avoid)}",
        "",
        "# Company Details",
        f"Company Name: {company.get('company_name', b.get('name', ''))}",
        f"Location: {company.get('location', '')}",
        f"Founded: {company.get('founded', '')}",
        f"Industry: {company.get('industry', '')}",
        f"Company Size: {company.get('company_size', '')}",
        f"Founder/CEO: {company.get('founder_name', '')}",
        f"Founder Title: {company.get('founder_title', '')}",
        f"Company Phone: {company.get('phone', '')}",
        f"Company Email: {company.get('email', '')}",
        f"Boilerplate: {company.get('boilerplate', '')}",
        "",
        "# Product Context",
        f"Product: {product.get('name', '')}",
        f"Tagline: {product.get('tagline', '')}",
        f"URL: {product.get('url', '')}",
        f"Description: {product.get('description', '')}",
        f"Keywords: {', '.join(product.get('keywords', []))}",
        f"Status: {product.get('status', 'pre_launch')}",
        f"Type: {product.get('project_type', 'product')}",
        "",
        "# Output Preferences",
        f"Research depth: {prefs.get('depth', 'thorough')}",
        f"Content length: {prefs.get('length', 'medium')}",
        f"Include emoji: {prefs.get('emoji', True)}",
        f"Hashtag style: {prefs.get('hashtags', 'moderate')}",
        f"Cite sources: {prefs.get('sources', True)}",
    ]
    return "\n".join(sections)


# ──────────────────────────────────────────────
# WORKFLOW PROMPTS
# Each background workflow: its instructions,
# whether it researches the web, and its result.
# ──────────────────────────────────────────────

WORKFLOW_PROMPTS = {
    "competitor": {
        "instructions": """You are a competitive intelligence analyst. Your job is to find and
analyze REAL, SPECIFIC competitors to the product described in the context below.

CRITICAL INSTRUCTIONS:
- Use web search to find ACTUAL competitors by name, with real URLs and pricing
- NEVER use placeholder names like "[Competitor A]" or vague descriptions
- NEVER say "various competitors exist" — NAME THEM with real details
- Include at least 5 specific competitors with their actual product names, URLs, and pricing
- Research each competitor's actual features, pricing pages, and market position""",
        "web_search": True,
        "result": results.CompetitorResult,
    },

    "trend": {
        "instructions": """You are a market trend analyst for creative technology products.
Research current trends in the product's market space. Cover: emerging trends,
declining trends, key players, market size indicators, and opportunities.""",
        "web_search": True,
        "result": results.TrendResult,
    },

    "cold_outreach": {
        "instructions": """You are an expert outreach copywriter. Draft personalized cold
outreach emails for press, influencers, or potential partners. Each email
should feel genuine, reference the recipient's work, and clearly communicate
the value proposition.""",
        "web_search": False,
        "result": results.ColdOutreachResult,
    },

    "partnerships": {
        "instructions": """You are a business development specialist finding partnership
opportunities. Identify companies, creators, and organizations that would
benefit from partnering with this product. Consider cross-promotion,
integration, bundle, and co-marketing opportunities.""",
        "web_search": True,
        "result": results.PartnershipsResult,
    },

    "social_posts": {
        "instructions": """You are a social media content strategist for tech/creative products.
Generate platform-specific social media posts. Each post should match the
platform's culture, format, and best practices.

Generate 3-5 posts per platform requested.""",
        "web_search": False,
        "result": results.SocialPostsResult,
    },

    "ad_copy": {
        "instructions": """You are a direct response copywriter specializing in digital ads.
Create A/B test-ready ad copy sets for the product. Include headlines,
body copy, and CTAs optimized for conversion.""",
        "web_search": False,
        "result": results.AdCopyResult,
    },

    "blog": {
        "instructions": """You are an SEO-aware content writer for technology products.
Draft a blog post that drives organic traffic while being genuinely
useful and engaging. Include meta description and suggested internal links.""",
        "web_search": True,
        "result": results.BlogResult,
    },

    "announcement": {
        "instructions": """You are a product marketing writer crafting launch and update
announcements. Write compelling copy that creates excitement while clearly
communicating value. Generate versions for email, blog, social, and a press release.""",
        "web_search": False,
        "result": results.AnnouncementResult,
    },

    "reddit": {
        "instructions": """You are a community marketing specialist who understands Reddit culture.
Find relevant subreddits and craft community-appropriate posts. Be honest about
self-promotion rules — flag which communities allow it and which don't.""",
        "web_search": True,
        "result": results.RedditResult,
    },

    "directories": {
        "instructions": """You are a growth marketer finding free product directories and listing
sites. Focus on directories relevant to the product's niche, with real traffic.""",
        "web_search": True,
        "result": results.DirectoriesResult,
    },

    "launch_platforms": {
        "instructions": """You are a launch strategist identifying the best platforms for a
product launch. Cover Product Hunt, Hacker News, Indie Hackers, BetaList,
and niche-specific platforms. Include timing and preparation tips.""",
        "web_search": True,
        "result": results.LaunchPlatformsResult,
    },

    "podcasts": {
        "instructions": """You are a PR specialist finding podcast guest opportunities.
Identify podcasts where the founder could be a guest to promote the product.
Focus on shows with relevant audiences.""",
        "web_search": True,
        "result": results.PodcastsResult,
    },
}


# ──────────────────────────────────────────────
# REPORT AND TOOL INSTRUCTIONS
# Press kit, press release, SEO, repurpose,
# pricing and market analysis. Each run's
# material goes in the prompt's details.
# ──────────────────────────────────────────────


PRESS_KIT_INSTRUCTIONS = """You are a PR professional creating a press kit for a software product.
Given the scraped content from the product's website (below), create a complete press kit."""


PRESS_RELEASE_INSTRUCTIONS = """You are an experienced PR writer crafting a professional press release.
Using the scraped content from the product's website and the contact information provided below,
write a complete, publication-ready press release.

Write a professional press release following standard format:
1. Headline (attention-grabbing, factual)
2. Subheadline (supporting detail)
3. Dateline (city, date)
4. Lead paragraph (who, what, when, where, why)
5. Body paragraphs (details, features, quotes, market context)
6. Boilerplate (about the company)
7. Contact information block

For the distribution channels, use web search to find SPECIFIC, REAL resources relevant
to this product's industry. Each channel must include real contact details where available.
Look for press release distribution services, industry-specific news outlets, relevant
journalists, tech blogs, and directories that accept press releases in this space."""


SEO_ANALYSIS_INSTRUCTIONS = """You are an SEO specialist analyzing a website's metadata and
generating optimized alternatives.

Analyze the current page metadata (below) and generate optimized versions. Consider:
1. Title tag optimization (50-60 chars, keyword-rich)
2. Meta description (150-160 chars, compelling with CTA)
3. Open Graph tags for social sharing
4. Twitter Card tags
5. Canonical URL
6. JSON-LD structured data (SoftwareApplication schema)
7. Keyword optimization"""


REPURPOSE_INSTRUCTIONS = """You are a content repurposing expert who adapts content for different platforms.

Adapt the original content (below) for each target platform, respecting:
- Twitter/X: 280 chars, punchy, thread-friendly, relevant hashtags
- Instagram: Visual description + caption, 2200 char limit, hashtag clusters
- LinkedIn: Professional tone, industry insights, thought leadership
- Reddit: Community-first, authentic, anti-self-promo tone
- TikTok: Script format, hook-first, trendy language
- Facebook: Conversational, shareable, community-building"""


PRICING_INSTRUCTIONS = """You are a pricing strategist for software products.

Research competitors and the market to suggest a pricing strategy. Consider:
1. Competitor pricing analysis
2. Value-based pricing principles
3. Freemium vs paid conversion rates in this market
4. Launch pricing strategy
5. Annual vs monthly discount"""


MARKET_ANALYSIS_INSTRUCTIONS = """You are a senior market analyst producing a comprehensive market
analysis report for a software/technology product.

CRITICAL INSTRUCTIONS:
- Use web search to find REAL, SPECIFIC data — actual company names, real pricing, real URLs
- NEVER use placeholder names or vague statements like "various competitors"
- Include actual numbers, percentages, and dollar amounts wherever possible
- Base revenue projections on the pricing context provided below

Produce a thorough market analysis covering these sections:

## A. Key Players
Identify the top 8-10 competitors in this space. For each, provide their actual name,
URL, what they do, their estimated market share or user base, funding/revenue if public,
and their primary differentiator.

## B. Pricing Benchmarks
Analyze real pricing across the market. Show what competitors actually charge, common
pricing models (subscription, perpetual, freemium, usage-based), price ranges by tier,
and where the product should position itself.

## C. Competitive Differentiation
Based on the product description and competitor research, identify what SPECIFICALLY
sets this product apart. Be concrete — not generic statements like "better UX" but
specific features, approaches, or positioning that competitors don't offer.

## D. Barriers to Entry
What makes it hard for new competitors to enter this market? Consider technical barriers,
network effects, switching costs, brand loyalty, regulatory requirements, and capital needs.

## E. Revenue Projections
Using the pricing provided, project revenue for Year 1, Year 2, and Year 3 under three
scenarios (conservative, moderate, aggressive). Show user/customer acquisition assumptions,
conversion rates, churn estimates, and monthly recurring revenue growth. Base projections
on realistic market penetration rates for this industry.

## F. Target Customer Segments
Identify 4-6 specific customer segments with: segment name, description, estimated
segment size, willingness to pay, acquisition channel, and priority ranking.

Finish with an executive summary of the market opportunity."""
