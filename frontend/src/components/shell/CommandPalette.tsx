import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { useMatch, useNavigate } from "react-router";
import {
  CalendarDays,
  FileText,
  Inbox,
  LayoutGrid,
  Library,
  Lightbulb,
  ListChecks,
  Monitor,
  Moon,
  Plus,
  Send,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { useOrganisation } from "@/lib/auth/organisation";
import { useProjects } from "@/lib/queries/hooks";
import { useTheme } from "@/lib/hooks/useTheme";
import { OPERATIONS } from "@/lib/domain/operations";
import { swatchColor } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Kbd } from "@/components/ui/Display";
import type { ShellDialogs } from "./shellContext";
import styles from "./Shell.module.css";

export function CommandPalette({
  open,
  onOpenChange,
  dialogs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogs: ShellDialogs;
}) {
  const navigate = useNavigate();
  const projects = useProjects();
  const [, setTheme] = useTheme();
  const projectMatch = useMatch("/projects/:projectId/*");
  const currentProjectId = projectMatch?.params.projectId;
  const currentProject = projects.data?.find((p) => p.id === currentProjectId);
  // Running operations, creating projects and capturing ideas need the Editor role.
  const canEdit = useOrganisation().can("editor");

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };
  const act = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.paletteScrim} />
        <Dialog.Content className={styles.palette} aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Search and run</Dialog.Title>
          <Command label="Search and run" loop>
            <Command.Input className={styles.paletteInput} placeholder="Search projects, pages and operations…" autoFocus />
            <Command.List className={styles.paletteList}>
              <Command.Empty className={styles.paletteEmpty}>No matches.</Command.Empty>

              {canEdit && currentProject && (
                <Command.Group heading={`Run on ${currentProject.name}`}>
                  {OPERATIONS.map((op) => (
                    <Command.Item
                      key={op.id}
                      value={`run ${op.name} ${op.category}`}
                      className={styles.paletteItem}
                      onSelect={() => go(routes.projectOperations(currentProject.id, op.id))}
                    >
                      <Sparkles aria-hidden="true" />
                      {op.name}
                      <span className={styles.paletteHint}>{op.kind === "workflow" ? "to Review" : op.kind === "report" ? "to Reports" : "tool"}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Actions">
                {canEdit && (
                  <>
                    <Command.Item value="new project create" className={styles.paletteItem} onSelect={() => act(dialogs.openNewProject)}>
                      <Plus aria-hidden="true" />
                      New project
                    </Command.Item>
                    <Command.Item
                      value="capture idea note"
                      className={styles.paletteItem}
                      onSelect={() => act(() => dialogs.openCapture(currentProjectId))}
                    >
                      <Lightbulb aria-hidden="true" />
                      Capture an idea
                    </Command.Item>
                  </>
                )}
                <Command.Item value="theme light" className={styles.paletteItem} onSelect={() => act(() => setTheme("light"))}>
                  <Sun aria-hidden="true" />
                  Use light theme
                </Command.Item>
                <Command.Item value="theme dark" className={styles.paletteItem} onSelect={() => act(() => setTheme("dark"))}>
                  <Moon aria-hidden="true" />
                  Use dark theme
                </Command.Item>
                <Command.Item value="theme system" className={styles.paletteItem} onSelect={() => act(() => setTheme("system"))}>
                  <Monitor aria-hidden="true" />
                  Match system theme
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Go to">
                <Command.Item value="portfolio home" className={styles.paletteItem} onSelect={() => go(routes.portfolio)}>
                  <LayoutGrid aria-hidden="true" />
                  Portfolio
                </Command.Item>
                <Command.Item value="review approvals queue" className={styles.paletteItem} onSelect={() => go(routes.review())}>
                  <Inbox aria-hidden="true" />
                  Review
                </Command.Item>
                <Command.Item value="outbox email drafts" className={styles.paletteItem} onSelect={() => go(routes.outbox)}>
                  <Send aria-hidden="true" />
                  Outbox
                </Command.Item>
                <Command.Item value="calendar schedule" className={styles.paletteItem} onSelect={() => go(routes.calendar)}>
                  <CalendarDays aria-hidden="true" />
                  Calendar
                </Command.Item>
                <Command.Item value="library templates ideas" className={styles.paletteItem} onSelect={() => go(routes.library)}>
                  <Library aria-hidden="true" />
                  Library
                </Command.Item>
                <Command.Item value="settings" className={styles.paletteItem} onSelect={() => go(routes.settings())}>
                  <Settings aria-hidden="true" />
                  Settings
                </Command.Item>
              </Command.Group>

              {(projects.data?.length ?? 0) > 0 && (
                <Command.Group heading="Projects">
                  {projects.data!.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`project ${p.name} ${p.tagline}`}
                      className={styles.paletteItem}
                      onSelect={() => go(routes.project(p.id))}
                    >
                      <span className={styles.swatch} style={{ background: swatchColor(p.color) }} aria-hidden="true" />
                      {p.name}
                      <span className={styles.paletteHint}>{p.tagline}</span>
                    </Command.Item>
                  ))}
                  {projects.data!.map((p) => (
                    <Command.Item
                      key={`${p.id}-reports`}
                      value={`${p.name} reports`}
                      className={styles.paletteItem}
                      onSelect={() => go(routes.projectReports(p.id))}
                    >
                      <FileText aria-hidden="true" />
                      {p.name} — Reports
                    </Command.Item>
                  ))}
                  {projects.data!.map((p) => (
                    <Command.Item
                      key={`${p.id}-plan`}
                      value={`${p.name} launch plan checklist`}
                      className={styles.paletteItem}
                      onSelect={() => go(routes.projectPlan(p.id))}
                    >
                      <ListChecks aria-hidden="true" />
                      {p.name} — Launch plan
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className={styles.paletteFooter}>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
              </span>
              <span>
                <Kbd>Enter</Kbd> to open
              </span>
              <span>
                <Kbd>Esc</Kbd> to close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
