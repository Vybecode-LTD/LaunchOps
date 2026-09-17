import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateKey,
  formatMonth,
  formatTimestamp,
  formatWeekRange,
  minutesSince,
  monthGrid,
  monthStart,
  parseDateKey,
  relativeTime,
  toDateKey,
  weekDays,
} from "./dates";

describe("date keys", () => {
  it("round-trips local calendar days without UTC shifting", () => {
    const late = new Date(2026, 8, 14, 23, 30); // 11:30 pm local
    expect(toDateKey(late)).toBe("2026-09-14");
    expect(toDateKey(parseDateKey("2026-09-14")!)).toBe("2026-09-14");
  });

  it("rejects malformed keys", () => {
    expect(parseDateKey("14/09/2026")).toBeNull();
    expect(parseDateKey(null)).toBeNull();
  });

  it("counts whole days across month ends and DST changes", () => {
    expect(daysBetween("2026-09-14", "2026-09-25")).toBe(11);
    expect(daysBetween("2026-09-25", "2026-09-14")).toBe(-11);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("adds days", () => {
    expect(addDays("2026-09-28", 5)).toBe("2026-10-03");
  });
});

describe("monthGrid", () => {
  it("returns six Monday-first weeks covering the month", () => {
    const grid = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-08-31");
    expect(grid[1]).toBe("2026-09-01");
    expect(parseDateKey(grid[0])!.getDay()).toBe(1);
  });
});

describe("weeks and months", () => {
  it("returns the Monday-first week containing a day", () => {
    const week = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
    expect(weekDays("2026-09-14")).toEqual(week);
    expect(weekDays("2026-09-16")).toEqual(week);
    expect(weekDays("2026-09-20")).toEqual(week);
  });

  it("crosses month and year ends", () => {
    expect(weekDays("2026-10-01")[0]).toBe("2026-09-28");
    expect(weekDays("2027-01-01")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  });

  it("steps to the first day of another month", () => {
    expect(monthStart("2026-01-31")).toBe("2026-01-01");
    expect(monthStart("2026-01-31", 1)).toBe("2026-02-01");
    expect(monthStart("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("labels weeks and months", () => {
    expect(formatWeekRange(weekDays("2026-09-16"))).toBe("Sep 14 – 20, 2026");
    expect(formatWeekRange(weekDays("2026-10-01"))).toBe("Sep 28 – Oct 4, 2026");
    expect(formatWeekRange(weekDays("2027-01-01"))).toBe("Dec 28, 2026 – Jan 3, 2027");
    expect(formatMonth("2026-09-16")).toBe("September 2026");
  });
});

describe("formatting", () => {
  it("formats keys", () => {
    expect(formatDateKey("2026-09-25", "short")).toBe("Sep 25");
    expect(formatDateKey("2026-09-25", "long")).toBe("Friday, September 25, 2026");
    expect(formatDateKey("", "short")).toBe("");
  });

  it("describes elapsed time", () => {
    const now = Date.parse("2026-09-14T12:00:00Z");
    expect(relativeTime("2026-09-14T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-09-14T11:55:00Z", now)).toBe("5 min ago");
    expect(relativeTime("2026-09-14T09:00:00Z", now)).toBe("3 h ago");
    expect(relativeTime("2026-09-13T12:00:00Z", now)).toBe("1 day ago");
    expect(minutesSince("2026-09-14T11:00:00Z", now)).toBe(60);
  });

  it("switches from days ago to a date after two weeks", () => {
    const now = new Date(2026, 8, 14, 12).getTime();
    expect(relativeTime(new Date(2026, 8, 1, 12).toISOString(), now)).toBe("13 days ago");
    expect(relativeTime(new Date(2026, 7, 31, 12).toISOString(), now)).toBe("Aug 31, 2026");
  });

  it("formats timestamps in local time", () => {
    // No zone suffix: parsed as local time, so the expectation holds in any time zone.
    expect(formatTimestamp("2026-09-14T13:46:00")).toMatch(/^Sep 14, 2026, 1:46\sPM$/);
  });
});

describe("missing and malformed values", () => {
  it("formats nothing rather than an invalid date", () => {
    const now = Date.parse("2026-09-14T12:00:00Z");
    expect(formatTimestamp(null)).toBe("");
    expect(formatTimestamp("not a timestamp")).toBe("");
    expect(relativeTime(undefined, now)).toBe("");
    expect(relativeTime("soon", now)).toBe("");
    expect(minutesSince(null, now)).toBe(0);
    expect(minutesSince("later", now)).toBe(0);
    expect(formatMonth("")).toBe("");
    expect(formatWeekRange([])).toBe("");
  });

  it("leaves unreadable date keys alone", () => {
    expect(addDays("someday", 3)).toBe("someday");
    expect(monthStart("someday", 1)).toBe("someday");
    expect(weekDays("someday")).toEqual([]);
    expect(daysBetween("2026-09-14", "")).toBeNull();
  });
});
