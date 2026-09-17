/**
 * PostgreSQL stores results as JSONB, which does not keep object keys in the
 * order the model wrote them (it sorts by key length). These orders restore the
 * reading order each prompt asks for, so documents and exports read naturally.
 */

export const RESULT_FIELD_ORDER: Record<string, string[]> = {
  competitor: ["competitors"],
  trend: ["trends", "key_players", "opportunities", "threats"],
  cold_outreach: ["emails"],
  partnerships: ["partnerships"],
  social_posts: ["posts"],
  ad_copy: ["ad_sets"],
  blog: ["title", "meta_description", "outline", "full_content", "suggested_keywords", "word_count"],
  announcement: ["email_version", "blog_version", "social_versions", "press_release_version"],
  reddit: ["communities"],
  directories: ["directories"],
  launch_platforms: ["platforms"],
  podcasts: ["podcasts"],
  press_kit: ["boilerplate", "key_features", "target_audience", "founder_bio", "suggested_angles", "media_assets"],
  press_release: ["headline", "subheadline", "body", "summary", "suggested_distribution", "seo_keywords"],
  seo_result: ["current_score", "optimized_score", "issues", "optimized", "head_block"],
  pricing_result: ["tiers", "launch_strategy", "competitor_prices", "insights"],
  market_analysis: [
    "executive_summary",
    "key_players",
    "pricing_benchmarks",
    "differentiation",
    "barriers_to_entry",
    "revenue_projections",
    "target_segments",
  ],
};

/** Fields that identify or summarize an item come first, in this order. */
const ITEM_KEY_PRIORITY = [
  "name",
  "title",
  "headline",
  "subreddit",
  "competitor",
  "platform",
  "variant",
  "subject",
  "barrier",
  "advantage",
  "url",
  "host",
  "type",
  "category",
  "plan",
  "price",
  "severity",
  "priority",
  "threat_level",
  "overview",
  "description",
  "content",
  "body",
  "summary",
];

export const SEO_TAG_ORDER = [
  "title",
  "description",
  "keywords",
  "canonical",
  "robots",
  "og_title",
  "og_description",
  "og_image",
  "twitter_card",
  "json_ld",
];

const SCENARIO_ORDER = ["conservative", "moderate", "aggressive"];

function rank(list: string[], key: string): number {
  const i = list.indexOf(key);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/** Sort keys by a preferred order; unknown keys keep their relative order at the end. */
export function sortKeys(keys: string[], preferred: string[]): string[] {
  return keys
    .map((key, index) => ({ key, index }))
    .sort((a, b) => rank(preferred, a.key) - rank(preferred, b.key) || a.index - b.index)
    .map((entry) => entry.key);
}

/** A web research result ends with the pages it relied on, after any other field. */
const LAST_KEY = "sources";

export function orderedEntries(value: Record<string, unknown>, kind?: string): Array<[string, unknown]> {
  const preferred = (kind && RESULT_FIELD_ORDER[kind]) || ITEM_KEY_PRIORITY;
  const keys = sortKeys(Object.keys(value), preferred);
  return [...keys.filter((key) => key !== LAST_KEY), ...keys.filter((key) => key === LAST_KEY)].map((key) => [key, value[key]]);
}

export function orderedItemEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return sortKeys(Object.keys(value), ITEM_KEY_PRIORITY).map((key) => [key, value[key]]);
}

/** Conservative, moderate, aggressive (case-insensitive), then any others in their original order. */
export function sortScenarioKeys(keys: string[]): string[] {
  return keys
    .map((key, index) => ({ key, index }))
    .sort((a, b) => rank(SCENARIO_ORDER, a.key.toLowerCase()) - rank(SCENARIO_ORDER, b.key.toLowerCase()) || a.index - b.index)
    .map((entry) => entry.key);
}

/** JSON-LD reads conventionally with @context and @type first. */
export function orderJsonLd(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderJsonLd);
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const keys = sortKeys(Object.keys(obj), ["@context", "@type", "@id", "name"]);
  return Object.fromEntries(keys.map((k) => [k, orderJsonLd(obj[k])]));
}
