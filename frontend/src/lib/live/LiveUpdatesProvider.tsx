import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { keys } from "@/lib/queries/keys";
import { runLiveConnection, type LiveStatus } from "./connection";
import { LiveUpdatesContext } from "./liveContext";

/** Changes that arrive together (an operation finishing, drafts being added) cost one refetch. */
export const REFRESH_DELAY_MS = 150;

/**
 * Listens to the organisation's live updates while someone is signed in, and refetches what changed:
 * results (and the lists that count them) on `queue` events, the Outbox and the sending quota on `email`
 * events, and both after reconnecting, since changes may have been missed. It starts again when the
 * organisation changes, stops on sign-out, and after giving up on repeated failures tries again when the
 * browser comes back online.
 */
export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const organisationId = useAuth().organisation?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const connection = `${organisationId ?? ""}:${attempt}`;
  // The status belongs to one connection; a stale one (another organisation, an earlier attempt) is ignored.
  const [live, setLive] = useState<{ connection: string; status: LiveStatus } | null>(null);
  const status = live?.connection === connection ? live.status : "connecting";

  useEffect(() => {
    if (!organisationId) return;
    const controller = new AbortController();
    const stale = new Set<"queue" | "email">();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (...kinds: Array<"queue" | "email">) => {
      kinds.forEach((kind) => stale.add(kind));
      timer ??= setTimeout(() => {
        timer = undefined;
        if (stale.has("queue")) void queryClient.invalidateQueries({ queryKey: keys.queueAll });
        if (stale.has("email")) void queryClient.invalidateQueries({ queryKey: keys.emailsAll });
        stale.clear();
      }, REFRESH_DELAY_MS);
    };

    void runLiveConnection({
      open: (signal) => eventsApi.open(signal),
      signal: controller.signal,
      onEvent: (event) => refresh(event.type),
      onReconnected: () => refresh("queue", "email"),
      onStatus: (next) => {
        if (!controller.signal.aborted) setLive({ connection, status: next });
      },
    });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [organisationId, connection, queryClient]);

  useEffect(() => {
    if (status !== "stopped") return;
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [status]);

  const value = useMemo(() => ({ connected: status === "connected" }), [status]);
  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>;
}
