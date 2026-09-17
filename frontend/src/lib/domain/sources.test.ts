import { describe, expect, it } from "vitest";
import { resultSources, sourcesMarkdown, sourcesPlainText } from "./sources";

const researched = {
  competitors: [{ name: "PatchForge" }],
  sources: [
    { title: "PatchForge pricing", url: "https://www.patchforge.example/pricing", page_age: "September 2, 2026" },
    { title: "Plugin builders compared", url: "https://synthweekly.example/builders?ref=launch", page_age: null },
    { title: "", url: "https://knobworks.example/", page_age: "3 days ago" },
    { title: "A page that was never a web address", url: "javascript:alert(1)", page_age: null },
    { title: "", url: "", page_age: "yesterday" },
    "https://not-an-object.example",
  ],
};

describe("resultSources", () => {
  it("reads each page's title, safe address, site and age, in the order given", () => {
    expect(resultSources(researched)).toEqual([
      { title: "PatchForge pricing", url: "https://www.patchforge.example/pricing", host: "patchforge.example", pageAge: "September 2, 2026" },
      { title: "Plugin builders compared", url: "https://synthweekly.example/builders?ref=launch", host: "synthweekly.example", pageAge: "" },
      // No title: the site names it.
      { title: "knobworks.example", url: "https://knobworks.example/", host: "knobworks.example", pageAge: "3 days ago" },
      // An address that isn't safe to link to leaves just the title.
      { title: "A page that was never a web address", url: null, host: "", pageAge: "" },
    ]);
  });

  it("gives nothing for results without sources, or that aren't objects", () => {
    expect(resultSources({ competitors: [] })).toEqual([]);
    expect(resultSources({ sources: [] })).toEqual([]);
    expect(resultSources({ sources: "none" })).toEqual([]);
    expect(resultSources("## A text result")).toEqual([]);
    expect(resultSources(null)).toEqual([]);
  });
});

describe("source exports", () => {
  const sources = resultSources(researched);

  it("writes Markdown list items with each address and when the page was updated", () => {
    expect(sourcesMarkdown(sources)).toEqual([
      "1. PatchForge pricing — https://www.patchforge.example/pricing (updated September 2, 2026)",
      "2. Plugin builders compared — https://synthweekly.example/builders?ref=launch",
      "3. knobworks.example — https://knobworks.example/ (updated 3 days ago)",
      "4. A page that was never a web address",
    ]);
  });

  it("writes plain text as numbered titles with the address and age beneath", () => {
    expect(sourcesPlainText(sources.slice(0, 2))).toEqual([
      "  1. PatchForge pricing",
      "     https://www.patchforge.example/pricing",
      "     Updated September 2, 2026",
      "  2. Plugin builders compared",
      "     https://synthweekly.example/builders?ref=launch",
    ]);
  });

  it("keeps a title with line breaks on one line", () => {
    const [entry] = resultSources({ sources: [{ title: "Plugin\n  builders", url: "https://synthweekly.example/", page_age: " 2\ndays ago " }] });
    expect(sourcesMarkdown([entry!])).toEqual(["1. Plugin builders — https://synthweekly.example/ (updated 2 days ago)"]);
  });
});
