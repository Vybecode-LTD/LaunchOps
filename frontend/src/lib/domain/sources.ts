import { dicts, hostname, isDict, safeUrl, text } from "./values";

/*
 * The sources a web research result ends with (backend: services/claude.py keeps only pages the operation's searches
 * returned). The operations that research the web are the catalogue entries with webResearch; results they stored
 * before sources existed, and every other result, have none.
 */

/** One web page a result relied on, ready to show or export. */
export interface SourceEntry {
  title: string;
  /** The page's address when it's safe to link to (http or https), otherwise null. */
  url: string | null;
  /** The site, e.g. "synthweekly.example"; empty without a safe address. */
  host: string;
  /** When the search engine says the page was updated, in its words ("3 days ago"); empty when it didn't say. */
  pageAge: string;
}

/** A result's sources in the order given, skipping any with neither a title nor an address. */
export function resultSources(result: unknown): SourceEntry[] {
  if (!isDict(result)) return [];
  return dicts(result.sources).flatMap((source) => {
    const url = safeUrl(source.url);
    const host = url ? hostname(url) : "";
    const title = text(source.title) || host;
    return title ? [{ title, url, host, pageAge: text(source.page_age) }] : [];
  });
}

/** Markdown list lines: "1. Title — https://… (updated 3 days ago)". Bare addresses stay readable as text and link when rendered. */
export function sourcesMarkdown(sources: SourceEntry[]): string[] {
  return sources.map(
    (source, i) => `${i + 1}. ${oneLine(source.title)}${source.url ? ` — ${source.url}` : ""}${source.pageAge ? ` (updated ${oneLine(source.pageAge)})` : ""}`,
  );
}

/** Plain text lines for a numbered item each: the title, then its address and when it was updated, indented. */
export function sourcesPlainText(sources: SourceEntry[], indent = ""): string[] {
  return sources.flatMap((source, i) => [
    `${indent}  ${i + 1}. ${oneLine(source.title)}`,
    ...(source.url ? [`${indent}     ${source.url}`] : []),
    ...(source.pageAge ? [`${indent}     Updated ${oneLine(source.pageAge)}`] : []),
  ]);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
