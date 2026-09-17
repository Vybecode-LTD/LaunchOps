import { useSyncExternalStore } from "react";

/**
 * Deletes that can be undone for a few seconds. The item disappears at once;
 * the DELETE request is sent when the undo window closes. If the page is
 * closed during the window, pending deletes are sent immediately with
 * `keepalive` so the browser still delivers them.
 */

type Commit = (keepalive: boolean) => Promise<void>;

interface PendingDelete {
  id: string;
  timer: ReturnType<typeof setTimeout>;
  commit: Commit;
}

const pending = new Map<string, PendingDelete>();
const listeners = new Set<() => void>();
let version = 0;
let listening = false;

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

function flushAll() {
  for (const [key, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(key);
    void entry.commit(true);
  }
  notify();
}

export function isPendingDelete(id: string): boolean {
  for (const entry of pending.values()) {
    if (entry.id === id) return true;
  }
  return false;
}

/** Schedule a delete. Returns a function that cancels it (undo); it returns false if the delete already went out. */
export function scheduleDelete(key: string, id: string, commit: Commit, delayMs: number): () => boolean {
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("pagehide", flushAll);
    listening = true;
  }
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    void commit(false).finally(notify);
  }, delayMs);
  pending.set(key, { id, timer, commit });
  notify();
  return () => {
    const entry = pending.get(key);
    if (!entry) return false;
    clearTimeout(entry.timer);
    pending.delete(key);
    notify();
    return true;
  };
}

/** Changes whenever the set of pending deletes changes, so list selectors re-run. */
export function usePendingDeletesVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => 0,
  );
}

/** Test helper. */
export function _resetPendingDeletes() {
  for (const entry of pending.values()) clearTimeout(entry.timer);
  pending.clear();
  notify();
}
