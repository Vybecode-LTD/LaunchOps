import { getOperation } from "./operations";

/*
 * AI usage and budgets (GET /api/organisation/usage, PUT /api/organisation/budget; backend/services/usage.py).
 * The ledger counts calendar months in UTC, and the budget check compares the current UTC month's cost with it.
 */

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The UTC month an instant falls in, as YYYY-MM. */
export function usageMonthOf(instant: number): string {
  const date = new Date(instant);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month `delta` months before (negative) or after `month`. */
export function shiftMonth(month: string, delta: number): string {
  const [year = 1970, number = 1] = month.split("-").map(Number);
  return usageMonthOf(Date.UTC(year, number - 1 + delta, 1));
}

/** The month a `?month=` value asks for, or the current month when it's missing, malformed or in the future. */
export function chosenUsageMonth(value: string | null, now: number): string {
  const current = usageMonthOf(now);
  return value && MONTH.test(value) && value <= current ? value : current;
}

/** "September 2026". */
export function formatUsageMonth(month: string): string {
  const [year = 1970, number = 1] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, number - 1, 1));
}

const DOLLARS = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const COUNT = new Intl.NumberFormat("en-GB");

/** "$1,234.56", or "< $0.01" for a cost too small to show in cents. */
export function formatUsd(amount: number): string {
  return amount > 0 && amount < 0.005 ? "< $0.01" : DOLLARS.format(amount);
}

/** "1,234,567". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** A usage row's operation, named as the catalogue names it, or its id for an operation the catalogue doesn't list. */
export function operationLabel(id: string): string {
  return getOperation(id)?.name ?? id;
}

export type BudgetTone = "ok" | "warn" | "crit";

/** Warn once this share of the budget is used. At 100% operations stop. */
export const BUDGET_WARN_PERCENT = 80;

/** How much of the budget a month's cost has used (can pass 100), and the state that puts it in. */
export function budgetUse(cost: number, budget: number): { percent: number; tone: BudgetTone } {
  // The backend stops operations once cost >= budget, so a budget of 0 is used up from the start.
  const percent = budget > 0 ? (cost / budget) * 100 : 100;
  return { percent, tone: percent >= 100 ? "crit" : percent >= BUDGET_WARN_PERCENT ? "warn" : "ok" };
}

/** The largest budget the API stores: 12 digits, 2 of them after the decimal point. */
export const MAX_BUDGET_USD = 9_999_999_999.99;

/** Read a budget typed in US dollars ("50", "49.99", "$1,000"). */
export function parseBudget(input: string): { amount: number } | { error: string } {
  const text = input.trim();
  if (/^\$?\s*-/.test(text)) return { error: "The budget can't be negative." };
  const digits = text.replace(/^\$\s*/, "").replace(/,/g, "");
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(digits)) return { error: "Enter an amount in US dollars, such as 50 or 49.99." };
  if (/\.\d{3,}$/.test(digits)) return { error: "Use at most 2 decimal places, such as 49.99." };
  const amount = Number(digits);
  if (amount > MAX_BUDGET_USD) return { error: "Enter an amount below $10,000,000,000." };
  return { amount };
}
