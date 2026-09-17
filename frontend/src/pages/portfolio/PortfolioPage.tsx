import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { FolderPlus, Plus } from "lucide-react";
import type { Project, QueueItem } from "@/lib/api/types";
import { roleRequirement, useOrganisation } from "@/lib/auth/organisation";
import { useCalendar, useEmails, useProjects, useQueue } from "@/lib/queries/hooks";
import { STALL_MINUTES } from "@/lib/domain/queue";
import { useNow, useToday } from "@/lib/hooks/useClock";
import { addDays, daysBetween, formatDateKey, minutesSince, relativeTime } from "@/lib/domain/dates";
import { workflowName } from "@/lib/domain/operations";
import {
  PROJECT_TYPE_LABELS,
  STATUS_LABELS,
  daysToLaunch,
  launchState,
  projectType,
  readiness,
  type LaunchState,
  type Readiness,
} from "@/lib/domain/projects";
import { channelName } from "@/lib/domain/channels";
import { routes } from "@/lib/routes";
import { Button, cx } from "@/components/ui/Button";
import { EmptyState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { Count } from "@/components/ui/Pill";
import { LaunchClock, LaunchStatePill, ProjectSwatch, ReadinessMeter, ReportLamps } from "@/components/project/ProjectBits";
import { RoleNote } from "@/components/access/Access";
import { useShell } from "@/components/shell/shellContext";
import styles from "./PortfolioPage.module.css";

type SortKey = "attention" | "launch" | "readiness" | "name";
type FilterKey = "all" | "pre" | "launched";

interface Row {
  project: Project;
  readiness: Readiness;
  days: number | null;
  state: LaunchState;
  pending: number;
}

const STATE_RANK: Record<LaunchState, number> = { overdue: 0, at_risk: 1, on_track: 2, unscheduled: 3, launched: 4 };

export function PortfolioPage() {
  const shell = useShell();
  const canEdit = useOrganisation().can("editor");
  const navigate = useNavigate();
  const today = useToday();
  const now = useNow();
  const projects = useProjects();
  const pending = useQueue({ status: "pending", limit: 500 });
  const failed = useQueue({ status: "failed", limit: 50 });
  const running = useQueue({ status: "running", limit: 50 });
  const emails = useEmails();
  const calendar = useCalendar();
  const [sort, setSort] = useState<SortKey>("attention");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo<Row[]>(() => {
    const pendingByProject = new Map<string, number>();
    for (const item of pending.data ?? []) {
      pendingByProject.set(item.product_id, (pendingByProject.get(item.product_id) ?? 0) + 1);
    }
    return (projects.data ?? []).map((project) => {
      const r = readiness(project);
      return {
        project,
        readiness: r,
        days: daysToLaunch(project, today),
        state: launchState(project, r.score, today),
        pending: pendingByProject.get(project.id) ?? 0,
      };
    });
  }, [projects.data, pending.data, today]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (filter === "pre" && row.project.status !== "pre_launch") return false;
      if (filter === "launched" && row.project.status === "pre_launch") return false;
      if (q && !`${row.project.name} ${row.project.tagline}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const byDays = (a: Row, b: Row) => (a.days ?? Number.POSITIVE_INFINITY) - (b.days ?? Number.POSITIVE_INFINITY);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "launch":
          return byDays(a, b) || a.project.name.localeCompare(b.project.name);
        case "readiness":
          return a.readiness.score - b.readiness.score || a.project.name.localeCompare(b.project.name);
        case "name":
          return a.project.name.localeCompare(b.project.name);
        default:
          return STATE_RANK[a.state] - STATE_RANK[b.state] || byDays(a, b) || a.project.name.localeCompare(b.project.name);
      }
    });
  }, [rows, filter, search, sort]);

  const upcomingLaunches = rows
    .filter((r) => r.project.status === "pre_launch" && r.days !== null && r.days >= 0 && r.days <= 30)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  const unsent = (emails.data ?? []).filter((e) => e.status !== "sent");
  const failedEmails = unsent.filter((e) => e.status === "failed").length;
  const pendingProjects = new Set((pending.data ?? []).map((i) => i.product_id)).size;
  const preLaunch = rows.filter((r) => r.project.status === "pre_launch").length;

  const eyebrow = formatDateKey(today, "long");

  if (projects.isSuccess && projects.data.length === 0) {
    return (
      <>
        <PageHeader eyebrow={eyebrow} title="Portfolio" />
        <Panel>
          <EmptyState
            icon={<FolderPlus aria-hidden="true" />}
            title="Your launch board is empty"
            action={
              canEdit ? (
                <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={shell.openNewProject}>
                  Create a project
                </Button>
              ) : (
                <RoleNote action="Creating a project" minimum="editor" />
              )
            }
          >
            Add each product, service or persona you're launching. The board tracks every launch date, readiness score and
            open review in one place.
            <ol className={styles.intro}>
              <li className={styles.introStep}>
                <strong>Describe the project</strong>
                Name, website and a description become context for every AI operation.
              </li>
              <li className={styles.introStep}>
                <strong>Run operations</strong>
                Market analysis, press, content and outreach — results wait for your review.
              </li>
              <li className={styles.introStep}>
                <strong>Work the launch plan</strong>
                A 33-step plan from pre-launch to retrospective, with a T-minus clock.
              </li>
            </ol>
          </EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title="Portfolio"
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={shell.openNewProject}>
              New project
            </Button>
          )
        }
      />

      <section className={styles.summary} aria-label="Portfolio summary">
        <div className={styles.figure}>
          <span className="placard">Projects</span>
          <span className={styles.figureValue}>{projects.isLoading ? "–" : rows.length}</span>
          <span className={styles.figureSub}>
            {preLaunch} pre-launch · {rows.length - preLaunch} launched
          </span>
        </div>
        <div className={styles.figure}>
          <span className="placard">Launching in 30 days</span>
          <span className={styles.figureValue}>{upcomingLaunches.length}</span>
          <span className={styles.figureSub}>
            {upcomingLaunches[0]
              ? `Next: ${upcomingLaunches[0].project.name}, ${formatDateKey(upcomingLaunches[0].project.launch_date, "short")}`
              : "No launch dates in the next 30 days"}
          </span>
        </div>
        <Link to={routes.review()} className={styles.figure}>
          <span className="placard">Awaiting review</span>
          <span className={styles.figureValue}>{pending.data?.length ?? "–"}</span>
          <span className={styles.figureSub}>
            {pendingProjects ? `Across ${pendingProjects} project${pendingProjects === 1 ? "" : "s"}` : "Nothing waiting"}
          </span>
        </Link>
        <Link to={routes.outbox} className={styles.figure}>
          <span className="placard">Unsent emails</span>
          <span className={styles.figureValue}>{emails.data ? unsent.length : "–"}</span>
          <span className={styles.figureSub}>{failedEmails ? `${failedEmails} failed to send` : "Drafts waiting in the Outbox"}</span>
        </Link>
      </section>

      <section className={styles.board} aria-labelledby="board-title">
        <div className={styles.boardHeader}>
          <h2 className={styles.boardTitle} id="board-title">
            Launch board <span className="placard">{visible.length} shown</span>
          </h2>
          <div className={styles.boardControls}>
            <Input
              className={styles.search}
              type="search"
              placeholder="Filter projects"
              aria-label="Filter projects by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Segmented<FilterKey>
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "pre", label: "Pre-launch" },
                { value: "launched", label: "Launched" },
              ]}
            />
            <Segmented<SortKey>
              label="Sort by"
              value={sort}
              onChange={setSort}
              options={[
                { value: "attention", label: "Attention" },
                { value: "launch", label: "Launch date" },
                { value: "readiness", label: "Readiness" },
                { value: "name", label: "Name" },
              ]}
            />
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className="placard">
                  Project
                </th>
                <th scope="col" className="placard">
                  State
                </th>
                <th scope="col" className="placard">
                  Launch
                </th>
                <th scope="col" className="placard">
                  Readiness
                </th>
                <th scope="col" className={cx("placard", styles.hideNarrow)}>
                  Reports
                </th>
                <th scope="col" className="placard" style={{ textAlign: "right" }}>
                  Review
                </th>
                <th scope="col" className={cx("placard", styles.hideNarrow)} style={{ textAlign: "right" }}>
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.isLoading &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }, (__, j) => (
                      <td key={j}>
                        <Skeleton width={j === 0 ? 180 : 70} />
                      </td>
                    ))}
                  </tr>
                ))}
              {visible.map((row) => (
                <tr key={row.project.id} className={styles.row} onClick={() => navigate(routes.project(row.project.id))}>
                  <td>
                    <div className={styles.projectCell}>
                      <ProjectSwatch color={row.project.color} size="lg" />
                      <div className={styles.projectText}>
                        <Link to={routes.project(row.project.id)} className={styles.projectName} onClick={(e) => e.stopPropagation()}>
                          {row.project.name}
                        </Link>
                        <span className={styles.projectSub}>
                          {PROJECT_TYPE_LABELS[projectType(row.project)]} · {STATUS_LABELS[row.project.status] ?? row.project.status}
                          {row.project.tagline ? ` · ${row.project.tagline}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <LaunchStatePill state={row.state} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={styles.launchCell}>
                      <LaunchClock days={row.days} launchDate={row.project.launch_date} state={row.state} />
                      <span className={styles.launchDate}>
                        {row.project.launch_date ? formatDateKey(row.project.launch_date, "medium") : "Not scheduled"}
                      </span>
                    </div>
                  </td>
                  <td className={styles.readinessCell} onClick={(e) => e.stopPropagation()}>
                    <ReadinessMeter readiness={row.readiness} />
                  </td>
                  <td className={styles.hideNarrow} onClick={(e) => e.stopPropagation()}>
                    <ReportLamps project={row.project} />
                  </td>
                  <td className={styles.numCell}>
                    {row.pending ? <Count value={row.pending} signal label={`${row.pending} awaiting review`} /> : <span className={styles.muted}>0</span>}
                  </td>
                  <td className={cx(styles.numCell, styles.hideNarrow, styles.muted)}>{relativeTime(row.project.updated_at, now)}</td>
                </tr>
              ))}
              {projects.isSuccess && visible.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No projects match">Clear the filter or search to see every project.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.lower}>
        <AttentionPanel rows={rows} failed={failed.data ?? []} running={running.data ?? []} failedEmails={failedEmails} now={now} />
        <UpcomingPanel rows={rows} today={today} events={calendar.data ?? []} />
      </div>
    </>
  );
}

