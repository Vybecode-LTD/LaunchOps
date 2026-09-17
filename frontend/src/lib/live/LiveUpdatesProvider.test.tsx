import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { eventsApi } from "@/lib/api/endpoints";
import { keys } from "@/lib/queries/keys";
import type { LiveConnectionOptions } from "./connection";
import { runLiveConnection } from "./connection";
import { LiveUpdatesProvider, REFRESH_DELAY_MS } from "./LiveUpdatesProvider";
import { useLiveUpdates } from "./liveContext";

const auth = vi.hoisted(() => ({ organisation: { id: "org-1", name: "Northstar Ventures", role: "owner" } as { id: string; name: string; role: string } | null }));

vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => ({ organisation: auth.organisation }) }));
vi.mock("./connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./connection")>()),
  runLiveConnection: vi.fn(() => Promise.resolve()),
}));

const connect = vi.mocked(runLiveConnection);

/** The options of each connection the provider started, oldest first. */
const connections = (): LiveConnectionOptions[] => connect.mock.calls.map(([options]) => options);
const latest = () => connections().at(-1)!;

function Probe() {
  return <span data-testid="live">{useLiveUpdates().connected ? "connected" : "not connected"}</span>;
}

function renderProvider() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <LiveUpdatesProvider>
        <Probe />
      </LiveUpdatesProvider>
    </QueryClientProvider>
  );
  const utils = render(tree());
  return { ...utils, invalidate, rerender: () => utils.rerender(tree()) };
}

/** The query keys refetched so far. */
const invalidated = (invalidate: { mock: { calls: unknown[][] } }) => invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);

beforeEach(() => {
  auth.organisation = { id: "org-1", name: "Northstar Ventures", role: "owner" };
  connect.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe("LiveUpdatesProvider", () => {
  it("says it's connected only while the stream is open", () => {
    renderProvider();
    expect(screen.getByTestId("live")).toHaveTextContent("not connected");

    act(() => latest().onStatus("connected"));
    expect(screen.getByTestId("live")).toHaveTextContent(/^connected$/);

    act(() => latest().onStatus("reconnecting"));
    expect(screen.getByTestId("live")).toHaveTextContent("not connected");
  });

  it("opens the stream through the API", async () => {
    const open = vi.spyOn(eventsApi, "open").mockResolvedValue(new ReadableStream());
    renderProvider();
    const signal = new AbortController().signal;

    await latest().open(signal);
    expect(open).toHaveBeenCalledWith(signal);
  });

  it("refetches results on queue changes and the Outbox on email changes, once for a burst", async () => {
    const { invalidate } = renderProvider();

    act(() => {
      latest().onEvent({ type: "queue", id: "queue-1", status: "running" });
      latest().onEvent({ type: "queue", id: "queue-1", status: "pending" });
      latest().onEvent({ type: "queue", id: "queue-2", status: "deleted" });
    });
    expect(invalidate).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidated(invalidate)).toEqual([keys.queueAll]));

    act(() => latest().onEvent({ type: "email", id: "queue-1", status: "drafts" }));
    await waitFor(() => expect(invalidated(invalidate)).toEqual([keys.queueAll, keys.emailsAll]));
    expect(REFRESH_DELAY_MS).toBeLessThan(1000);
  });

  it("refetches both after reconnecting, since changes may have been missed", async () => {
    const { invalidate } = renderProvider();

    act(() => latest().onReconnected());

    await waitFor(() => expect(invalidated(invalidate)).toEqual([keys.queueAll, keys.emailsAll]));
  });

  it("starts again for another organisation, and stops when it unmounts", () => {
    const { rerender, unmount } = renderProvider();
    const first = latest();
    act(() => first.onStatus("connected"));

    auth.organisation = { id: "org-2", name: "Harbor Labs", role: "editor" };
    rerender();

    expect(connections()).toHaveLength(2);
    expect(first.signal.aborted).toBe(true);
    // The old connection's news no longer counts.
    act(() => first.onStatus("connected"));
    expect(screen.getByTestId("live")).toHaveTextContent("not connected");

    unmount();
    expect(latest().signal.aborted).toBe(true);
  });

  it("doesn't listen without an organisation", () => {
    auth.organisation = null;
    renderProvider();
    expect(connect).not.toHaveBeenCalled();
  });

  it("after giving up, tries again when the browser is back online", () => {
    renderProvider();

    act(() => window.dispatchEvent(new Event("online")));
    expect(connections()).toHaveLength(1);

    act(() => latest().onStatus("stopped"));
    act(() => window.dispatchEvent(new Event("online")));
    expect(connections()).toHaveLength(2);
    expect(connections()[0]!.signal.aborted).toBe(true);
  });

  it("drops a refetch that was waiting when it stops", async () => {
    const { invalidate, unmount } = renderProvider();

    act(() => latest().onEvent({ type: "queue", id: "queue-1", status: "pending" }));
    unmount();

    await new Promise((resolve) => setTimeout(resolve, REFRESH_DELAY_MS * 2));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
