import { describe, expect, it } from "vitest";
import { formatMoney, hostname, midSentence, moneyFrom, numberFrom, safeUrl, strings, stripEmoji, text } from "./values";

describe("text and lists", () => {
  it("coerces scalars and drops everything else", () => {
    expect(text("  hi ")).toBe("hi");
    expect(text(7)).toBe("7");
    expect(text({ a: 1 })).toBe("");
  });

  it("reads comma or newline separated strings as lists", () => {
    expect(strings("a, b\nc")).toEqual(["a", "b", "c"]);
    expect(strings(["x", 2, null, ""])).toEqual(["x", "2"]);
  });
});

describe("numbers and money", () => {
  it("parses threat levels written different ways", () => {
    expect(numberFrom("7/10")).toBe(7);
    expect(numberFrom(8.5)).toBe(8.5);
    expect(numberFrom("high")).toBeNull();
  });

  it("parses single amounts with units", () => {
    expect(moneyFrom("$1.2M")).toBe(1_200_000);
    expect(moneyFrom("$450,000")).toBe(450_000);
    expect(moneyFrom("120k")).toBe(120_000);
    expect(moneyFrom(90000)).toBe(90000);
  });

  it("refuses ranges and prose rather than guessing", () => {
    expect(moneyFrom("$100k–$200k")).toBeNull();
    expect(moneyFrom("about a million")).toBeNull();
  });

  it("formats compactly", () => {
    expect(formatMoney(3_200_000)).toBe("$3.2M");
    expect(formatMoney(760_000)).toBe("$760k");
    expect(formatMoney(4_500)).toBe("$4,500");
  });
});

describe("urls", () => {
  it("accepts http(s) and bare domains", () => {
    expect(safeUrl("patchforge.example")).toBe("https://patchforge.example/");
    expect(hostname("https://www.waveline.example/pricing")).toBe("waveline.example");
  });

  it("rejects unsafe protocols", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
  });
});

describe("stripEmoji", () => {
  it("removes pictographs and their joiners but keeps text and symbols", () => {
    expect(stripEmoji("Launch 🚀 day 👩‍💻 — T–3")).toBe("Launch day — T–3");
    expect(stripEmoji("✓ Ready")).toBe("✓ Ready");
  });
});

describe("midSentence", () => {
  it("lowercases a name for use inside a sentence", () => {
    expect(midSentence("Market analysis")).toBe("market analysis");
    expect(midSentence("Competitor deep-dive")).toBe("competitor deep-dive");
  });

  it("keeps acronyms and proper nouns", () => {
    expect(midSentence("SEO metadata")).toBe("SEO metadata");
    expect(midSentence("Reddit communities")).toBe("Reddit communities");
    expect(midSentence("LinkedIn posts")).toBe("LinkedIn posts");
  });
});
