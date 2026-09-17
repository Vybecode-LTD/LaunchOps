/**
 * Coercion helpers for model-generated JSON, whose shape is only a request.
 * Renderers use these so a missing or mistyped field degrades to "not shown"
 * instead of a crash.
 */

export type Dict = Record<string, unknown>;

export function isDict(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function list<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function dicts(value: unknown): Dict[] {
  return list(value).filter(isDict);
}

export function strings(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return list(value)
    .map((v) => text(v))
    .filter(Boolean);
}

/** Parse "7", "7/10", 7 → 7. */
export function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = /-?\d+(?:\.\d+)?/.exec(value.replace(/,/g, ""));
    if (match) return Number(match[0]);
  }
  return null;
}

/**
 * Parse money like "$1.2M", "$450,000", "120k", 450000 → dollars. Returns null
 * when the string doesn't hold one clear amount (ranges, prose).
 */
export function moneyFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  const matches = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)\s*([kKmMbB](?:illion|n)?)?/g);
  if (!matches || matches.length !== 1) return null;
  const match = /(\d+(?:\.\d+)?)\s*([kKmMbB])?/.exec(matches[0]);
  if (!match) return null;
  const base = Number(match[1]);
  const unit = (match[2] ?? "").toLowerCase();
  const multiplier = unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1;
  return base * multiplier;
}

export function formatMoney(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${trim(value / 1e9)}B`;
  if (Math.abs(value) >= 1e6) return `$${trim(value / 1e6)}M`;
  if (Math.abs(value) >= 1e4) return `$${trim(value / 1e3)}k`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1).replace(/\.0$/, "") : n.toFixed(2).replace(/\.?0+$/, "");
}

export function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function safeUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function hostname(value: unknown): string {
  const url = safeUrl(value);
  if (!url) return text(value);
  return new URL(url).hostname.replace(/^www\./, "");
}

// Pictographs plus the joiners and selectors that combine them. Alternation rather than a
// character class, so combining code points are matched as themselves.
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}|\u{FE0E}|\u{200D}|\u{20E3}|[\u{E0020}-\u{E007F}]/gu;

/** Names that keep their capital mid-sentence: acronyms ("SEO metadata") and proper nouns. */
const KEEPS_CAPITAL = /^(?:[A-Z]{2,}|Reddit|LinkedIn|X)\b/;

/** A sentence-case name for use inside a sentence: "Market analysis" → "market analysis". */
export function midSentence(name: string): string {
  return KEEPS_CAPITAL.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

export function stripEmoji(value: string): string {
  return value.replace(EMOJI, "").replace(/[ \t]{2,}/g, " ").trim();
}
