import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CalendarEvent, Project, Template } from "@/lib/api/types";
import { addDays, formatDateKey, toDateKey } from "@/lib/domain/dates";
import { id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { changesRequested, stateAs } from "./roles";

// What each organisation role sees in the shell, the portfolio, the calendar and the library (docs/PHASE1_DESIGN.md, D2).

const today = toDateKey(new Date());
const tomorrow = addDays(today, 1);

type User = ReturnType<typeof renderApp>["user"];

async function openPalette(user: User) {
  await user.keyboard("{Control>}k{/Control}");
  return screen.findByRole("dialog", { name: "Search and run" });
}

function makeEvent(project: Project, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id: id("event"), date: today, title: "Teaser thread", product_id: project.id, product_name: project.name, platform: "twitter", color: project.color, ...overrides };
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return { id: id("template"), name: "Intro email", type: "email", tags: ["outreach", "email"], content: "Keep it short.", source_product: "", created_at: "2026-09-10T09:00:00+00:00", ...overrides };
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
const dayCell = (date: string) => dayButton(date).parentElement!;
const agendaFor = (date: string) => screen.getByRole("region", { name: formatDateKey(date, "long") });
/** The draggable chip around an entry's title on the calendar grid. */
const chipOf = (title: string, date: string) => within(dayCell(date)).getByText(title).closest("[draggable]")!;

describe("Shell by role", () => {
  it("gives a viewer no way to create a project, capture an idea or run an operation", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const state = stateAs("viewer", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}`, state);
    await screen.findByRole("heading", { level: 1, name: /Fieldnote/ });

    const rail = screen.getByRole("navigation", { name: "Projects" });
    expect(within(rail).getByRole("link", { name: "Fieldnote" })).toBeInTheDocument();
    expect(within(rail).queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Capture idea" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Run an operation" })).not.toBeInTheDocument();

    const palette = await openPalette(user);
    expect(within(palette).queryByRole("group", { name: /^Run on/ })).not.toBeInTheDocument();
    expect(within(palette).queryByRole("option", { name: "New project" })).not.toBeInTheDocument();
    expect(within(palette).queryByRole("option", { name: "Capture an idea" })).not.toBeInTheDocument();
    // Themes and navigation stay available.
    expect(within(palette).getByRole("option", { name: "Use dark theme" })).toBeInTheDocument();
    expect(within(palette).getByRole("option", { name: "Fieldnote — Launch plan" })).toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("doesn't invite a viewer in an organisation without projects to create the first one", async () => {
    renderApp("/portfolio", stateAs("viewer"));

    const main = await screen.findByRole("main");
    expect(await within(main).findByText("Your launch board is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create your first project" })).not.toBeInTheDocument();
  });

  it("lets an editor capture an idea and start a project from the palette", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const state = stateAs("editor", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}`, state);
    await screen.findByRole("heading", { level: 1, name: /Fieldnote/ });

    expect(within(screen.getByRole("navigation", { name: "Projects" })).getByRole("button", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run an operation" })).toBeInTheDocument();
    const palette = await openPalette(user);
    expect(within(palette).getByRole("group", { name: "Run on Fieldnote" })).toBeInTheDocument();
    expect(within(palette).getByRole("option", { name: "New project" })).toBeInTheDocument();
    await user.click(within(palette).getByRole("option", { name: "Capture an idea" }));

    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    await user.type(within(dialog).getByLabelText("Idea"), "Studio tour video");
    await user.click(within(dialog).getByRole("button", { name: "Save idea" }));

    expect(await screen.findByText("Idea captured")).toBeInTheDocument();
    expect(state.captures.map((c) => c.text)).toEqual(["Studio tour video"]);
  });

  it("still offers an owner the first project, idea capture and operations", async () => {
    const { user } = renderApp("/portfolio", makeState());
    expect(await screen.findByRole("button", { name: "Create your first project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capture idea" })).toBeInTheDocument();

    const palette = await openPalette(user);
    expect(within(palette).getByRole("option", { name: "New project" })).toBeInTheDocument();
    expect(within(palette).getByRole("option", { name: "Capture an idea" })).toBeInTheDocument();
  });
});

describe("Portfolio by role", () => {
  it("tells a viewer that creating a project needs the Editor role", async () => {
    const state = stateAs("viewer");
    renderApp("/portfolio", state);

    const main = await screen.findByRole("main");
    expect(await within(main).findByText("Creating a project needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(main).queryByRole("button", { name: "Create a project" })).not.toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("shows a viewer the launch board without New project", async () => {
    const state = stateAs("viewer", { projects: [makeProject({ name: "Fieldnote" })] });
    renderApp("/portfolio", state);

    expect(await within(await screen.findByRole("table")).findByRole("link", { name: "Fieldnote" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
  });

  it("tells a viewer an operation may be stuck without advising them to cancel it", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const stuck = {
      id: id("queue"), product_id: project.id, workflow_id: "reddit", status: "running" as const, content: {}, preview: "", input_params: "", notes: "",
      created_at: new Date(Date.now() - 75 * 60_000).toISOString(),
    };
    const state = stateAs("viewer", { projects: [project], queue: [stuck] });
    const { user } = renderApp("/portfolio", state);

    const attention = await screen.findByRole("region", { name: "Needs attention" });
    expect(
      await within(attention).findByText("Fieldnote · it may be stuck. Cancelling it and running it again needs the Editor role in Northstar Ventures."),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "1 stalled" }));
    const popover = await screen.findByRole("dialog", { name: "Operations in progress" });
    expect(within(popover).getByText("Fieldnote · running over 60 min. Cancelling it needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor create a project", async () => {
    const state = stateAs("editor", { projects: [makeProject({ name: "Fieldnote" })] });
    const { user } = renderApp("/portfolio", state);

    const main = await screen.findByRole("main");
    await user.click(await within(main).findByRole("button", { name: "New project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    await user.type(within(dialog).getByLabelText("Name"), "Halcyon Studio");
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("heading", { level: 1, name: /Halcyon Studio/ })).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/products")).toHaveLength(1);
  });
});

describe("Calendar by role", () => {
  it("shows a viewer launches and entries without ways to add, change or move them", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    const state = stateAs("viewer", { projects: [project], calendar: [makeEvent(project)] });
    const { user } = renderApp("/calendar", state);

    await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    expect(within(agendaFor(today)).getByText("Halcyon Studio launches")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Teaser thread" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Teaser thread" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change launch date for Halcyon Studio" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Drag an entry to another day/)).not.toBeInTheDocument();
    expect(chipOf("Teaser thread", today)).toHaveAttribute("draggable", "false");
    expect(chipOf("Halcyon Studio", today)).toHaveAttribute("draggable", "false");

    // Neither dragging nor double-clicking a day does anything.
    drag(chipOf("Teaser thread", today), dayCell(tomorrow));
    drag(chipOf("Halcyon Studio", today), dayCell(tomorrow));
    await user.dblClick(dayButton(tomorrow));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(agendaFor(tomorrow)).getByText("Adding entries needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(dayCell(today)).getByText("Teaser thread")).toBeInTheDocument();
    expect(within(dayCell(today)).getByText("Halcyon Studio")).toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor add entries and move them", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const state = stateAs("editor", { projects: [project], calendar: [makeEvent(project)] });
    const { user } = renderApp("/calendar", state);

    await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    drag(chipOf("Teaser thread", today), dayCell(tomorrow));
    expect(await screen.findByText("Entry moved")).toBeInTheDocument();
    await waitFor(() => expect(state.calendar[0]?.date).toBe(tomorrow));

    await user.click(screen.getByRole("button", { name: "Add entry" }));
    const dialog = await screen.findByRole("dialog", { name: "Add calendar entry" });
    await user.type(within(dialog).getByLabelText("Title"), "Launch thread");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect(await screen.findByText("Entry added")).toBeInTheDocument();
    expect(state.calendar.map((e) => e.title)).toEqual(["Teaser thread", "Launch thread"]);
  });

  it("still gives an owner every way to add, change and move entries", async () => {
    const project = makeProject({ name: "Halcyon Studio", launch_date: today });
    renderApp("/calendar", makeState({ projects: [project], calendar: [makeEvent(project)] }));

    await waitFor(() => within(dayCell(today)).getByText("Teaser thread"));
    expect(screen.getByRole("button", { name: "Add entry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Teaser thread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Teaser thread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change launch date for Halcyon Studio" })).toBeInTheDocument();
    expect(screen.getByText(/Drag an entry to another day to reschedule it\./)).toBeInTheDocument();
    expect(chipOf("Teaser thread", today)).toHaveAttribute("draggable", "true");
    expect(chipOf("Halcyon Studio", today)).toHaveAttribute("draggable", "true");
  });
});

describe("Library by role", () => {
  it("lets a viewer read and copy templates and ideas, without saving, using or deleting them", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const idea = { id: id("capture"), text: "Reddit AMA for launch week", product_id: project.id, created_at: new Date().toISOString() };
    const state = stateAs("viewer", { projects: [project], templates: [makeTemplate()], captures: [idea] });
    const { user } = renderApp("/library", state);

    const preview = await screen.findByRole("region", { name: "Intro email" });
    expect(within(preview).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(within(preview).queryByRole("button", { name: "Delete template" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Templates" })).queryByRole("button", { name: "New" })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Ideas · 1" }));
    const ideas = await screen.findByRole("region", { name: "Ideas" });
    expect(await within(ideas).findByText("Reddit AMA for launch week")).toBeInTheDocument();
    // Once the project has loaded, an editor would be offered "Use in an operation" here.
    expect(await within(ideas).findByRole("link", { name: "Fieldnote" })).toBeInTheDocument();
    expect(within(ideas).queryByRole("button", { name: "Capture idea" })).not.toBeInTheDocument();
    expect(within(ideas).queryByRole("link", { name: "Use in an operation" })).not.toBeInTheDocument();
    expect(within(ideas).queryByRole("button", { name: "Delete idea" })).not.toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("tells a viewer with an empty library that adding templates and capturing ideas need the Editor role", async () => {
    const { user } = renderApp("/library", stateAs("viewer"));

    const templates = await screen.findByRole("region", { name: "Templates" });
    expect(within(templates).getByText("Adding templates needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Ideas/ }));
    const ideas = await screen.findByRole("region", { name: "Ideas" });
    expect(within(ideas).getByText("Capturing ideas needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
  });

  it("lets an editor save and delete templates and work with ideas", async () => {
    const project = makeProject();
    const idea = { id: id("capture"), text: "Reddit AMA for launch week", product_id: project.id, created_at: new Date().toISOString() };
    const state = stateAs("editor", { projects: [project], captures: [idea] });
    const { user } = renderApp("/library", state);

    await user.click(await screen.findByRole("button", { name: "New" }));
    const dialog = await screen.findByRole("dialog", { name: "New template" });
    await user.type(within(dialog).getByLabelText("Name"), "Intro email");
    await user.type(within(dialog).getByLabelText("Content"), "Keep it short.");
    await user.click(within(dialog).getByRole("button", { name: "Save template" }));
    expect(await screen.findByText("Template saved")).toBeInTheDocument();
    const preview = await screen.findByRole("region", { name: "Intro email" });
    expect(within(preview).getByRole("button", { name: "Delete template" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Ideas · 1" }));
    const ideas = await screen.findByRole("region", { name: "Ideas" });
    expect(await within(ideas).findByRole("link", { name: "Use in an operation" })).toBeInTheDocument();
    expect(within(ideas).getByRole("button", { name: "Capture idea" })).toBeInTheDocument();
    expect(within(ideas).getByRole("button", { name: "Delete idea" })).toBeInTheDocument();
  });
});
