import type { Project, QueueItem } from "@/lib/api/types";
import { minutesSince } from "./dates";

/*
 * Background workflows run as durable jobs (backend/services/jobs.py): a worker runs them, they carry on through
 * restarts and deploys, and a failure a retry might fix is tried again, up to 3 attempts, after waiting 30 seconds
 * and then 2 minutes. Each attempt is stopped after 15 minutes (JOB_TIMEOUT_MINUTES), so a healthy job can take
 * about 48 minutes at worst (3 × 15 + 2.5).
 */

/** A running item older than this may be stuck, for example because no worker is running. */
export const STALL_MINUTES = 60;

/** How often lists with running items refresh: without live updates, and as a safety net with them. */
export const QUEUE_POLL_MS = 4_000;
export const QUEUE_POLL_LIVE_MS = 30_000;

export type DisplayStatus = "running" | "stalled" | "pending" | "approved" | "rejected" | "failed";

export function displayStatus(item: Pick<QueueItem, "status" | "created_at">, now: number): DisplayStatus {
  if (item.status === "running") return minutesSince(item.created_at, now) >= STALL_MINUTES ? "stalled" : "running";
  if (item.status === "pending" || item.status === "approved" || item.status === "rejected" || item.status === "failed") {
    return item.status;
  }
  return "failed";
}

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  running: "Running",
  stalled: "Stalled",
  pending: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed",
};

/** The refetch interval for a list of results: none unless something is running. */
export function queuePollInterval(items: Array<Pick<QueueItem, "status">> | undefined, liveUpdates: boolean): number | false {
  if (!items?.some((item) => item.status === "running")) return false;
  return liveUpdates ? QUEUE_POLL_LIVE_MS : QUEUE_POLL_MS;
}

/**
 * What a running item's preview says beyond "it's running", e.g. "Trying again in 30 seconds: <reason>".
 * Null for the placeholder the backend starts with ("Running <workflow id>...").
 */
export function runningNote(item: Pick<QueueItem, "status" | "preview">): string | null {
  const preview = item.preview?.trim() ?? "";
  if (item.status !== "running" || !preview || /^Running [\w-]+\.\.\.$/.test(preview)) return null;
  return preview;
}

/** The backend refuses to send without a host, a username and a saved password. */
export function smtpReady(project: Pick<Project, "email_settings"> | undefined): boolean {
  const s = project?.email_settings;
  return Boolean(s?.smtp_host && s?.smtp_user && s?.smtp_password_set);
}

export function senderAddress(project: Pick<Project, "email_settings"> | undefined): string {
  const s = project?.email_settings;
  const address = s?.from_email || s?.smtp_user || "";
  return s?.from_name ? `${s.from_name} <${address}>` : address;
}
