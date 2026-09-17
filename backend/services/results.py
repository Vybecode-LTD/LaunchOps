"""The structured result of every AI operation (docs/PHASE1_DESIGN.md D11).

Each operation's result is a Pydantic model. Its JSON schema goes to the Anthropic API: as the response
format for operations that don't search the web, or as the input schema of the strict submit tool for
operations that do (web search always cites, and citations can't be combined with a response format).
Either way the answer arrives complete and in shape, and it's validated here again before it's stored.
The field descriptions are part of the prompt: they tell the model what each field holds.

Schemas stay within what structured outputs accept: every object is closed, every field is required,
and there are no unions or numeric and string limits. Stored results keep the keys they always had
(Result.stored), so the interface renders results from before and after this change the same way.

Results of web research end with their sources: the pages the result relies on. services/claude.py keeps
only pages the operation's searches actually returned.
"""

import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Item(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Result(Item):
    """The result of one operation."""

    def stored(self) -> dict:
        """The result as it's stored and returned: plain JSON values."""
        return self.model_dump(mode="json")


Level = Literal["high", "medium", "low"]


class Source(Item):
    title: str = Field(description="The page's title")
    url: str = Field(description="The page's URL, exactly as your web search returned it")


def _sources():
    return Field(description="The pages from your web searches that this result relies on, most important first")


# ─── Research ───


class Competitor(Item):
    name: str = Field(description="The competitor's real company or product name")
    url: str = Field(description="Their actual website URL")
    overview: str = Field(description="What they do")
    features: list[str] = Field(description="Specific features they offer")
    pricing: str = Field(description='Their actual pricing, from their website, or "Contact for pricing" if it isn\'t public')
    audience: str = Field(description="Who they target")
    strengths: list[str]
    weaknesses: list[str]
    threat_level: int = Field(description="How much they threaten the product, from 1 (little) to 10 (most)")
    differentiation: str = Field(description="How the product differs from them")


class CompetitorResult(Result):
    competitors: list[Competitor] = Field(description="At least five real competitors")
    sources: list[Source] = _sources()


class Trend(Item):
    name: str
    description: str
    relevance: str = Field(description="Why the trend matters for the product")
    direction: Literal["emerging", "growing", "stable", "declining"]


class NamedItem(Item):
    name: str
    description: str


class TrendResult(Result):
    trends: list[Trend]
    key_players: list[NamedItem] = Field(description="The companies shaping this market, and what they do")
    opportunities: list[str]
    threats: list[str]
    sources: list[Source] = _sources()


class Partnership(Item):
    name: str = Field(description="The company, creator or organisation")
    type: str = Field(description="The kind of partnership, for example cross-promotion, integration, bundle or co-marketing")
    rationale: str = Field(description="Why they would benefit from partnering")
    approach: str = Field(description="How to approach them")
    potential_value: str


class PartnershipsResult(Result):
    partnerships: list[Partnership]
    sources: list[Source] = _sources()


class Podcast(Item):
    name: str
    host: str
    url: str
    audience_size: str
    relevance: str
    pitch_angle: str
    contact_method: str = Field(description="How to pitch the show, for example a guest form, an email address or a social account")


class PodcastsResult(Result):
    podcasts: list[Podcast]
    sources: list[Source] = _sources()


# ─── Outreach and content ───


class OutreachEmail(Item):
    subject: str
    body: str
    target_type: str = Field(description='Who the email is for, for example "tech journalist" or "YouTube creator"')
    follow_up_subject: str
    follow_up_body: str


class ColdOutreachResult(Result):
    emails: list[OutreachEmail]


class SocialPost(Item):
    platform: str = Field(description='The platform as the request names it, for example "twitter", "linkedin" or "instagram"')
    content: str
    hashtags: list[str] = Field(description='Hashtags including the "#"')
    notes: str
    post_type: str = Field(description='The kind of post, for example "thread", "carousel" or "announcement"')


class SocialPostsResult(Result):
    posts: list[SocialPost]


class AdSet(Item):
    variant: str = Field(description='The A/B test variant, for example "A" or "B"')
    headline: str
    body: str
    cta: str = Field(description="The call to action")
    platform: str
    target_emotion: str


class AdCopyResult(Result):
    ad_sets: list[AdSet]


class BlogResult(Result):
    title: str
    meta_description: str
    outline: list[str] = Field(description="The article's section headings")
    full_content: str = Field(description="The whole article in Markdown")
    suggested_keywords: list[str]
    word_count: int
    sources: list[Source] = _sources()


class SocialVersion(Item):
    platform: str
    content: str


class AnnouncementResult(Result):
    email_version: str
    blog_version: str
    social_versions: list[SocialVersion] = Field(description="One version for each social platform")
    press_release_version: str

    def stored(self) -> dict:
        # Stored announcements keep their social versions keyed by platform
        return {**super().stored(), "social_versions": {version.platform: version.content for version in self.social_versions}}


# ─── Communities and listings ───


class Community(Item):
    subreddit: str = Field(description='The subreddit, for example "r/SideProject"')
    subscribers: str = Field(description='The approximate number of subscribers, for example "1.2M"')
    relevance: str
    rules_summary: str
    self_promo_allowed: Literal["yes", "no", "limited"] = Field(
        description='Whether the rules allow self-promotion: "limited" when only in some posts, threads or days',
    )
    suggested_post: str
    post_type: str
    best_time: str


class RedditResult(Result):
    communities: list[Community]
    sources: list[Source] = _sources()


class Directory(Item):
    name: str
    url: str
    category: str
    is_free: bool = Field(description="Whether a basic listing is free")
    estimated_traffic: str
    submission_process: str
    notes: str


class DirectoriesResult(Result):
    directories: list[Directory]
    sources: list[Source] = _sources()


class LaunchPlatform(Item):
    name: str
    url: str
    audience: str
    prep_required: str
    best_day: str
    tips: list[str]
    priority: Level


class LaunchPlatformsResult(Result):
    platforms: list[LaunchPlatform]
    sources: list[Source] = _sources()


# ─── Reports and tools ───


class PressKitResult(Result):
    boilerplate: str = Field(description="Two or three paragraphs describing the company and product")
    key_features: list[str] = Field(description="Four to six features")
    target_audience: str = Field(description="The product's ideal users")
    founder_bio: str = Field(description="A professional biography of the founder")
    media_assets: list[str] = Field(description="Assets to prepare for the press, such as screenshots or a logo pack")
    suggested_angles: list[str] = Field(description="Story angles for the press")


class DistributionChannel(Item):
    name: str = Field(description="The publication or outlet")
    type: Literal["wire_service", "industry_publication", "tech_blog", "journalist", "directory", "podcast"]
    url: str = Field(description="Its website")
    contact_email: str = Field(description="A submission or editor email address if you found one, otherwise an empty string")
    submission_url: str = Field(description="Its submission or tip page if it has one, otherwise an empty string")
    notes: str = Field(description="Why the outlet is relevant and how to submit")


class PressReleaseResult(Result):
    headline: str = Field(description="Attention-grabbing and factual")
    subheadline: str
    body: str = Field(
        description="The complete press release in Markdown, including the dateline, every paragraph, the boilerplate and the contact block",
    )
    summary: str = Field(description="One or two sentences for distribution emails")
    suggested_distribution: list[DistributionChannel] = Field(description="Specific, real outlets found with web search")
    seo_keywords: list[str] = Field(description="Five to eight keywords for online distribution")
    sources: list[Source] = _sources()


class OptimizedMetadata(Item):
    title: str = Field(description="The title tag: 50 to 60 characters, keyword-rich")
    description: str = Field(description="The meta description: 150 to 160 characters, compelling, with a call to action")
    og_title: str
    og_description: str
    og_image: str = Field(description="The Open Graph image URL, or an empty string if the page has none")
    canonical: str = Field(description="The canonical URL")
    keywords: str = Field(description="Comma-separated keywords")
    twitter_card: str = Field(description='The Twitter Card type, for example "summary_large_image"')
    json_ld: str = Field(description="JSON-LD structured data using the SoftwareApplication schema, written as JSON")
    robots: str = Field(description='The robots meta content, for example "index, follow"')


class SeoResult(Result):
    current_score: int = Field(description="The current metadata's quality, from 0 to 100")
    optimized_score: int = Field(description="The optimized metadata's quality, from 0 to 100")
    issues: list[str] = Field(description="Specific problems with the current metadata")
    optimized: OptimizedMetadata
    head_block: str = Field(description="The complete HTML head block, ready to paste")

    def stored(self) -> dict:
        data = super().stored()
        # Stored SEO results carry the structured data as an object, as the report and exports expect
        try:
            data["optimized"]["json_ld"] = json.loads(self.optimized.json_ld)
        except ValueError:
            pass
        return data


class RepurposedPost(Item):
    platform: str
    content: str
    hashtags: list[str] = Field(description='Hashtags including the "#"')
    notes: str
    character_count: int


class RepurposeResult(Result):
    platforms: list[RepurposedPost] = Field(description="One version for each target platform")


class PricingTier(Item):
    name: str
    price: str = Field(description='For example "$19/month"')
    features: list[str]
    recommended: bool = Field(description="Whether this is the tier to recommend")


class CompetitorPrice(Item):
    name: str
    price: str
    model: str = Field(description='The pricing model, for example "subscription", "one-time" or "freemium"')


class PricingResult(Result):
    tiers: list[PricingTier]
    insights: list[str] = Field(description="Insights about pricing in this market")
    competitor_prices: list[CompetitorPrice]
    launch_strategy: str = Field(description="The recommended launch pricing approach")
    sources: list[Source] = _sources()


class MarketPlayer(Item):
    name: str
    url: str
    description: str = Field(description="What they do")
    market_position: str = Field(description="Their estimated market share or position")
    estimated_users: str
    funding: str = Field(description="Their funding or revenue if public, otherwise an empty string")
    differentiator: str = Field(description="Their primary differentiator")


class BenchmarkRow(Item):
    competitor: str
    plan: str
    price: str
    model: str = Field(description='The pricing model, for example "subscription", "perpetual", "freemium" or "usage-based"')


class PricingBenchmarks(Item):
    market_range_low: str = Field(description='The low end of market prices, for example "$9/month"')
    market_range_high: str = Field(description='The high end of market prices, for example "$99/month"')
    common_models: list[str] = Field(description="The common pricing models in this market")
    positioning_recommendation: str = Field(description="Where the product should position its price")
    benchmark_table: list[BenchmarkRow]


class Advantage(Item):
    advantage: str
    why_it_matters: str
    competitor_gap: str = Field(description="What competitors don't offer")


class Differentiation(Item):
    summary: str
    unique_advantages: list[Advantage]
    positioning_statement: str


class Barrier(Item):
    barrier: str
    severity: Level
    description: str
    implication: str = Field(description="What the barrier means for the product")


class Scenario(Item):
    y1: str = Field(description='Year 1 revenue in US dollars, for example "$120,000"')
    y2: str = Field(description="Year 2 revenue in US dollars")
    y3: str = Field(description="Year 3 revenue in US dollars")
    assumptions: str = Field(description="Customer acquisition, conversion, churn and recurring revenue growth assumptions")


class Scenarios(Item):
    conservative: Scenario
    moderate: Scenario
    aggressive: Scenario


class RevenueProjections(Item):
    pricing_used: str = Field(description="The pricing the projections are based on")
    scenarios: Scenarios


class Segment(Item):
    name: str
    description: str
    segment_size: str = Field(description="The estimated size of the segment")
    willingness_to_pay: str
    acquisition_channel: str
    priority: int = Field(description="From 1 (highest priority) to 5 (lowest)")


class MarketAnalysisResult(Result):
    key_players: list[MarketPlayer] = Field(description="The top 8 to 10 competitors in this space")
    pricing_benchmarks: PricingBenchmarks
    differentiation: Differentiation
    barriers_to_entry: list[Barrier]
    revenue_projections: RevenueProjections
    target_segments: list[Segment] = Field(description="Four to six customer segments")
    executive_summary: str = Field(description="A two or three paragraph overview of the market opportunity")
    sources: list[Source] = _sources()
