import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { CalendarEvent, Project } from "@/lib/api/types";
import { addDays, formatDateKey, formatWeekRange, toDateKey, weekDays } from "@/lib/domain/dates";
import { API, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

const today = toDateKey(new Date());
const tomorrow = addDays(today, 1);

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

const dayButton = (date: string) => screen.getByRole("button", { name: new RegExp(`^${formatDateKey(date, "long")}`) });
/** The calendar cell (month) or column (week) that holds a day's button and its entries. */
const dayCell = (date: string) => dayButton(date).parentElement!;

describe("Calendar", () => {
  it("shows launch dates and adds an entry on the selected day", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    const { user } = renderApp("/calendar", state);

    expect(await screen.findByText("Halcyon Studio launches")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /^Add/ })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add calendar entry" });
    await user.type(within(dialog).getByLabelText("Title"), "Launch thread");
    await user.selectOptions(within(dialog).getByLabelText("Channel"), "twitter");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/calendar")[0]?.body).toEqual({ date: today, title: "Launch thread", product_id: project.id, platform: "twitter" }),
    );
  });

  it("reschedules an entry by dragging it to another day, and undoes the move", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const event = makeEvent(project);
    const state = makeState({ projects: [project], calendar: [event] });
    const { user } = renderApp("/calendar", state);

    const chip = await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    drag(chip, dayCell(tomorrow));

    await waitFor(() => expect(within(dayCell(tomorrow)).getByText("Teaser thread")).toBeInTheDocument());
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/calendar")[0]?.body).toEqual({ date: tomorrow }));
    expect(await screen.findByText("Entry moved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/calendar")[1]?.body).toEqual({ date: today }));
    await waitFor(() => expect(within(dayCell(today)).getByText("Teaser thread")).toBeInTheDocument());
  });

  it("puts an entry back and says why when a move fails", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project], calendar: [makeEvent(project)] });
    renderApp("/calendar", state);
    server.use(http.patch(`${API}/api/calendar/:id`, () => HttpResponse.json({ detail: "Event not found" }, { status: 404 })));

    drag(await waitFor(() => within(dayCell(today)).getByText("Teaser thread")), dayCell(tomorrow));

    expect(await screen.findByText("Entry not moved")).toBeInTheDocument();
    expect(screen.getByText("Event not found")).toBeInTheDocument();
    await waitFor(() => expect(within(dayCell(today)).getByText("Teaser thread")).toBeInTheDocument());
    expect(within(dayCell(tomorrow)).queryByText("Teaser thread")).not.toBeInTheDocument();
  });

  it("moves a launch date by dragging the launch", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    renderApp("/calendar", state);

    drag(await waitFor(() => within(dayCell(today)).getByText("Halcyon Studio")), dayCell(tomorrow));

    await waitFor(() => expect(within(dayCell(tomorrow)).getByText("Halcyon Studio")).toBeInTheDocument());
    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({ launch_date: tomorrow }));
    expect(await screen.findByText("Halcyon Studio launch moved")).toBeInTheDocument();
  });

  it("edits an entry from the agenda", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const other = makeProject({ name: "Northwind" });
    const state = makeState({ projects: [project, other], calendar: [makeEvent(project)] });
    const { user } = renderApp("/calendar", state);

    await user.click(await screen.findByRole("button", { name: "Edit Teaser thread" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit calendar entry" });
    const title = within(dialog).getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Launch thread");
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: tomorrow } });
    await user.selectOptions(within(dialog).getByLabelText("Project"), other.id);
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", "/api/calendar")[0]?.body).toEqual({ title: "Launch thread", date: tomorrow, product_id: other.id, platform: "twitter" }),
    );
    expect(await screen.findByText("Entry updated")).toBeInTheDocument();
  });

  it("changes a launch date from the agenda without dragging", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = makeState({ projects: [project] });
    const { user } = renderApp("/calendar", state);

    await user.click(await screen.findByRole("button", { name: "Change launch date for Halcyon Studio" }));
    const dialog = await screen.findByRole("dialog", { name: "Change launch date" });
    fireEvent.change(within(dialog).getByLabelText("Launch date"), { target: { value: tomorrow } });
    await user.click(within(dialog).getByRole("button", { name: "Save date" }));

    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({ launch_date: tomorrow }));
  });

  it("shows one week at a time and steps by week", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const state = makeState({ projects: [project], calendar: [makeEvent(project)] });
    const { user, router } = renderApp("/calendar", state);

    await user.click(await screen.findByRole("button", { name: "Week" }));
    expect(router.state.location.search).toBe("?view=week");
    const week = weekDays(today);
    expect(screen.getByRole("heading", { name: formatWeekRange(week) })).toBeInTheDocument();
    week.forEach((day) => expect(dayButton(day)).toBeInTheDocument());
    expect(within(dayCell(today)).getByText("Teaser thread")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));
    const next = weekDays(addDays(today, 7));
    expect(await screen.findByRole("heading", { name: formatWeekRange(next) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(`^${formatDateKey(week[0]!, "long")}`) })).not.toBeInTheDocument();
  });
});

