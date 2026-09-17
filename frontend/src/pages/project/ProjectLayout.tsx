import { Link, Outlet, useParams } from "react-router";
import { ExternalLink, FolderX, Lightbulb, Play } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Project } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useBrands, useEmails, useProject, useQueue } from "@/lib/queries/hooks";
import { useToday } from "@/lib/hooks/useClock";
import { planProgress } from "@/lib/domain/checklist";
import {
  PROJECT_TYPE_LABELS,
  REPORT_KEYS,
  STATUS_LABELS,
  daysToLaunch,
  hasReport,
  launchState,
  projectType,
  readiness,
} from "@/lib/domain/projects";
import { formatDateKey } from "@/lib/domain/dates";
import { hostname, safeUrl } from "@/lib/domain/values";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState, Notice, Panel, Skeleton } from "@/components/ui/Display";
import { Count } from "@/components/ui/Pill";
import { TabNav } from "@/components/ui/TabNav";
import { LaunchClock, LaunchStatePill, ProjectSwatch, ReadinessMeter } from "@/components/project/ProjectBits";
import projectStyles from "@/components/project/Project.module.css";
import { useShell } from "@/components/shell/shellContext";
import type { ProjectOutletContext } from "./projectContext";
import styles from "./ProjectPages.module.css";

export function ProjectLayout() {
  const { projectId } = useParams();
  const project = useProject(projectId);

  if (project.data) return <ProjectWorkspace project={project.data} />;

  if (project.isError) {
    const notFound = project.error instanceof ApiError && project.error.status === 404;
    return (
      <Panel>
        {notFound ? (
          <EmptyState
            icon={<FolderX aria-hidden="true" />}
            title="Project not found"
            action={
              <Button asChild variant="secondary">
                <Link to={routes.portfolio}>Back to portfolio</Link>
              </Button>
            }
          >
            It may have been deleted, or it belongs to another account.
          </EmptyState>
        ) : (
          <Notice tone="crit">{errorMessage(project.error)}</Notice>
        )}
      </Panel>
    );
  }

  return (
    <div className={projectStyles.header} aria-busy="true">
      <Skeleton width={120} height={12} />
      <Skeleton width={320} height={32} />
      <Skeleton width="60%" height={16} />
    </div>
  );
}

function ProjectWorkspace({ project }: { project: Project }) {
  const today = useToday();
  const shell = useShell();
  const canEdit = useOrganisation().can("editor");
  const pending = useQueue({ product_id: project.id, status: "pending", limit: 500 });
  const emails = useEmails({ product_id: project.id });
  const brands = useBrands();
  const r = readiness(project);
  const days = daysToLaunch(project, today);
  const state = launchState(project, r.score, today);
  const plan = planProgress(project.checklist ?? {});
  const reportsDone = REPORT_KEYS.filter((k) => hasReport(project[k])).length;
  const unsent = (emails.data ?? []).filter((e) => e.status !== "sent").length;
  const pendingCount = pending.data?.length ?? 0;
  const website = safeUrl(project.url);
  const company = project.brand_id
    ? brands.data?.find((b) => b.id === project.brand_id)?.name
    : project.company_details?.company_name;

  return (
    <>
      <header className={projectStyles.header}>
        <div className={projectStyles.headerTop}>
          <div className={projectStyles.identity}>
            <div className="placard">
              {PROJECT_TYPE_LABELS[projectType(project)]} · {STATUS_LABELS[project.status] ?? project.status}
            </div>
            <h1 className={projectStyles.name}>
              <ProjectSwatch color={project.color} size="lg" />
              {project.name}
            </h1>
            {project.tagline && <p className={projectStyles.tagline}>{project.tagline}</p>}
            <div className={projectStyles.identityMeta}>
              <LaunchStatePill state={state} />
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {hostname(project.url)} <ExternalLink size={12} aria-hidden="true" style={{ display: "inline" }} />
                </a>
              )}
              {company && (
                <>
                  <span className={projectStyles.sep}>·</span>
                  <span>{company}</span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            {canEdit && (
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" icon={<Lightbulb aria-hidden="true" />} onClick={() => shell.openCapture(project.id)}>
                  Capture idea
                </Button>
                <Button asChild variant="primary">
                  <Link to={routes.projectOperations(project.id)}>
                    <Play aria-hidden="true" />
                    Run an operation
                  </Link>
                </Button>
              </div>
            )}
            <div className={projectStyles.gauges}>
              <div className={projectStyles.gauge}>
                <span className="placard">Launch</span>
                <div className={projectStyles.gaugeValue}>
                  <LaunchClock days={days} launchDate={project.launch_date} state={state} size="lg" />
                </div>
                <span className={projectStyles.gaugeSub}>
                  {project.launch_date ? formatDateKey(project.launch_date, "medium") : "No date set"}
                </span>
              </div>
              <div className={projectStyles.gauge} style={{ minWidth: 200 }}>
                <span className="placard">Readiness</span>
                <ReadinessMeter readiness={r} size="lg" />
                <span className={projectStyles.gaugeSub}>Select for the breakdown</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.tabs}>
        <TabNav
          label="Project sections"
          items={[
            { to: routes.project(project.id), label: "Overview", end: true },
            { to: routes.projectOperations(project.id), label: "Operations" },
            { to: routes.projectReports(project.id), label: "Reports", badge: <Count value={reportsDone} label={`${reportsDone} of 5 reports`} /> },
            {
              to: routes.projectReview(project.id),
              label: "Review",
              badge: pendingCount ? <Count value={pendingCount} signal label={`${pendingCount} awaiting review`} /> : undefined,
            },
            { to: routes.projectOutbox(project.id), label: "Outbox", badge: unsent ? <Count value={unsent} label={`${unsent} unsent`} /> : undefined },
            { to: routes.projectPlan(project.id), label: "Launch plan", badge: <span className="placard num">{plan.done}/{plan.total}</span> },
            { to: routes.projectSettings(project.id), label: "Settings" },
          ]}
        />
      </div>

      <Outlet context={{ project } satisfies ProjectOutletContext} />
    </>
  );
}
