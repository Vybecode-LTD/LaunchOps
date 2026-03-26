"""Claude AI service for VybeCod.ing Launch Ops.

This module handles all Claude API interactions. It includes a sandbox
version of call_claude (used during development in Claude.ai artifacts)
and a deployment version (used when running on Railway).

When ready to deploy, swap SANDBOX_MODE to False.
When developing new features in sandbox, swap back to True.
"""

import json
import httpx
from config import get_settings

# ──────────────────────────────────────────────
# SANDBOX MODE TOGGLE
# Set to False when deploying to Railway
# Set to True when developing in Claude.ai sandbox
# ──────────────────────────────────────────────
SANDBOX_MODE = False


async def call_claude(
    system: str,
    user_message: str,
    tools: list[dict] | None = None,
    max_tokens: int = 4096,
) -> str:
    """Call Claude API and return the text response.

    In SANDBOX_MODE, this uses the artifact-embedded API pattern.
    In production, this calls the Anthropic API directly.
    """
    if SANDBOX_MODE:
        return await _call_claude_sandbox(system, user_message, tools, max_tokens)
    return await _call_claude_production(system, user_message, tools, max_tokens)


async def _call_claude_production(
    system: str,
    user_message: str,
    tools: list[dict] | None,
    max_tokens: int,
) -> str:
    """Production Claude API call via httpx."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
    }

    body = {
        "model": settings.claude_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user_message}],
    }

    if tools:
        body["tools"] = tools

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body,
        )
        response.raise_for_status()
        data = response.json()

    # Extract text from content blocks
    text_parts = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block["text"])
    return "\n".join(text_parts)


async def _call_claude_sandbox(
    system: str,
    user_message: str,
    tools: list[dict] | None,
    max_tokens: int,
) -> str:
    """Sandbox stub — returns mock data for artifact development.

    Replace this with the artifact fetch() pattern when testing
    inside Claude.ai artifacts.
    """
    return json.dumps({
        "status": "sandbox_mode",
        "message": "This is a sandbox response. Deploy to Railway for live AI.",
    })


# ──────────────────────────────────────────────
# BRAND CONTEXT BUILDER
# Injects brand voice, product details, and
# user preferences into every system prompt.
# ──────────────────────────────────────────────


def build_brand_context(
    product: dict,
    brand: dict | None = None,
    prefs: dict | None = None,
) -> str:
    """Build the brand context block injected into all system prompts."""
    from datetime import datetime
    brand = brand or {}
    prefs = prefs or {}
    company = product.get("company_details") or {}

    today = datetime.utcnow().strftime("%B %d, %Y")

    sections = [
        f"# Today's Date: {today}",
        "IMPORTANT: Never output placeholder text like '[current date]', '[City]', or '[Company Name]'.",
        "Always use the actual values provided in this context.",
        "",
        "# Brand Context",
        f"Brand: {brand.get('name', 'VybeCod.ing')}",
        f"Tagline: {brand.get('tagline', '')}",
        f"Elevator: {brand.get('elevator', '')}",
        f"Tone: {brand.get('tone', 'creative')}",
        f"Keywords to weave in: {', '.join(brand.get('keywords', []))}",
        f"Phrases to AVOID: {', '.join(brand.get('avoid', []))}",
        "",
        "# Company Details",
        f"Company Name: {company.get('company_name', brand.get('name', ''))}",
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
# WORKFLOW SYSTEM PROMPTS
# Each workflow gets a specialized prompt that
# includes the brand context + task instructions.
# ──────────────────────────────────────────────

WORKFLOW_PROMPTS = {
    "competitor": {
        "system": """You are a competitive intelligence analyst for a software company.
Analyze the specified competitor thoroughly. Cover: product features, pricing,
target audience, strengths, weaknesses, market positioning, and opportunities
for differentiation.

{brand_context}

