import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { QueueItem, QueueStatus } from "@/lib/api/types";
import { addDays, toDateKey } from "@/lib/domain/dates";
import { keys } from "@/lib/queries/keys";
import { API, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { stateAs } from "./roles";
import { server } from "./server";

// Operations → the launch playbook (components/operations/Playbook.tsx): what to run next, then
// each stage of a launch in order. The domain rules are tested in lib/domain/playbook.test.ts;
// these check what the screen shows and does with them.

function result(productId: string, workflowId: string, status: QueueStatus): QueueItem {
  return {
    id: id("queue"), product_id: productId, workflow_id: workflowId, status, content: {}, preview: "",
    input_params: "", notes: "", created_at: new Date().toISOString(),
  };
}

const nextUp = () => screen.findByRole("region", { name: "Next up" });
const stage = (title: string) => screen.getByRole("heading", { name: new RegExp(title) }).closest("li")!;

describe("The launch playbook", () => {
  it("opens the Operations screen on what to run next", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));

    const hero = await nextUp();
    expect(within(hero).getByText(/Next up · Stage 1 of 5 · Understand the market/)).toBeInTheDocument();
    expect(within(hero).getByRole("heading", { name: "Market analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Playbook" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the run sheet for the recommended operation", async () => {
    const project = makeProject();
    const { user, router } = renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));

    await user.click(within(await nextUp()).getByRole("button", { name: "Run market analysis" }));

    expect(await screen.findByRole("dialog", { name: "Run market analysis" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?run=market_analysis");
  });

  it("moves on as results arrive, and marks each operation's progress", async () => {
    const project = makeProject({ market_analysis: { executive_summary: "Growing." } });
    const state = makeState({
      projects: [project],
      queue: [result(project.id, "competitor", "approved"), result(project.id, "trend", "pending"), result(project.id, "pricing", "failed")],
    });
    renderApp(`/projects/${project.id}/operations`, state);

    // Market analysis is saved, competitor approved, trend awaiting review — pricing failed, so it's next.
    expect(within(await nextUp()).getByRole("heading", { name: "Pricing strategy" })).toBeInTheDocument();
    const understand = stage("Understand the market");
    const row = (name: string) => within(understand).getAllByRole("listitem").find((item) => within(item).queryByText(name))!;
    expect(within(row("Market analysis")).getByText("Done")).toBeInTheDocument();
    expect(within(row("Competitor deep-dive")).getByText("Done")).toBeInTheDocument();
    expect(within(row("Trend report")).getByText("In review")).toBeInTheDocument();
    expect(within(row("Pricing strategy")).getByText("Failed")).toBeInTheDocument();
    expect(within(understand).getByRole("heading")).toHaveTextContent("3 of 4");
  });

  it("shows the stage to work on, and keeps the others one click away", async () => {
    const project = makeProject();
    const { user } = renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));
    await nextUp();

    // The current stage is open; a later one is collapsed until asked for.
    expect(within(stage("Understand the market")).getByText("Competitor deep-dive")).toBeInTheDocument();
    const push = stage("Prepare the push");
    expect(within(push).queryByText("Ad copy variants")).not.toBeInTheDocument();

    await user.click(within(push).getByRole("button", { name: /Prepare the push/ }));

    expect(within(stage("Prepare the push")).getByText("Ad copy variants")).toBeInTheDocument();
  });

  it("says when the launch is close and this stage should already be underway", async () => {
    const project = makeProject({ launch_date: addDays(toDateKey(new Date()), 10) });
    renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));

    const hero = await nextUp();
    expect(within(hero).getByText("Behind: this stage is normally underway 45 days before launch, and launch is 10 days away.")).toBeInTheDocument();
    expect(within(stage("Understand the market")).getByText("Behind")).toBeInTheDocument();
  });

  // A launch date that has passed read "launch is -3 days away", and tomorrow "launch is 1 days away".
  it.each([
    [1, "launch is tomorrow"],
    [0, "launch is today"],
    [-1, "the launch date was yesterday"],
    [-3, "the launch date was 3 days ago"],
  ])("puts a launch date %i days from today in words: %s", async (offset, words) => {
    const project = makeProject({ launch_date: addDays(toDateKey(new Date()), offset) });
    renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));

    const hero = await nextUp();
    expect(within(hero).getByText(`Behind: this stage is normally underway 45 days before launch, and ${words}.`)).toBeInTheDocument();
  });

  it("opens the next stage when the one being worked on finishes, and leaves the finished one as it was", async () => {
    // A stage decides whether it starts open when it first renders. One that becomes current while
    // the screen is open has to open then, or the guide points at a stage that's shut.
    const project = makeProject({ market_analysis: { executive_summary: "Growing." }, pricing_result: { launch_strategy: "Undercut." } });
    const trend = result(project.id, "trend", "running");
    const state = makeState({ projects: [project], queue: [result(project.id, "competitor", "approved"), trend] });
    const { queryClient } = renderApp(`/projects/${project.id}/operations`, state);
    await nextUp();
    expect(within(stage("Fix the positioning")).queryByText("Press kit")).not.toBeInTheDocument();

    // The trend report reaches review, which finishes the first stage.
    trend.status = "pending";
    await queryClient.invalidateQueries({ queryKey: keys.queueAll });

    expect(await within(stage("Fix the positioning")).findByText("Press kit")).toBeInTheDocument();
    // Closing the finished stage would pull its operations out from under someone using them.
    expect(within(stage("Understand the market")).getByText("Competitor deep-dive")).toBeInTheDocument();
  });

  it("reads what's finished from a count of every result, not a page of the newest", async () => {
    // GET /api/queue returns the newest 500 results at most, so an operation whose only approved
    // result was older looked unfinished and was recommended again. The summary counts them all —
    // and is only counts, where the list carried every result's content.
    const project = makeProject();
    const state = makeState({ projects: [project], queue: [result(project.id, "competitor", "approved")] });
    renderApp(`/projects/${project.id}/operations`, state);
    await nextUp();

    expect(requestsTo(state, "GET", `/api/queue/summary?product_id=${project.id}`).length).toBeGreaterThan(0);
    // The screen's other lists of results are counts of one status, like the Review tab's.
    const lists = requestsTo(state, "GET", "/api/queue?").map((r) => new URLSearchParams(r.path.split("?")[1]));
    expect(lists.filter((params) => !params.has("status"))).toEqual([]);
  });

  it("names unfinished groundwork a stage builds on, without stopping anyone running it", async () => {
    const project = makeProject();
    const { user } = renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));
    await nextUp();

    const position = stage("Fix the positioning");
    await user.click(within(position).getByRole("button", { name: /Fix the positioning/ }));

    expect(
      within(stage("Fix the positioning")).getByText("Builds on Understand the market, which isn't finished yet. You can still run these now."),
    ).toBeInTheDocument();
    expect(within(stage("Fix the positioning")).getAllByRole("button", { name: "Run" }).length).toBeGreaterThan(0);
  });

  it("says so when every step is done", async () => {
    const project = makeProject({
      market_analysis: { executive_summary: "Growing." },
      pricing_result: { launch_strategy: "Undercut." },
      press_kit: { boilerplate: "Halcyon." },
      press_release: { headline: "Halcyon launches" },
      seo_result: { current_score: 60 },
    });
    const workflows = ["competitor", "trend", "announcement", "blog", "launch_platforms", "directories", "podcasts", "partnerships", "reddit", "social_posts", "ad_copy", "cold_outreach"];
    const state = makeState({ projects: [project], queue: workflows.map((w) => result(project.id, w, "approved")) });
    renderApp(`/projects/${project.id}/operations`, state);

    const hero = await nextUp();
    expect(within(hero).getByRole("heading", { name: "Every step of the playbook is done" })).toBeInTheDocument();
    expect(within(hero).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the tool that saves nothing out of the steps, and always to hand", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));
    await nextUp();

    const tools = screen.getByRole("region", { name: "Always available" });
    expect(within(tools).getByText("Repurpose content")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Playbook progress" })).toHaveAttribute("aria-valuetext", "0 of 17 steps done");
  });

  it("shows a viewer the plan but no way to run it", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}/operations`, stateAs("viewer", { projects: [project] }));

    const hero = await nextUp();
    expect(within(hero).getByRole("heading", { name: "Market analysis" })).toBeInTheDocument();
    expect(within(hero).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
  });

  it("waits for review rather than asking for work that's already done", async () => {
    // Everything in the current stage is running or awaiting approval: there is nothing to run, and
    // saying "run X" would only duplicate it.
    const project = makeProject({ market_analysis: { executive_summary: "Growing." }, pricing_result: { launch_strategy: "Undercut." } });
    const state = makeState({
      projects: [project],
      queue: [result(project.id, "competitor", "running"), result(project.id, "trend", "pending")],
    });
    renderApp(`/projects/${project.id}/operations`, state);

    const hero = await nextUp();
    expect(await within(hero).findByRole("heading", { name: "Waiting on understand the market" })).toBeInTheDocument();
    expect(within(hero).getByRole("link", { name: "Open Review" })).toHaveAttribute("href", `/projects/${project.id}/review`);
    expect(within(hero).queryByRole("button")).not.toBeInTheDocument();
  });

  it("still guides from saved reports when results can't be loaded, and says so", async () => {
    const project = makeProject({ market_analysis: { executive_summary: "Growing." } });
    renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));
    // After renderApp, which installs the fake backend's own handlers on top of anything added earlier.
    server.use(http.get(`${API}/api/queue/summary`, () => HttpResponse.json({ detail: "Service unavailable" }, { status: 503 })));

    expect(
      await screen.findByText(/Results couldn't be loaded, so the playbook may not show everything that's already done/),
    ).toBeInTheDocument();
    // The saved report still counts, so market analysis is done and the next step moves on.
    expect(within(await nextUp()).getByRole("heading", { name: "Competitor deep-dive" })).toBeInTheDocument();
  });

  it("switches to the full catalogue by category, and back", async () => {
    const project = makeProject();
    const { user, router } = renderApp(`/projects/${project.id}/operations`, makeState({ projects: [project] }));
    await nextUp();

    await user.click(screen.getByRole("button", { name: "All operations" }));

    expect(await screen.findByRole("region", { name: "Research" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?view=all");
    expect(screen.queryByRole("region", { name: "Launch playbook" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Playbook" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByRole("region", { name: "Launch playbook" })).toBeInTheDocument();
  });
});
