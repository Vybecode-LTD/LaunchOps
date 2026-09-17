import { Link, useSearchParams } from "react-router";
import { FileText, Globe, Inbox, Mail, PanelRight, Search } from "lucide-react";
import { useOrganisation } from "@/lib/auth/organisation";
import { useCaptures } from "@/lib/queries/hooks";
import { useOperations } from "@/lib/operations/OperationsProvider";
import { CATEGORY_LABELS, CATEGORY_ORDER, OPERATIONS, getOperation, type OperationDef } from "@/lib/domain/operations";
import { hasReport } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Notice, Spinner } from "@/components/ui/Display";
import { Pill } from "@/components/ui/Pill";
import { RoleNote } from "@/components/access/Access";
import { RunSheet } from "@/components/operations/RunSheet";
import { useProjectContext } from "./projectContext";
import styles from "./ProjectPages.module.css";

const KIND_LABEL: Record<OperationDef["kind"], string> = {
  workflow: "To Review",
  report: "Report",
  tool: "Tool",
};

export function OperationsPage() {
  const project = useProjectContext();
  const ops = useOperations();
  const canRun = useOrganisation().can("editor");
  const captures = useCaptures();
  const [params, setParams] = useSearchParams();
  const runId = params.get("run");
  const ideaId = params.get("idea");
  const activeOp = runId ? (getOperation(runId) ?? null) : null;
  const idea = ideaId ? captures.data?.find((c) => c.id === ideaId) : undefined;

  const setRun = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("run", id);
    else next.delete("run");
    setParams(next, { replace: true });
  };

  const clearIdea = () => {
    const next = new URLSearchParams(params);
    next.delete("idea");
    setParams(next, { replace: true });
  };

  return (
    <>
      {idea && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Notice tone="signal">
            Using the idea <strong>“{idea.text}”</strong> — pick an operation and it will be filled in as instructions.{" "}
            <button type="button" onClick={clearIdea} style={{ border: 0, background: "none", color: "var(--signal-ink)", textDecoration: "underline", padding: 0 }}>
              Don't use it
            </button>
          </Notice>
        </div>
      )}
      {!canRun && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <RoleNote action="Running operations" minimum="editor" />
        </div>
      )}
      <div className={styles.opsLayout}>
        <nav className={styles.opsNav} aria-label="Operation categories">
          <span className="placard" style={{ padding: "0 10px 6px" }}>
            Categories
          </span>
          {CATEGORY_ORDER.map((cat) => (
            <a key={cat} href={`#ops-${cat}`}>
              {CATEGORY_LABELS[cat]}
              <span className="num" style={{ color: "var(--ink-3)" }}>
                {OPERATIONS.filter((o) => o.category === cat).length}
              </span>
            </a>
          ))}
        </nav>

        <div className={styles.opsSections}>
          {CATEGORY_ORDER.map((cat) => (
            <section key={cat} id={`ops-${cat}`} className={styles.opsSection} aria-labelledby={`ops-${cat}-title`}>
              <div className={styles.opsSectionHead}>
                <h2 className={styles.opsSectionTitle} id={`ops-${cat}-title`}>
                  {CATEGORY_LABELS[cat]}
                </h2>
              </div>
              <ul className={styles.opList}>
                {OPERATIONS.filter((o) => o.category === cat).map((op) => {
                  const running = op.kind !== "workflow" && ops.isRunning(op.id, project.id);
                  const hasExisting = op.reportKey ? hasReport(project[op.reportKey]) : false;
                  return (
                    <li key={op.id} className={styles.op}>
                      <div className={styles.opMain}>
                        <div className={styles.opName}>
                          {op.name}
                          <Pill tone="outline" dot={false}>
                            {KIND_LABEL[op.kind]}
                          </Pill>
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
                          <Button
                            variant={running ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => setRun(op.id)}
                            icon={running ? <Spinner /> : undefined}
                          >
                            {running ? "Running…" : "Run"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <RunSheet
        op={activeOp}
        project={project}
        seedText={idea?.text}
        onOpenChange={(open) => {
          if (!open) setRun(null);
        }}
      />
    </>
  );
}