Respond in structured JSON with keys: competitor_name, overview, features,
pricing, audience, strengths, weaknesses, opportunities, threat_level (1-10).""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },

    "trend": {
        "system": """You are a market trend analyst for creative technology products.
Research current trends in the product's market space. Cover: emerging trends,
declining trends, key players, market size indicators, and opportunities.

{brand_context}

Respond in structured JSON with keys: trends (array of {{name, description,
relevance, direction}}), key_players, opportunities, threats.""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },


    "cold_outreach": {
        "system": """You are an expert outreach copywriter. Draft personalized cold
outreach emails for press, influencers, or potential partners. Each email
should feel genuine, reference the recipient's work, and clearly communicate
the value proposition.

{brand_context}

Respond in structured JSON with keys: emails (array of {{subject, body,
target_type, follow_up_subject, follow_up_body}}).""",
        "tools": [],
    },

    "partnerships": {
        "system": """You are a business development specialist finding partnership
opportunities. Identify companies, creators, and organizations that would
benefit from partnering with this product. Consider cross-promotion,
integration, bundle, and co-marketing opportunities.

{brand_context}

Respond in structured JSON with keys: partnerships (array of {{name, type,
rationale, approach, potential_value}}).""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },

    "social_posts": {
        "system": """You are a social media content strategist for tech/creative products.
Generate platform-specific social media posts. Each post should match the
platform's culture, format, and best practices.

{brand_context}

Generate 3-5 posts per platform requested. Respond in structured JSON with
keys: posts (array of {{platform, content, hashtags, notes, post_type}}).""",
        "tools": [],
    },

    "ad_copy": {
        "system": """You are a direct response copywriter specializing in digital ads.
Create A/B test-ready ad copy sets for the product. Include headlines,
body copy, and CTAs optimized for conversion.

{brand_context}

Respond in structured JSON with keys: ad_sets (array of {{variant, headline,
body, cta, platform, target_emotion}}).""",
        "tools": [],
    },

    "blog": {
        "system": """You are an SEO-aware content writer for technology products.
Draft a blog post that drives organic traffic while being genuinely
useful and engaging. Include meta description and suggested internal links.

{brand_context}

Respond in structured JSON with keys: title, meta_description, outline
(array of section headers), full_content, suggested_keywords, word_count.""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },

    "announcement": {
        "system": """You are a product marketing writer crafting launch and update
announcements. Write compelling copy that creates excitement while clearly
communicating value. Generate versions for email, blog, and social.

{brand_context}

Respond in structured JSON with keys: email_version, blog_version,
social_versions (object with platform keys), press_release_version.""",
        "tools": [],
    },

    "reddit": {
        "system": """You are a community marketing specialist who understands Reddit culture.
Find relevant subreddits and craft community-appropriate posts. Be honest about
self-promotion rules — flag which communities allow it and which don't.

{brand_context}

Respond in structured JSON with keys: communities (array of {{subreddit, subscribers,
relevance, rules_summary, self_promo_allowed, suggested_post, post_type, best_time}}).""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },

    "directories": {
        "system": """You are a growth marketer finding free product directories and listing
sites. Focus on directories relevant to the product's niche, with real traffic.

{brand_context}

Respond in structured JSON with keys: directories (array of {{name, url, category,
is_free, estimated_traffic, submission_process, notes}}).""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },

    "launch_platforms": {
        "system": """You are a launch strategist identifying the best platforms for a
product launch. Cover Product Hunt, Hacker News, Indie Hackers, BetaList,
and niche-specific platforms. Include timing and preparation tips.

{brand_context}

Respond in structured JSON with keys: platforms (array of {{name, url, audience,
prep_required, best_day, tips, priority}}).""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },

    "podcasts": {
        "system": """You are a PR specialist finding podcast guest opportunities.
Identify podcasts where the founder could be a guest to promote the product.
Focus on shows with relevant audiences.

{brand_context}

Respond in structured JSON with keys: podcasts (array of {{name, host, url,
audience_size, relevance, pitch_angle, contact_method}}).""",
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    },
}


