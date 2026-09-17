import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/Overlay";
import type { ReportKey } from "@/lib/api/types";
import type { ScenarioSeries } from "@/lib/domain/chart";
import { ReportBody } from "./Reports";
import { RevenueChart } from "./RevenueChart";
import { WorkflowResult } from "./WorkflowResult";

function wrap(ui: ReactNode) {
  return render(
    <ToastProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </ToastProvider>,
  );
}

const WORKFLOWS: Array<[string, Record<string, unknown>, string]> = [
  ["trend", { trends: [{ name: "AI stem separation", direction: "Rising", relevance: "High" }], opportunities: "Stem-aware effects", threats: [{ name: "Bundled DAWs" }] }, "AI stem separation"],
  ["cold_outreach", { emails: [{ subject: "Beta invite", body: "Hi Dana", target_type: "Journalist", follow_up_subject: "Following up", follow_up_body: "Any thoughts?" }] }, "Beta invite"],
  ["partnerships", { partnerships: [{ name: "Waveline", type: "Integration", rationale: "Shared users" }] }, "Shared users"],
  ["podcasts", { podcasts: [{ name: "The Build Log", host: "Maya", pitch_angle: "No-code DSP" }] }, "Hosted by Maya"],
  ["social_posts", { posts: [{ platform: "twitter", content: "Launch day", hashtags: ["#vst3"], post_type: "Teaser" }, { platform: "linkedin", content: "We launched" }] }, "Launch day"],
  ["ad_copy", { ad_sets: [{ variant: "A", headline: "Build plugins without code", body: "Try it", cta: "Start free" }] }, "Start free"],
  ["blog", { title: "Why producers build their own plugins", full_content: "## Intro\nBody text", outline: ["Intro"], suggested_keywords: ["vst3"], word_count: 900 }, "Why producers build their own plugins"],
  ["announcement", { email_version: "Email body", blog_version: "Blog body", social_versions: { twitter: "Tweet body" } }, "Email body"],
  ["reddit", { communities: [{ subreddit: "r/audioengineering", subscribers: "780k", self_promo_allowed: false, suggested_post: "A breakdown" }] }, "r/audioengineering"],
  ["directories", { directories: [{ name: "LaunchList", url: "https://launchlist.example", is_free: true, submission_process: "Web form" }] }, "LaunchList"],
  ["launch_platforms", { platforms: [{ name: "Product Hunt", priority: "high", tips: ["Launch at 12:01 PT"] }, { name: "BetaList", priority: "low" }] }, "Product Hunt"],
  ["competitor", { competitors: [{ name: "PatchForge", threat_level: 7, strengths: ["Community"], weaknesses: "No export" }] }, "PatchForge"],
];