describe("Library", () => {
  it("creates a template with tags operations look for", async () => {
    const state = makeState();
    const { user } = renderApp("/library", state);

    await user.click(await screen.findByRole("button", { name: "New" }));
    const dialog = await screen.findByRole("dialog", { name: "New template" });
    await user.type(within(dialog).getByLabelText("Name"), "Intro email");
    await user.type(within(dialog).getByLabelText("Tags"), "outreach,email,");
    await user.type(within(dialog).getByLabelText("Content"), "Keep it short.");
    await user.click(within(dialog).getByRole("button", { name: "Save template" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/templates")[0]?.body).toEqual({ name: "Intro email", type: "content", tags: ["outreach", "email"], content: "Keep it short." }),
    );
  });

  it("turns an idea into an operation with the idea as instructions", async () => {
    const project = makeProject();
    const idea = { id: id("capture"), text: "Reddit AMA for launch week", product_id: project.id, created_at: new Date().toISOString() };
    const state = makeState({ projects: [project], captures: [idea] });
    const { user } = renderApp("/library?tab=ideas", state);

    await user.click(await screen.findByRole("link", { name: "Use in an operation" }));
    expect(await screen.findByText(/pick an operation and it will be filled in as instructions/)).toBeInTheDocument();
    await user.click(within(screen.getByRole("region", { name: "Content" })).getAllByRole("button", { name: "Run" })[0]!);
    expect(await screen.findByLabelText(/Instructions/)).toHaveValue("Reddit AMA for launch week");
  });
});

describe("Capture", () => {
  it("captures an idea against the current project from the top bar", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}`, state);

    await user.click(await screen.findByRole("button", { name: "Capture idea" }));
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    await user.type(within(dialog).getByLabelText("Idea"), "Testimonial clips");
    await user.click(within(dialog).getByRole("button", { name: "Save idea" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/captures")[0]?.body).toEqual({ text: "Testimonial clips", product_id: project.id }));
  });
});

describe("New project", () => {
  it("creates a project with its type and launch date, then opens it", async () => {
    const state = makeState({ projects: [makeProject({ name: "Existing" })] });
    const { user } = renderApp("/portfolio", state);

    const main = await screen.findByRole("main");
    await user.click(await within(main).findByRole("button", { name: "New project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    await user.click(within(dialog).getByRole("button", { name: "Service" }));
    await user.type(within(dialog).getByLabelText("Name"), "Halcyon Studio");
    await user.type(within(dialog).getByLabelText(/Launch date/), "2026-10-01");
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/products")[0]?.body).toMatchObject({ name: "Halcyon Studio", project_type: "service", launch_date: "2026-10-01" }),
    );
    expect(await screen.findByRole("heading", { level: 1, name: /Halcyon Studio/ })).toBeInTheDocument();
  });
});
