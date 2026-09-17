import { describe, expect, it } from "vitest";
import {
  budgetUse,
  chosenUsageMonth,
  formatCount,
  formatUsageMonth,
  formatUsd,
  operationLabel,
  parseBudget,
  shiftMonth,
  usageMonthOf,
} from "./usage";

describe("usage months", () => {
  it("counts months in UTC, as the usage ledger does", () => {
    // 00:30 on 1 October in London is still September in UTC.
    expect(usageMonthOf(Date.parse("2026-09-30T23:30:00Z"))).toBe("2026-09");
    expect(usageMonthOf(Date.parse("2026-10-01T00:00:00Z"))).toBe("2026-10");
  });

  it("steps back and forward across year ends", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-09", -12)).toBe("2025-09");
  });

  it("shows the month asked for, but never a malformed or future one", () => {
    const now = Date.parse("2026-09-16T12:00:00Z");
    expect(chosenUsageMonth("2026-08", now)).toBe("2026-08");
    expect(chosenUsageMonth("2026-09", now)).toBe("2026-09");
    expect(chosenUsageMonth("2026-10", now)).toBe("2026-09");
    expect(chosenUsageMonth("2026-13", now)).toBe("2026-09");
    expect(chosenUsageMonth("September", now)).toBe("2026-09");
    expect(chosenUsageMonth(null, now)).toBe("2026-09");
  });

  it("names a month", () => {
    expect(formatUsageMonth("2026-09")).toBe("September 2026");
    expect(formatUsageMonth("2027-01")).toBe("January 2027");
  });
});

describe("usage figures", () => {
  it("formats dollars to the cent, and tiny costs as under a cent", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("< $0.01");
    expect(formatUsd(0.005)).toBe("$0.01");
  });

  it("groups counts", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("names operations as the catalogue does, falling back to the id", () => {
    expect(operationLabel("market_analysis")).toBe("Market analysis");
    expect(operationLabel("competitor")).toBe("Competitor deep-dive");
    expect(operationLabel("press_targets")).toBe("press_targets");
  });

  it("warns from 80% of the budget and is used up from 100%", () => {
    expect(budgetUse(20, 50)).toEqual({ percent: 40, tone: "ok" });
    expect(budgetUse(40, 50)).toEqual({ percent: 80, tone: "warn" });
    expect(budgetUse(50, 50)).toEqual({ percent: 100, tone: "crit" });
    expect(budgetUse(60, 50)).toEqual({ percent: 120, tone: "crit" });
    // Operations stop once cost reaches the budget, so a budget of nothing is used up at once.
    expect(budgetUse(0, 0)).toEqual({ percent: 100, tone: "crit" });
  });
});

describe("parseBudget", () => {
  it("reads whole and decimal dollar amounts, with or without a dollar sign and commas", () => {
    expect(parseBudget("50")).toEqual({ amount: 50 });
    expect(parseBudget(" 49.99 ")).toEqual({ amount: 49.99 });
    expect(parseBudget("$1,000.5")).toEqual({ amount: 1000.5 });
    expect(parseBudget(".75")).toEqual({ amount: 0.75 });
    expect(parseBudget("0")).toEqual({ amount: 0 });
  });

  it("explains what's wrong with an amount it can't store", () => {
    const vague = { error: "Enter an amount in US dollars, such as 50 or 49.99." };
    expect(parseBudget("")).toEqual(vague);
    expect(parseBudget("fifty")).toEqual(vague);
    expect(parseBudget("1.2.3")).toEqual(vague);
    expect(parseBudget("-5")).toEqual({ error: "The budget can't be negative." });
    expect(parseBudget("$-5")).toEqual({ error: "The budget can't be negative." });
    expect(parseBudget("49.999")).toEqual({ error: "Use at most 2 decimal places, such as 49.99." });
    expect(parseBudget("10000000000")).toEqual({ error: "Enter an amount below $10,000,000,000." });
    expect(parseBudget("9999999999.99")).toEqual({ amount: 9_999_999_999.99 });
  });
});
