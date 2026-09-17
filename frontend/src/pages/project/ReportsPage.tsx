import { Link, useParams } from "react-router";
import { ChevronDown, Clipboard, Download, FileDown, Play, Printer, Sparkles } from "lucide-react";
import type { Project, ReportKey } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { REPORTS, reportForKey } from "@/lib/domain/operations";
import { hasReport } from "@/lib/domain/projects";
import { formatTimestamp } from "@/lib/domain/dates";
import { downloadText, slugify, toAssistantPrompt, toMarkdown } from "@/lib/domain/exporters";
import { hostname, midSentence, text } from "@/lib/domain/values";
import { REPORT_SLUGS, reportKeyFromSlug, routes } from "@/lib/routes";
import { Button, cx } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Display";
import { copyText } from "@/lib/clipboard";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import { RoleNote } from "@/components/access/Access";
import { ReportBody } from "@/components/results/Reports";
import { reportSections, seoAssistantPrompt } from "@/lib/domain/reports";
import type { SeoResult } from "@/lib/api/types";
import { useProjectContext } from "./projectContext";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  const project = useProjectContext();
  const { reportSlug } = useParams();
  if (!reportSlug) return <ReportsIndex project={project} />;
  const key = reportKeyFromSlug(reportSlug);
  if (!key) {
    return (
      <Panel>
        <EmptyState title="Report not found" action={<Button asChild variant="secondary"><Link to={routes.projectReports(project.id)}>All reports</Link></Button>}>
          There's no report at this address.
        </EmptyState>
      </Panel>
    );
  }
  return <ReportDocument project={project} reportKey={key} />;
}

function meta(project: Project, key: ReportKey) {
  const value = project[key] as { generated_at?: string; source_url?: string } | null | undefined;
  return { value, generated: value?.generated_at, source: value?.source_url };
}

