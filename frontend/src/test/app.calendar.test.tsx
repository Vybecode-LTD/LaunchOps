import { describe, expect, it } from "vitest";
import { createEvent, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { CalendarEvent, Project } from "@/lib/api/types";
import { addDays, formatDateKey, formatMonth, monthStart, toDateKey, weekDays } from "@/lib/domain/dates";
import { UNDO_WINDOW_MS } from "@/lib/queries/hooks";
import { API, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

// More calendar behaviour; the basics (adding, dragging, editing, the week view) are in app.planning.test.tsx.

const today = toDateKey(new Date());
const tomorrow = addDays(today, 1);
// Always inside the current month's grid, which shows at least five days of the next month.
const inTwoDays = addDays(today, 2);
const OFFLINE = "Can't reach the LaunchOps server. Check your connection and try again.";

function makeEvent(project: Project, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: id("event"),
    date: today,
    title: "Teaser thread",
    product_id: project.id,
    product_name: project.name,
    platform: "twitter",
    color: project.color,
    ...overrides,
  };
}

/** A stand-in for the browser's DataTransfer, shared by the events of one drag gesture. */
function dragData() {
  const store = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "all",
    get types() {
      return [...store.keys()];
    },
    setData: (type: string, value: string) => void store.set(type, value),
    getData: (type: string) => store.get(type) ?? "",
    clearData: () => store.clear(),
    setDragImage: () => undefined,
  };
}

function drag(source: Element, target: Element) {
  const dataTransfer = dragData();
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(source, { dataTransfer });
}

/** jsdom has no DragEvent, so the pointer's next element has to be attached by hand. */
function dragLeave(target: Element, dataTransfer: ReturnType<typeof dragData>, relatedTarget: Element) {
  const event = createEvent.dragLeave(target, { dataTransfer });
  Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
  fireEvent(target, event);
}

const dayButton = (date: string) => screen.getByRole("button", { name: new RegExp(`^${formatDateKey(date, "long")}`) });
/** The calendar cell (month) or column (week) that holds a day's button and its entries. */
const dayCell = (date: string) => dayButton(date).parentElement!;
/** The agenda panel is titled with the selected day. */
const agendaFor = (date: string) => screen.getByRole("region", { name: formatDateKey(date, "long") });
const projectsLoaded = () => waitFor(() => expect(screen.getByRole("button", { name: "Add entry" })).toBeEnabled());

describe("Calendar navigation", () => {
  it("steps through months and jumps back to today", async () => {
    const state = makeState({ projects: [makeProject()] });
    const { user } = renderApp("/calendar", state);

    expect(await screen.findByRole("heading", { name: formatMonth(today) })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { name: formatMonth(monthStart(today, 1)) })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    const lastMonth = monthStart(today, -1);
    expect(screen.getByRole("heading", { name: formatMonth(lastMonth) })).toBeInTheDocument();

    await user.click(dayButton(lastMonth));
    expect(agendaFor(lastMonth)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { name: formatMonth(today) })).toBeInTheDocument();
    expect(agendaFor(today)).toBeInTheDocument();
    expect(dayButton(today)).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a day's entries in the agenda when you select the day or one of its entries", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const state = makeState({
      projects: [project],
      calendar: [makeEvent(project, { date: tomorrow }), makeEvent(project, { date: inTwoDays, title: "Demo video", platform: "all" })],
    });
    const { user } = renderApp("/calendar", state);

    await waitFor(() => within(dayCell(tomorrow)).getByText("Teaser thread"));
    expect(agendaFor(today)).toHaveTextContent("Nothing on this day");

    await user.click(dayButton(tomorrow));
    expect(dayButton(tomorrow)).toHaveAttribute("aria-pressed", "true");
    expect(within(agendaFor(tomorrow)).getByText("Teaser thread")).toBeInTheDocument();
    expect(agendaFor(tomorrow)).toHaveTextContent("Halcyon Studio · X (Twitter)");

    await user.click(within(dayCell(inTwoDays)).getByText("Demo video"));
    expect(within(agendaFor(inTwoDays)).getByText("Demo video")).toBeInTheDocument();
    expect(agendaFor(inTwoDays)).toHaveTextContent("Halcyon Studio · All channels");
  });

  it("switches from the week view back to the month that holds the selected day", async () => {
    const state = makeState({ projects: [makeProject()] });
    const { user, router } = renderApp("/calendar?view=week", state);
    const day = weekDays(today).find((d) => d !== today)!;
    await projectsLoaded();

    await user.click(dayButton(day));
    expect(dayButton(day)).toHaveAttribute("aria-pressed", "true");
    expect(agendaFor(day)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("heading", { name: formatMonth(day) })).toBeInTheDocument();
    expect(dayButton(day)).toHaveAttribute("aria-pressed", "true");
  });

  it("filters the calendar to one project, and adds new entries to that project", async () => {
    const halcyon = makeProject({ name: "Halcyon Studio" });
    const northwind = makeProject({ name: "Northwind", launch_date: today });
    const state = makeState({
      projects: [halcyon, northwind],
      calendar: [makeEvent(halcyon), makeEvent(northwind, { title: "Podcast pitch" })],
    });
    const { user } = renderApp("/calendar", state);

    await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    await user.selectOptions(screen.getByLabelText("Filter by project"), northwind.id);

    expect(within(dayCell(today)).queryByText("Teaser thread")).not.toBeInTheDocument();
    expect(within(dayCell(today)).getByText("Podcast pitch")).toBeInTheDocument();
    expect(within(agendaFor(today)).queryByText("Teaser thread")).not.toBeInTheDocument();
    expect(within(agendaFor(today)).getByText("Northwind launches")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog", { name: "Add calendar entry" });
    expect(within(dialog).getByLabelText("Project")).toHaveValue(northwind.id);
  });
});