interface AttentionItem {
  key: string;
  severity: "crit" | "warn" | "signal";
  title: ReactNode;
  meta: string;
}

function AttentionPanel({
  rows,
  failed,
  running,
  failedEmails,
  now,
}: {
  rows: Row[];
  failed: QueueItem[];
  running: QueueItem[];
  failedEmails: number;
  now: number;
}) {
  const { current, can } = useOrganisation();
  const nameOf = (id: string) => rows.find((r) => r.project.id === id)?.project.name ?? "a project";
  const stalledAdvice = can("editor")
    ? "Open it to cancel it and run it again."
    : roleRequirement("Cancelling it and running it again", "editor", current?.name);
  const items: AttentionItem[] = [];

  for (const row of rows) {
    if (row.state === "overdue") {
      items.push({
        key: `overdue-${row.project.id}`,
        severity: "crit",
        title: <Link to={routes.project(row.project.id)}>{row.project.name} is past its launch date</Link>,
        meta: `Launch date was ${formatDateKey(row.project.launch_date, "medium")}. Mark it launched or set a new date.`,
      });
    }
  }
  for (const row of rows) {
    if (row.state === "at_risk") {
      items.push({
        key: `risk-${row.project.id}`,
        severity: "warn",
        title: <Link to={routes.projectPlan(row.project.id)}>{row.project.name} launches in {row.days} days</Link>,
        meta: `Readiness ${row.readiness.score} of 100 — below 70 inside the final 14 days.`,
      });
    }
  }
  for (const item of failed.slice(0, 5)) {
    items.push({
      key: `failed-${item.id}`,
      severity: "crit",
      title: <Link to={routes.projectReview(item.product_id, item.id)}>{workflowName(item.workflow_id)} failed</Link>,
      meta: `${nameOf(item.product_id)} · ${relativeTime(item.created_at, now)}`,
    });
  }
  for (const item of running) {
    if (minutesSince(item.created_at, now) >= STALL_MINUTES) {
      items.push({
        key: `stalled-${item.id}`,
        severity: "warn",
        title: <Link to={routes.projectReview(item.product_id, item.id)}>{workflowName(item.workflow_id)} has been running {Math.round(minutesSince(item.created_at, now))} minutes</Link>,
        meta: `${nameOf(item.product_id)} · it may be stuck. ${stalledAdvice}`,
      });
    }
  }
  if (failedEmails) {
    items.push({
      key: "emails",
      severity: "crit",
      title: <Link to={routes.outbox}>{failedEmails} email{failedEmails === 1 ? "" : "s"} failed to send</Link>,
      meta: "Open the Outbox to see the error and retry.",
    });
  }
  for (const row of rows) {
    if (row.pending > 0) {
      items.push({
        key: `pending-${row.project.id}`,
        severity: "signal",
        title: (
          <Link to={routes.projectReview(row.project.id)}>
            {row.pending} result{row.pending === 1 ? "" : "s"} awaiting review in {row.project.name}
          </Link>
        ),
        meta: "Approve, reject or save as a template.",
      });
    }
  }

  const shown = items.slice(0, 8);
  return (
    <Panel title="Needs attention" flush>
      {shown.length === 0 ? (
        <EmptyState title="All clear">No overdue launches, failures or results waiting for review.</EmptyState>
      ) : (
        <>
          <ul className={styles.list}>
            {shown.map((item) => (
              <li key={item.key} className={styles.listItem}>
                <span
                  className={cx(
                    styles.severity,
                    item.severity === "crit" && styles.severityCrit,
                    item.severity === "warn" && styles.severityWarn,
                    item.severity === "signal" && styles.severitySignal,
                  )}
                  aria-hidden="true"
                />
                <div>
                  <div>{item.title}</div>
                  <div className={styles.listMeta}>{item.meta}</div>
                </div>
                <span />
              </li>
            ))}
          </ul>
          {items.length > shown.length && <div className={styles.more}>And {items.length - shown.length} more</div>}
        </>
      )}
    </Panel>
  );
}

