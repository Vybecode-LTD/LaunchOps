import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { QueueItem } from "@/lib/api/types";
import { API, id, liveUpdates, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { changesRequested, stateAs } from "./roles";
import { server } from "./server";

// Cancelling a running operation from Review (POST /api/queue/{id}/cancel, Editor), and how running and possibly
// stuck operations are described now that they run as durable jobs with retries.

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function running(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: id("queue"),
    product_id: "",
    workflow_id: "competitor",
    status: "running",
    content: {},
    preview: "Running competitor...",
    input_params: "Focus on Europe",
    notes: "",
    created_at: minutesAgo(3),
    ...overrides,
  };
}

const detailHeading = (name: RegExp) => screen.findByRole("heading", { level: 2, name });

async function confirmCancel(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Cancel operation" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Cancel competitor deep-dive?" });
  expect(dialog).toHaveTextContent("It stops without a result and shows as failed in Review. You can run it again afterwards.");
  await user.click(within(dialog).getByRole("button", { name: "Cancel operation" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
}

describe("Cancelling an operation", () => {
  it("cancels one that hasn't started: it fails at once with who cancelled it, and the log records it", async () => {
    const project = makeProject();
    const item = running({ product_id: project.id });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    await confirmCancel(user);

    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText(`Competitor deep-dive for ${project.name} stopped without a result.`)).toBeInTheDocument();
    expect(await screen.findByText("This operation failed: Cancelled by jordan@northstar.example.")).toBeInTheDocument();
    expect(await detailHeading(/^Competitor deep-dive/)).toHaveTextContent("Failed");
    expect(screen.getByRole("button", { name: "Run again" })).toBeInTheDocument();
    expect(requestsTo(state, "POST", `/api/queue/${item.id}/cancel`)).toHaveLength(1);
    expect(state.activity[0]).toMatchObject({ action: "operation.cancelled", target_id: item.id });
  });

  it("stops one that's running at its next check, and shows it failed when the live update arrives", async () => {
    const project = makeProject();
    const item = running({ product_id: project.id });
    const state = makeState({ projects: [project], queue: [item], runningJobs: [item.id] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);

    await confirmCancel(user);

    expect(await screen.findByText("Stopping competitor deep-dive")).toBeInTheDocument();
    expect(screen.getByText("It stops within about 20 seconds, then shows as failed.")).toBeInTheDocument();
    // Until the worker stops it, it's still running.
    expect(screen.getByText("Working on it")).toBeInTheDocument();
    expect(await detailHeading(/^Competitor deep-dive/)).toHaveTextContent("Running");

    // The worker stops the job and the backend announces it.
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));
    Object.assign(state.queue[0]!, { status: "failed", content: { error: "Cancelled by jordan@northstar.example." }, preview: "Failed: Cancelled by jordan@northstar.example." });
    liveUpdates.publish("queue", item.id, "failed");

    expect(await screen.findByText("This operation failed: Cancelled by jordan@northstar.example.")).toBeInTheDocument();
    expect(await detailHeading(/^Competitor deep-dive/)).toHaveTextContent("Failed");
  });

  it("says when there was nothing left to cancel, and shows how it finished", async () => {
    const project = makeProject();
    const item = running({ product_id: project.id });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);
    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    // It finished while the page was open, without a live update reaching it.
    Object.assign(state.queue[0]!, { status: "pending", content: { competitors: [{ name: "PatchForge", threat_level: 7 }] }, preview: "Analyzed 1 competitors" });

    await confirmCancel(user);

    expect(await screen.findByText("Nothing to cancel")).toBeInTheDocument();
    expect(screen.getByText("This operation has already finished.")).toBeInTheDocument();
    expect(await detailHeading(/^Competitor deep-dive/)).toHaveTextContent("Needs review");
    expect(state.activity).toEqual([]);
  });

  it("keeps it running when you choose to, and says why a cancel failed", async () => {
    const project = makeProject();
    const item = running({ product_id: project.id });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/review/${item.id}?status=running`, state);

    await user.click(await screen.findByRole("button", { name: "Cancel operation" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Cancel competitor deep-dive?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep running" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(requestsTo(state, "POST", "/api/queue")).toEqual([]);

    server.use(http.post(`${API}/api/queue/:id/cancel`, () => HttpResponse.error()));
    await confirmCancel(user);

    expect(await screen.findByText("Cancel failed")).toBeInTheDocument();
    expect(screen.getByText("Can't reach the LaunchOps server. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByText("Working on it")).toBeInTheDocument();
  });

  it("shows a retry that's waiting, in the list and in the result", async () => {
    const project = makeProject();
    const note = "Trying again in 30 seconds: The AI provider returned an error (HTTP 529). Try again in a few minutes.";
    const item = running({ product_id: project.id, preview: note });
    renderApp(`/projects/${project.id}/review/${item.id}?status=running`, makeState({ projects: [project], queue: [item] }));

    const list = await screen.findByRole("list", { name: "Results" });
    expect(within(list).getByRole("link", { name: /Competitor deep-dive/ })).toHaveTextContent(note);
    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    expect(screen.getAllByText(note)).toHaveLength(2);
    expect(screen.getByText(/carries on if you close LaunchOps/)).toBeInTheDocument();
  });

  it("describes an operation running over an hour as possibly stuck, and offers an editor to cancel it", async () => {
    const project = makeProject();
    const item = running({ product_id: project.id, workflow_id: "blog", created_at: minutesAgo(75) });
    const state = stateAs("editor", { projects: [project], queue: [item] });
    renderApp(`/projects/${project.id}/review/${item.id}?status=running`, state);

    expect(await screen.findByText("This operation may be stuck")).toBeInTheDocument();
    expect(
      screen.getByText(
        /^It has been running for 75 minutes\. Even when a failure is retried, an operation should finish within 60 minutes, so something may be wrong: for example, no worker is running to finish it\. Cancel it, then run it again\.$/,
      ),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Results" })).getByRole("link", { name: /Blog post draft/ })).toHaveTextContent("Stalled");
    expect(screen.getByRole("button", { name: "Cancel operation" })).toBeInTheDocument();
    // Running it again before it's cancelled would start a second copy.
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
  });
});

describe("Cancelling by role", () => {
  it("tells a viewer that cancelling needs the Editor role, without advice they can't follow", async () => {
    const project = makeProject();
    const active = running({ product_id: project.id });
    const stuck = running({ product_id: project.id, workflow_id: "blog", created_at: minutesAgo(75) });
    const state = stateAs("viewer", { projects: [project], queue: [active, stuck] });
    const { user } = renderApp(`/projects/${project.id}/review/${active.id}?status=running`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    expect(screen.getByText("Cancelling it needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel operation" })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("list", { name: "Results" })).getByRole("link", { name: /Blog post draft/ }));
    expect(await screen.findByText("This operation may be stuck")).toBeInTheDocument();
    expect(screen.queryByText(/Cancel it, then run it again/)).not.toBeInTheDocument();
    expect(screen.getByText("Cancelling it needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete result" })).not.toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor cancel from Review across projects", async () => {
    const project = makeProject();
    const item = running({ product_id: project.id });
    const state = stateAs("editor", { projects: [project], queue: [item] });
    const { user } = renderApp(`/review/${item.id}?status=running`, state);

    await confirmCancel(user);
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(state.queue[0]?.status).toBe("failed");
  });
});
