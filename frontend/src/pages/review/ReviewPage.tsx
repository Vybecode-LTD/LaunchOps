import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router";
import { Check, ChevronDown, CircleStop, Clipboard, Download, FileDown, Inbox, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api/client";
import { queueApi } from "@/lib/api/endpoints";
import type { Project, QueueItem } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import {
  useCancelOperation,
  useCreateTemplate,
  useLaunchWorkflow,
  useProjects,
  useQueue,
  useReviewItem,
  useUndoableDelete,
} from "@/lib/queries/hooks";
import { keys } from "@/lib/queries/keys";
import { useNow } from "@/lib/hooks/useClock";
import { formatTimestamp, relativeTime } from "@/lib/domain/dates";
import { downloadText, slugify, toAssistantPrompt, toMarkdown, toPlainText } from "@/lib/domain/exporters";
import { getOperation, workflowName } from "@/lib/domain/operations";
import { midSentence } from "@/lib/domain/values";
import { routes } from "@/lib/routes";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, Kbd, PageHeader, Segmented, Skeleton } from "@/components/ui/Display";
import { copyText } from "@/lib/clipboard";
import { Select } from "@/components/ui/Field";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import { RoleNote } from "@/components/access/Access";
import { ProjectSwatch } from "@/components/project/ProjectBits";
import { QueueStatusPill } from "@/components/review/QueueStatusPill";
import { STALL_MINUTES, displayStatus, runningNote, type DisplayStatus } from "@/lib/domain/queue";
import { WorkflowResult } from "@/components/results/WorkflowResult";
import type { ProjectOutletContext } from "@/pages/project/projectContext";
import styles from "./ReviewPage.module.css";

type Filter = "pending" | "running" | "approved" | "rejected" | "failed" | "all";

const FILTER_MATCH: Record<Filter, (s: DisplayStatus) => boolean> = {
  pending: (s) => s === "pending",
  running: (s) => s === "running" || s === "stalled",
  approved: (s) => s === "approved",
  rejected: (s) => s === "rejected",
  failed: (s) => s === "failed",
  all: () => true,
};

