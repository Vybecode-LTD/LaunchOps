import { describe, expect, it, onTestFinished, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { CalendarEvent, Project, QueueItem } from "@/lib/api/types";
import { addDays, formatDateKey, toDateKey } from "@/lib/domain/dates";
import { API, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

// More of the project workspace: its header, overview panels, launch plan and report pages.
// The basics are in app.project.test.tsx and app.projectPages.test.tsx.

const today = toDateKey(new Date());
const OFFLINE = "Can't reach the LaunchOps server. Check your connection and try again.";

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

function calendarEntry(project: Project, date: string, title: string, platform = "twitter"): CalendarEvent {
  return { id: id("event"), date, title, product_id: project.id, product_name: project.name, platform, color: project.color };
}

describe("Project header", () => {
  it("says when a project doesn't exist, with a way back to the portfolio", async () => {
    renderApp("/projects/project-missing", makeState({ projects: [makeProject()] }));

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to portfolio" })).toHaveAttribute("href", "/portfolio");
  });

  it("shows why a project couldn't be loaded instead of calling it missing", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}`, makeState({ projects: [project] }));
    server.use(http.get(`${API}/api/products/:id`, () => HttpResponse.error()));

    expect(await screen.findByRole("alert")).toHaveTextContent(OFFLINE);
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
  });

  it("captures an idea for the open project from its header", async () => {
    const first = makeProject({ name: "Fieldnote" });
    const project = makeProject({ name: "Halcyon Studio" });
    const state = makeState({ projects: [first, project] });
    const { user } = renderApp(`/projects/${project.id}`, state);

    // The page's own button, not the one in the top bar.
    const main = await screen.findByRole("main");
    await user.click(await within(main).findByRole("button", { name: "Capture idea" }));
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    expect(within(dialog).getByLabelText("Project")).toHaveValue(project.id);
    await user.type(within(dialog).getByLabelText("Idea"), "Studio tour video");
    await user.click(within(dialog).getByRole("button", { name: "Save idea" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/captures")[0]?.body).toEqual({ text: "Studio tour video", product_id: project.id }));
  });
});

describe("Project overview panels", () => {
  it("puts results awaiting review first in next steps and lists recent operations with their state", async () => {
    const project = makeProject();
    const posts = queueItem({ product_id: project.id, workflow_id: "social_posts", preview: "Drafted 12 posts" });
    const blog = queueItem({ product_id: project.id, workflow_id: "blog", preview: "Drafted a 900-word post" });
    const reddit = queueItem({ product_id: project.id, workflow_id: "reddit", status: "running", preview: "Running reddit..." });
    const trend = queueItem({ product_id: project.id, workflow_id: "trend", status: "running", preview: "Trying again in 30 seconds: The AI provider timed out." });
    renderApp(`/projects/${project.id}`, makeState({ projects: [project], queue: [posts, blog, reddit, trend] }));

    const steps = await screen.findByRole("region", { name: "Next steps" });
    const review = await within(steps).findByRole("link", { name: "Review 2 results" });
    expect(review).toHaveAttribute("href", `/projects/${project.id}/review`);
    expect(within(steps).getAllByRole("link")[0]).toBe(review);

    const recent = screen.getByRole("region", { name: "Recent operations" });
    await within(recent).findByRole("link", { name: "Social posts" });
    const rows = within(recent).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getByRole("link", { name: "Social posts" })).toHaveAttribute("href", `/projects/${project.id}/review/${posts.id}`);
    expect(rows[0]).toHaveTextContent("Drafted 12 posts");
    expect(within(rows[0]!).getByText("Needs review")).toBeInTheDocument();
    // A running operation shows its state, not its placeholder preview.
    expect(within(rows[2]!).getByRole("link", { name: "Reddit communities" })).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Running")).toBeInTheDocument();
    expect(rows[2]).not.toHaveTextContent("Running reddit...");
    // ...unless it says a retry is waiting.
    expect(rows[3]).toHaveTextContent("Trying again in 30 seconds: The AI provider timed out.");
  });

  it("lists this project's calendar entries for the next 30 days in date order", async () => {
    const project = makeProject();
    const other = makeProject({ name: "Northwind" });
    const calendar = [
      calendarEntry(project, addDays(today, 3), "Teaser thread"),
      calendarEntry(project, addDays(today, 1), "Launch email", "all"),
      calendarEntry(project, addDays(today, -2), "Beta invite"),
      calendarEntry(project, addDays(today, 45), "Retrospective"),
      calendarEntry(other, addDays(today, 2), "Northwind podcast"),
    ];
    renderApp(`/projects/${project.id}`, makeState({ projects: [project, other], calendar }));

    const upcoming = await screen.findByRole("region", { name: "Next 30 days" });
    await within(upcoming).findByText("Launch email");
    const rows = within(upcoming).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText(formatDateKey(addDays(today, 1), "weekday"))).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Launch email")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("All channels")).toBeInTheDocument();
    expect(within(rows[1]!).getByText(formatDateKey(addDays(today, 3), "weekday"))).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Teaser thread")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("says when a launch change can't be saved and keeps the saved status", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}`, state);
    server.use(http.patch(`${API}/api/products/:id`, () => HttpResponse.error()));

    const launch = await screen.findByRole("region", { name: "Launch" });
    await user.selectOptions(within(launch).getByLabelText("Status"), "launched");

    expect(await screen.findByText("Not saved")).toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    expect(within(launch).getByLabelText("Status")).toHaveValue("pre_launch");
  });

  it("lists this project's ideas, captures new ones for it and removes them", async () => {
    const first = makeProject({ name: "Fieldnote" });
    const project = makeProject({ name: "Halcyon Studio" });
    const idea = (p: Project, text: string) => ({ id: id("capture"), text, product_id: p.id, created_at: new Date().toISOString() });
    const state = makeState({ projects: [first, project], captures: [idea(project, "Studio tour video"), idea(first, "Field recording pack")] });
    const { user } = renderApp(`/projects/${project.id}`, state);

    const ideas = await screen.findByRole("region", { name: "Ideas" });
    await within(ideas).findByText("Studio tour video");
    expect(within(ideas).queryByText("Field recording pack")).not.toBeInTheDocument();

    await user.click(within(ideas).getByRole("button", { name: "Delete idea" }));
    await waitFor(() => expect(within(ideas).queryByText("Studio tour video")).not.toBeInTheDocument());
    expect(await screen.findByText("Idea deleted")).toBeInTheDocument();

    await user.click(within(ideas).getByRole("button", { name: "Capture" }));
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    expect(within(dialog).getByLabelText("Project")).toHaveValue(project.id);
  });
});

