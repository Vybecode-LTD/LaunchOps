/**
 * Calendar-date helpers. Dates the user picks ("launch on Oct 1") are local
 * calendar days, stored as YYYY-MM-DD — never converted through UTC, which
 * shifts the day for anyone west of Greenwich in the evening.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string | null | undefined): Date | null {
  if (!key) return null;
  const match = DATE_KEY.exec(key.slice(0, 10));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number | null {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return null;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Six Monday-first weeks covering the given month. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

/** The Monday-first week (seven date keys) containing the given day. */
export function weekDays(key: string): string[] {
  const date = parseDateKey(key);
  if (!date) return [];
  const offset = (date.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(toDateKey(date), i - offset));
}

/** The first day of the month `delta` months from the given day's month. */
export function monthStart(key: string, delta = 0): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

/** "September 2026" */
export function formatMonth(key: string): string {
  const date = parseDateKey(key);
  return date ? date.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
}

/** "Sep 14 – 20, 2026", "Sep 28 – Oct 4, 2026" or "Dec 28, 2026 – Jan 3, 2027". */
export function formatWeekRange(days: string[]): string {
  const first = parseDateKey(days[0]);
  const last = parseDateKey(days[days.length - 1]);
  if (!first || !last) return "";
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (first.getFullYear() !== last.getFullYear()) {
    return `${formatDateKey(days[0])} – ${formatDateKey(days[days.length - 1])}`;
  }
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}` : `${month(last)} ${last.getDate()}`;
  return `${month(first)} ${first.getDate()} – ${end}, ${last.getFullYear()}`;
}

export function formatDateKey(key: string | null | undefined, style: "short" | "medium" | "long" | "weekday" = "medium"): string {
  const date = parseDateKey(key);
  if (!date) return "";
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { month: "short", day: "numeric" }
      : style === "long"
        ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
        : style === "weekday"
          ? { weekday: "short", month: "short", day: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function minutesSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return (now - then) / 60_000;
}
