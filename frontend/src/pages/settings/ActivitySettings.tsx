import { Navigate } from "react-router";
import { errorMessage } from "@/lib/api/client";
import { useOrganisation } from "@/lib/auth/organisation";
import { useActivity } from "@/lib/queries/hooks";
import { formatTimestamp } from "@/lib/domain/dates";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState, Notice, Panel, Skeleton } from "@/components/ui/Display";
import styles from "./Settings.module.css";

/** The organisation's activity log: approvals, sends, deletions, membership and settings changes (owners only). */
export function ActivitySettings() {
  const { current, can } = useOrganisation();
  const isOwner = can("owner");
  const activity = useActivity(isOwner);
  if (!isOwner) return <Navigate to={routes.settings("organisation")} replace />;
  const entries = activity.data?.pages.flat() ?? [];

  return (
    <div className={styles.stack}>
      <p className={styles.lede}>
        Who approved, sent, deleted or changed what in {current?.name}, newest first. Running operations and reading aren&apos;t listed.
      </p>
      <Panel title="Activity" flush>
        {activity.isLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton height={120} />
          </div>
        ) : activity.isError ? (
          <div style={{ padding: 16 }}>
            <Notice tone="crit">{errorMessage(activity.error)}</Notice>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState title="Nothing recorded yet">Approvals, sends, deletions and changes to members or settings will appear here.</EmptyState>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">When</th>
                  <th className="placard">Who</th>
                  <th className="placard">What</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className={styles.rowMeta} style={{ whiteSpace: "nowrap" }}>
                      <time dateTime={entry.created_at}>{formatTimestamp(entry.created_at)}</time>
                    </td>
                    <td className="mono" style={{ fontSize: "var(--text-12)" }}>
                      {entry.actor || "Deleted account"}
                    </td>
                    <td>{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {activity.hasNextPage && (
        <div>
          <Button variant="secondary" loading={activity.isFetchingNextPage} onClick={() => void activity.fetchNextPage()}>
            Show older activity
          </Button>
        </div>
      )}
    </div>
  );
}
