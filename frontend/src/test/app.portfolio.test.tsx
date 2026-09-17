import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { CalendarEvent, EmailItem, QueueItem } from "@/lib/api/types";
import { addDays, formatDateKey, toDateKey } from "@/lib/domain/dates";
import { id, makeProject, makeState } from "./fakeApi";
import { renderApp } from "./renderApp";

const today = toDateKey(new Date());
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function queueItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: id("queue"),
    product_id: "",
    workflow_id: "social_posts",
    status: "pending",
    content: {},
    preview: "",
    input_params: "",
    notes: "",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function email(productId: string, overrides: Partial<EmailItem> = {}): EmailItem {
  return {
    id: id("email"),
    product_id: productId,
    source_queue_id: null,
    recipient_name: "Dana Whitfield",
    recipient_email: "dana@synthweekly.example",
    subject: "A plugin you could build in an afternoon",
    body: "Hi Dana",
    status: "pending",
    error: "",
    sent_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function calendarEntry(project: { id: string; name: string; color: string }, overrides: Partial<CalendarEvent>): CalendarEvent {
  return { id: id("event"), date: today, product_id: project.id, product_name: project.name, platform: "all", title: "Post", color: project.color, ...overrides };
}

/**
 * Five projects, one in each launch state, with work waiting across them. Readiness scores:
 * Northwind 8 (no launch date), Orbit and Tessera 12, Halcyon 16 (company set), Fieldnote 18 (pricing report).
 */
function portfolio() {
  const tessera = makeProject({ name: "Tessera Health", tagline: "Patient intake for small clinics", launch_date: addDays(today, -2) });
  const halcyon = makeProject({ name: "Halcyon Studio", launch_date: addDays(today, 5), company_details: { company_name: "Halcyon Ltd" } });
  const fieldnote = makeProject({ name: "Fieldnote", launch_date: addDays(today, 20), pricing_result: { tiers: [{ name: "Pro", price: "$9/mo" }] } });
  const orbit = makeProject({ name: "Orbit Payroll", status: "launched", launch_date: addDays(today, -10) });
  const northwind = makeProject({ name: "Northwind Notes", launch_date: null });
  const failedTrend = queueItem({ product_id: fieldnote.id, workflow_id: "trend", status: "failed", created_at: minutesAgo(120) });
  const failedBlog = queueItem({ product_id: halcyon.id, workflow_id: "blog", status: "failed" });
  const stalled = queueItem({ product_id: tessera.id, workflow_id: "reddit", status: "running", created_at: minutesAgo(75) });
  const state = makeState({
    projects: [tessera, halcyon, fieldnote, orbit, northwind],
    queue: [
      queueItem({ product_id: tessera.id, workflow_id: "blog" }),
      queueItem({ product_id: tessera.id, workflow_id: "social_posts" }),
      queueItem({ product_id: halcyon.id, workflow_id: "ad_copy" }),
      queueItem({ product_id: fieldnote.id, workflow_id: "podcasts" }),
      failedTrend,
      failedBlog,
      stalled,
      queueItem({ product_id: halcyon.id, workflow_id: "competitor", status: "running" }),
    ],
    emails: [
      email(tessera.id, { status: "failed", error: "550 Mailbox unavailable" }),
      email(halcyon.id),
      email(orbit.id, { status: "sent", sent_at: minutesAgo(60) }),
    ],
    calendar: [
      calendarEntry(tessera, { title: "Podcast recording", date: addDays(today, 9), platform: "linkedin" }),
      calendarEntry(halcyon, { title: "Teaser video", date: today, platform: "twitter" }),
      calendarEntry(tessera, { title: "Last week's post", date: addDays(today, -1) }),
      calendarEntry(fieldnote, { title: "Newsletter feature", date: addDays(today, 1), platform: "all" }),
      calendarEntry(fieldnote, { title: "Webinar", date: addDays(today, 20) }),
    ],
  });
  return { state, tessera, halcyon, fieldnote, orbit, northwind, failedTrend, failedBlog, stalled };
}

/** Matches text made of these parts in this order, however the markup spaces them. */
const inOrder = (...texts: string[]) => new RegExp(texts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"));

const boardNames = () =>
  within(screen.getByRole("table"))
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("Portfolio overview", () => {
  it("summarises launches, results awaiting review and unsent email", async () => {
    const { state } = portfolio();
    renderApp("/portfolio", state);

    const summary = await screen.findByRole("region", { name: "Portfolio summary" });
    await waitFor(() => expect(summary).toHaveTextContent(inOrder("Projects", "5", "4 pre-launch · 1 launched")));
    expect(summary).toHaveTextContent(inOrder("Launching in 30 days", "2", `Next: Halcyon Studio, ${formatDateKey(addDays(today, 5), "short")}`));
    const review = within(summary).getByRole("link", { name: /Awaiting review/ });
    await waitFor(() => expect(review).toHaveTextContent(inOrder("Awaiting review", "4", "Across 3 projects")));
    expect(review).toHaveAttribute("href", "/review");
    const outbox = within(summary).getByRole("link", { name: /Unsent emails/ });
    await waitFor(() => expect(outbox).toHaveTextContent(inOrder("Unsent emails", "2", "1 failed to send")));
    expect(outbox).toHaveAttribute("href", "/outbox");
  });

  it("lists what needs attention, most urgent first", async () => {
    const { state, tessera, halcyon, fieldnote, failedTrend, failedBlog, stalled } = portfolio();
    renderApp("/portfolio", state);

    const attention = await screen.findByRole("region", { name: "Needs attention" });
    await waitFor(() => expect(within(attention).getAllByRole("link")).toHaveLength(8));
    const links = within(attention).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Tessera Health is past its launch date", `/projects/${tessera.id}`],
      ["Halcyon Studio launches in 5 days", `/projects/${halcyon.id}/plan`],
      ["Trend report failed", `/projects/${fieldnote.id}/review/${failedTrend.id}`],
      ["Blog post draft failed", `/projects/${halcyon.id}/review/${failedBlog.id}`],
      ["Reddit communities has been running 75 minutes", `/projects/${tessera.id}/review/${stalled.id}`],
      ["1 email failed to send", "/outbox"],
      ["2 results awaiting review in Tessera Health", `/projects/${tessera.id}/review`],
      ["1 result awaiting review in Halcyon Studio", `/projects/${halcyon.id}/review`],
    ]);
    expect(attention).toHaveTextContent(`Launch date was ${formatDateKey(addDays(today, -2), "medium")}. Mark it launched or set a new date.`);
    expect(attention).toHaveTextContent("Readiness 16 of 100 — below 70 inside the final 14 days.");
    expect(attention).toHaveTextContent("Fieldnote · 2 h ago");
    expect(attention).toHaveTextContent("Tessera Health · it may be stuck. Open it to cancel it and run it again.");
    // Fieldnote's result awaiting review is the ninth item.
    expect(within(attention).getByText("And 1 more")).toBeInTheDocument();
  });

  it("shows launch days and calendar entries for the next 14 days in date order", async () => {
    const { state, halcyon, tessera } = portfolio();
    renderApp("/portfolio", state);

    const upcoming = await screen.findByRole("region", { name: "Next 14 days" });
    await waitFor(() => expect(within(upcoming).getAllByRole("listitem")).toHaveLength(4));
    const entries = within(upcoming).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent(inOrder("Today", "Teaser video", "Halcyon Studio · X (Twitter)"));
    expect(entries[1]).toHaveTextContent(inOrder("Tomorrow", "Newsletter feature", "Fieldnote · All channels"));
    expect(entries[2]).toHaveTextContent(inOrder(formatDateKey(addDays(today, 5), "weekday"), "Halcyon Studio launches", "Launch day"));
    expect(entries[3]).toHaveTextContent(inOrder(formatDateKey(addDays(today, 9), "weekday"), "Podcast recording", "Tessera Health · LinkedIn"));
    expect(within(entries[2]!).getByRole("link", { name: "Halcyon Studio launches" })).toHaveAttribute("href", `/projects/${halcyon.id}`);
    expect(within(entries[3]!).getByRole("link", { name: "Podcast recording" })).toHaveAttribute("href", `/projects/${tessera.id}`);
    expect(within(upcoming).getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
  });
});

describe("Launch board", () => {
  it("sorts by launch date, readiness or name, and filters by status or text", async () => {
    const { state } = portfolio();
    const { user } = renderApp("/portfolio", state);
    const show = async (option: string) => user.click(within(screen.getByRole("group", { name: "Show" })).getByRole("button", { name: option }));
    const sortBy = async (option: string) => user.click(within(screen.getByRole("group", { name: "Sort by" })).getByRole("button", { name: option }));

    await waitFor(() => expect(boardNames()).toEqual(["Tessera Health", "Halcyon Studio", "Fieldnote", "Northwind Notes", "Orbit Payroll"]));

    await sortBy("Launch date");
    // Soonest first, counting past dates; projects without a date go last.
    expect(boardNames()).toEqual(["Orbit Payroll", "Tessera Health", "Halcyon Studio", "Fieldnote", "Northwind Notes"]);
    await sortBy("Readiness");
    expect(boardNames()).toEqual(["Northwind Notes", "Orbit Payroll", "Tessera Health", "Halcyon Studio", "Fieldnote"]);
    await sortBy("Name");
    expect(boardNames()).toEqual(["Fieldnote", "Halcyon Studio", "Northwind Notes", "Orbit Payroll", "Tessera Health"]);

    await show("Pre-launch");
    expect(boardNames()).toEqual(["Fieldnote", "Halcyon Studio", "Northwind Notes", "Tessera Health"]);
    await show("Launched");
    expect(boardNames()).toEqual(["Orbit Payroll"]);
    await show("All");

    const search = screen.getByLabelText("Filter projects by name");
    await user.type(search, "clinics");
    expect(boardNames()).toEqual(["Tessera Health"]);
    expect(screen.getByRole("heading", { level: 2, name: /Launch board/ })).toHaveTextContent("1 shown");

    await user.clear(search);
    await user.type(search, "spreadsheet");
    expect(within(screen.getByRole("table")).getByText("No projects match")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryAllByRole("link")).toEqual([]);

    await user.clear(search);
    await user.click(within(screen.getByRole("table")).getByRole("link", { name: "Halcyon Studio" }));
    expect(await screen.findByRole("heading", { level: 1, name: /Halcyon Studio/ })).toBeInTheDocument();
  });

  it("opens a project from anywhere on its row except the row's own controls", async () => {
    const { state } = portfolio();
    const { user } = renderApp("/portfolio", state);
    // Re-queried after each step: if a control had opened the project, the board would be gone.
    const row = () => within(screen.getByRole("table")).getByRole("row", { name: /Tessera Health/ });
    await screen.findByRole("row", { name: /Tessera Health/ });

    await user.click(within(row()).getByRole("button", { name: /^Overdue/ }));
    expect(await screen.findByText("Launch date has passed and status is still Pre-launch.")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(within(row()).getByRole("button", { name: /^Launch readiness 12 of 100/ }));
    expect(await screen.findByText(/Score = 50 × plan items done/)).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(within(row()).getByRole("button", { name: /^0 of 5 reports generated/ }));
    expect(await screen.findByText("0 of 5 reports generated")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(within(row()).getByText("T+2d"));
    expect(screen.getByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();

    await user.click(within(row()).getByText(/Patient intake for small clinics/));
    expect(await screen.findByRole("heading", { level: 1, name: /Tessera Health/ })).toBeInTheDocument();
  });

  it("invites you to create the first project when the portfolio is empty", async () => {
    const { user } = renderApp("/portfolio", makeState());

    const main = await screen.findByRole("main");
    expect(await within(main).findByText("Your launch board is empty")).toBeInTheDocument();
    expect(within(main).queryByRole("table")).not.toBeInTheDocument();
    await user.click(within(main).getByRole("button", { name: "Create a project" }));

    expect(await screen.findByRole("dialog", { name: "New project" })).toBeInTheDocument();
  });
});
