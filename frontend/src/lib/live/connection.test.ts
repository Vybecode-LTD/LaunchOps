import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { LiveEvent } from "@/lib/api/types";
import { MAX_BACKOFF_MS, MAX_FAILURES, backoffDelay, runLiveConnection, toLiveEvent, type LiveStatus } from "./connection";

/** A response body the test writes to, ends or breaks. */
function stream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const state = { cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      state.cancelled = true;
    },
  });
  const encoder = new TextEncoder();
  return {
    body,
    state,
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
    drop: () => controller.error(new TypeError("network error")),
  };
}

type Attempt = () => Promise<ReadableStream<Uint8Array>>;

const refuse = (status: number) => () => Promise.reject(new ApiError(status, `Refused (${status})`));
const accept = (s: ReturnType<typeof stream>) => () => Promise.resolve(s.body);

/**
 * Runs a connection whose attempts to open the stream follow `attempts` in order (the last one repeats),
 * recording what it reports. Waits between attempts finish at once and are recorded, unless `realWaits`.
 */
function connect(attempts: Attempt[], { realWaits = false } = {}) {
  const controller = new AbortController();
  const record = { statuses: [] as LiveStatus[], events: [] as LiveEvent[], waits: [] as number[], reconnects: 0, opens: 0 };
  const done = runLiveConnection({
    open: () => {
      const attempt = attempts[Math.min(record.opens, attempts.length - 1)]!;
      record.opens += 1;
      return attempt();
    },
    signal: controller.signal,
    onEvent: (event) => record.events.push(event),
    onStatus: (status) => record.statuses.push(status),
    onReconnected: () => {
      record.reconnects += 1;
    },
    wait: realWaits
      ? undefined
      : async (milliseconds) => {
          record.waits.push(milliseconds);
        },
  });
  return { record, done, abort: () => controller.abort() };
}

