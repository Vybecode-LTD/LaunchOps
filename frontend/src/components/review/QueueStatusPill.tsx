import type { QueueItem } from "@/lib/api/types";
import { STALL_MINUTES, displayStatus } from "@/lib/domain/queue";
import { Pill } from "@/components/ui/Pill";

export function QueueStatusPill({ item, now }: { item: Pick<QueueItem, "status" | "created_at">; now: number }) {
  switch (displayStatus(item, now)) {
    case "running":
      return (
        <Pill tone="signal" live>
          Running
        </Pill>
      );
    case "stalled":
      return (
        <Pill tone="warn" title={`Running for more than ${STALL_MINUTES} minutes, so it may be stuck.`}>
          Stalled
        </Pill>
      );
    case "pending":
      return <Pill tone="signal">Needs review</Pill>;
    case "approved":
      return <Pill tone="ok">Approved</Pill>;
    case "rejected":
      return <Pill tone="neutral">Rejected</Pill>;
    default:
      return <Pill tone="crit">Failed</Pill>;
  }
}
