import type { ReportKey, SeoResult } from "@/lib/api/types";
import { resultSources } from "./sources";
import { isDict, strings, stripEmoji, text } from "./values";

export interface ReportSection {
  id: string;
  label: string;
}

/** Section list for a report's contents rail; only sections with content are listed, and the sources come last. */
export function reportSections(key: ReportKey, value: unknown): ReportSection[] {
  if (!isDict(value) || text(value.raw_response)) return [];
  const sections = contentSections(key, value);
  return resultSources(value).length ? [...sections, { id: "sources", label: "Sources" }] : sections;
}

function contentSections(key: ReportKey, value: Record<string, unknown>): ReportSection[] {
  const has = (k: string) => {
    const v = value[k];
    return Array.isArray(v) ? v.length > 0 : isDict(v) ? Object.keys(v).length > 0 : Boolean(text(v));
  };
  const pick = (entries: Array<[string, string, string]>) =>
    entries.filter(([, , field]) => has(field)).map(([id, label]) => ({ id, label }));
  switch (key) {
    case "market_analysis":
      return pick([
        ["summary", "Executive summary", "executive_summary"],
        ["players", "Key players", "key_players"],
        ["pricing", "Pricing benchmarks", "pricing_benchmarks"],
        ["differentiation", "Differentiation", "differentiation"],
        ["barriers", "Barriers to entry", "barriers_to_entry"],
        ["revenue", "Revenue projections", "revenue_projections"],
        ["segments", "Target segments", "target_segments"],
      ]);
    case "pricing_result":
      return pick([
        ["tiers", "Recommended tiers", "tiers"],
        ["strategy", "Launch strategy", "launch_strategy"],
        ["competitors", "Competitor prices", "competitor_prices"],
        ["insights", "Market insights", "insights"],
      ]);
    case "press_kit": {
      // Press kits saved by the first version of LaunchOps name two fields "features" and "assets".
      // The report body reads the older name when the current one is missing, so the contents must too.
      const field = (current: string, older: string) => (value[current] == null ? older : current);
      return pick([
        ["boilerplate", "Boilerplate", "boilerplate"],
        ["features", "Key features", field("key_features", "features")],
        ["audience", "Target audience", "target_audience"],
        ["founder", "Founder bio", "founder_bio"],
        ["angles", "Story angles", "suggested_angles"],
        ["assets", "Media assets", field("media_assets", "assets")],
      ]);
    }
    case "press_release":
      return pick([
        ["release", "Release", "body"],
        ["summary", "Distribution summary", "summary"],
        ["distribution", "Distribution channels", "suggested_distribution"],
        ["keywords", "SEO keywords", "seo_keywords"],
      ]);
    case "seo_result":
      return pick([
        ["scores", "Scores", "optimized_score"],
        ["issues", "Issues found", "issues"],
        ["tags", "Optimized tags", "optimized"],
        ["head", "Head block", "head_block"],
      ]);
  }
}

export const SEO_TAG_LABELS: Record<string, string> = {
  title: "Title tag",
  description: "Meta description",
  og_title: "Open Graph title",
  og_description: "Open Graph description",
  og_image: "Open Graph image",
  canonical: "Canonical URL",
  keywords: "Keywords",
  twitter_card: "Twitter Card",
  json_ld: "JSON-LD",
  robots: "Robots",
};

/** A paste-ready prompt for an AI coding assistant that applies the SEO changes. */
export function seoAssistantPrompt(data: SeoResult, pageUrl: string): string {
  const optimized = isDict(data.optimized) ? data.optimized : {};
  const lines = [
    `Update the SEO metadata for ${pageUrl || "this page"}. Make these specific changes:`,
    "",
    "## Issues to fix",
    ...strings(data.issues).map((issue, i) => `${i + 1}. ${stripEmoji(issue)}`),
    "",
    "## Optimized metadata",
    ...Object.entries(optimized)
      .filter(([k, v]) => k !== "json_ld" && text(v))
      .map(([k, v]) => `- **${SEO_TAG_LABELS[k] ?? k}**: \`${stripEmoji(text(v))}\``),
  ];
  const jsonLd = optimized.json_ld;
  if (jsonLd) {
    lines.push(
      "",
      "## JSON-LD structured data",
      "Add this inside `<head>`:",
      "```html",
      '<script type="application/ld+json">',
      typeof jsonLd === "string" ? jsonLd : JSON.stringify(jsonLd, null, 2),
      "</script>",
      "```",
    );
  }
  if (text(data.head_block)) {
    lines.push("", "## Full head block", "Replace the matching tags in `<head>` with:", "```html", text(data.head_block), "```");
  }
  lines.push("", "Find the HTML or template files for this page and apply every change above. Keep any existing tags these changes don't cover.");
  return lines.join("\n");
}
