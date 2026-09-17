"""Structured AI results (services/results.py, docs/PHASE1_DESIGN.md D11)."""

import inspect
import json

import pytest
from pydantic import Field

from services import results
from services.claude import WORKFLOW_PROMPTS

RESULT_TYPES = sorted(
    (cls for _, cls in inspect.getmembers(results, inspect.isclass) if issubclass(cls, results.Result) and cls is not results.Result),
    key=lambda cls: cls.__name__,
)
# What a schema may use and still be accepted exactly as written: no unions, defaults, formats or limits
SCHEMA_KEYWORDS = {"type", "properties", "required", "additionalProperties", "items", "enum", "description", "title", "$ref", "$defs"}


def _objects(schema: dict):
    """Every object schema inside a schema, and every keyword used anywhere in it."""
    keywords = set(schema)
    objects = [schema] if schema.get("type") == "object" else []
    children = [*schema.get("properties", {}).values(), *schema.get("$defs", {}).values()]
    if "items" in schema:
        children.append(schema["items"])
    for child in children:
        child_objects, child_keywords = _objects(child)
        objects += child_objects
        keywords |= child_keywords
    return objects, keywords


def test_every_operation_has_a_result_type():
    used = {prompt["result"] for prompt in WORKFLOW_PROMPTS.values()} | {
        results.PressKitResult, results.PressReleaseResult, results.SeoResult, results.RepurposeResult,
        results.PricingResult, results.MarketAnalysisResult,
    }
    assert used == set(RESULT_TYPES)


def test_the_schema_check_catches_what_structured_outputs_would_not_keep():
    class Loose(results.Result):
        level: int = Field(default=5, ge=1)
        note: str | None = None

    objects, keywords = _objects(Loose.model_json_schema())

    assert {"default", "minimum", "anyOf"} <= keywords
    assert "required" not in objects[0]


@pytest.mark.parametrize("result_type", RESULT_TYPES, ids=lambda cls: cls.__name__)
def test_result_schemas_stay_within_what_structured_outputs_accept(result_type):
    objects, keywords = _objects(result_type.model_json_schema())

    assert keywords <= SCHEMA_KEYWORDS, "the API would drop or reject these; the SDK moves them into descriptions"
    for schema in objects:
        # Closed objects whose fields are all required: no optional parameters to count against the API's limits
        assert schema["additionalProperties"] is False
        assert sorted(schema["required"]) == sorted(schema["properties"])


WEB_RESEARCH_RESULTS = {prompt["result"] for prompt in WORKFLOW_PROMPTS.values() if prompt["web_search"]} | {
    results.PressReleaseResult, results.PricingResult, results.MarketAnalysisResult,
}


@pytest.mark.parametrize("result_type", RESULT_TYPES, ids=lambda cls: cls.__name__)
def test_results_of_web_research_list_their_sources_last(result_type):
    fields = list(result_type.model_fields)
    if result_type in WEB_RESEARCH_RESULTS:
        assert fields[-1] == "sources", "sources come last, once the result they support is written"
        assert result_type.model_fields["sources"].annotation == list[results.Source]
    else:
        assert "sources" not in fields, "only web research has pages to cite"


def test_results_reject_fields_they_dont_have():
    with pytest.raises(ValueError, match="extra"):
        results.BlogResult.model_validate({
            "title": "T", "meta_description": "M", "outline": [], "full_content": "C", "suggested_keywords": [],
            "word_count": 1, "hero_image": "x",
        })


def _seo(json_ld: str) -> results.SeoResult:
    optimized = dict.fromkeys(results.OptimizedMetadata.model_fields, "") | {"json_ld": json_ld}
    return results.SeoResult(current_score=40, optimized_score=90, issues=[], optimized=optimized, head_block="<title>")


def test_seo_structured_data_is_stored_as_an_object_when_it_is_json():
    json_ld = json.dumps({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Launch Ops"})

    assert _seo(json_ld).stored()["optimized"]["json_ld"] == {
        "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Launch Ops",
    }
    # The report shows text that isn't JSON as it is
    assert _seo("SoftwareApplication: Launch Ops").stored()["optimized"]["json_ld"] == "SoftwareApplication: Launch Ops"
