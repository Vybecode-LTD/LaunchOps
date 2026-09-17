import { ApiError } from "@/lib/api/client";
import { createSseParser } from "@/lib/api/sse";
import type { LiveEvent } from "@/lib/api/types";

/*
 * The live updates connection (GET /api/events, backend/routers/events.py): open the stream, hand on each
 * change, and open it again whenever it ends. The backend sends `retry: 5000` first, a keep-alive comment
 * every 15 seconds, and events that say what changed (never the data), so the app refetches.
 */

export type LiveStatus = "connecting" | "connected" | "reconnecting" | "stopped";

/** The reconnection delay until the stream announces its own (the backend's RECONNECT_MILLISECONDS). */
export const DEFAULT_RETRY_MS = 5_000;
/** The longest wait between attempts, however many have failed. */
export const MAX_BACKOFF_MS = 5 * 60_000;
/** Consecutive failed attempts before giving up; the app keeps polling meanwhile. */
export const MAX_FAILURES = 8;

export interface LiveConnectionOptions {
  /** Opens the stream: resolves with its body, or rejects with an ApiError (see openEventStream). */
  open: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
  /** Aborting ends the connection for good (signing out, switching organisation, leaving the app). */
  signal: AbortSignal;
  onEvent: (event: LiveEvent) => void;
  onStatus: (status: LiveStatus) => void;
  /** A stream opened again after an earlier one closed: changes made in between were missed. */
  onReconnected: () => void;
  /** Waits between attempts, finishing early if `signal` aborts. Tests replace it. */
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

/** The wait before the next attempt after `failures` consecutive failures: the retry delay, doubling each time, capped. */
export function backoffDelay(retryMs: number, failures: number): number {
  return Math.min(retryMs * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS);
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish);
  });
}

/** A stream event as a LiveEvent, or null for event types and payloads the app doesn't use. */
export function toLiveEvent(type: string, data: string): LiveEvent | null {
  if (type !== "queue" && type !== "email") return null;
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { id, status } = payload as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || typeof status !== "string") return null;
  return { type, id, status } as LiveEvent;
}

/**
 * Keep the live updates stream open until `signal` aborts. When the stream ends it opens again after the
 * server's retry delay; after a failure (unreachable, 403, 404, 5xx, not an event stream) it waits longer
 * each time, and gives up after MAX_FAILURES in a row. A 401 the session couldn't be renewed from stops it
 * at once: the auth layer signs out.
 */
export async function runLiveConnection({ open, signal, onEvent, onStatus, onReconnected, wait = sleep }: LiveConnectionOptions): Promise<void> {
  let retryMs = DEFAULT_RETRY_MS;
  let failures = 0;
  let openedBefore = false;
  onStatus("connecting");

  while (!signal.aborted) {
    let body: ReadableStream<Uint8Array>;
    try {
      body = await open(signal);
    } catch (error) {
      if (signal.aborted) return;
      failures += 1;
      if ((error instanceof ApiError && error.status === 401) || failures >= MAX_FAILURES) {
        onStatus("stopped");
        return;
      }
      onStatus("reconnecting");
      await wait(backoffDelay(retryMs, failures), signal);
      continue;
    }

    failures = 0;
    onStatus("connected");
    if (openedBefore) onReconnected();
    openedBefore = true;

    const reader = body.getReader();
    // Stop reading at once when aborted: a mocked or proxied body may not end with the request.
    const cancel = () => void reader.cancel().catch(() => undefined);
    signal.addEventListener("abort", cancel);
    const decoder = new TextDecoder();
    const parser = createSseParser({
      onEvent: ({ event, data }) => {
        const change = toLiveEvent(event, data);
        if (change) onEvent(change);
      },
      onRetry: (milliseconds) => {
        retryMs = milliseconds;
      },
    });
    let dropped = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      dropped = true;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    if (signal.aborted) return;

    // The server closed the stream (a restart or a deploy), or the connection dropped: open it again.
    if (dropped) failures += 1;
    onStatus("reconnecting");
    await wait(backoffDelay(retryMs, Math.max(1, failures)), signal);
  }
}