describe("live updates connection", () => {
  it("hands on queue and email changes, and ignores comments, other events and unreadable data", async () => {
    const live = stream();
    const { record, abort, done } = connect([accept(live)]);

    live.send('retry: 5000\n\n: keep-alive\n\nevent: queue\ndata: {"id":"queue-1","status":"pending"}\n\n');
    live.send('event: presence\ndata: {"id":"user-1","status":"online"}\n\nevent: queue\ndata: not json\n\n');
    live.send('event: email\ndata: {"id":"queue-1","status":"drafts"}\n\n');

    await vi.waitFor(() => expect(record.events).toHaveLength(2));
    expect(record.events).toEqual([
      { type: "queue", id: "queue-1", status: "pending" },
      { type: "email", id: "queue-1", status: "drafts" },
    ]);
    expect(record.statuses).toEqual(["connecting", "connected"]);

    abort();
    await done;
    expect(live.state.cancelled).toBe(true);
    expect(record.opens).toBe(1);
  });

  it("opens the stream again after the server's retry delay when it ends, and says changes may have been missed", async () => {
    const first = stream();
    const second = stream();
    const { record, abort, done } = connect([accept(first), accept(second)]);

    first.send("retry: 2500\n\n");
    first.end();

    await vi.waitFor(() => expect(record.reconnects).toBe(1));
    expect(record.waits).toEqual([2500]);
    expect(record.statuses).toEqual(["connecting", "connected", "reconnecting", "connected"]);
    abort();
    await done;
  });

  it("waits longer after each failed attempt, and gives up after too many in a row", async () => {
    const { record, done } = connect([refuse(503)]);

    await done;
    expect(record.opens).toBe(MAX_FAILURES);
    expect(record.waits).toEqual([5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000]);
    expect(record.statuses.at(-1)).toBe("stopped");
    expect(record.reconnects).toBe(0);
  });

  it("backs off the same way when the organisation or the stream is refused", async () => {
    for (const status of [403, 404, 429, 500]) {
      const { record, done } = connect([refuse(status)]);
      await done;
      expect(record.waits.slice(0, 2), `status ${status}`).toEqual([5_000, 10_000]);
    }
  });

  it("stops at once on a 401 the session couldn't be renewed from", async () => {
    const { record, done } = connect([refuse(401)]);

    await done;
    expect(record.opens).toBe(1);
    expect(record.waits).toEqual([]);
    expect(record.statuses).toEqual(["connecting", "stopped"]);
  });

  it("starts counting failures again once a stream opens", async () => {
    const live = stream();
    const { record, done } = connect([refuse(502), refuse(502), accept(live), refuse(502)]);

    await vi.waitFor(() => expect(record.statuses).toContain("connected"));
    live.end();
    await done;
    // Two failures, the stream's end, then failures counted from one again until it gives up.
    expect(record.waits.slice(0, 5)).toEqual([5_000, 10_000, 5_000, 5_000, 10_000]);
    expect(record.opens).toBe(3 + MAX_FAILURES);
  });

  it("counts a dropped connection towards waiting longer", async () => {
    const live = stream();
    const { record, done } = connect([accept(live), refuse(502)]);

    await vi.waitFor(() => expect(record.statuses).toContain("connected"));
    live.drop();
    await done;
    expect(record.waits.slice(0, 3)).toEqual([5_000, 10_000, 20_000]);
    expect(record.opens).toBe(MAX_FAILURES);
  });

  it("really waits between attempts, and ends without another attempt when aborted while waiting", async () => {
    const first = stream();
    const second = stream();
    const { record, abort, done } = connect([accept(first), accept(second)], { realWaits: true });

    first.send("retry: 1\n\n");
    first.end();
    await vi.waitFor(() => expect(record.reconnects).toBe(1));

    second.send("retry: 60000\n\n");
    second.end();
    await vi.waitFor(() => expect(record.statuses.at(-1)).toBe("reconnecting"));
    abort();
    await done;
    expect(record.opens).toBe(2);
  });

  it("ends without waiting when stopped just as it starts to wait", async () => {
    const controller = new AbortController();
    const open = vi.fn(() => Promise.reject(new ApiError(503, "Unavailable")));
    await runLiveConnection({
      open,
      signal: controller.signal,
      onEvent: () => undefined,
      onReconnected: () => undefined,
      onStatus: (status) => {
        if (status === "reconnecting") controller.abort();
      },
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("ends quietly when aborted while the stream opens", async () => {
    const controller = new AbortController();
    const statuses: LiveStatus[] = [];
    const done = runLiveConnection({
      open: (signal) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
      signal: controller.signal,
      onEvent: () => undefined,
      onStatus: (status) => statuses.push(status),
      onReconnected: () => undefined,
    });

    controller.abort();
    await done;
    expect(statuses).toEqual(["connecting"]);
  });

  it("doesn't start when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const open = vi.fn();
    await runLiveConnection({ open, signal: controller.signal, onEvent: () => undefined, onStatus: () => undefined, onReconnected: () => undefined });
    expect(open).not.toHaveBeenCalled();
  });
});

describe("backoffDelay", () => {
  it("doubles the retry delay for each failure, up to the cap", () => {
    expect([1, 2, 3].map((failures) => backoffDelay(5_000, failures))).toEqual([5_000, 10_000, 20_000]);
    expect(backoffDelay(5_000, 0)).toBe(5_000);
    expect(backoffDelay(5_000, 40)).toBe(MAX_BACKOFF_MS);
  });
});

describe("toLiveEvent", () => {
  it("accepts queue and email changes with a string id and status only", () => {
    expect(toLiveEvent("queue", '{"id":"queue-1","status":"deleted"}')).toEqual({ type: "queue", id: "queue-1", status: "deleted" });
    expect(toLiveEvent("message", '{"id":"queue-1","status":"deleted"}')).toBeNull();
    expect(toLiveEvent("queue", "null")).toBeNull();
    expect(toLiveEvent("queue", "42")).toBeNull();
    expect(toLiveEvent("email", '{"id":7,"status":"sent"}')).toBeNull();
    expect(toLiveEvent("email", '{"id":"email-1"}')).toBeNull();
  });
});
