import { Link } from "react-router";
import { FileText, Globe, Inbox, Mail, PanelRight, Search } from "lucide-react";
import type { Project } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useOperations } from "@/lib/operations/OperationsProvider";
import type { OperationDef } from "@/lib/domain/operations";
import type { OperationState } from "@/lib/domain/playbook";
import { hasReport } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Display";
import { Pill, type Tone } from "@/components/ui/Pill";
import styles from "@/pages/project/ProjectPages.module.css";

const KIND_LABEL: Record<OperationDef["kind"], string> = {
  workflow: "To Review",
  report: "Report",
  tool: "Tool",
};

/** How the playbook describes an operation's progress. `todo` shows nothing: the Run button says it. */
const STATE_PILL: Record<Exclude<OperationState, "todo">, { label: string; tone: Tone }> = {
  done: { label: "Done", tone: "ok" },
  in_review: { label: "In review", tone: "signal" },
  running: { label: "Running", tone: "neutral" },
  failed: { label: "Failed", tone: "crit" },
};

/**
 * One operation: what it produces, how it behaves, and the controls to open its report or run it.
 * Shared by the playbook and the full catalogue, so an operation looks and reads the same in both.
 */
export function OperationCard({
  op,
  project,
  onRun,
  state,
}: {
  op: OperationDef;
  project: Project;
  onRun: (id: string) => void;
  /** Progress from the playbook. Left out in the catalogue, which shows operations, not progress. */
  state?: OperationState;
}) {
  const ops = useOperations();
  const canRun = useOrganisation().can("editor");
  // Reports and tools run in the page; workflows run as background jobs and show in Review instead.
  const running = op.kind !== "workflow" && ops.isRunning(op.id, project.id);
  const hasExisting = op.reportKey ? hasReport(project[op.reportKey]) : false;
  const pill = state && state !== "todo" ? STATE_PILL[state] : null;

  return (
    <li className={styles.op}>
      <div className={styles.opMain}>
        <div className={styles.opName}>
          {op.name}
          <Pill tone="outline" dot={false}>
            {KIND_LABEL[op.kind]}
          </Pill>
          {pill && <Pill tone={pill.tone}>{pill.label}</Pill>}
        </div>
        <p className={styles.opProduces}>{op.produces}</p>
        <ul className={styles.opFacts}>
          {op.webResearch && (
            <li>
              <Search aria-hidden="true" />
              Live web research
            </li>
          )}
          {op.readsPage && (
            <li>
              <Globe aria-hidden="true" />
              Reads a web page
            </li>
          )}
          {op.kind === "workflow" && (
            <li>
              <Inbox aria-hidden="true" />
              Result goes to Review
            </li>
          )}
          {op.kind === "report" && (
            <li>
              <FileText aria-hidden="true" />
              {hasExisting ? "Replaces the saved report" : "Saved to Reports"}
            </li>
          )}
          {op.kind === "tool" && (
            <li>
              <PanelRight aria-hidden="true" />
              Results shown in the panel, not saved
            </li>
          )}
          {op.draftsEmailsOnApproval && (
            <li>
              <Mail aria-hidden="true" />
              Approval creates Outbox drafts
            </li>
          )}
        </ul>
      </div>
      <div className={styles.opActions}>
        {hasExisting && op.reportKey && (
          <Button asChild variant="ghost" size="sm">
            <Link to={routes.projectReport(project.id, op.reportKey)}>Open report</Link>
          </Button>
        )}
        {canRun && (
          <Button variant={running ? "secondary" : "primary"} size="sm" onClick={() => onRun(op.id)} icon={running ? <Spinner /> : undefined}>
            {running ? "Running…" : "Run"}
          </Button>
        )}
      </div>
    </li>
  );
}