function ReportsIndex({ project }: { project: Project }) {
  const canRun = useOrganisation().can("editor");
  return (
    <div className={styles.index}>
      {REPORTS.map((report) => {
        const { value, generated } = meta(project, report.reportKey);
        const done = hasReport(value);
        const raw = Boolean(value && text((value as { raw_response?: unknown }).raw_response));
        return (
          <article key={report.id} className={styles.indexCard} aria-labelledby={`report-${report.id}`}>
            <div className={styles.indexHead}>
              <span className={cx(styles.lamp, done && styles.lampLit)} aria-hidden="true" />
              <h2 className={styles.indexTitle} id={`report-${report.id}`}>
                {report.name}
              </h2>
            </div>
            <p className={styles.indexText}>{report.produces}</p>
            <div className={styles.indexMeta}>
              {done
                ? generated
                  ? `Generated ${formatTimestamp(generated)}`
                  : "Generated"
                : raw
                  ? "Last run returned unstructured text"
                  : "Not generated yet"}
            </div>
            <div className={styles.indexActions}>
              {(done || raw) && (
                <Button asChild variant="secondary" size="sm">
                  <Link to={routes.projectReport(project.id, report.reportKey)}>
                    Open{" "}
                    <span className="sr-only">{midSentence(report.name)}</span>
                  </Link>
                </Button>
              )}
              {canRun && (
                <Button asChild variant={done ? "ghost" : "primary"} size="sm">
                  <Link to={routes.projectOperations(project.id, report.id)}>
                    {done ? "Run again" : "Generate"}
                    {/* A text-node space: accessible names drop a span's leading whitespace. */}
                    {done ? "" : " "}
                    <span className="sr-only">{done ? `: ${midSentence(report.name)}` : midSentence(report.name)}</span>
                  </Link>
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ReportDocument({ project, reportKey }: { project: Project; reportKey: ReportKey }) {
  const toast = useToast();
  const canRun = useOrganisation().can("editor");
  const op = reportForKey(reportKey)!;
  const { value, generated, source } = meta(project, reportKey);
  const exists = Boolean(value && (hasReport(value) || text((value as { raw_response?: unknown }).raw_response)));
  const sections = exists ? reportSections(reportKey, value) : [];
  const title = `${op.name} — ${project.name}`;
  const filename = `${slugify(project.name)}-${REPORT_SLUGS[reportKey]}.md`;
  const pageUrl = source || project.url;

  const copy = async (contents: string, what: string) => {
    const ok = await copyText(contents);
    toast.show(ok ? { title: `${what} copied` } : { title: "Couldn't copy", description: "Your browser blocked clipboard access.", tone: "crit" });
  };

  return (
    <div className={styles.docLayout}>
      <aside className={styles.rail} data-print="hide">
        <nav aria-label="Reports">
          <span className="placard">Reports</span>
          <ul className={styles.railList}>
            {REPORTS.map((r) => (
              <li key={r.id}>
                <Link
                  to={routes.projectReport(project.id, r.reportKey)}
                  className={styles.railLink}
                  aria-current={r.reportKey === reportKey ? "page" : undefined}
                >
                  <span className={cx(styles.lamp, hasReport(project[r.reportKey]) && styles.lampLit)} aria-hidden="true" />
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {sections.length > 0 && (
          <nav aria-label="On this page">
            <span className="placard">On this page</span>
            <div className={styles.railList}>
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={styles.sectionLink}>
                  {s.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </aside>

      <article className={styles.document} data-print="page">
        <header className={styles.docHeader}>
          <div className="placard">Report · {project.name}</div>
          <div className={styles.docTitleRow}>
            <h1 className={styles.docTitle}>{op.name}</h1>
            <div className={styles.docActions} data-print="hide">
              {exists && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="secondary" icon={<FileDown aria-hidden="true" />}>
                      Export <ChevronDown aria-hidden="true" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Printer aria-hidden="true" />} onSelect={() => window.print()}>
                      Print or save as PDF
                    </MenuItem>
                    <MenuItem icon={<Download aria-hidden="true" />} onSelect={() => downloadText(filename, toMarkdown(value, title, reportKey), "text/markdown")}>
                      Download Markdown
                    </MenuItem>
                    <MenuItem icon={<Clipboard aria-hidden="true" />} onSelect={() => void copy(toMarkdown(value, title, reportKey), "Markdown")}>
                      Copy as Markdown
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Sparkles aria-hidden="true" />}
                      onSelect={() =>
                        void copy(
                          reportKey === "seo_result" ? seoAssistantPrompt(value as SeoResult, pageUrl) : toAssistantPrompt(value, op.name, project.name, reportKey),
                          "Prompt",
                        )
                      }
                    >
                      Copy as AI assistant prompt
                    </MenuItem>
                  </MenuContent>
                </Menu>
              )}
              {canRun && (
                <Button asChild variant={exists ? "ghost" : "primary"}>
                  <Link to={routes.projectOperations(project.id, op.id)}>
                    <Play aria-hidden="true" />
                    {exists ? "Run again" : "Generate"}
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {exists && (
            <div className={styles.docMeta}>
              {generated ? <span>Generated {formatTimestamp(generated)}</span> : <span>Generated before timestamps were recorded</span>}
              {source && <span>Source page: {hostname(source)}</span>}
              {op.webResearch && <span>Includes live web research</span>}
            </div>
          )}
        </header>

        {exists ? (
          <ReportBody reportKey={reportKey} value={value} pageUrl={pageUrl} />
        ) : (
          <EmptyState
            icon={<Sparkles aria-hidden="true" />}
            title={`No ${midSentence(op.name)} yet`}
            action={
              canRun ? (
                <Button asChild variant="primary">
                  <Link to={routes.projectOperations(project.id, op.id)}>Generate {midSentence(op.name)}</Link>
                </Button>
              ) : (
                <RoleNote action="Generating reports" minimum="editor" />
              )
            }
          >
            {op.produces}
          </EmptyState>
        )}
      </article>
    </div>
  );
}
