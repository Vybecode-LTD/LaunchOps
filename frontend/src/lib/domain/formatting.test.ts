import { describe, expect, it } from "vitest";
import { niceTicks, parseScenarios } from "./chart";
import { composeLink, channelId } from "./channels";
import { toAssistantPrompt, toMarkdown, toPlainText } from "./exporters";
import { orderJsonLd, orderedEntries, sortScenarioKeys } from "./order";
import { STALL_MINUTES, displayStatus, queuePollInterval, runningNote, senderAddress, smtpReady } from "./queue";
import { reportSections, seoAssistantPrompt } from "./reports";
import { OPERATIONS, getOperation, workflowName } from "./operations";

describe("ordering (JSONB loses key order)", () => {
  it("restores a result's field order from its prompt", () => {
    const blog = { word_count: 900, title: "T", full_content: "Body", meta_description: "M", outline: ["a"] };
    expect(orderedEntries(blog, "blog").map(([k]) => k)).toEqual(["title", "meta_description", "outline", "full_content", "word_count"]);
  });

  it("puts a result's sources last, wherever JSONB stored them", () => {
    // JSONB sorts shorter keys first, so "sources" comes before "competitors" and "key_players".
    const competitor = { sources: [], notes: "Extra field", competitors: [] };
    expect(orderedEntries(competitor, "competitor").map(([k]) => k)).toEqual(["competitors", "notes", "sources"]);
    const trend = { trends: [], sources: [], threats: [], key_players: [], opportunities: [] };
    expect(orderedEntries(trend, "trend").map(([k]) => k)).toEqual(["trends", "key_players", "opportunities", "threats", "sources"]);
    expect(orderedEntries({ sources: [], name: "Unknown kind" }).map(([k]) => k)).toEqual(["name", "sources"]);
  });

  it("orders scenarios conservative → aggressive, keeping unknown ones last", () => {
    expect(sortScenarioKeys(["moderate", "stretch", "Aggressive", "conservative"])).toEqual(["conservative", "moderate", "Aggressive", "stretch"]);
  });

  it("puts @context and @type first in JSON-LD", () => {
    expect(Object.keys(orderJsonLd({ name: "X", "@type": "SoftwareApplication", "@context": "https://schema.org" }) as object)).toEqual([
      "@context",
      "@type",
      "name",
    ]);
  });
});

