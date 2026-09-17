"""Estimated cost of Claude API calls (docs/PHASE1_DESIGN.md D12).

Prices are Anthropic's published prices on the Claude API, in US dollars, as documented in September 2026:
per million tokens by model, and $10 per 1,000 web searches on top of the tokens. Cache writes (5-minute
entries) cost 1.25 times the input price; cache reads cost 0.1 times, except where a model's own rate is
published. A model not listed has no estimate (None), so it's never silently counted as free.
"""

from dataclasses import dataclass
from decimal import Decimal

PER_MILLION = Decimal(1_000_000)
CACHE_WRITE_MULTIPLIER = Decimal("1.25")
CACHE_READ_MULTIPLIER = Decimal("0.1")
WEB_SEARCH_PRICE = Decimal(10) / Decimal(1000)


@dataclass(frozen=True)
class Price:
    input: Decimal
    output: Decimal
    cache_read_multiplier: Decimal = CACHE_READ_MULTIPLIER


# Longest matching prefix wins, so dated IDs (claude-haiku-4-5-20251001) find their model
MODEL_PRICES: dict[str, Price] = {
    "claude-fable-5-1": Price(Decimal(10), Decimal(50), cache_read_multiplier=Decimal("0.025")),
    "claude-mythos-5-1": Price(Decimal(10), Decimal(50), cache_read_multiplier=Decimal("0.025")),
    "claude-fable-5": Price(Decimal(10), Decimal(50)),
    "claude-opus-5": Price(Decimal(5), Decimal(25)),
    "claude-opus-4-8": Price(Decimal(5), Decimal(25)),
    "claude-sonnet-5": Price(Decimal(2), Decimal(10)),
    "claude-sonnet-4-6": Price(Decimal(3), Decimal(15)),
    "claude-haiku-4-5": Price(Decimal(1), Decimal(5)),
}


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0


def price_for(model: str) -> Price | None:
    matches = [prefix for prefix in MODEL_PRICES if model == prefix or model.startswith(f"{prefix}-")]
    return MODEL_PRICES[max(matches, key=len)] if matches else None


def cost_usd(model: str, usage: TokenUsage, web_search_requests: int = 0) -> Decimal | None:
    """The call's estimated cost, or None when the model's price isn't known."""
    price = price_for(model)
    if price is None:
        return None
    tokens = (
        usage.input_tokens * price.input
        + usage.output_tokens * price.output
        + usage.cache_creation_input_tokens * price.input * CACHE_WRITE_MULTIPLIER
        + usage.cache_read_input_tokens * price.input * price.cache_read_multiplier
    ) / PER_MILLION
    return tokens + web_search_requests * WEB_SEARCH_PRICE