describe("Launch plan", () => {
  it("adds a custom item to a phase", async () => {
    const project = makeProject({ checklist: {} });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/plan`, state);

    const phase = await screen.findByRole("region", { name: /^Pre-launch/ });
    const draft = within(phase).getByLabelText("New Pre-launch item");
    await user.type(draft, "   ");
    expect(within(phase).getByRole("button", { name: "Add" })).toBeDisabled();

    await user.clear(draft);
    await user.type(draft, "Record demo video{Enter}");

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", `/api/products/${project.id}/checklist`).map((r) => r.body)).toEqual([{ "_custom_Pre-Launch": ["Record demo video"] }]),
    );
    expect(draft).toHaveValue("");
    expect(await within(phase).findByLabelText("Record demo video")).not.toBeChecked();
    expect(within(phase).getByRole("button", { name: 'Remove "Record demo video"' })).toBeInTheDocument();
  });
});

describe("Report pages", () => {
  const pricing = { tiers: [{ name: "Creator", price: "$12/mo", recommended: true }], generated_at: "2026-09-12T13:46:00+00:00" };

  it("says when there's no report at an address", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}/reports/roadmap`, makeState({ projects: [project] }));

    expect(await screen.findByText("Report not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All reports" })).toHaveAttribute("href", `/projects/${project.id}/reports`);
  });

  it("prints a report, or copies it as a prompt for an AI assistant", async () => {
    const project = makeProject({ pricing_result: pricing });
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    onTestFinished(() => print.mockRestore());
    const { user } = renderApp(`/projects/${project.id}/reports/pricing`, makeState({ projects: [project] }));

    await user.click(await screen.findByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy as AI assistant prompt" }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toMatch(/^Below are pricing strategy results for VybeCode DSP/));
    expect(await screen.findByText("Prompt copied")).toBeInTheDocument();
  });

  it("copies SEO changes as a prompt for the page the report was made from", async () => {
    const seo = {
      issues: ["Title is 72 characters"],
      optimized: { title: "VybeCode DSP: build audio plugins without code" },
      source_url: "https://dsp.vybecod.example/pricing",
      generated_at: "2026-09-12T13:46:00+00:00",
    };
    const project = makeProject({ seo_result: seo });
    const { user } = renderApp(`/projects/${project.id}/reports/seo`, makeState({ projects: [project] }));

    await user.click(await screen.findByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy as AI assistant prompt" }));

    await waitFor(async () => expect(await navigator.clipboard.readText()).toMatch(/^Update the SEO metadata for https:\/\/dsp\.vybecod\.example\/pricing\./));
    expect(await navigator.clipboard.readText()).toContain("1. Title is 72 characters");
  });
});
