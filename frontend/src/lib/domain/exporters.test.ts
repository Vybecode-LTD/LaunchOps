import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadText, slugify, toAssistantPrompt, toMarkdown, toPlainText } from "./exporters";

// JSONB returns keys in its own order; the trend prompt's order is trends, key players, opportunities, threats.
const trendReport = {
  threats: "Bundled DAW instruments",
  generated_at: "2026-09-14T09:00:00+00:00",
  opportunities: ["Stem-aware effects", "Education bundles"],
  trends: [
    {
      relevance: "High",
      name: "AI stem separation",
      direction: "Rising",
      sources: ["MusicTech", { name: "Sound On Sound" }],
      metrics: { searches: "+40%" },
    },
    { direction: "Flat", description: "" },
  ],
  key_players: { leaders: "Waves", challengers: "" },
  notes: null,
};

describe("plain text export", () => {
  it("writes fields as labelled lines, lists as numbered items and nested groups indented", () => {
    expect(toPlainText(trendReport, "trend")).toBe(
      [
        "TRENDS",
        "  1. AI stem separation",
        "     Relevance: High",
        "     Direction: Rising",
        '     Sources: MusicTech, {"name":"Sound On Sound"}',
        '     Metrics: {"searches":"+40%"}',
        "  2. Item 2",
        "     Direction: Flat",
        "",
        "KEY PLAYERS",
        "  LEADERS: Waves",
        "",
        "OPPORTUNITIES",
        "  1. Stem-aware effects",
        "  2. Education bundles",
        "THREATS: Bundled DAW instruments",
      ].join("\n"),
    );
  });

  it("keeps a text result as it is and writes other values as JSON", () => {
    expect(toPlainText("Already written as text")).toBe("Already written as text");
    expect(toPlainText(["Stem-aware effects"])).toBe('[\n  "Stem-aware effects"\n]');
    expect(toPlainText(null)).toBe("");
  });
});

describe("Markdown export", () => {
  it("writes sections, item headings and bullet lists without metadata or empty fields", () => {
    expect(toMarkdown(trendReport, "Trend report — Halcyon", "trend")).toBe(
      [
        "# Trend report — Halcyon",
        "",
        "## Trends",
        "",
        "### AI stem separation",
        "",
        "- **Relevance:** High",
        "- **Direction:** Rising",
        '- **Sources:** MusicTech, {"name":"Sound On Sound"}',
        '- **Metrics:** {"searches":"+40%"}',
        "",
        "### Item 2",
        "",
        "- **Direction:** Flat",
        "",
        "## Key players",
        "",
        "- **Leaders:** Waves",
        "",
        "## Opportunities",
        "",
        "1. Stem-aware effects",
        "2. Education bundles",
        "",
        "## Threats",
        "",
        "Bundled DAW instruments",
        "",
      ].join("\n"),
    );
  });

  it("puts a text result under the title and gives other values just the title", () => {
    expect(toMarkdown("Plain **reply**", "Blog post draft — Halcyon")).toBe("# Blog post draft — Halcyon\n\nPlain **reply**");
    expect(toMarkdown(null, "Blog post draft — Halcyon")).toBe("# Blog post draft — Halcyon\n");
  });
});

describe("sources in exports", () => {
  // As stored: JSONB puts "sources" before longer keys, and the backend ends every web research result with it.
  const research = {
    sources: [
      { title: "PatchForge pricing", url: "https://patchforge.example/pricing", page_age: "September 2, 2026" },
      { title: "Unlinkable page", url: "javascript:alert(1)", page_age: null },
    ],
    competitors: [{ name: "PatchForge", threat_level: 7 }],
    generated_at: "2026-09-14T09:00:00+00:00",
  };

  it("ends a Markdown export with a numbered Sources list carrying each address", () => {
    expect(toMarkdown(research, "Competitor deep-dive — Halcyon", "competitor")).toBe(
      [
        "# Competitor deep-dive — Halcyon",
        "",
        "## Competitors",
        "",
        "### PatchForge",
        "",
        "- **Threat level:** 7",
        "",
        "## Sources",
        "",
        "1. PatchForge pricing — https://patchforge.example/pricing (updated September 2, 2026)",
        "2. Unlinkable page",
        "",
      ].join("\n"),
    );
  });

  it("ends a plain text export with the sources and their addresses", () => {
    expect(toPlainText(research, "competitor")).toBe(
      [
        "COMPETITORS",
        "  1. PatchForge",
        "     Threat level: 7",
        "",
        "SOURCES",
        "  1. PatchForge pricing",
        "     https://patchforge.example/pricing",
        "     Updated September 2, 2026",
        "  2. Unlinkable page",
      ].join("\n"),
    );
  });

  it("gives an AI assistant the sources with their addresses", () => {
    expect(toAssistantPrompt(research, "Competitor deep-dive", "Halcyon", "competitor")).toMatch(
      /\n## Sources\n\n1\. PatchForge pricing — https:\/\/patchforge\.example\/pricing \(updated September 2, 2026\)\n2\. Unlinkable page$/,
    );
  });

  it("leaves Sources out when there are none, or none that can be listed", () => {
    for (const sources of [[], [{ title: "", url: "", page_age: null }], "none"]) {
      const result = { competitors: [{ name: "PatchForge" }], sources };
      expect(toMarkdown(result, "Competitors", "competitor")).not.toContain("Sources");
      expect(toPlainText(result, "competitor")).not.toContain("SOURCES");
    }
  });
});

describe("downloadText", () => {
  const { createObjectURL, revokeObjectURL } = URL;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  it("saves the text under the given file name and releases the file a second later", async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    // jsdom has no object URLs.
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:launchops/export-1";
      }),
      revokeObjectURL: vi.fn(),
    });
    const clicked: Array<{ href: string; download: string; inDocument: boolean }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download, inDocument: document.body.contains(this) });
    });

    downloadText("halcyon-trend.md", "# Trend report — Halcyon\n", "text/markdown");

    expect(clicked).toEqual([{ href: "blob:launchops/export-1", download: "halcyon-trend.md", inDocument: true }]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(blobs[0]?.type).toBe("text/markdown;charset=utf-8");
    expect(await blobs[0]?.text()).toBe("# Trend report — Halcyon\n");

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:launchops/export-1");
  });

  it("saves plain text by default", () => {
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return "blob:launchops/export-2";
      },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadText("notes.txt", "Launch notes");

    expect(blobs[0]?.type).toBe("text/plain;charset=utf-8");
  });
});

describe("slugify", () => {
  it("turns a name into a short, safe file name", () => {
    expect(slugify("VybeCode DSP")).toBe("vybecode-dsp");
    expect(slugify("  Café & Co. — Launch!  ")).toBe("caf-co-launch");
    expect(slugify("a".repeat(80))).toBe("a".repeat(60));
  });

  it("falls back to a generic name when nothing usable is left", () => {
    expect(slugify("🚀 !!!")).toBe("export");
    expect(slugify("")).toBe("export");
  });
});