# ──────────────────────────────────────────────
# SPECIALIZED TASK PROMPTS
# For press kit, SEO, repurpose, pricing
# ──────────────────────────────────────────────


PRESS_KIT_PROMPT = """You are a PR professional creating a press kit for a software product.
Given the scraped content from the product's website, create a complete press kit.

{brand_context}

# Scraped Content
{scraped_content}

Respond in structured JSON with keys:
- boilerplate: 2-3 paragraph company/product description
- key_features: array of 4-6 feature strings
- target_audience: description of ideal users
- founder_bio: professional bio paragraph
- media_assets: array of recommended assets to prepare
- suggested_angles: array of story angles for press"""


PRESS_RELEASE_PROMPT = """You are an experienced PR writer crafting a professional press release.
Using the scraped content from the product's website and the contact information provided,
write a complete, publication-ready press release.

{brand_context}

# Scraped Website Content
{scraped_content}

# Contact Information
{contact_info}

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
journalists, tech blogs, and directories that accept press releases in this space.

Respond in structured JSON with keys:
- headline: string
- subheadline: string
- body: complete press release text in markdown (including dateline, all paragraphs, boilerplate, and contact block)
- summary: 1-2 sentence summary for distribution emails
- suggested_distribution: array of objects, each with: name (publication/outlet name),
  type (one of: "wire_service", "industry_publication", "tech_blog", "journalist", "directory", "podcast"),
  url (website URL), contact_email (submission or editor email if findable, or empty string if not),
  submission_url (specific submission/tip page URL if available, or empty string),
  notes (brief note on why this outlet is relevant and how to submit)
- seo_keywords: array of 5-8 keywords for online distribution"""


SEO_ANALYSIS_PROMPT = """You are an SEO specialist analyzing a website's metadata and
generating optimized alternatives.

{brand_context}

# Current Page Metadata
{current_metadata}

Analyze the current metadata and generate optimized versions. Consider:
1. Title tag optimization (50-60 chars, keyword-rich)
2. Meta description (150-160 chars, compelling with CTA)
3. Open Graph tags for social sharing
4. Twitter Card tags
5. Canonical URL
6. JSON-LD structured data (SoftwareApplication schema)
7. Keyword optimization

Respond in structured JSON with keys:
- current_score: integer 0-100
- optimized_score: integer 0-100
- issues: array of specific problems found
- optimized: object with title, description, og_title, og_description, og_image,
  canonical, keywords, twitter_card, json_ld, robots
- head_block: complete HTML head block ready to paste"""


REPURPOSE_PROMPT = """You are a content repurposing expert who adapts content for different platforms.

{brand_context}

# Original Content
{original_content}

# Target Platforms
{platforms}

Adapt this content for each platform, respecting:
- Twitter/X: 280 chars, punchy, thread-friendly, relevant hashtags
- Instagram: Visual description + caption, 2200 char limit, hashtag clusters
- LinkedIn: Professional tone, industry insights, thought leadership
- Reddit: Community-first, authentic, anti-self-promo tone
- TikTok: Script format, hook-first, trendy language
- Facebook: Conversational, shareable, community-building

Respond in structured JSON with keys: platforms (array of {{platform, content,
hashtags, notes, character_count}})."""


PRICING_PROMPT = """You are a pricing strategist for software products.

{brand_context}

# Additional Notes
{notes}

Research competitors and the market to suggest a pricing strategy. Consider:
1. Competitor pricing analysis
2. Value-based pricing principles
3. Freemium vs paid conversion rates in this market
4. Launch pricing strategy
5. Annual vs monthly discount

Respond in structured JSON with keys:
- tiers: array of {{name, price, features (array), recommended (bool)}}
- insights: array of market insight strings
- competitor_prices: array of {{name, price, model}}
- launch_strategy: recommended launch pricing approach"""