describe("revenue chart data", () => {
  it("parses three scenarios in reading order", () => {
    const series = parseScenarios({
      moderate: { y1: "$310,000", y2: "$840,000", y3: "$1.6M" },
      aggressive: { y1: "$520,000", y2: "$1.5M", y3: "$3.2M" },
      conservative: { y1: "$180,000", y2: "$420,000", y3: "$760,000" },
    });
    expect(series?.map((s) => s.key)).toEqual(["conservative", "moderate", "aggressive"]);
    expect(series?.[2]?.values).toEqual([520_000, 1_500_000, 3_200_000]);
  });

  it("declines to chart values it can't read", () => {
    expect(parseScenarios({ moderate: { y1: "$1M", y2: "strong growth", y3: "$2M" } })).toBeNull();
    expect(parseScenarios({ a: {}, b: {}, c: {}, d: {} })).toBeNull();
  });

  it("builds clean ticks above the maximum", () => {
    expect(niceTicks(3_200_000)).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe("compose links say what they prefill", () => {
  it("prefills text on X and Threads", () => {
    const x = composeLink("Twitter/X", "Hello world", "https://a.example");
    expect(x).toMatchObject({ prefillsText: true, label: "Open in X" });
    expect(x?.href).toBe("https://x.com/intent/post?text=Hello%20world");
  });

  it("only shares a link on LinkedIn, and only when there is one", () => {
    expect(composeLink("linkedin", "Hi", "")).toBeNull();
    expect(composeLink("linkedin", "Hi", "https://a.example")).toMatchObject({ prefillsText: false });
  });

  it("has no composer for Instagram", () => {
    expect(channelId("IG")).toBe("instagram");
    expect(composeLink("instagram", "Hi", "https://a.example")).toBeNull();
  });
});

describe("exporters", () => {
  const result = { generated_at: "2026-09-14T00:00:00Z", competitors: [{ threat_level: 7, url: "https://p.example", name: "PatchForge" }] };

  it("writes markdown in reading order without metadata", () => {
    const md = toMarkdown(result, "Competitors", "competitor");
    expect(md).not.toContain("Generated");
    expect(md).toContain("### PatchForge");
    expect(md.indexOf("**Url:**")).toBeLessThan(md.indexOf("**Threat level:**"));
  });

  it("writes plain text", () => {
    expect(toPlainText(result, "competitor")).toContain("1. PatchForge");
  });

  it("strips emoji from assistant prompts", () => {
    expect(toAssistantPrompt({ summary: "Ship it 🚀" }, "Trend report", "Halcyon")).not.toContain("🚀");
  });
});

describe("queue helpers", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");

  it("flags running items as stalled after the threshold", () => {
    expect(displayStatus({ status: "running", created_at: "2026-09-14T11:50:00Z" }, now)).toBe("running");
    const stalledAt = new Date(now - STALL_MINUTES * 60_000).toISOString();
    expect(displayStatus({ status: "running", created_at: stalledAt }, now)).toBe("stalled");
  });

  it("doesn't call a job stalled while retries could still be running it", () => {
    // Worst case for a healthy job: three 15-minute attempts plus waits of 30 seconds and 2 minutes.
    const worstCase = new Date(now - (3 * 15 + 2.5) * 60_000).toISOString();
    expect(displayStatus({ status: "running", created_at: worstCase }, now)).toBe("running");
    expect(STALL_MINUTES).toBe(60);
  });

  it("polls lists with running results often without live updates, and rarely with them", () => {
    expect(queuePollInterval([{ status: "pending" }, { status: "running" }], false)).toBe(4_000);
    expect(queuePollInterval([{ status: "running" }], true)).toBe(30_000);
    expect(queuePollInterval([{ status: "pending" }], false)).toBe(false);
    expect(queuePollInterval(undefined, true)).toBe(false);
  });

  it("shows what a running result's preview says, but not the placeholder it starts with", () => {
    expect(runningNote({ status: "running", preview: "Trying again in 30 seconds: The AI provider is overloaded." })).toBe(
      "Trying again in 30 seconds: The AI provider is overloaded.",
    );
    expect(runningNote({ status: "running", preview: "Running cold_outreach..." })).toBeNull();
    expect(runningNote({ status: "running", preview: "" })).toBeNull();
    expect(runningNote({ status: "failed", preview: "Failed: Cancelled by jordan@northstar.example." })).toBeNull();
  });

  it("requires host, user and a saved password to send", () => {
    expect(smtpReady({ email_settings: { smtp_host: "h", smtp_user: "u", smtp_password_set: true } })).toBe(true);
    expect(smtpReady({ email_settings: { smtp_host: "h", smtp_user: "u" } })).toBe(false);
    expect(senderAddress({ email_settings: { smtp_user: "u@a.example", from_name: "Alex" } })).toBe("Alex <u@a.example>");
  });
});

describe("reports", () => {
  it("lists only sections that have content", () => {
    expect(reportSections("pricing_result", { tiers: [{}], insights: [] }).map((s) => s.id)).toEqual(["tiers"]);
    expect(reportSections("pricing_result", { raw_response: "x" })).toEqual([]);
  });

  it("builds an SEO prompt naming the analysed page", () => {
    const prompt = seoAssistantPrompt({ issues: ["No title 🚫"], optimized: { title: "Better" }, head_block: "<title>Better</title>" }, "https://a.example");
    expect(prompt).toContain("https://a.example");
    expect(prompt).toContain("- **Title tag**: `Better`");
    expect(prompt).not.toContain("🚫");
  });
});

describe("operations catalog", () => {
  it("names retired and unknown workflows", () => {
    expect(workflowName("press_targets")).toBe("Press targets (retired)");
    expect(workflowName("launch_platforms")).toBe("Launch platforms");
    expect(workflowName("mind_reading")).toBe("Mind reading");
  });

  it("marks the workflows whose approval creates drafts", () => {
    expect(getOperation("cold_outreach")?.draftsEmailsOnApproval).toBe(true);
    expect(getOperation("social_posts")?.draftsEmailsOnApproval).toBeUndefined();
  });

  it("says that exactly the web research operations list the pages their research relied on", () => {
    // The backend adds sources to these results: services/results.py.
    const withSources = ["competitor", "trend", "partnerships", "blog", "reddit", "directories", "launch_platforms", "podcasts", "press_release", "pricing", "market_analysis"];
    const researching = OPERATIONS.filter((op) => op.webResearch).map((op) => op.id);
    expect([...researching].sort()).toEqual([...withSources].sort());
    for (const op of OPERATIONS) {
      if (op.webResearch) expect(op.produces, op.id).toMatch(/ Lists the web pages the research relied on\.$/);
      else expect(op.produces, op.id).not.toMatch(/web pages/);
    }
  });
});
