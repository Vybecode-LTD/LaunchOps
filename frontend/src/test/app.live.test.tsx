import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw";
import type { EmailItem, QueueItem } from "@/lib/api/types";
import { id, liveUpdates, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";

// Live updates (GET /api/events): the signed-in app listens to its organisation's changes and refetches what changed.

function running(productId: string): QueueItem {
  return {
    id: id("queue"),
    product_id: productId,
    workflow_id: "competitor",
    status: "running",
    content: {},
    preview: "Running competitor...",
    input_params: "",
    notes: "",
    created_at: new Date().toISOString(),
  };
}

/** What a worker saves when the competitor deep-dive finishes. */
const finished = { status: "pending", content: { competitors: [{ name: "PatchForge", threat_level: 7 }] }, preview: "Analyzed 1 competitors · highest threat 7/10" };

function draft(productId: string): EmailItem {
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
  };
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("Live updates", () => {
  it("shows a finished operation's result as soon as the backend announces it, without waiting for a poll", async () => {
    const project = makeProject();
    const item = running(project.id);
    const state = makeState({ projects: [project], queue: [item] });
    renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    await waitFor(() => expect(liveUpdates.openStreams("org-1")).toBe(1));

    Object.assign(state.queue[0]!, finished);
    liveUpdates.publish("queue", item.id, "pending");

    // Polling would take at least 4 seconds.
    expect((await screen.findAllByRole("img", { name: "Threat level 7 of 10" }, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: /^Competitor deep-dive/ })).toHaveTextContent("Needs review");
  });

  it("shows new Outbox drafts as soon as they're added", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    renderApp("/portfolio", state);

    const rail = await screen.findByRole("navigation", { name: "Workspace" });
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));
    expect(within(rail).getByRole("link", { name: "Outbox" })).toBeInTheDocument();

    state.emails.push(draft(project.id));
    liveUpdates.publish("email", "queue-approved-elsewhere", "drafts");

    expect(await within(rail).findByRole("link", { name: /^Outbox\s*1 unsent emails$/ }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("opens the stream again after the server restarts, and catches up on what changed meanwhile", async () => {
    const project = makeProject();
    const item = running(project.id);
    const state = makeState({ projects: [project], queue: [item], eventsRetryMs: 50 });
    renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));

    // The operation finishes while the server restarts, so no event announces it.
    liveUpdates.end();
    Object.assign(state.queue[0]!, finished);

    expect((await screen.findAllByRole("img", { name: "Threat level 7 of 10" }, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(requestsTo(state, "GET", "/api/events")).toHaveLength(2);
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));
  });

  it("reads an event however the server breaks it across lines and packets", async () => {
    const project = makeProject();
    const item = running(project.id);
    const state = makeState({ projects: [project], queue: [item] });
    renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));
    Object.assign(state.queue[0]!, finished);

    liveUpdates.write(": keep-alive\r\n\r\nevent: queue\r\ndata: {\"id\": \"");
    liveUpdates.write(`${item.id}",\r\ndata: "status": "pending"}\r\n\r`);
    liveUpdates.write("\n");

    expect((await screen.findAllByRole("img", { name: "Threat level 7 of 10" }, { timeout: 3000 })).length).toBeGreaterThan(0);
  });

  it("reconnects after the connection drops", async () => {
    const project = makeProject();
    const item = running(project.id);
    const state = makeState({ projects: [project], queue: [item], eventsRetryMs: 50 });
    renderApp(`/projects/${project.id}/review/${item.id}?status=all`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));

    liveUpdates.drop();
    Object.assign(state.queue[0]!, finished);

    expect((await screen.findAllByRole("img", { name: "Threat level 7 of 10" }, { timeout: 3000 })).length).toBeGreaterThan(0);
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));
    expect(requestsTo(state, "GET", "/api/events")).toHaveLength(2);
  });

  it("listens to the organisation being worked in, and switches with it", async () => {
    const project = makeProject({ name: "Harbor Pilot", org_id: "org-2" });
    const state = makeState({ projects: [project] });
    state.user = { ...state.user, organisations: [...state.user.organisations, { id: "org-2", name: "Harbor Labs", role: "editor" }] };
    const { user } = renderApp("/portfolio", state);
    const pendingReads = () => requestsTo(state, "GET", "/api/queue?status=pending").length;
    const rail = await screen.findByRole("navigation", { name: "Workspace" });

    await waitFor(() => expect(liveUpdates.openStreams("org-1")).toBe(1));
    const readsBeforeSwitch = pendingReads();
    await user.click(await screen.findByRole("button", { name: /^Organisation: Northstar Ventures/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Harbor Labs/ }));

    await waitFor(() => expect(liveUpdates.openStreams("org-2")).toBe(1));
    // Harbor Labs' lists have loaded (with nothing waiting for review) before anything changes.
    await waitFor(() => expect(pendingReads()).toBeGreaterThan(readsBeforeSwitch));
    await pause(100);
    expect(within(rail).getByRole("link", { name: "Review" })).toBeInTheDocument();

    // A result now waits for review. News of it on Northstar's stream no longer reaches the app...
    state.queue.push({ ...running(project.id), status: "pending" });
    liveUpdates.publish("queue", "queue-northstar", "pending", "org-1");
    await pause(600);
    expect(within(rail).getByRole("link", { name: "Review" })).toBeInTheDocument();

    // ...while Harbor Labs' stream refreshes it.
    liveUpdates.publish("queue", "queue-harbor", "pending", "org-2");
    expect(await within(rail).findByRole("link", { name: /^Review\s*1 awaiting review$/ }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("stops listening on sign-out", async () => {
    const state = makeState({ eventsRetryMs: 50 });
    const { user } = renderApp("/portfolio", state);
    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));

    await user.click(await screen.findByRole("button", { name: /^Jordan Avery/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    // Signed out, the app doesn't open the stream again, even after its retry delay would have passed.
    await pause(300);
    liveUpdates.end();
    await pause(300);
    expect(requestsTo(state, "GET", "/api/events")).toHaveLength(1);
  });

  it("renews an expired session when the stream is refused, then listens", async () => {
    let refusals = 0;
    const state = makeState({
      sessionRenews: true,
      eventsResponse: () => (refusals++ === 0 ? HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 }) : undefined),
    });
    renderApp("/portfolio", state);

    await waitFor(() => expect(liveUpdates.openStreams()).toBe(1));
    expect(requestsTo(state, "POST", "/api/auth/refresh")).toHaveLength(1);
    expect(requestsTo(state, "GET", "/api/events")).toHaveLength(2);
    expect(localStorage.getItem("launchops_token")).toBe("token-renewed");
  });

  it("signs out, and stops trying, when the stream is refused and the session can't be renewed", async () => {
    const state = makeState({ eventsResponse: () => HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 }) });
    renderApp("/portfolio", state);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Your session ended. Sign in again to continue.")).toBeInTheDocument();
    await pause(300);
    expect(requestsTo(state, "GET", "/api/events")).toHaveLength(1);
  });

  it("carries on without live updates when the server refuses them, trying again later", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const state = makeState({ projects: [project], eventsResponse: () => HttpResponse.json({ detail: "Service unavailable" }, { status: 503 }) });
    renderApp("/portfolio", state);

    expect(await within(await screen.findByRole("table")).findByRole("link", { name: "Fieldnote" })).toBeInTheDocument();
    await waitFor(() => expect(requestsTo(state, "GET", "/api/events")).toHaveLength(1));
    // The next attempt waits for the retry delay (5 seconds), so there's no burst of attempts.
    await pause(300);
    expect(requestsTo(state, "GET", "/api/events")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
  });
});
