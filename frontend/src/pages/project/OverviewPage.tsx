import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, CalendarClock, Circle, FileText, Inbox, ListChecks, Pencil, Sparkles } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import type { OrgRole, Project, ProjectStatus } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useCalendar, useCaptures, useQueue, useUndoableDelete, useUpdateProject } from "@/lib/queries/hooks";
import { capturesApi } from "@/lib/api/endpoints";
import { keys } from "@/lib/queries/keys";
import { useNow, useToday } from "@/lib/hooks/useClock";
import { PLAN_PHASES, phaseItems } from "@/lib/domain/checklist";
import { addDays, formatDateKey, formatTimestamp, relativeTime } from "@/lib/domain/dates";
import { REPORTS, workflowName } from "@/lib/domain/operations";
import { runningNote } from "@/lib/domain/queue";
import { STATUS_LABELS, hasReport, readiness } from "@/lib/domain/projects";
import { channelName } from "@/lib/domain/channels";
import { midSentence } from "@/lib/domain/values";
import { routes } from "@/lib/routes";
import { Button, IconButton, cx } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Display";
import { Field, FieldStack, Input, Select } from "@/components/ui/Field";
import { RoleRequirement, ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { QueueStatusPill } from "@/components/review/QueueStatusPill";
import { useShell } from "@/components/shell/shellContext";
import { useToast } from "@/components/ui/toast";
import { useProjectContext } from "./projectContext";
import styles from "./ProjectPages.module.css";

export function OverviewPage() {
  const project = useProjectContext();
  return (
    <div className={styles.split}>
      <div className={styles.column}>
        <NextSteps project={project} />
        <RecentOperations project={project} />
      </div>
      <div className={styles.column}>
        <LaunchPanel project={project} />
        <ReportsPanel project={project} />
        <UpcomingPanel project={project} />
        <IdeasPanel project={project} />
      </div>
    </div>
  );
}

interface Step {
  key: string;
  icon: ReactNode;
  title: string;
  meta: string;
  to: string;
  /** The role that can act on the step. Anyone else sees it listed without a link. */
  minimum: OrgRole;
}

function NextSteps({ project }: { project: Project }) {
  const { can } = useOrganisation();
  const pending = useQueue({ product_id: project.id, status: "pending", limit: 500 });
  const r = readiness(project);
  const steps: Step[] = [];
  const pendingCount = pending.data?.length ?? 0;

  if (pendingCount) {
    steps.push({
      key: "review",
      icon: <Inbox aria-hidden="true" />,
      title: `Review ${pendingCount} result${pendingCount === 1 ? "" : "s"}`,
      meta: "Approve what's usable; approving outreach results creates Outbox drafts.",
      to: routes.projectReview(project.id),
      minimum: "viewer",
    });
  }
  const profileTargets: Record<string, { title: string; meta: string }> = {
    launch_date: { title: "Set a launch date", meta: "Starts the T-minus clock and at-risk tracking." },
    description: { title: "Describe the project in 80+ characters", meta: "The description is context for every operation." },
    url: { title: "Add the website", meta: "Press kit, press release and SEO read this page." },
    keywords: { title: "Add keywords", meta: "Operations weave them into copy and research." },
    company: { title: "Assign a company", meta: "Press materials use the company's name, founders and boilerplate." },
  };
  for (const check of r.profile) {
    if (!check.done && profileTargets[check.id]) {
      steps.push({
        key: check.id,
        icon: <Pencil aria-hidden="true" />,
        ...profileTargets[check.id]!,
        to: routes.projectSettings(project.id),
        minimum: "editor",
      });
    }
  }
  for (const report of REPORTS) {
    if (!hasReport(project[report.reportKey])) {
      steps.push({
        key: report.id,
        icon: <Sparkles aria-hidden="true" />,
        title: `Generate the ${midSentence(report.name)}`,
        meta: report.produces,
        to: routes.projectOperations(project.id, report.id),
        minimum: "editor",
      });
    }
  }
  for (const def of PLAN_PHASES) {
    const open = phaseItems(project.checklist ?? {}, def).filter((i) => !i.checked);
    if (open.length) {
      steps.push({
        key: `plan-${def.phase}`,
        icon: <ListChecks aria-hidden="true" />,
        title: `${def.label}: ${open[0]!.label}`,
        meta: `${open.length} open item${open.length === 1 ? "" : "s"} in ${def.label.toLowerCase()}.`,
        to: routes.projectPlan(project.id),
        minimum: "editor",
      });
      break;
    }
  }

  return (
    <Panel title="Next steps" flush>
      {steps.length === 0 ? (
        <EmptyState title="Nothing outstanding">The profile is complete, every report exists and the plan is done.</EmptyState>
      ) : (
        <ul className={styles.list}>
          {steps.slice(0, 7).map((step) => {
            const actionable = can(step.minimum);
            return (
              <li key={step.key} className={styles.listItem}>
                <span className={styles.stepIcon}>{step.icon}</span>
                <div className={styles.listMain}>
                  {actionable ? (
                    <Link to={step.to} className={styles.listTitle}>
                      {step.title}
                    </Link>
                  ) : (
                    <span className={styles.listTitle}>{step.title}</span>
                  )}
                  <span className={styles.listMeta}>{step.meta}</span>
                </div>
                {actionable && <ArrowRight size={14} aria-hidden="true" style={{ color: "var(--ink-3)" }} />}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RecentOperations({ project }: { project: Project }) {
  const queue = useQueue({ product_id: project.id, limit: 8 });
  const now = useNow();
  const items = queue.data ?? [];
  return (
    <Panel
      title="Recent operations"
      flush
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link to={routes.projectReview(project.id)}>All results</Link>
        </Button>
      }
    >
      {queue.isSuccess && items.length === 0 ? (
        <EmptyState
          icon={<Sparkles aria-hidden="true" />}
          title="No operations yet"
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to={routes.projectOperations(project.id)}>Browse operations</Link>
            </Button>
          }
        >
          Workflow results — competitor research, social posts, outreach — land here for review.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            // A running item's preview is a placeholder, unless it says a retry is waiting.
            const summary = item.status === "running" ? runningNote(item) : item.preview;
            return (
              <li key={item.id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <Link to={routes.projectReview(project.id, item.id)} className={styles.listTitle}>
                    {workflowName(item.workflow_id)}
                  </Link>
                  <span className={styles.listMeta}>
                    {relativeTime(item.created_at, now)}
                    {summary ? ` · ${summary}` : ""}
                  </span>
                </div>
                <QueueStatusPill item={item} now={now} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function LaunchPanel({ project }: { project: Project }) {
  const update = useUpdateProject(project.id);
  const canEdit = useOrganisation().can("editor");
  const toast = useToast();
  const [date, setDate] = useState(project.launch_date ?? "");
  const [syncedDate, setSyncedDate] = useState(project.launch_date ?? "");
  if ((project.launch_date ?? "") !== syncedDate) {
    setSyncedDate(project.launch_date ?? "");
    setDate(project.launch_date ?? "");
  }

  const save = async (patch: { status?: ProjectStatus; launch_date?: string | null }, success: string) => {
    try {
      await update.mutateAsync(patch);
      toast.show({ title: success });
    } catch (err) {
      toast.show({ title: "Not saved", description: errorMessage(err), tone: "crit" });
    }
  };

  return (
    <Panel title="Launch">
      <FieldStack>
        {!canEdit && <ViewOnlyNotice action="Changing them">You can view the launch status and date.</ViewOnlyNotice>}
        <ViewOnlyFieldset readOnly={!canEdit}>
          <div className={styles.inlineForm}>
            <Field label="Status">
              {(props) => (
                <Select
                  {...props}
                  value={project.status}
                  disabled={update.isPending}
                  onChange={(e) => {
                    const status = e.target.value as ProjectStatus;
                    void save({ status }, `Status set to ${STATUS_LABELS[status]}`);
                  }}
                >
                  {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Launch date">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={date}
                  disabled={update.isPending}
                  onChange={(e) => setDate(e.target.value)}
                  onBlur={() => {
                    if (date !== (project.launch_date ?? "")) {
                      void save({ launch_date: date || null }, date ? `Launch date set to ${formatDateKey(date, "medium")}` : "Launch date cleared");
                    }
                  }}
                />
              )}
            </Field>
          </div>
        </ViewOnlyFieldset>
      </FieldStack>
    </Panel>
  );
}

function ReportsPanel({ project }: { project: Project }) {
  const canEdit = useOrganisation().can("editor");
  return (
    <Panel title="Reports" flush>
      <ul className={styles.list}>
        {REPORTS.map((report) => {
          const value = project[report.reportKey] as { generated_at?: string } | null | undefined;
          const done = hasReport(value);
          return (
            <li key={report.id} className={styles.listItem}>
              <span className={cx(styles.lamp, done && styles.lampLit)} aria-hidden="true" />
              <div className={styles.listMain}>
                {done ? (
                  <Link to={routes.projectReport(project.id, report.reportKey)} className={styles.listTitle}>
                    {report.name}
                  </Link>
                ) : (
                  <span className={styles.listTitle}>{report.name}</span>
                )}
                <span className={styles.listMeta}>
                  {done ? (value?.generated_at ? `Generated ${formatTimestamp(value.generated_at)}` : "Generated") : "Not generated"}
                </span>
              </div>
              {!done && canEdit && (
                <Button asChild size="sm" variant="ghost">
                  <Link to={routes.projectOperations(project.id, report.id)}>Generate</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function UpcomingPanel({ project }: { project: Project }) {
  const today = useToday();
  const calendar = useCalendar();
  const horizon = addDays(today, 30);
  const events = (calendar.data ?? [])
    .filter((e) => e.product_id === project.id && e.date >= today && e.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  return (
    <Panel
      title="Next 30 days"
      flush
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link to={routes.calendar}>Calendar</Link>
        </Button>
      }
    >
      {events.length === 0 ? (
        <EmptyState icon={<CalendarClock aria-hidden="true" />} title="Nothing scheduled">
          Add content dates for this project on the calendar.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {events.map((e) => (
            <li key={e.id} className={styles.listItem}>
              <span className="num" style={{ fontSize: "var(--text-12)", color: "var(--ink-2)", minWidth: 84 }}>
                {formatDateKey(e.date, "weekday")}
              </span>
              <div className={styles.listMain}>
                <span className={styles.listTitle}>{e.title}</span>
                <span className={styles.listMeta}>{e.platform === "all" ? "All channels" : channelName(e.platform)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function IdeasPanel({ project }: { project: Project }) {
  const captures = useCaptures();
  const shell = useShell();
  const canEdit = useOrganisation().can("editor");
  const now = useNow();
  const remove = useUndoableDelete();
  const ideas = (captures.data ?? []).filter((c) => c.product_id === project.id).slice(0, 5);
  return (
    <Panel
      title="Ideas"
      flush
      actions={
        canEdit && (
          <Button size="sm" variant="ghost" onClick={() => shell.openCapture(project.id)}>
            Capture
          </Button>
        )
      }
    >
      {ideas.length === 0 ? (
        <EmptyState icon={<FileText aria-hidden="true" />} title="No ideas captured">
          {canEdit ? (
            "Jot down post ideas, angles and follow-ups. Turn any of them into an operation later."
          ) : (
            <RoleRequirement action="Capturing ideas" minimum="editor" />
          )}
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {ideas.map((idea) => (
            <li key={idea.id} className={styles.listItem}>
              <Circle size={8} aria-hidden="true" style={{ color: "var(--ink-3)", flexShrink: 0 }} />
              <div className={styles.listMain}>
                <span style={{ whiteSpace: "normal" }}>{idea.text}</span>
                <span className={styles.listMeta}>
                  {relativeTime(idea.created_at, now)}
                  {canEdit && (
                    <>
                      {" · "}
                      <Link to={`${routes.projectOperations(project.id)}?idea=${idea.id}`}>Use in an operation</Link>
                    </>
                  )}
                </span>
              </div>
              {canEdit && (
                <IconButton
                  size="sm"
                  label="Delete idea"
                  onClick={() =>
                    remove({ id: idea.id, noun: "Idea", listKeys: [keys.captures()], remove: capturesApi.remove })
                  }
                >
                  ×
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
