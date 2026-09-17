import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router";
import {
  CalendarDays,
  ChevronsUpDown,
  Inbox,
  LayoutGrid,
  Library,
  Lightbulb,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOrganisation } from "@/lib/auth/organisation";
import { LiveUpdatesProvider } from "@/lib/live/LiveUpdatesProvider";
import { OperationsProvider } from "@/lib/operations/OperationsProvider";
import { useEmails, useProject, useProjects, useQueue, useSettings } from "@/lib/queries/hooks";
import { useTheme } from "@/lib/hooks/useTheme";
import { swatchColor } from "@/lib/domain/projects";
import { reportForKey } from "@/lib/domain/operations";
import { reportKeyFromSlug, routes } from "@/lib/routes";
import { IconButton, cx } from "@/components/ui/Button";
import { Count } from "@/components/ui/Pill";
import { Kbd } from "@/components/ui/Display";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/Overlay";
import { ActivityIndicator } from "./ActivityIndicator";
import { CaptureDialog } from "./CaptureDialog";
import { CommandPalette } from "./CommandPalette";
import { NewProjectDialog } from "./NewProjectDialog";
import { OrganisationSwitcher } from "./OrganisationSwitcher";
import { ShellContext, type ShellDialogs } from "./shellContext";
import { Wordmark } from "./Wordmark";
import styles from "./Shell.module.css";

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [capture, setCapture] = useState<{ open: boolean; projectId?: string }>({ open: false });
  const [railOpen, setRailOpen] = useState(false);
  const location = useLocation();

  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setRailOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dialogs: ShellDialogs = {
    openNewProject: () => setNewProjectOpen(true),
    openCapture: (projectId) => setCapture({ open: true, projectId }),
    openPalette: () => setPaletteOpen(true),
  };

  return (
    <LiveUpdatesProvider>
    <OperationsProvider>
      <ShellContext.Provider value={dialogs}>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <div className={styles.shell}>
        {railOpen && <div className={styles.railScrim} onClick={() => setRailOpen(false)} role="presentation" />}
        <Rail open={railOpen} onNewProject={dialogs.openNewProject} />
        <div className={styles.main}>
          <TopBar dialogs={dialogs} onOpenRail={() => setRailOpen(true)} />
          <main id="main" className={styles.content} data-print="page">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} dialogs={dialogs} />
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
      <CaptureDialog
        open={capture.open}
        defaultProjectId={capture.projectId}
        onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
      />
      </ShellContext.Provider>
    </OperationsProvider>
    </LiveUpdatesProvider>
  );
}

function Rail({ open, onNewProject }: { open: boolean; onNewProject: () => void }) {
  const { user, logout } = useAuth();
  const canEdit = useOrganisation().can("editor");
  const [theme, setTheme] = useTheme();
  const settings = useSettings();
  const projects = useProjects();
  const pending = useQueue({ status: "pending", limit: 500 });
  const emails = useEmails();
  const drafts = emails.data?.filter((e) => e.status !== "sent").length ?? 0;
  const projectMatch = useMatch("/projects/:projectId/*");
  const brand = settings.data?.brand;
  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const sortedProjects = [...(projects.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <aside className={cx(styles.rail, open && styles.railOpen)} data-print="hide" aria-label="Main navigation">
      <Link to={routes.portfolio} className={styles.railHeader} aria-label="LaunchOps home">
        {brand?.logo_url ? (
          <img src={brand.logo_url} alt={brand.company_name || "Company logo"} className={styles.logoImage} />
        ) : (
          <Wordmark companyName={brand?.company_name || undefined} />
        )}
      </Link>

      <OrganisationSwitcher />

      <div className={styles.railScroll}>
        <nav className={styles.railGroup} aria-label="Workspace">
          <NavLink to={routes.portfolio} className={styles.railLink}>
            <LayoutGrid aria-hidden="true" />
            <span className={styles.railLabel}>Portfolio</span>
          </NavLink>
          <NavLink to={routes.review()} className={styles.railLink}>
            <Inbox aria-hidden="true" />
            <span className={styles.railLabel}>Review</span>
            {/* A text-node space keeps the label and count separate words in the link's name ("Review 2 awaiting review"). */}
            {(pending.data?.length ?? 0) > 0 && " "}
            {(pending.data?.length ?? 0) > 0 && (
              <Count value={pending.data!.length} signal label={`${pending.data!.length} awaiting review`} />
            )}
          </NavLink>
          <NavLink to={routes.outbox} className={styles.railLink}>
            <Send aria-hidden="true" />
            <span className={styles.railLabel}>Outbox</span>
            {drafts > 0 && " "}
            {drafts > 0 && <Count value={drafts} label={`${drafts} unsent emails`} />}
          </NavLink>
          <NavLink to={routes.calendar} className={styles.railLink}>
            <CalendarDays aria-hidden="true" />
            <span className={styles.railLabel}>Calendar</span>
          </NavLink>
          <NavLink to={routes.library} className={styles.railLink}>
            <Library aria-hidden="true" />
            <span className={styles.railLabel}>Library</span>
          </NavLink>
        </nav>

        <nav className={styles.railGroup} aria-label="Projects">
          <div className={styles.railGroupHeader}>
            <span className="placard">Projects</span>
            {canEdit && (
              <Tooltip content="New project">
                <IconButton label="New project" size="sm" onClick={onNewProject}>
                  <Plus aria-hidden="true" />
                </IconButton>
              </Tooltip>
            )}
          </div>
          {sortedProjects.map((p) => (
            <NavLink
              key={p.id}
              to={routes.project(p.id)}
              className={cx(styles.railLink, projectMatch?.params.projectId === p.id && styles.railLinkActive)}
              end
            >
              <span className={styles.swatch} style={{ background: swatchColor(p.color) }} aria-hidden="true" />
              <span className={styles.railLabel}>{p.name}</span>
            </NavLink>
          ))}
          {canEdit && projects.isSuccess && sortedProjects.length === 0 && (
            <button type="button" className={styles.railLink} onClick={onNewProject} style={{ border: 0, background: "transparent" }}>
              <Plus aria-hidden="true" />
              <span className={styles.railLabel}>Create your first project</span>
            </button>
          )}
        </nav>
      </div>

      <div className={styles.railFooter}>
        <NavLink to={routes.settings()} className={styles.railLink}>
          <Settings aria-hidden="true" />
          <span className={styles.railLabel}>Settings</span>
        </NavLink>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={styles.userButton}>
              <span className={styles.avatar} aria-hidden="true">
                {initials}
              </span>
              <span className={styles.userText}>
                <span className={styles.userName}>{user?.name || user?.email}</span>
                <span className={styles.userEmail}>{user?.role === "admin" ? "Administrator" : user?.email}</span>
              </span>
              <ChevronsUpDown size={14} aria-hidden="true" style={{ marginLeft: "auto", color: "var(--ink-3)" }} />
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>Theme</MenuLabel>
            <MenuItem icon={<Monitor aria-hidden="true" />} onSelect={() => setTheme("system")} shortcut={theme === "system" ? "✓" : undefined}>
              Match system
            </MenuItem>
            <MenuItem icon={<Sun aria-hidden="true" />} onSelect={() => setTheme("light")} shortcut={theme === "light" ? "✓" : undefined}>
              Light
            </MenuItem>
            <MenuItem icon={<Moon aria-hidden="true" />} onSelect={() => setTheme("dark")} shortcut={theme === "dark" ? "✓" : undefined}>
              Dark
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<LogOut aria-hidden="true" />} onSelect={logout}>
              Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </aside>
  );
}

