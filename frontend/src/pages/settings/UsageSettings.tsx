import { useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import type { UsageBreakdown, UsageSummary } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useSetBudget, useUsage } from "@/lib/queries/hooks";
import { useNow } from "@/lib/hooks/useClock";
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
} from "@/lib/domain/usage";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, Meter, Notice, Panel, Skeleton } from "@/components/ui/Display";
import { Field, FieldStack, Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/toast";
import { RoleRequirement } from "@/components/access/Access";
import settingsStyles from "./Settings.module.css";
import styles from "./UsageSettings.module.css";

/** What AI operations cost the organisation, month by month, and the monthly budget that stops them (owners only). */
export function UsageSettings() {
  const { current, can } = useOrganisation();
  const isOwner = can("owner");
  const now = useNow(60_000);
  const [params, setParams] = useSearchParams();
  const thisMonth = usageMonthOf(now);
  const month = chosenUsageMonth(params.get("month"), now);
  const usage = useUsage(month, isOwner);

  if (!isOwner) {
    return (
      <div className={settingsStyles.stack}>
        <Panel>
          <EmptyState title="AI usage and budget">
            <RoleRequirement action="Seeing what AI operations cost and setting the monthly budget" minimum="owner" />
          </EmptyState>
        </Panel>
      </div>
    );
  }

  const show = (next: string) => {
    const search = new URLSearchParams(params);
    if (next === thisMonth) search.delete("month");
    else search.set("month", next);
    setParams(search, { replace: true });
  };
  const monthName = formatUsageMonth(month);
  // While another month loads, the previous month's figures stand in: show them only for the budget, which isn't monthly.
  const summary = usage.isPlaceholderData ? undefined : usage.data;

  return (
    <div className={settingsStyles.stack}>
      <p className={settingsStyles.lede}>
        What AI operations in {current?.name} cost each month, and the monthly budget that stops them. Months follow UTC.
      </p>
      <Panel
        title={monthName}
        actions={
          <>
            <IconButton label="Previous month" variant="secondary" size="sm" onClick={() => show(shiftMonth(month, -1))}>
              <ChevronLeft aria-hidden="true" />
            </IconButton>
            <IconButton label="Next month" variant="secondary" size="sm" disabled={month >= thisMonth} onClick={() => show(shiftMonth(month, 1))}>
              <ChevronRight aria-hidden="true" />
            </IconButton>
          </>
        }
      >
        <p className="sr-only" aria-live="polite">
          Showing {monthName}
        </p>
        {usage.isError ? (
          <Notice tone="crit">{errorMessage(usage.error)}</Notice>
        ) : !summary ? (
          <Skeleton height={160} />
        ) : summary.total.calls === 0 ? (
          <>
            <EmptyState title={`No AI usage in ${monthName}`}>
              {month === thisMonth
                ? "Operations and reports run this month will show here with what they cost."
                : "No operations or reports ran that month."}
            </EmptyState>
            {month === thisMonth && <BudgetStatement summary={summary} />}
          </>
        ) : (
          <MonthSummary summary={summary} current={month === thisMonth} />
        )}
      </Panel>
      {usage.data && <BudgetPanel key={usage.data.budget_usd ?? "none"} budget={usage.data.budget_usd} defaultBudget={usage.data.default_budget_usd} />}
      {summary && summary.total.calls > 0 && (
        <>
          <Breakdown title="By operation" nameHeader="Operation" rows={summary.by_operation} name={(row) => operationLabel(row.key)} />
          <Breakdown title="By project" nameHeader="Project" rows={summary.by_project} />
          <Breakdown title="By member" nameHeader="Member" rows={summary.by_member} />
          <Breakdown title="By model" nameHeader="Model" rows={summary.by_model} mono />
        </>
      )}
    </div>
  );
}

/**
 * Which budget applies, in one sentence. Used when the month has nothing to chart: the summary is the
 * only other place the budget appears, so without this a brand-new organisation — the one most likely
 * to be on the platform default — saw no sign of its cap until an operation had already cost something.
 */
function BudgetStatement({ summary }: { summary: UsageSummary }) {
  const { effective_budget_usd: budget, budget_source: source } = summary;
  if (budget === null) {
    return <p className={styles.budgetText}>No monthly budget, so operations don&apos;t stop for cost. Set one below.</p>;
  }
  const whose = source === "default" ? "The platform's default budget" : "Your organisation's budget";
  return (
    <p className={styles.budgetText}>
      {whose} of {formatUsd(budget)} applies: operations stop when a month&apos;s cost reaches it.
    </p>
  );
}

function MonthSummary({ summary, current }: { summary: UsageSummary; current: boolean }) {
  // The budget that actually stops operations, not only the one the organisation set: under the
  // platform default the stored budget is null, and reading it said operations never stop for cost.
  const { total, effective_budget_usd: budget, budget_source: source } = summary;
  const use = budget === null ? null : budgetUse(total.cost_usd, budget);
  const stats: Array<[string, number]> = [
    ["Calls", total.calls],
    ["Input tokens", total.input_tokens],
    ["Output tokens", total.output_tokens],
    ["Cache writes", total.cache_creation_input_tokens],
    ["Cache reads", total.cache_read_input_tokens],
    ["Web searches", total.web_search_requests],
  ];

  return (
    <div className={styles.summary}>
      <div className={styles.headline}>
        <div className={styles.figure}>
          <span className="placard">Estimated cost</span>
          <span className={styles.cost}>{formatUsd(total.cost_usd)}</span>
        </div>
        <div className={styles.budget}>
          <span className="placard">Budget</span>
          {budget === null || !use ? (
            <p className={styles.budgetText}>No monthly budget, so operations don&apos;t stop for cost. Set one below.</p>
          ) : (
            <>
              <div className={styles.budgetLine}>
                <span className={styles.budgetAmount}>{formatUsd(budget)}</span>
                {use.tone === "crit" ? (
                  <Pill tone="crit">Budget reached</Pill>
                ) : use.tone === "warn" ? (
                  <Pill tone="warn">Near the budget</Pill>
                ) : (
                  <Pill tone="ok">Within budget</Pill>
                )}
              </div>
              <Meter
                value={use.percent}
                label="Budget used"
                tone={use.tone}
                size="lg"
                display={`${Math.floor(use.percent)}%`}
                valueText={`${Math.floor(use.percent)}% of the ${formatUsd(budget)} budget used`}
              />
              <p className={styles.budgetText}>
                {current && use.tone === "crit"
                  ? "AI operations can't start again until next month, unless the budget is raised."
                  : "Operations stop when the month's cost reaches the budget."}
              </p>
              {source === "default" && (
                <p className={styles.budgetText}>
                  This is the platform&apos;s default budget. You can set a lower one below; only a platform administrator can
                  set a higher one.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <dl className={styles.stats}>
        {stats.map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <dt className="placard">{label}</dt>
            <dd className={styles.statValue}>{formatCount(value)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.notes}>
        <Notice>Costs are estimates from Anthropic&apos;s published prices for tokens and web searches, not an invoice.</Notice>
        {total.unpriced_calls > 0 && (
          <Notice tone="warn">
            {total.unpriced_calls === 1
              ? "1 call used a model without a known price, so it has no cost estimate and isn't in the cost."
              : `${formatCount(total.unpriced_calls)} calls used a model without a known price, so they have no cost estimate and aren't in the cost.`}
          </Notice>
        )}
      </div>
    </div>
  );
}

function BudgetPanel({ budget, defaultBudget }: { budget: number | null; defaultBudget: number | null }) {
  const setBudget = useSetBudget();
  const toast = useToast();
  const [value, setValue] = useState(budget === null ? "" : budget.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "remove" | null>(null);
  const typed = parseBudget(value);
  const unchanged = "amount" in typed && typed.amount === budget;

  const save = (amount: number | null) => {
    setError(null);
    setSaving(amount === null ? "remove" : "save");
    setBudget.mutate(amount, {
      onSuccess: () =>
        toast.show(
          amount === null
            ? {
                title: "Budget removed",
                // Removing an organisation's own budget hands it back to the platform default, if one is on.
                description:
                  defaultBudget !== null
                    ? `The platform's default budget of ${formatUsd(defaultBudget)} applies again.`
                    : "AI operations no longer stop for cost.",
              }
            : { title: "Budget saved", description: `AI operations stop when a month's cost reaches ${formatUsd(amount)}.` },
        ),
      onError: (err) => setError(errorMessage(err)),
      onSettled: () => setSaving(null),
    });
  };

  return (
    <Panel title="Monthly budget">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if ("error" in typed) setError(typed.error);
          else save(typed.amount);
        }}
      >
        <FieldStack>
          <Field
            label="Budget in US dollars"
            hint="When a month's estimated cost reaches it, operations and reports can't start until the next month or until the budget is raised."
            error={error}
          >
            {(props) => (
              <Input
                {...props}
                className={styles.amount}
                mono
                inputMode="decimal"
                autoComplete="off"
                placeholder="50.00"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
          <div className={styles.formActions}>
            {budget !== null && (
              <Button variant="secondary" loading={saving === "remove"} disabled={saving !== null} onClick={() => save(null)}>
                Remove budget
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving === "save"} disabled={saving !== null || unchanged}>
              Save budget
            </Button>
          </div>
        </FieldStack>
      </form>
    </Panel>
  );
}

function Breakdown({
  title,
  nameHeader,
  rows,
  name = (row) => row.label,
  mono = false,
}: {
  title: string;
  nameHeader: string;
  rows: UsageBreakdown[];
  name?: (row: UsageBreakdown) => string;
  mono?: boolean;
}) {
  return (
    <Panel title={title} flush>
      <div className={styles.tableScroll}>
        <table className={settingsStyles.table}>
          <thead>
            <tr>
              <th scope="col" className="placard">
                {nameHeader}
              </th>
              {["Cost", "Calls", "Input tokens", "Output tokens", "Web searches"].map((heading) => (
                <th key={heading} scope="col" className={`placard ${styles.numeric}`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key || row.label}>
                <th scope="row" className={mono ? "mono" : undefined}>
                  {name(row)}
                </th>
                <td className={styles.numeric}>
                  {formatUsd(row.cost_usd)}
                  {row.unpriced_calls > 0 && <span className={styles.unpriced}>{formatCount(row.unpriced_calls)} not priced</span>}
                </td>
                <td className={styles.numeric}>{formatCount(row.calls)}</td>
                <td className={styles.numeric}>{formatCount(row.input_tokens)}</td>
                <td className={styles.numeric}>{formatCount(row.output_tokens)}</td>
                <td className={styles.numeric}>{formatCount(row.web_search_requests)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