export function ReviewPage({ scope }: { scope: "all" | "project" }) {
  const outlet = useOutletContext<ProjectOutletContext | undefined>();
  const project = scope === "project" ? outlet?.project : undefined;
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const now = useNow(15_000);
  const projects = useProjects();
  const projectFilter = scope === "all" ? (params.get("project") ?? "") : (project?.id ?? "");
  const queue = useQueue({ product_id: projectFilter || undefined, limit: 500 });
  const filter = (params.get("status") as Filter | null) ?? "pending";

  const items = useMemo(() => queue.data ?? [], [queue.data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { pending: 0, running: 0, approved: 0, rejected: 0, failed: 0, all: items.length };
    for (const item of items) {
      const s = displayStatus(item, now);
      (Object.keys(FILTER_MATCH) as Filter[]).forEach((f) => {
        if (f !== "all" && FILTER_MATCH[f](s)) c[f] += 1;
      });
    }
    return c;
  }, [items, now]);
  const visible = items.filter((item) => FILTER_MATCH[filter](displayStatus(item, now)));
  const selected = items.find((i) => i.id === itemId) ?? null;
  const projectOf = (id: string) => (project && project.id === id ? project : projects.data?.find((p) => p.id === id));

  const itemPath = (id?: string) => {
    const base = scope === "project" && project ? routes.projectReview(project.id, id) : routes.review(id);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // On wide screens, open the first result instead of an empty detail pane.
  const firstPath = visible[0] ? itemPath(visible[0].id) : null;
  useEffect(() => {
    if (itemId || !firstPath) return;
    if (window.matchMedia("(min-width: 1001px)").matches) navigate(firstPath, { replace: true });
  }, [itemId, firstPath, navigate]);

  // Keyboard: J/K move through the visible list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      if (!visible.length) return;
      const index = visible.findIndex((i) => i.id === itemId);
      const nextIndex = e.key === "j" ? Math.min(visible.length - 1, index + 1) : Math.max(0, index - 1);
      const next = visible[index === -1 ? 0 : nextIndex];
      if (next) navigate(itemPath(next.id), { replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      {scope === "all" && (
        <PageHeader title="Review" lede="Every AI workflow result waits here. Approve what's usable; nothing leaves LaunchOps from this page." />
      )}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <Segmented<Filter>
            label="Status"
            value={filter}
            onChange={(f) => setParam("status", f === "pending" ? "" : f)}
            options={[
              { value: "pending", label: `Needs review · ${counts.pending}` },
              { value: "running", label: `Running · ${counts.running}` },
              { value: "approved", label: `Approved · ${counts.approved}` },
              { value: "rejected", label: `Rejected · ${counts.rejected}` },
              { value: "failed", label: `Failed · ${counts.failed}` },
              { value: "all", label: "All" },
            ]}
          />
          {scope === "all" && (
            <Select
              className={styles.projectFilter}
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setParam("project", e.target.value)}
            >
              <option value="">All projects</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className={styles.shortcuts} aria-hidden="true">
          <span>
            <Kbd>J</Kbd> <Kbd>K</Kbd> move
          </span>
        </div>
      </div>

      <div className={styles.panes}>
        <div className={styles.listPane}>
          {queue.isLoading ? (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState icon={<Inbox aria-hidden="true" />} title={filter === "pending" ? "Nothing to review" : "No results here"}>
              {filter === "pending"
                ? "Run a workflow from a project's Operations tab; its result will wait here for you."
                : "Try another status filter."}
            </EmptyState>
          ) : (
            <ul className={styles.list} aria-label="Results">
              {visible.map((item) => {
                const p = projectOf(item.product_id);
                // A running item's preview is a placeholder, unless it says a retry is waiting.
                const summary = item.status === "running" ? runningNote(item) : item.preview;
                return (
                  <li key={item.id}>
                    <Link to={itemPath(item.id)} className={styles.item} aria-current={item.id === itemId ? "true" : undefined}>
                      <div className={styles.itemTop}>
                        <span className={styles.itemName}>{workflowName(item.workflow_id)}</span>
                        <QueueStatusPill item={item} now={now} />
                      </div>
                      {summary && <span className={styles.itemPreview}>{summary}</span>}
                      <span className={styles.itemMeta}>
                        {scope === "all" && p ? `${p.name} · ` : ""}
                        {relativeTime(item.created_at, now)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={styles.detail}>
          {selected ? (
            <ReviewDetail
              key={selected.id}
              item={selected}
              project={projectOf(selected.product_id)}
              showProject={scope === "all"}
              now={now}
              onDeleted={() => navigate(itemPath(), { replace: true })}
            />
          ) : (
            <EmptyState icon={<Inbox aria-hidden="true" />} title="Select a result" centered>
              {visible.length ? "Choose a result from the list, or press J to open the first one." : "Results you select open here."}
            </EmptyState>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewDetail({
  item,
  project,
  showProject,
  now,
  onDeleted,
}: {
  item: QueueItem;
  project: Project | undefined;
  showProject: boolean;
  now: number;
  onDeleted: () => void;
}) {
  const review = useReviewItem();
  const launch = useLaunchWorkflow();
  const cancel = useCancelOperation();
  const createTemplate = useCreateTemplate();
  const remove = useUndoableDelete();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useOrganisation();
  // Approving, rejecting, moving back and deleting results need the Approver role; running again, cancelling and templates need the Editor role.
  const canApprove = can("approver");
  const canEdit = can("editor");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const op = getOperation(item.workflow_id);
  const name = workflowName(item.workflow_id);
  const status = displayStatus(item, now);
  const inFlight = status === "running" || status === "stalled";
  const note = runningNote(item);
  const projectName = project?.name ?? "Project";
  const title = `${name} — ${projectName}`;

  const cancelOperation = () =>
    cancel.mutate(item.id, {
      onSuccess: (outcome) => {
        setConfirmingCancel(false);
        if (outcome.status === "cancelling") {
          // It stops at its next heartbeat; the live update (or the next poll) shows it failed.
          toast.show({ title: `Stopping ${midSentence(name)}`, description: "It stops within about 20 seconds, then shows as failed.", tone: "info" });
        } else {
          toast.show({ title: "Cancelled", description: `${name} for ${projectName} stopped without a result.` });
        }
      },
      onError: (err) => {
        setConfirmingCancel(false);
        if (err instanceof ApiError && err.status === 409) toast.show({ title: "Nothing to cancel", description: err.message, tone: "info" });
        else toast.show({ title: "Cancel failed", description: errorMessage(err), tone: "crit" });
      },
    });

  const act = async (label: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(label);
    try {
      await fn();
      toast.show({ title: success });
    } catch (err) {
      toast.show({ title: `${label} failed`, description: errorMessage(err), tone: "crit" });
    } finally {
      setBusy(null);
    }
  };

  const copy = async (contents: string, what: string) => {
    const ok = await copyText(contents);
    toast.show(ok ? { title: `${what} copied` } : { title: "Couldn't copy", tone: "crit" });
  };

  const runAgain = () =>
    act(
      "Run again",
      async () => {
        const response = await launch.mutateAsync({ productId: item.product_id, workflowId: item.workflow_id, instructions: item.input_params ?? "" });
        navigate(project ? routes.projectReview(project.id, response.task_id) : routes.review(response.task_id));
      },
      `${name} started again`,
    );

  const hasContent = item.content !== null && typeof item.content === "object" && Object.keys(item.content as object).length > 0;

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.detailTitleRow}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <h2 className={styles.detailTitle}>
              {name}
              <QueueStatusPill item={item} now={now} />
            </h2>
            <div className={styles.detailMeta}>
              {showProject && project && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ProjectSwatch color={project.color} />
                  <Link to={routes.project(project.id)}>{project.name}</Link>
                </span>
              )}
              <span>Started {formatTimestamp(item.created_at)}</span>
              {item.notes && <span>Note: {item.notes}</span>}
            </div>
          </div>
          <div className={styles.actions}>
            {status === "pending" && !canApprove && <RoleNote action="Approving or rejecting results" minimum="approver" />}
            {status === "pending" && canApprove && (
              <>
                <Button
                  variant="secondary"
                  icon={<X aria-hidden="true" />}
                  loading={busy === "Reject"}
                  onClick={() => void act("Reject", () => review.mutateAsync({ id: item.id, status: "rejected" }), "Result rejected")}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  icon={<Check aria-hidden="true" />}
                  loading={busy === "Approve"}
                  onClick={() =>
                    void act(
                      "Approve",
                      () => review.mutateAsync({ id: item.id, status: "approved" }),
                      op?.draftsEmailsOnApproval ? "Approved — any email addresses were added to the Outbox as drafts" : "Result approved",
                    )
                  }
                >
                  Approve
                </Button>
              </>
            )}
            {(status === "approved" || status === "rejected") && canApprove && (
              <Button
                variant="secondary"
                icon={<RotateCcw aria-hidden="true" />}
                loading={busy === "Move back"}
                onClick={() => void act("Move back", () => review.mutateAsync({ id: item.id, status: "pending" }), "Moved back to Needs review")}
              >
                Move back to review
              </Button>
            )}
            {inFlight &&
              (canEdit ? (
                <Button
                  variant={status === "stalled" ? "primary" : "secondary"}
                  icon={<CircleStop aria-hidden="true" />}
                  loading={cancel.isPending}
                  onClick={() => setConfirmingCancel(true)}
                >
                  Cancel operation
                </Button>
              ) : (
                <RoleNote action="Cancelling it" minimum="editor" />
              ))}
            {status === "failed" &&
              op &&
              (canEdit ? (
                <Button variant="primary" icon={<RotateCcw aria-hidden="true" />} loading={busy === "Run again"} onClick={() => void runAgain()}>
                  Run again
                </Button>
              ) : (
                <RoleNote action="Running it again" minimum="editor" />
              ))}
            {hasContent && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="secondary" icon={<FileDown aria-hidden="true" />}>
                    Export <ChevronDown aria-hidden="true" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Clipboard aria-hidden="true" />} onSelect={() => void copy(toPlainText(item.content, item.workflow_id), "Text")}>
                    Copy as plain text
                  </MenuItem>
                  <MenuItem icon={<Clipboard aria-hidden="true" />} onSelect={() => void copy(toMarkdown(item.content, title, item.workflow_id), "Markdown")}>
                    Copy as Markdown
                  </MenuItem>
                  <MenuItem
                    icon={<Download aria-hidden="true" />}
                    onSelect={() => downloadText(`${slugify(projectName)}-${item.workflow_id}.md`, toMarkdown(item.content, title, item.workflow_id), "text/markdown")}
                  >
                    Download Markdown
                  </MenuItem>
                  <MenuItem icon={<Sparkles aria-hidden="true" />} onSelect={() => void copy(toAssistantPrompt(item.content, name, projectName, item.workflow_id), "Prompt")}>
                    Copy as AI assistant prompt
                  </MenuItem>
                  {canEdit && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Save aria-hidden="true" />}
                        onSelect={() =>
                          void act(
                            "Save as template",
                            () =>
                              createTemplate.mutateAsync({
                                name: `${name} — ${projectName}`,
                                type: op?.category ?? "content",
                                tags: [...new Set([...(op?.templateTags ?? []), item.workflow_id])],
                                content: toMarkdown(item.content, title, item.workflow_id),
                                source_product: projectName,
                              }),
                            "Saved to templates",
                          )
                        }
                      >
                        Save as template
                      </MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            )}
            {status !== "running" && canApprove && (
              <IconButton
                variant="dangerGhost"
                label="Delete result"
                onClick={() => {
                  remove({ id: item.id, noun: "Result", listKeys: [keys.queueAll], remove: queueApi.remove });
                  onDeleted();
                }}
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            )}
          </div>
        </div>
        {status === "pending" && canApprove && op?.draftsEmailsOnApproval && (
          <p className={styles.hint}>Approving copies any email addresses in this result to the Outbox as drafts. Nothing is sent until you press Send there.</p>
        )}
        {item.input_params && (
          <details className={styles.instructions}>
            <summary>Instructions used</summary>
            <p>{item.input_params}</p>
          </details>
        )}
      </header>
      <div className={styles.detailBody}>
        {status === "running" ? (
          <EmptyState title="Working on it" centered>
            {op?.webResearch ? "This operation uses live web research, which can take a few minutes. " : ""}The result appears here
            automatically when it's ready, and the operation carries on if you close LaunchOps.
            {note && <span className={styles.runningNote}>{note}</span>}
          </EmptyState>
        ) : status === "stalled" ? (
          <EmptyState title="This operation may be stuck" centered>
            It has been running for {Math.round((now - new Date(item.created_at).getTime()) / 60_000)} minutes. Even when a failure is retried,
            an operation should finish within {STALL_MINUTES} minutes, so something may be wrong: for example, no worker is running to finish
            it.{canEdit ? " Cancel it, then run it again." : ""}
            {note && <span className={styles.runningNote}>Last update: {note}</span>}
          </EmptyState>
        ) : (
          <WorkflowResult workflowId={item.workflow_id} content={item.content} projectUrl={project?.url} />
        )}
      </div>
      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title={`Cancel ${midSentence(name)}?`}
        description="It stops without a result and shows as failed in Review. You can run it again afterwards."
        confirmLabel="Cancel operation"
        cancelLabel="Keep running"
        destructive
        busy={cancel.isPending}
        onConfirm={cancelOperation}
      />
    </>
  );
}
