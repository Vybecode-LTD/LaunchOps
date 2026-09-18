import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { QueueItem } from "@/lib/api/types";
import { formatUsageMonth, shiftMonth, usageMonthOf } from "@/lib/domain/usage";
import { API, id, makeProject, makeState, type FakeState, type FakeUsageRow } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { changesRequested, stateAs } from "./roles";
import { server } from "./server";

// Settings → Usage (owners): a month's AI usage and estimated cost, the budget, and what happens once it's used.

const thisMonth = usageMonthOf(Date.now());
const lastMonth = shiftMonth(thisMonth, -1);

let row = 0;
function usage(overrides: Partial<FakeUsageRow> = {}): FakeUsageRow {
  row += 1;
  return {
    org_id: "org-1",
    created_at: new Date(Date.now() - row * 1000).toISOString(),
    user_id: "user-1",
    product_id: null,
    operation: "competitor",
    model: "claude-sonnet-5",
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    web_search_requests: 0,
    cost_usd: 0,
    ...overrides,
  };
}

/** Two projects' worth of usage this month: $41.27 in all, 82% of a $50 budget. */
function busyMonth(partial: Partial<FakeState> = {}) {
  const fieldnote = makeProject({ name: "Fieldnote" });
  const halcyon = makeProject({ name: "Halcyon Studio" });
  const state = makeState({
    projects: [fieldnote, halcyon],
    budgets: { "org-1": 50 },
    aiUsage: [
      usage({
        operation: "market_analysis",
        product_id: fieldnote.id,
        input_tokens: 120_000,
        output_tokens: 18_000,
        cache_creation_input_tokens: 4_000,
        cache_read_input_tokens: 60_000,
        web_search_requests: 12,
        cost_usd: 30.12,
      }),
      usage({ operation: "competitor", product_id: halcyon.id, user_id: "user-2", input_tokens: 40_000, output_tokens: 9_000, web_search_requests: 5, cost_usd: 11.15 }),
      usage({ operation: "press_targets", product_id: halcyon.id, input_tokens: 500, output_tokens: 100, cost_usd: 0 }),
    ],
    ...partial,
  });
  return { state, fieldnote, halcyon };
}

const region = (name: string) => screen.findByRole("region", { name });
const rowOf = (table: HTMLElement, name: string) => within(table).getByRole("rowheader", { name }).closest("tr")!;