const SECTION_LABELS: Record<string, string> = {
  operations: "Operations",
  reports: "Reports",
  review: "Review",
  outbox: "Outbox",
  plan: "Launch plan",
  settings: "Settings",
};

const SETTINGS_LABELS: Record<string, string> = {
  voice: "Voice & AI",
  companies: "Companies",
  channels: "Channels",
  organisation: "Organisation",
  activity: "Activity",
  usage: "Usage",
  team: "Team & access",
};

function TopBar({ dialogs, onOpenRail }: { dialogs: ShellDialogs; onOpenRail: () => void }) {
  const location = useLocation();
  const projectMatch = useMatch("/projects/:projectId/*");
  const projectId = projectMatch?.params.projectId;
  const project = useProject(projectId);
  const canEdit = useOrganisation().can("editor");
  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs: Array<{ label: string; to?: string }> = [];
  if (projectId) {
    crumbs.push({ label: "Portfolio", to: routes.portfolio });
    const section = segments[2];
    crumbs.push({ label: project.data?.name ?? "Project", to: section ? routes.project(projectId) : undefined });
    if (section) {
      if (section === "reports" && segments[3]) {
        crumbs.push({ label: "Reports", to: routes.projectReports(projectId) });
        const key = reportKeyFromSlug(segments[3]);
        crumbs.push({ label: key ? (reportForKey(key)?.name ?? "Report") : "Report" });
      } else {
        crumbs.push({ label: SECTION_LABELS[section] ?? section });
      }
    }
  } else if (segments[0] === "settings") {
    crumbs.push({ label: "Settings", to: segments[1] ? routes.settings() : undefined });
    if (segments[1]) crumbs.push({ label: SETTINGS_LABELS[segments[1]] ?? segments[1] });
  } else {
    const labels: Record<string, string> = {
      portfolio: "Portfolio",
      review: "Review",
      outbox: "Outbox",
      calendar: "Calendar",
      library: "Library",
    };
    crumbs.push({ label: labels[segments[0] ?? ""] ?? "LaunchOps" });
  }

  return (
    <header className={styles.topbar} data-print="hide">
      <IconButton label="Open navigation" className={styles.mobileMenuButton} onClick={onOpenRail}>
        <MenuIcon aria-hidden="true" />
      </IconButton>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} style={{ display: "contents" }}>
            {i > 0 && (
              <span className={styles.crumbSep} aria-hidden="true">
                /
              </span>
            )}
            {crumb.to ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span className={styles.crumbCurrent} aria-current="page">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className={styles.topActions}>
        <ActivityIndicator />
        {canEdit && (
          <Tooltip content="Capture an idea for later">
            <IconButton label="Capture idea" onClick={() => dialogs.openCapture(projectId)}>
              <Lightbulb aria-hidden="true" />
            </IconButton>
          </Tooltip>
        )}
        <button type="button" className={styles.searchButton} onClick={dialogs.openPalette}>
          <Search aria-hidden="true" />
          <span className={styles.searchLabel}>Search or run…</span>
          <Kbd>{navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"}</Kbd>
        </button>
      </div>
    </header>
  );
}