describe("WorkflowResult", () => {
  it.each(WORKFLOWS)("renders %s results", (workflowId, content, expected) => {
    wrap(<WorkflowResult workflowId={workflowId} content={content} projectUrl="https://dsp.example" />);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it.each(WORKFLOWS.map(([id]) => id))("survives malformed %s output", (workflowId) => {
    const malformed = { competitors: "none", trends: 5, emails: [null, "x"], posts: {}, ad_sets: [1], communities: [{}], directories: null, platforms: "", podcasts: [[]] };
    expect(() => wrap(<WorkflowResult workflowId={workflowId} content={malformed} />)).not.toThrow();
  });

  it("says which communities limit self-promotion, with a warning pill", () => {
    wrap(
      <WorkflowResult
        workflowId="reddit"
        content={{
          communities: [
            { subreddit: "r/SideProject", self_promo_allowed: "yes" },
            { subreddit: "r/audioengineering", self_promo_allowed: "no" },
            { subreddit: "r/WeAreTheMusicMakers", self_promo_allowed: "limited" },
          ],
        }}
      />,
    );
    const card = (name: string) => screen.getByRole("heading", { name }).closest("article")!;
    expect(within(card("r/SideProject")).getByText("Allowed")).toHaveClass("ok");
    expect(within(card("r/audioengineering")).getByText("Not allowed")).toHaveClass("crit");
    expect(within(card("r/WeAreTheMusicMakers")).getByText("Limited")).toHaveClass("warn");
    expect(screen.queryByText("limited")).not.toBeInTheDocument();
  });

  it("names launch platform priorities as people say them", () => {
    wrap(
      <WorkflowResult
        workflowId="launch_platforms"
        content={{
          platforms: [
            { name: "BetaList", priority: "low" },
            { name: "Product Hunt", priority: "high" },
            { name: "Indie Hackers", priority: "medium" },
            { name: "Hacker News", priority: 2 },
            { name: "Uneed", priority: "Worth a try" },
            { name: "Peerlist", priority: "high priority" },
          ],
        }}
      />,
    );
    const priority = (name: string) => within(screen.getByRole("heading", { name }).closest("article")!).getByText(/priority|Priority/);
    expect(priority("Product Hunt")).toHaveTextContent(/^High priority$/);
    expect(priority("Indie Hackers")).toHaveTextContent(/^Medium priority$/);
    expect(priority("BetaList")).toHaveTextContent(/^Low priority$/);
    expect(priority("Hacker News")).toHaveTextContent(/^Priority 2$/);
    expect(priority("Uneed")).toHaveTextContent(/^Priority: Worth a try$/);
    expect(priority("Peerlist")).toHaveTextContent(/^High priority$/);
    // Highest first: high, medium and low rank as 1, 2 and 3, numbers as themselves, anything else last.
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Product Hunt", "Peerlist", "Indie Hackers", "Hacker News", "BetaList", "Uneed"]);
  });

  it("shows an unparsed reply as text with a notice", () => {
    wrap(<WorkflowResult workflowId="blog" content={{ raw_response: "Plain **reply**" }} />);
    expect(screen.getByText(/couldn't be structured/)).toBeInTheDocument();
    expect(screen.getByText("reply")).toBeInTheDocument();
  });

  it("shows the error of a failed run", () => {
    wrap(<WorkflowResult workflowId="blog" content={{ error: "overloaded" }} />);
    expect(screen.getByText("This operation failed: overloaded")).toBeInTheDocument();
  });

  it("falls back to a generic view for unknown workflows", () => {
    wrap(<WorkflowResult workflowId="press_targets" content={{ targets: [{ name: "Synth Weekly", email: "tips@synth.example" }], note: "Old workflow" }} />);
    expect(screen.getByText("Synth Weekly")).toBeInTheDocument();
    expect(screen.getByText("Old workflow")).toBeInTheDocument();
  });

  it("switches announcement versions", async () => {
    const user = userEvent.setup();
    wrap(<WorkflowResult workflowId="announcement" content={{ email_version: "Email body", blog_version: "Blog body" }} />);
    await user.click(screen.getByRole("button", { name: "Blog" }));
    expect(screen.getByText("Blog body")).toBeInTheDocument();
  });

  it("links a post to a composer that says what it prefills", () => {
    wrap(<WorkflowResult workflowId="social_posts" content={{ posts: [{ platform: "Twitter/X", content: "Hello" }] }} />);
    expect(screen.getByRole("link", { name: "Open in X" })).toHaveAttribute("title", "Opens with this text filled in");
  });

  it("shows a result saved as text as Markdown", () => {
    wrap(<WorkflowResult workflowId="blog" content={"## Draft\n\nWhy producers build their own plugins"} />);
    expect(screen.getByRole("heading", { name: "Draft" })).toBeInTheDocument();
    expect(screen.getByText("Why producers build their own plugins")).toBeInTheDocument();
  });

  it("says so when a result has no content", () => {
    wrap(<WorkflowResult workflowId="blog" content={null} />);
    expect(screen.getByText("This result is empty.")).toBeInTheDocument();
  });
});

const REPORTS: Array<[ReportKey, Record<string, unknown>, string[]]> = [
  [
    "market_analysis",
    {
      executive_summary: "The market is growing.",
      key_players: [{ name: "PatchForge", url: "patchforge.example", description: "Modular patching" }],
      pricing_benchmarks: { market_range_low: "$0", market_range_high: "$399", benchmark_table: [{ competitor: "PatchForge", plan: "Pro", price: "$249" }], positioning_recommendation: "Price below code-first tools." },
      differentiation: { summary: "Only signed export.", unique_advantages: [{ advantage: "Signed export" }], positioning_statement: "For producers…" },
      barriers_to_entry: [{ barrier: "DSP quality", severity: "high" }],
      revenue_projections: { pricing_used: "Pro $29", scenarios: { moderate: { y1: "$310k", y2: "$840k", y3: "$1.6M" }, conservative: { y1: "$180k", y2: "$420k", y3: "$760k" } } },
      target_segments: [{ name: "Independent producers", priority: 1 }],
    },
    ["The market is growing.", "PatchForge", "$0 – $399", "Signed export", "DSP quality", "Independent producers"],
  ],
  [
    "pricing_result",
    { tiers: [{ name: "Creator", price: "$12/mo", features: ["Export"], recommended: true }], launch_strategy: "Discount launch week.", competitor_prices: [{ name: "Waveline", price: "$15/mo" }], insights: ["Annual plans convert."] },
    ["Recommended", "$12/mo", "Discount launch week.", "Waveline", "Annual plans convert."],
  ],
  [
    "press_kit",
    { boilerplate: "VybeCode builds tools.", key_features: ["Node editor"], target_audience: "Producers", founder_bio: "Alex produces music.", suggested_angles: ["No-code audio"], media_assets: ["Logo pack"] },
    ["VybeCode builds tools.", "Node editor", "Alex produces music.", "No-code audio", "Logo pack"],
  ],
  [
    "press_release",
    { headline: "Orbit launches", subheadline: "Payroll in 40 countries", body: "**LONDON** — today", summary: "Short summary", suggested_distribution: [{ name: "Remote Work Weekly", type: "industry_publication", contact_email: "tips@rww.example" }, "A plain outlet"], seo_keywords: ["payroll"] },
    ["Orbit launches", "Payroll in 40 countries", "Short summary", "Industry publication", "tips@rww.example", "A plain outlet", "payroll"],
  ],
  [
    "seo_result",
    { current_score: 54, optimized_score: 88, issues: ["No meta description"], optimized: { robots: "index", title: "Better title", json_ld: { name: "X", "@context": "https://schema.org" } }, head_block: "<title>Better title</title>" },
    ["54", "88", "No meta description", "Better title", "<title>Better title</title>"],
  ],
];

describe("ReportBody", () => {
  it.each(REPORTS)("renders the %s report", (key, value, expected) => {
    wrap(<ReportBody reportKey={key} value={value} pageUrl="https://dsp.example" />);
    for (const text of expected) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it("orders SEO tags canonically and JSON-LD with @context first", () => {
    const [, value] = REPORTS[4]!;
    wrap(<ReportBody reportKey="seo_result" value={value} />);
    const rows = within(screen.getAllByRole("table")[0]!).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("td")?.textContent)).toEqual(["Title tag", "Robots"]);
    expect(screen.getByText(/"@context"/).textContent?.indexOf("@context")).toBeLessThan(screen.getByText(/"@context"/).textContent!.indexOf('"name"'));
  });

  it("charts parseable revenue scenarios and lists them conservative first", () => {
    const [, value] = REPORTS[0]!;
    wrap(<ReportBody reportKey="market_analysis" value={value} />);
    expect(screen.getByRole("img", { name: /Revenue projections by scenario/ })).toBeInTheDocument();
    const scenarioTable = screen.getAllByRole("table").find((t) => within(t).queryByText("Assumptions"))!;
    expect(within(scenarioTable).getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent)).toEqual(["conservative", "moderate"]);
  });

  it("skips the chart when amounts can't be read", () => {
    wrap(<ReportBody reportKey="market_analysis" value={{ revenue_projections: { scenarios: { moderate: { y1: "strong", y2: "?", y3: "?" } } } }} />);
    expect(screen.queryByRole("img", { name: /Revenue projections/ })).not.toBeInTheDocument();
  });

  it("shows unstructured report text with a notice", () => {
    wrap(<ReportBody reportKey="pricing_result" value={{ raw_response: "Tiers: Pro" }} />);
    expect(screen.getByText(/couldn't be structured/)).toBeInTheDocument();
  });

  it("copies a prompt that tells a coding assistant to apply the SEO changes to the analysed page", async () => {
    const user = userEvent.setup();
    const [, value] = REPORTS[4]!;
    wrap(<ReportBody reportKey="seo_result" value={value} pageUrl="https://dsp.example" />);

    await user.click(screen.getByRole("button", { name: "Copy prompt for coding assistant" }));

    // user-event installs its own clipboard, so read back what was written.
    await waitFor(async () => expect(await navigator.clipboard.readText()).toContain("Update the SEO metadata for https://dsp.example."));
    expect(await navigator.clipboard.readText()).toContain("- **Title tag**: `Better title`");
  });
});

const SOURCES = [
  { title: "PatchForge pricing", url: "https://www.patchforge.example/pricing", page_age: "September 2, 2026" },
  { title: "Plugin builders compared", url: "https://synthweekly.example/builders", page_age: null },
  { title: "A page with no usable address", url: "javascript:alert(1)", page_age: "3 days ago" },
];

describe("Sources", () => {
  const sourcesSection = () => screen.getByRole("region", { name: /^Sources/ });
  /** The result's sections, in order (the toast viewport is a region too). */
  const resultSections = () => screen.getAllByRole("region").filter((region) => region.tagName === "SECTION");

  it("ends a web research result with the numbered pages it relied on", () => {
    // JSONB stores "sources" before the longer keys; it still comes last.
    wrap(<WorkflowResult workflowId="competitor" content={{ sources: SOURCES, competitors: [{ name: "PatchForge", threat_level: 7 }] }} />);

    expect(resultSections().at(-1)).toBe(sourcesSection());
    expect(within(sourcesSection()).getByRole("heading", { level: 2 })).toHaveTextContent(/^Sources\s*3$/);
    const items = within(within(sourcesSection()).getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(sourcesSection().querySelector("ol")).not.toBeNull();

    const first = within(items[0]!).getByRole("link", { name: "PatchForge pricing" });
    expect(first).toHaveAttribute("href", "https://www.patchforge.example/pricing");
    expect(first).toHaveAttribute("target", "_blank");
    expect(first).toHaveAttribute("rel", "noopener noreferrer");
    expect(items[0]).toHaveTextContent("patchforge.example · Updated September 2, 2026");
  });

  it("doesn't say when a page was updated if the search didn't", () => {
    wrap(<WorkflowResult workflowId="competitor" content={{ competitors: [{ name: "PatchForge" }], sources: SOURCES }} />);
    const item = within(sourcesSection()).getAllByRole("listitem")[1]!;
    expect(within(item).getByRole("link", { name: "Plugin builders compared" })).toHaveAttribute("href", "https://synthweekly.example/builders");
    expect(within(item).getByText("synthweekly.example")).toBeInTheDocument();
    expect(item).not.toHaveTextContent("Updated");
  });

  it("shows a source whose address isn't safe as plain text, without a link", () => {
    wrap(<WorkflowResult workflowId="competitor" content={{ competitors: [{ name: "PatchForge" }], sources: SOURCES }} />);
    const item = within(sourcesSection()).getAllByRole("listitem")[2]!;
    expect(within(item).queryByRole("link")).not.toBeInTheDocument();
    expect(item).toHaveTextContent("A page with no usable address");
    expect(item).toHaveTextContent("Updated 3 days ago");
    expect(item).not.toHaveTextContent("javascript");
  });

  it("prints each source's address, which a printed link can't show", () => {
    wrap(<WorkflowResult workflowId="competitor" content={{ competitors: [{ name: "PatchForge" }], sources: SOURCES }} />);
    const [first, , unsafe] = within(sourcesSection()).getAllByRole("listitem");
    expect(within(first!).getByText("https://www.patchforge.example/pricing")).toHaveClass("sourceUrl");
    expect(unsafe!.querySelector(".sourceUrl")).toBeNull();
  });

  it("renders nothing for results without sources", () => {
    for (const content of [{ competitors: [{ name: "PatchForge" }] }, { competitors: [{ name: "PatchForge" }], sources: [] }, { competitors: [{ name: "PatchForge" }], sources: [{ title: "", url: "" }] }]) {
      const { unmount } = wrap(<WorkflowResult workflowId="competitor" content={content} />);
      expect(screen.queryByRole("region", { name: /^Sources/ })).not.toBeInTheDocument();
      expect(screen.queryByText("Sources")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("lists a generic result's sources once, as sources rather than as items", () => {
    wrap(<WorkflowResult workflowId="press_targets" content={{ sources: SOURCES, targets: [{ name: "Synth Weekly" }] }} />);
    expect(screen.getAllByRole("heading", { name: /^Sources/ })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Item 1" })).not.toBeInTheDocument();
    expect(within(sourcesSection()).getByRole("link", { name: "PatchForge pricing" })).toBeInTheDocument();
    expect(screen.getByText("Synth Weekly")).toBeInTheDocument();
  });

  it.each<[ReportKey, Record<string, unknown>]>([
    ["press_release", { headline: "Orbit launches", body: "LONDON — today" }],
    ["pricing_result", { tiers: [{ name: "Creator", price: "$12/mo" }] }],
    ["market_analysis", { executive_summary: "The market is growing." }],
  ])("ends the %s report with its sources", (key, value) => {
    wrap(<ReportBody reportKey={key} value={{ sources: SOURCES, ...value }} />);
    expect(resultSections().at(-1)).toBe(sourcesSection());
    expect(sourcesSection()).toHaveAttribute("id", "sources");
    expect(within(sourcesSection()).getByRole("link", { name: "PatchForge pricing" })).toBeInTheDocument();
  });
});

describe("Structured result shapes", () => {
  it("reads a trend's key players as names with what they do, and its direction as a word", () => {
    wrap(
      <WorkflowResult
        workflowId="trend"
        content={{
          trends: [{ name: "AI stem separation", description: "Splitting mixes", relevance: "Core feature", direction: "growing" }],
          key_players: [{ name: "Waves", description: "Plugin maker" }],
          opportunities: ["Stem-aware effects"],
          threats: ["Bundled DAWs"],
        }}
      />,
    );
    expect(screen.getByRole("cell", { name: "Growing" })).toBeInTheDocument();
    expect(screen.getByText("Waves — Plugin maker")).toBeInTheDocument();
  });

  it("shows whether a directory is free from a true or false answer", () => {
    wrap(
      <WorkflowResult
        workflowId="directories"
        content={{ directories: [{ name: "LaunchList", is_free: true }, { name: "SaaSHub", is_free: false }] }}
      />,
    );
    expect(within(screen.getByRole("row", { name: /LaunchList/ })).getByText("Free")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /SaaSHub/ })).getByText("Paid")).toBeInTheDocument();
  });

  it("names barrier severities and every press distribution type in words", () => {
    const types = ["wire_service", "industry_publication", "tech_blog", "journalist", "directory", "podcast"];
    const { unmount } = wrap(
      <ReportBody
        reportKey="press_release"
        value={{ headline: "Orbit launches", suggested_distribution: types.map((type, i) => ({ name: `Outlet ${i}`, type })) }}
      />,
    );
    for (const label of ["Wire service", "Industry publication", "Tech blog", "Journalist", "Directory", "Podcast"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    unmount();

    wrap(<ReportBody reportKey="market_analysis" value={{ barriers_to_entry: [{ barrier: "DSP quality", severity: "high" }, { barrier: "Trust", severity: "medium" }] }} />);
    expect(within(screen.getByRole("row", { name: /DSP quality/ })).getByText("High")).toHaveClass("crit");
    expect(within(screen.getByRole("row", { name: /Trust/ })).getByText("Medium")).toHaveClass("warn");
  });
});

describe("RevenueChart", () => {
  const series: ScenarioSeries[] = [
    { key: "conservative", label: "Conservative", values: [180_000, 420_000, 760_000] },
    { key: "moderate", label: "Moderate", values: [310_000, 840_000, 1_600_000] },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a column's amount while it is hovered", async () => {
    const user = userEvent.setup();
    render(<RevenueChart series={series} />);

    const column = screen.getByRole("img", { name: "Moderate, Year 2: $840k" });
    await user.hover(column);
    expect(screen.getByRole("status")).toHaveTextContent("$840k");
    expect(screen.getByRole("status")).toHaveTextContent("Moderate · Year 2");

    await user.unhover(column);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a column's amount when it is reached with the keyboard", async () => {
    const user = userEvent.setup();
    render(<RevenueChart series={series} />);

    await user.tab();
    expect(screen.getByRole("img", { name: "Conservative, Year 1: $180k" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("$180k");
    expect(screen.getByRole("status")).toHaveTextContent("Conservative · Year 1");

    await user.tab();
    expect(screen.getByRole("status")).toHaveTextContent("Conservative · Year 2");

    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("fills the width of its container, and keeps its size while the container is hidden", () => {
    let resize: (width: number) => void = () => {};
    class ResizeObserverDouble {
      constructor(callback: ResizeObserverCallback) {
        resize = (width) => callback([{ contentRect: { width } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    render(<RevenueChart series={series} />);
    const chart = screen.getByRole("img", { name: /^Revenue projections by scenario/ });
    expect(chart).toHaveAttribute("width", "640");

    act(() => resize(912.4));
    expect(chart).toHaveAttribute("width", "912");

    // A hidden container (a collapsed section, a background tab) reports zero width.
    act(() => resize(0));
    expect(chart).toHaveAttribute("width", "912");
  });
});