describe("Usage", () => {
  it("shows an owner this month's estimated cost, how much of the budget it uses, and where it went", async () => {
    const { state } = busyMonth();
    renderApp("/settings/usage", state);

    const month = await region(formatUsageMonth(thisMonth));
    expect(await within(month).findByText("$41.27")).toBeInTheDocument();
    expect(within(month).getByText("$50.00")).toBeInTheDocument();
    expect(within(month).getByText("Near the budget")).toBeInTheDocument();
    const meter = within(month).getByRole("meter", { name: "Budget used" });
    expect(meter).toHaveAttribute("aria-valuenow", "83");
    expect(meter).toHaveAttribute("aria-valuetext", "82% of the $50.00 budget used");
    expect(meter.parentElement).toHaveClass("meter-warn");
    expect(within(month).getByText("Operations stop when the month's cost reaches the budget.")).toBeInTheDocument();
    for (const [label, value] of [["Calls", "3"], ["Input tokens", "160,500"], ["Output tokens", "27,100"], ["Cache writes", "4,000"], ["Cache reads", "60,000"], ["Web searches", "17"]]) {
      expect(within(month).getByText(label!).nextElementSibling).toHaveTextContent(value!);
    }
    expect(within(month).getByText("Costs are estimates from Anthropic's published prices for tokens and web searches, not an invoice.")).toBeInTheDocument();
    expect(within(month).queryByText(/without a known price/)).not.toBeInTheDocument();

    const operations = await region("By operation");
    expect(rowOf(operations, "Market analysis")).toHaveTextContent(/\$30\.12\s*1\s*120,000\s*18,000\s*12/);
    expect(rowOf(operations, "Competitor deep-dive")).toHaveTextContent("$11.15");
    // An operation the catalogue doesn't list keeps its id.
    expect(rowOf(operations, "press_targets")).toHaveTextContent("$0.00");
    expect(within(operations).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Market analysis", "Competitor deep-dive", "press_targets"]);

    expect(rowOf(await region("By project"), "Fieldnote")).toHaveTextContent("$30.12");
    expect(rowOf(await region("By project"), "Halcyon Studio")).toHaveTextContent(/\$11\.15\s*2/);
    expect(rowOf(await region("By member"), "sam@northstar.example")).toHaveTextContent("$11.15");
    expect(rowOf(await region("By model"), "claude-sonnet-5")).toHaveTextContent(/\$41\.27\s*3/);
    expect(requestsTo(state, "GET", "/api/organisation/usage")).toEqual([{ method: "GET", path: `/api/organisation/usage?month=${thisMonth}`, body: null }]);
    expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute("aria-current", "page");
  });

  it("moves between months, but never past this one", async () => {
    const { state } = busyMonth();
    const { user, router } = renderApp("/settings/usage", state);

    await region(formatUsageMonth(thisMonth));
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous month" }));

    const previous = await region(formatUsageMonth(lastMonth));
    expect(await within(previous).findByText(`No AI usage in ${formatUsageMonth(lastMonth)}`)).toBeInTheDocument();
    expect(within(previous).getByText("No operations or reports ran that month.")).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?month=${lastMonth}`);
    expect(screen.queryByRole("region", { name: "By operation" })).not.toBeInTheDocument();
    // The budget isn't tied to a month.
    expect(await region("Monthly budget")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(await within(await region(formatUsageMonth(thisMonth))).findByText("$41.27")).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  it("shows this month for a future or malformed month in the address", async () => {
    const { state } = busyMonth();
    renderApp("/settings/usage?month=2999-01", state);

    expect(await within(await region(formatUsageMonth(thisMonth))).findByText("$41.27")).toBeInTheDocument();
  });

  it("says when nothing has run this month yet", async () => {
    renderApp("/settings/usage", makeState());

    const month = await region(formatUsageMonth(thisMonth));
    expect(await within(month).findByText(`No AI usage in ${formatUsageMonth(thisMonth)}`)).toBeInTheDocument();
    expect(within(month).getByText("Operations and reports run this month will show here with what they cost.")).toBeInTheDocument();
  });

  it("says how many calls have no cost estimate because their model has no known price", async () => {
    const state = makeState({
      aiUsage: [usage({ cost_usd: 2 }), usage({ model: "claude-future-9", cost_usd: null }), usage({ model: "claude-future-9", cost_usd: null })],
    });
    renderApp("/settings/usage", state);

    const month = await region(formatUsageMonth(thisMonth));
    expect(
      await within(month).findByText("2 calls used a model without a known price, so they have no cost estimate and aren't in the cost."),
    ).toBeInTheDocument();
    expect(within(month).getByText("No monthly budget, so operations don't stop for cost. Set one below.")).toBeInTheDocument();
    expect(rowOf(await region("By model"), "claude-future-9")).toHaveTextContent(/\$0\.00\s*2 not priced/);
  });

  it("says so for a single unpriced call", async () => {
    renderApp("/settings/usage", makeState({ aiUsage: [usage({ model: "claude-future-9", cost_usd: null })] }));

    expect(
      await screen.findByText("1 call used a model without a known price, so it has no cost estimate and isn't in the cost."),
    ).toBeInTheDocument();
  });

  it("shows a used-up budget, and what it means for the rest of the month", async () => {
    const { state } = busyMonth({ budgets: { "org-1": 40 } });
    renderApp("/settings/usage", state);

    const month = await region(formatUsageMonth(thisMonth));
    expect(await within(month).findByText("Budget reached")).toBeInTheDocument();
    expect(within(month).getByRole("meter", { name: "Budget used" })).toHaveAttribute("aria-valuetext", "103% of the $40.00 budget used");
    expect(within(month).getByRole("meter", { name: "Budget used" }).parentElement).toHaveClass("meter-crit");
    expect(within(month).getByText("AI operations can't start again until next month, unless the budget is raised.")).toBeInTheDocument();
  });

  it("describes a past month over the budget without saying operations are stopped now", async () => {
    const state = makeState({ budgets: { "org-1": 10 }, aiUsage: [usage({ created_at: `${lastMonth}-15T12:00:00.000Z`, cost_usd: 4 })] });
    renderApp(`/settings/usage?month=${lastMonth}`, state);

    const month = await region(formatUsageMonth(lastMonth));
    expect(await within(month).findByText("Within budget")).toBeInTheDocument();
    expect(within(month).getByRole("meter", { name: "Budget used" }).parentElement).toHaveClass("meter-ok");
  });

  it("sets the budget after checking the amount, and removes it", async () => {
    const state = makeState({ aiUsage: [usage({ cost_usd: 3 })] });
    const { user } = renderApp("/settings/usage", state);

    const panel = await region("Monthly budget");
    const amount = within(panel).getByLabelText("Budget in US dollars");
    const save = within(panel).getByRole("button", { name: "Save budget" });
    expect(within(panel).queryByRole("button", { name: "Remove budget" })).not.toBeInTheDocument();

    await user.click(save);
    expect(within(panel).getByRole("alert")).toHaveTextContent("Enter an amount in US dollars, such as 50 or 49.99.");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    await user.type(amount, "49.999");
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(save);
    expect(within(panel).getByRole("alert")).toHaveTextContent("Use at most 2 decimal places, such as 49.99.");
    await user.clear(amount);
    await user.type(amount, "-5");
    await user.click(save);
    expect(within(panel).getByRole("alert")).toHaveTextContent("The budget can't be negative.");
    expect(changesRequested(state)).toEqual([]);

    await user.clear(amount);
    await user.type(amount, "$1,000");
    await user.click(save);

    expect(await screen.findByText("Budget saved")).toBeInTheDocument();
    expect(screen.getByText("AI operations stop when a month's cost reaches $1,000.00.")).toBeInTheDocument();
    expect(requestsTo(state, "PUT", "/api/organisation/budget").map((r) => r.body)).toEqual([{ monthly_ai_budget_usd: 1000 }]);
    const month = await region(formatUsageMonth(thisMonth));
    expect(await within(month).findByText("$1,000.00")).toBeInTheDocument();
    expect(within(month).getByText("Within budget")).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Monthly budget" })).getByLabelText("Budget in US dollars")).toHaveValue("1000.00"));
    expect(within(screen.getByRole("region", { name: "Monthly budget" })).getByRole("button", { name: "Save budget" })).toBeDisabled();

    await user.click(within(screen.getByRole("region", { name: "Monthly budget" })).getByRole("button", { name: "Remove budget" }));

    expect(await screen.findByText("Budget removed")).toBeInTheDocument();
    expect(await within(month).findByText("No monthly budget, so operations don't stop for cost. Set one below.")).toBeInTheDocument();
    expect(requestsTo(state, "PUT", "/api/organisation/budget").map((r) => r.body)).toEqual([{ monthly_ai_budget_usd: 1000 }, { monthly_ai_budget_usd: null }]);
    expect(state.activity.map((entry) => entry.action)).toEqual(["organisation.budget_changed", "organisation.budget_changed"]);
  });

  it("shows why the budget wasn't saved", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/usage", state);
    const panel = await region("Monthly budget");
    server.use(http.put(`${API}/api/organisation/budget`, () => HttpResponse.json({ detail: [{ msg: "Decimal input should have no more than 12 digits in total" }] }, { status: 422 })));

    await user.type(within(panel).getByLabelText("Budget in US dollars"), "25");
    await user.click(within(panel).getByRole("button", { name: "Save budget" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent("Decimal input should have no more than 12 digits in total");
    expect(screen.queryByText("Budget saved")).not.toBeInTheDocument();
  });

  it("says why usage couldn't load", async () => {
    renderApp("/settings/usage", makeState());
    // Added after the fake's handlers, so it answers first; the page is still loading.
    server.use(http.get(`${API}/api/organisation/usage`, () => HttpResponse.json({ detail: "LaunchOps can't reach its database right now. Try again in a moment." }, { status: 503 })));

    expect(await screen.findByText("LaunchOps can't reach its database right now. Try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Monthly budget" })).not.toBeInTheDocument();
  });

  it("explains to anyone but an owner that usage needs the Owner role, and doesn't ask for it", async () => {
    const state = stateAs("approver", { aiUsage: [usage({ cost_usd: 5 })] });
    renderApp("/settings/usage", state);

    expect(
      await screen.findByText("Seeing what AI operations cost and setting the monthly budget needs the Owner role in Northstar Ventures."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organisation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
    expect(requestsTo(state, "GET", "/api/organisation/usage")).toEqual([]);
  });
});

describe("When the AI budget is used up", () => {
  const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const refusal = `Northstar Ventures has used its AI budget for ${month} ($5.00). An owner can raise it in Settings → Usage.`;
  const spent = () => {
    const project = makeProject();
    return { project, state: makeState({ projects: [project], budgets: { "org-1": 5 }, aiUsage: [usage({ product_id: project.id, cost_usd: 5.2 })] }) };
  };

  it("keeps the run sheet open with the reason when a workflow can't start", async () => {
    const { project, state } = spent();
    const { user } = renderApp(`/projects/${project.id}/operations?run=blog`, state);

    await user.click(await screen.findByRole("button", { name: "Run blog post draft" }));

    const sheet = screen.getByRole("dialog", { name: "Run blog post draft" });
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(refusal);
    expect(state.queue).toEqual([]);
  });

  it("says why a report wasn't generated, in the run sheet and a notification", async () => {
    const { project, state } = spent();
    const { user } = renderApp(`/projects/${project.id}/operations?run=pricing`, state);

    await user.click(await screen.findByRole("button", { name: "Run pricing strategy" }));

    expect(await screen.findByText("Pricing strategy failed")).toBeInTheDocument();
    expect(await within(screen.getByRole("dialog", { name: "Run pricing strategy" })).findByRole("alert")).toHaveTextContent(refusal);
    expect(state.projects[0]?.pricing_result).toBeUndefined();
  });

  it("says why content wasn't repurposed", async () => {
    const { project, state } = spent();
    const { user } = renderApp(`/projects/${project.id}/operations?run=repurpose`, state);

    await user.type(await screen.findByLabelText(/Content to repurpose/), "We launch Friday");
    await user.click(screen.getByRole("button", { name: "Repurpose" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(refusal);
  });

  it("says why a failed operation didn't run again", async () => {
    const { project, state } = spent();
    const failed: QueueItem = {
      id: id("queue"), product_id: project.id, workflow_id: "trend", status: "failed", content: { error: "Overloaded" }, preview: "Failed: Overloaded",
      input_params: "", notes: "", created_at: new Date().toISOString(),
    };
    state.queue = [failed];
    const { user } = renderApp(`/projects/${project.id}/review/${failed.id}?status=failed`, state);

    await user.click(await screen.findByRole("button", { name: "Run again" }));

    expect(await screen.findByText("Run again failed")).toBeInTheDocument();
    expect(screen.getByText(refusal)).toBeInTheDocument();
  });
});

// DEFAULT_MONTHLY_AI_BUDGET_USD caps any organisation that hasn't set its own budget. The page used to
// read only the organisation's stored budget, which is null under the default, so it told owners
// their operations would never stop for cost while they were in fact capped.
describe("The platform's default budget", () => {
  it("shows the default an organisation without its own budget is held to, not 'no budget'", async () => {
    const state = makeState({ defaultBudget: 25, aiUsage: [usage({ cost_usd: 10 })] });
    renderApp("/settings/usage", state);

    const month = await region(formatUsageMonth(thisMonth));
    expect(await within(month).findByText("$25.00")).toBeInTheDocument();
    expect(within(month).getByText("Within budget")).toBeInTheDocument();
    expect(
      within(month).getByText("This is the platform's default budget. You can set a lower one below; only a platform administrator can set a higher one."),
    ).toBeInTheDocument();
    expect(within(month).queryByText("No monthly budget, so operations don't stop for cost. Set one below.")).not.toBeInTheDocument();
  });

  it("says the default applies again when an organisation removes its own budget", async () => {
    const state = makeState({ defaultBudget: 25, budgets: { "org-1": 60 } });
    const { user } = renderApp("/settings/usage", state);

    const panel = await region("Monthly budget");
    await user.click(within(panel).getByRole("button", { name: "Remove budget" }));

    expect(await screen.findByText("Budget removed")).toBeInTheDocument();
    expect(screen.getByText("The platform's default budget of $25.00 applies again.")).toBeInTheDocument();
    expect(screen.queryByText("AI operations no longer stop for cost.")).not.toBeInTheDocument();
  });

  it("tells an owner who isn't a platform admin that they can't go above the default", async () => {
    // BUG-031: every account that registers owns its own organisation, so letting an owner raise
    // their budget past the default would let anyone lift the cap on the deployment's API key.
    const state = makeState({ defaultBudget: 25 });
    state.user = { ...state.user, role: "user" };
    const { user } = renderApp("/settings/usage", state);

    const panel = await region("Monthly budget");
    await user.type(within(panel).getByLabelText("Budget in US dollars"), "1000");
    await user.click(within(panel).getByRole("button", { name: "Save budget" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "An organisation can set a monthly AI budget of up to $25.00. A platform administrator can set a higher one.",
    );
    expect(state.budgets?.["org-1"]).toBeUndefined();
  });

  it("stops an organisation at the default and says which budget it reached", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project], defaultBudget: 5, aiUsage: [usage({ product_id: project.id, cost_usd: 5.2 })] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=blog`, state);

    await user.click(await screen.findByRole("button", { name: "Run blog post draft" }));

    const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const sheet = screen.getByRole("dialog", { name: "Run blog post draft" });
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      `Northstar Ventures has used the default AI budget for ${month} ($5.00). A platform administrator can raise it.`,
    );
    expect(state.queue).toEqual([]);
  });
});