describe("Calendar entries", () => {
  it("opens the add dialog on a double-clicked day or the day selected in the agenda", async () => {
    const state = makeState({ projects: [makeProject()] });
    const { user } = renderApp("/calendar", state);
    await projectsLoaded();

    await user.dblClick(dayButton(tomorrow));
    let dialog = await screen.findByRole("dialog", { name: "Add calendar entry" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue(tomorrow);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(dayButton(inTwoDays));
    await user.click(screen.getByRole("button", { name: "Add" }));
    dialog = await screen.findByRole("dialog", { name: "Add calendar entry" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue(inTwoDays);
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(requestsTo(state, "POST", "/api/calendar")).toEqual([]);
  });

  it("opens the add dialog on a double-clicked day in the week view", async () => {
    const state = makeState({ projects: [makeProject()] });
    const { user } = renderApp("/calendar?view=week", state);
    const day = weekDays(today).find((d) => d !== today)!;
    await projectsLoaded();

    await user.dblClick(dayButton(day));

    const dialog = await screen.findByRole("dialog", { name: "Add calendar entry" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue(day);
  });

  it("keeps the edit dialog open with the server's reason when a change can't be saved", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const other = makeProject({ name: "Northwind" });
    const state = makeState({ projects: [project, other], calendar: [makeEvent(project)] });
    const { user } = renderApp("/calendar", state);
    server.use(http.patch(`${API}/api/calendar/:id`, () => HttpResponse.json({ detail: "Project not found" }, { status: 400 })));

    await user.click(await screen.findByRole("button", { name: "Edit Teaser thread" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit calendar entry" });
    await user.selectOptions(within(dialog).getByLabelText("Project"), other.id);
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Project not found");
    expect(screen.queryByText("Entry updated")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(agendaFor(today)).getByRole("link", { name: "Halcyon Studio" })).toBeInTheDocument();
  });

  it("keeps the launch date dialog open with the server's reason when the date can't be saved", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    const { user } = renderApp("/calendar", state);
    server.use(http.patch(`${API}/api/products/:id`, () => HttpResponse.json({ detail: "Product not found" }, { status: 404 })));

    await user.click(await screen.findByRole("button", { name: "Change launch date for Halcyon Studio" }));
    const dialog = await screen.findByRole("dialog", { name: "Change launch date" });
    fireEvent.change(within(dialog).getByLabelText("Launch date"), { target: { value: tomorrow } });
    await user.click(within(dialog).getByRole("button", { name: "Save date" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Product not found");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(within(dayCell(today)).getByText("Halcyon Studio")).toBeInTheDocument());
  });

  it("removes an entry from the agenda at once and deletes it when the undo window closes", async () => {
    const project = makeProject();
    const event = makeEvent(project);
    const state = makeState({ projects: [project], calendar: [event] });
    const { user } = renderApp("/calendar", state);

    await user.click(await screen.findByRole("button", { name: "Delete Teaser thread" }));

    await waitFor(() => expect(within(dayCell(today)).queryByText("Teaser thread")).not.toBeInTheDocument());
    expect(agendaFor(today)).toHaveTextContent("Nothing on this day");
    expect(await screen.findByText("Entry deleted")).toBeInTheDocument();
    expect(requestsTo(state, "DELETE", "/api/calendar")).toEqual([]);
    await waitFor(() => expect(requestsTo(state, "DELETE", `/api/calendar/${event.id}`)).toHaveLength(1), { timeout: UNDO_WINDOW_MS + 3000 });
  }, 20_000);
});

describe("Calendar drag and drop", () => {
  it("highlights the day under a dragged entry until the pointer leaves that day", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project], calendar: [makeEvent(project)] });
    renderApp("/calendar", state);

    const chip = await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    const target = dayCell(tomorrow);
    const dataTransfer = dragData();
    fireEvent.dragStart(chip, { dataTransfer });
    fireEvent.dragEnter(target, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    expect(target).toHaveClass("dropTarget");

    // Moving over the day's own button still counts as being over the day.
    dragLeave(target, dataTransfer, dayButton(tomorrow));
    expect(target).toHaveClass("dropTarget");

    dragLeave(target, dataTransfer, dayCell(inTwoDays));
    expect(target).not.toHaveClass("dropTarget");
    fireEvent.dragEnd(chip, { dataTransfer });
  });

  it("only moves entries for drags that carry a readable calendar entry", async () => {
    const project = makeProject();
    const event = makeEvent(project);
    const state = makeState({ projects: [project], calendar: [event] });
    renderApp("/calendar", state);

    const chip = await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    const target = dayCell(tomorrow);

    // Text dragged in from another app: the day doesn't offer to take it.
    const text = dragData();
    text.setData("text/plain", "Teaser thread");
    fireEvent.dragEnter(target, { dataTransfer: text });
    fireEvent.dragOver(target, { dataTransfer: text });
    expect(target).not.toHaveClass("dropTarget");
    fireEvent.drop(target, { dataTransfer: text });

    // Drops that claim to be an entry but whose data can't be trusted.
    const probe = dragData();
    fireEvent.dragStart(chip, { dataTransfer: probe });
    fireEvent.dragEnd(chip, { dataTransfer: probe });
    const entryType = probe.types.find((type) => type !== "text/plain")!;
    for (const payload of ["not json", JSON.stringify({ kind: "event", id: event.id })]) {
      const unreadable = dragData();
      unreadable.setData(entryType, payload);
      fireEvent.drop(target, { dataTransfer: unreadable });
    }

    // A real drag afterwards is the only move sent.
    drag(chip, dayCell(inTwoDays));
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/calendar").map((r) => r.body)).toEqual([{ date: inTwoDays }]));
    expect(within(dayCell(tomorrow)).queryByText("Teaser thread")).not.toBeInTheDocument();
  });

  it("moves a launch back on Undo", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    const { user } = renderApp("/calendar", state);

    drag(await waitFor(() => within(dayCell(today)).getByText("Halcyon Studio")), dayCell(tomorrow));
    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({ launch_date: tomorrow }));

    await user.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[1]?.body).toEqual({ launch_date: today }));
    await waitFor(() => expect(within(dayCell(today)).getByText("Halcyon Studio")).toBeInTheDocument());
    expect(within(dayCell(tomorrow)).queryByText("Halcyon Studio")).not.toBeInTheDocument();
  });

  it("puts a launch back and says why when moving it fails", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    renderApp("/calendar", state);
    server.use(http.patch(`${API}/api/products/:id`, () => HttpResponse.json({ detail: "Product not found" }, { status: 404 })));

    drag(await waitFor(() => within(dayCell(today)).getByText("Halcyon Studio")), dayCell(tomorrow));

    expect(await screen.findByText("Launch date not changed")).toBeInTheDocument();
    expect(screen.getByText("Product not found")).toBeInTheDocument();
    await waitFor(() => expect(within(dayCell(today)).getByText("Halcyon Studio")).toBeInTheDocument());
    // The "moved" notice with its Undo is withdrawn.
    await waitFor(() => expect(screen.queryByText("Halcyon Studio launch moved")).not.toBeInTheDocument());
  });

  it("leaves an entry on its new day and says so when Undo can't be saved", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project], calendar: [makeEvent(project)] });
    const { user } = renderApp("/calendar", state);

    drag(await waitFor(() => within(dayCell(today)).getByText("Teaser thread")), dayCell(tomorrow));
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/calendar")).toHaveLength(1));
    server.use(http.patch(`${API}/api/calendar/:id`, () => HttpResponse.error()));

    await user.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Move not undone")).toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    await waitFor(() => expect(within(dayCell(tomorrow)).getByText("Teaser thread")).toBeInTheDocument());
  });

  it("leaves a launch on its new day and says so when Undo can't be saved", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    const { user } = renderApp("/calendar", state);

    drag(await waitFor(() => within(dayCell(today)).getByText("Halcyon Studio")), dayCell(tomorrow));
    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)).toHaveLength(1));
    server.use(http.patch(`${API}/api/products/:id`, () => HttpResponse.error()));

    await user.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Move not undone")).toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    await waitFor(() => expect(within(dayCell(tomorrow)).getByText("Halcyon Studio")).toBeInTheDocument());
  });
});
