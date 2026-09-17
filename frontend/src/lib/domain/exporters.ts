import { orderedEntries, orderedItemEntries } from "./order";
import { resultSources, sourcesMarkdown, sourcesPlainText } from "./sources";
import { humanizeKey, isDict, stripEmoji } from "./values";

const META_KEYS = new Set(["generated_at", "source_url"]);

function cell(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => (isDict(v) ? JSON.stringify(v) : String(v))).join(", ");
  if (isDict(value)) return JSON.stringify(value);
  return String(value ?? "");
}

function isEmpty(value: unknown): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * Plain text rendering of any result object, for pasting into email or docs.
 * `kind` is the workflow id or report key; it restores the prompt's field order.
 */
export function toPlainText(content: unknown, kind?: string): string {
  if (typeof content === "string") return content;
  if (!isDict(content)) return content == null ? "" : JSON.stringify(content, null, 2);
  const lines: string[] = [];
  const walk = (obj: Record<string, unknown>, indent: string, topKind?: string) => {
    for (const [key, value] of orderedEntries(obj, topKind)) {
      if (META_KEYS.has(key) || isEmpty(value)) continue;
      if (key === "sources" && obj === content) {
        const sources = resultSources(content);
        if (sources.length) lines.push("", "SOURCES", ...sourcesPlainText(sources));
        continue;
      }
      const label = humanizeKey(key).toUpperCase();
      if (typeof value !== "object") {
        lines.push(`${indent}${label}: ${String(value)}`);
      } else if (Array.isArray(value)) {
        lines.push("", `${indent}${label}`);
        value.forEach((item, i) => {
          if (isDict(item)) {
            const title = typeof item.name === "string" ? item.name : `Item ${i + 1}`;
            lines.push(`${indent}  ${i + 1}. ${title}`);
            for (const [k, v] of orderedItemEntries(item)) {
              if (k === "name" || isEmpty(v)) continue;
              lines.push(`${indent}     ${humanizeKey(k)}: ${cell(v)}`);
            }
          } else {
            lines.push(`${indent}  ${i + 1}. ${String(item)}`);
          }
        });
      } else {
        lines.push("", `${indent}${label}`);
        walk(value as Record<string, unknown>, `${indent}  `);
      }
    }
  };
  walk(content, "", kind);
  return lines.join("\n").trim();
}

/** Markdown rendering of any result object. */
export function toMarkdown(content: unknown, title: string, kind?: string): string {
  if (typeof content === "string") return `# ${title}\n\n${content}`;
  if (!isDict(content)) return `# ${title}\n`;
  const out: string[] = [`# ${title}`, ""];
  for (const [key, value] of orderedEntries(content, kind)) {
    if (META_KEYS.has(key) || isEmpty(value)) continue;
    if (key === "sources") {
      const sources = resultSources(content);
      if (sources.length) out.push("## Sources", "", ...sourcesMarkdown(sources), "");
      continue;
    }
    out.push(`## ${humanizeKey(key)}`, "");
    if (typeof value !== "object") {
      out.push(String(value), "");
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (isDict(item)) {
          const heading = typeof item.name === "string" ? item.name : `Item ${i + 1}`;
          out.push(`### ${heading}`, "");
          for (const [k, v] of orderedItemEntries(item)) {
            if (k === "name" || isEmpty(v)) continue;
            out.push(`- **${humanizeKey(k)}:** ${cell(v)}`);
          }
          out.push("");
        } else {
          out.push(`${i + 1}. ${String(item)}`);
        }
      });
      out.push("");
    } else {
      for (const [k, v] of orderedItemEntries(value as Record<string, unknown>)) {
        if (isEmpty(v)) continue;
        out.push(`- **${humanizeKey(k)}:** ${cell(v)}`);
      }
      out.push("");
    }
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/** A prompt to hand to an AI coding or writing assistant, without emoji noise. */
export function toAssistantPrompt(content: unknown, operationName: string, projectName: string, kind?: string): string {
  const body = toMarkdown(content, `${operationName} — ${projectName}`, kind);
  return stripEmoji(
    `Below are ${operationName.toLowerCase()} results for ${projectName}, produced by LaunchOps and approved for use. ` +
      `Review each section and carry out the recommended next steps.\n\n${body}`,
  );
}

export function downloadText(filename: string, contents: string, mime = "text/plain"): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "export"
  );
}