function UpcomingPanel({ rows, today, events }: { rows: Row[]; today: string; events: Array<{ id: string; date: string; title: string; product_id: string; platform: string }> }) {
  const horizon = addDays(today, 14);
  const entries = [
    ...rows
      .filter((r) => r.project.launch_date && r.project.launch_date >= today && r.project.launch_date <= horizon && r.project.status === "pre_launch")
      .map((r) => ({
        key: `launch-${r.project.id}`,
        date: r.project.launch_date!,
        title: `${r.project.name} launches`,
        projectId: r.project.id,
        color: r.project.color,
        meta: "Launch day",
      })),
    ...events
      .filter((e) => e.date >= today && e.date <= horizon)
      .map((e) => {
        const project = rows.find((r) => r.project.id === e.product_id)?.project;
        return {
          key: e.id,
          date: e.date,
          title: e.title,
          projectId: e.product_id,
          color: project?.color ?? "",
          meta: `${project?.name ?? "Project"} · ${e.platform === "all" ? "All channels" : channelName(e.platform)}`,
        };
      }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Panel
      title="Next 14 days"
      flush
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link to={routes.calendar}>Calendar</Link>
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyState title="Nothing scheduled">Launch dates and calendar entries for the next two weeks appear here.</EmptyState>
      ) : (
        <ul className={styles.list}>
          {entries.slice(0, 10).map((entry) => {
            const days = daysBetween(today, entry.date) ?? 0;
            return (
              <li key={entry.key} className={styles.listItem}>
                <span className={styles.dateCol}>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatDateKey(entry.date, "weekday")}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProjectSwatch color={entry.color} />
                    <Link to={routes.project(entry.projectId)}>{entry.title}</Link>
                  </div>
                  <div className={styles.listMeta}>{entry.meta}</div>
                </div>
                <span />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
