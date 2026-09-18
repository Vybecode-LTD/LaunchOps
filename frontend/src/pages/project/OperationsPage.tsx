import { useSearchParams } from "react-router";
import { useOrganisation } from "@/lib/auth/organisation";
import { useCaptures, useQueueSummary } from "@/lib/queries/hooks";
import { CATEGORY_LABELS, CATEGORY_ORDER, OPERATIONS, getOperation } from "@/lib/domain/operations";
import { Notice, Segmented } from "@/components/ui/Display";
import { RoleNote } from "@/components/access/Access";
import { OperationCard } from "@/components/operations/OperationCard";
import { Playbook } from "@/components/operations/Playbook";
import { RunSheet } from "@/components/operations/RunSheet";
import { useProjectContext } from "./projectContext";
import styles from "./ProjectPages.module.css";

type View = "playbook" | "all";

/**
 * Operations, two ways. The playbook (the default) is a guided launch: what to run next, then each
 * stage in the order a launch runs in. "All operations" is the catalogue by category, for someone
 * who already knows what they want. Both open the same run sheet, and the view is in the URL so a
 * link to either one stays put.
 */
export function OperationsPage() {
  const project = useProjectContext();
  const canRun = useOrganisation().can("editor");
  const captures = useCaptures();
  // Where every one of the project's results stands, counted by operation and status: the playbook
  // needs the finished and failed ones as well as those awaiting review to know what's done. A page of
  // results holds the newest 500 at most and could leave out an operation's only approved one.
  const results = useQueueSummary(project.id);
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "all" ? "all" : "playbook";
  const runId = params.get("run");
  const ideaId = params.get("idea");
  const activeOp = runId ? (getOperation(runId) ?? null) : null;
  const idea = ideaId ? captures.data?.find((c) => c.id === ideaId) : undefined;

  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: true });
  };
  const setRun = (id: string | null) => update((next) => (id ? next.set("run", id) : next.delete("run")));
  const setView = (value: View) => update((next) => (value === "all" ? next.set("view", "all") : next.delete("view")));
  const clearIdea = () => update((next) => next.delete("idea"));

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

      <div className={styles.opsViewBar}>
        <Segmented<View>
          label="How to show operations"
          value={view}
          onChange={setView}
          options={[
            { value: "playbook", label: "Playbook" },
            { value: "all", label: "All operations" },
          ]}
        />
      </div>

      {view === "playbook" ? (
        <Playbook project={project} queue={results.data} queueFailed={results.isError} onRun={setRun} />
      ) : (
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
                  {OPERATIONS.filter((o) => o.category === cat).map((op) => (
                    <OperationCard key={op.id} op={op} project={project} onRun={setRun} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

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
