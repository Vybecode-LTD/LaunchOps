import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useOrganisation } from "@/lib/auth/organisation";
import { useOperations } from "@/lib/operations/OperationsProvider";
import { useProjects, useQueue } from "@/lib/queries/hooks";
import { useNow } from "@/lib/hooks/useClock";
import { getOperation, workflowName } from "@/lib/domain/operations";
import { STALL_MINUTES, displayStatus, runningNote } from "@/lib/domain/queue";
import { routes } from "@/lib/routes";
import { Popover } from "@/components/ui/Overlay";
import { Spinner } from "@/components/ui/Display";
import { RoleRequirement } from "@/components/access/Access";
import styles from "./Shell.module.css";

function elapsed(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/**
 * Everything in flight: reports running in this browser, and workflows the server lists as running
 * (with a retry's reason when one is waiting). A workflow past the stall threshold is shown as possibly
 * stuck, not as running: an Editor can open it to cancel it and run it again.
 */
export function ActivityIndicator() {
  const { running } = useOperations();
  const canCancel = useOrganisation().can("editor");
  const queue = useQueue({ status: "running", limit: 50 });
  const projects = useProjects();
  const now = useNow(1000);
  const workflows = queue.data ?? [];
  const active = workflows.filter((item) => displayStatus(item, now) === "running");
  const stalled = workflows.filter((item) => displayStatus(item, now) === "stalled");
  const activeCount = running.length + active.length;
  if (activeCount === 0 && stalled.length === 0) return null;

  const projectName = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? "Project";
  const label = activeCount ? `${activeCount} running` : `${stalled.length} stalled`;

  return (
    <Popover
      label="Operations in progress"
      align="end"
      trigger={
        <button type="button" className={styles.activityButton}>
          {activeCount ? <Spinner /> : <TriangleAlert size={14} aria-hidden="true" />}
          {label}
        </button>
      }
    >
      <div className={styles.activityList}>
        {activeCount > 0 && <div className="placard">Running now</div>}
        {running.map((op) => (
          <div key={op.key} className={styles.activityItem}>
            <Spinner />
            <div>
              <div>{getOperation(op.operationId)?.name ?? op.operationId}</div>
              <div className={styles.activityMeta}>{op.projectName} · keep LaunchOps open until it finishes</div>
            </div>
            <span className={`${styles.activityMeta} num`}>{elapsed(op.startedAt, now)}</span>
          </div>
        ))}
        {active.map((item) => (
          <div key={item.id} className={styles.activityItem}>
            <Spinner />
            <div>
              <Link to={routes.projectReview(item.product_id, item.id)}>{workflowName(item.workflow_id)}</Link>
              <div className={styles.activityMeta}>
                {projectName(item.product_id)} · {runningNote(item) ?? "result goes to Review"}
              </div>
            </div>
            <span className={`${styles.activityMeta} num`}>{elapsed(new Date(item.created_at).getTime(), now)}</span>
          </div>
        ))}
        {stalled.length > 0 && <div className="placard">May be stuck</div>}
        {stalled.map((item) => (
          <div key={item.id} className={styles.activityItem}>
            <TriangleAlert size={14} aria-hidden="true" style={{ color: "var(--warn)" }} />
            <div>
              <Link to={routes.projectReview(item.product_id, item.id)}>{workflowName(item.workflow_id)}</Link>
              <div className={styles.activityMeta}>
                {projectName(item.product_id)} · running over {STALL_MINUTES} min.{" "}
                {canCancel ? "Open it to cancel it and run it again." : <RoleRequirement action="Cancelling it" minimum="editor" />}
              </div>
            </div>
            <span className={`${styles.activityMeta} num`}>{elapsed(new Date(item.created_at).getTime(), now)}</span>
          </div>
        ))}
      </div>
    </Popover>
  );
}
