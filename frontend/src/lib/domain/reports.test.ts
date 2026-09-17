import { describe, expect, it } from "vitest";
import type { SeoResult } from "@/lib/api/types";
import { reportSections, seoAssistantPrompt } from "./reports";

const labels = (...args: Parameters<typeof reportSections>) => reportSections(...args).map((s) => s.label);

describe("report contents", () => {
  it("lists the market analysis sections that have content, in reading order", () => {
    const analysis = {
      target_segments: [{ name: "Independent producers" }],
      executive_summary: "The plugin market is growing.",
      key_players: [],
      pricing_benchmarks: { market_range_low: "$0" },
      differentiation: {},
      barriers_to_entry: "   ",
      revenue_projections: { scenarios: {} },
    };
    expect(labels("market_analysis", analysis)).toEqual(["Executive summary", "Pricing benchmarks", "Revenue projections", "Target segments"]);
  });

  it("lists the press kit sections that have content", () => {
    const kit = { boilerplate: "VybeCode builds tools.", key_features: ["Node editor"], target_audience: "", founder_bio: "Alex produces music.", suggested_angles: [], media_assets: ["Logo pack"] };
    expect(labels("press_kit", kit)).toEqual(["Boilerplate", "Key features", "Founder bio", "Media assets"]);
  });

  it("lists the features and assets of press kits saved under their older field names", () => {
    // The first version of LaunchOps saved these as "features" and "assets"; the report body shows both.
    const legacyKit = { boilerplate: "VybeCode builds tools.", features: ["Node editor"], assets: ["Logo pack"] };
    expect(labels("press_kit", legacyKit)).toEqual(["Boilerplate", "Key features", "Media assets"]);
  });

  it("lists the press release and SEO sections that have content", () => {
    expect(labels("press_release", { headline: "Orbit launches", body: "LONDON — today", summary: "", suggested_distribution: [{ name: "Remote Work Weekly" }], seo_keywords: [] })).toEqual([
      "Release",
      "Distribution channels",
    ]);
    expect(labels("seo_result", { current_score: 54, optimized_score: 88, issues: ["No meta description"], optimized: {}, head_block: "<title>Orbit</title>" })).toEqual([
      "Scores",
      "Issues found",
      "Head block",
    ]);
  });

  it("lists the sources last when a report has any it can show", () => {
    const sources = [{ title: "Remote Work Weekly", url: "https://rww.example/", page_age: null }];
    expect(labels("press_release", { sources, headline: "Orbit launches", body: "LONDON — today" })).toEqual(["Release", "Sources"]);
    expect(labels("pricing_result", { sources, tiers: [{ name: "Pro" }] })).toEqual(["Recommended tiers", "Sources"]);
    expect(labels("market_analysis", { executive_summary: "Growing.", sources: [{ title: "", url: "" }] })).toEqual(["Executive summary"]);
  });

  it("lists nothing for a reply that couldn't be structured or isn't an object", () => {
    expect(reportSections("press_kit", { raw_response: "Boilerplate: …", boilerplate: "x" })).toEqual([]);
    expect(reportSections("seo_result", "Title: Orbit")).toEqual([]);
    expect(reportSections("market_analysis", null)).toEqual([]);
  });
});

describe("SEO prompt for a coding assistant", () => {
  it("names each tag, skips empty ones and adds JSON-LD as a script block", () => {
    const prompt = seoAssistantPrompt(
      {
        issues: ["Missing canonical URL"],
        optimized: {
          title: "Orbit Payroll",
          canonical: "https://orbit.example/",
          theme_color: "#0f8b8d",
          og_image: "",
          json_ld: { "@type": "SoftwareApplication", name: "Orbit Payroll" },
        },
      },
      "",
    );
    expect(prompt).toBe(
      [
        "Update the SEO metadata for this page. Make these specific changes:",
        "",
        "## Issues to fix",
        "1. Missing canonical URL",
        "",
        "## Optimized metadata",
        "- **Title tag**: `Orbit Payroll`",
        "- **Canonical URL**: `https://orbit.example/`",
        "- **theme_color**: `#0f8b8d`",
        "",
        "## JSON-LD structured data",
        "Add this inside `<head>`:",
        "```html",
        '<script type="application/ld+json">',
        '{\n  "@type": "SoftwareApplication",\n  "name": "Orbit Payroll"\n}',
        "</script>",
        "```",
        "",
        "Find the HTML or template files for this page and apply every change above. Keep any existing tags these changes don't cover.",
      ].join("\n"),
    );
  });

  it("uses JSON-LD written as text as it is", () => {
    const jsonLd = '{"@context":"https://schema.org","@type":"Organization"}';
    const prompt = seoAssistantPrompt({ optimized: { json_ld: jsonLd } }, "https://orbit.example");
    expect(prompt).toContain(`<script type="application/ld+json">\n${jsonLd}\n</script>`);
    expect(prompt).not.toContain("## Full head block");
  });

  it("still gives instructions when the model returned no usable tags", () => {
    // Model output only loosely follows the requested shape: here a comma-separated string and no tag object.
    const malformed = { issues: "No title, No description", optimized: "none" } as unknown as SeoResult;
    const prompt = seoAssistantPrompt(malformed, "https://orbit.example");
    expect(prompt).toContain("## Issues to fix\n1. No title\n2. No description\n\n## Optimized metadata\n\nFind the HTML");
    expect(prompt).not.toContain("JSON-LD");
  });
});
