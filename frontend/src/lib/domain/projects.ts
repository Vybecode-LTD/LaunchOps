import type { Project, ProjectStatus, ProjectType, ReportKey } from "@/lib/api/types";
import { planProgress } from "./checklist";
import { daysBetween } from "./dates";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  product: "Product",
  service: "Service",
  persona: "Persona",
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  pre_launch: "Pre-launch",
  launched: "Launched",
  post_launch: "Post-launch",
};

const LEGACY_TYPE_PREFIX = /^\[(PRODUCT|SERVICE|PERSONA)\]\s*/;

/**
 * Projects created before project_type existed stored it as a "[PRODUCT] "
 * prefix on the description. Read either form.
 */
export function projectType(project: Pick<Project, "project_type" | "description">): ProjectType {
  if (project.project_type) return project.project_type;
  const match = LEGACY_TYPE_PREFIX.exec(project.description ?? "");
  return match ? (match[1]!.toLowerCase() as ProjectType) : "product";
}

export function cleanDescription(description: string | null | undefined): string {
  return (description ?? "").replace(LEGACY_TYPE_PREFIX, "");
}

/* ─── Swatches ─── */

export const SWATCHES = [
  { name: "Teal", value: "#0f8b8d" },
  { name: "Violet", value: "#7654d8" },
  { name: "Coral", value: "#e4572e" },
  { name: "Moss", value: "#4c8c3c" },
  { name: "Azure", value: "#2f7fd9" },
  { name: "Rose", value: "#d6457a" },
  { name: "Amber", value: "#c98a12" },
  { name: "Slate", value: "#5b6478" },
] as const;

const LEGACY_COLORS: Record<string, string> = {
  "#00f0ff": "#0f8b8d",
  "#a855f7": "#7654d8",
  "#ff6b35": "#e4572e",
  "#22c55e": "#4c8c3c",
  "#3b82f6": "#2f7fd9",
  "#ec4899": "#d6457a",
};

export function swatchColor(color: string | null | undefined): string {
  const value = (color ?? "").toLowerCase();
  if (LEGACY_COLORS[value]) return LEGACY_COLORS[value];
  return /^#[0-9a-f]{6}$/.test(value) ? value : SWATCHES[0].value;
}

/* ─── Reports ─── */

export function hasReport(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const keys = Object.keys(value).filter((k) => k !== "generated_at" && k !== "source_url");
  if (keys.length === 0) return false;
  return !("raw_response" in value) && !("error" in value);
}

export const REPORT_KEYS: ReportKey[] = ["market_analysis", "pricing_result", "press_kit", "press_release", "seo_result"];

/* ─── Readiness ─── */

export interface ReadinessCheck {
  id: string;
  label: string;
  done: boolean;
}

export interface Readiness {
  score: number;
  plan: { done: number; total: number };
  assets: ReadinessCheck[];
  profile: ReadinessCheck[];
}

export const READINESS_WEIGHTS = { plan: 50, assets: 30, profile: 20 } as const;

const ASSET_LABELS: Record<ReportKey, string> = {
  market_analysis: "Market analysis",
  pricing_result: "Pricing strategy",
  press_kit: "Press kit",
  press_release: "Press release",
  seo_result: "SEO metadata",
};

/**
 * Launch readiness, 0–100:
 *   50 × launch-plan items done ÷ items in plan
 * + 30 × reports generated ÷ 5
 * + 20 × profile checks passed ÷ 5
 * The same formula is shown to users next to the score.
 */
export function readiness(project: Project): Readiness {
  const plan = planProgress(project.checklist ?? {});
  const assets = REPORT_KEYS.map((key) => ({ id: key, label: ASSET_LABELS[key], done: hasReport(project[key]) }));
  const company = project.company_details?.company_name?.trim();
  const profile: ReadinessCheck[] = [
    { id: "url", label: "Website URL", done: Boolean(project.url?.trim()) },
    { id: "description", label: "Description of 80+ characters", done: cleanDescription(project.description).trim().length >= 80 },
    { id: "keywords", label: "At least one keyword", done: (project.keywords ?? []).length > 0 },
    { id: "company", label: "Company assigned", done: Boolean(project.brand_id || company) },
    { id: "launch_date", label: "Launch date set", done: Boolean(project.launch_date) },
  ];
  const planPart = plan.total ? plan.done / plan.total : 0;
  const assetPart = assets.filter((a) => a.done).length / assets.length;
  const profilePart = profile.filter((p) => p.done).length / profile.length;
  const score = Math.round(
    READINESS_WEIGHTS.plan * planPart + READINESS_WEIGHTS.assets * assetPart + READINESS_WEIGHTS.profile * profilePart,
  );
  return { score, plan, assets, profile };
}

/* ─── Launch timing ─── */

export type LaunchState = "launched" | "overdue" | "at_risk" | "on_track" | "unscheduled";

export const AT_RISK_WINDOW_DAYS = 14;
export const AT_RISK_READINESS = 70;

export const LAUNCH_STATE_LABELS: Record<LaunchState, string> = {
  launched: "Launched",
  overdue: "Overdue",
  at_risk: "At risk",
  on_track: "On track",
  unscheduled: "Unscheduled",
};

export const LAUNCH_STATE_RULES: Record<LaunchState, string> = {
  launched: "Status is Launched or Post-launch.",
  overdue: "Launch date has passed and status is still Pre-launch.",
  at_risk: `Launching within ${AT_RISK_WINDOW_DAYS} days with readiness below ${AT_RISK_READINESS}.`,
  on_track: "Launch date set, and not at risk or overdue.",
  unscheduled: "No launch date set.",
};

export function daysToLaunch(project: Pick<Project, "launch_date">, today: string): number | null {
  return project.launch_date ? daysBetween(today, project.launch_date) : null;
}

export function launchState(project: Project, readinessScore: number, today: string): LaunchState {
  if (project.status === "launched" || project.status === "post_launch") return "launched";
  const days = daysToLaunch(project, today);
  if (days === null) return "unscheduled";
  if (days < 0) return "overdue";
  if (days <= AT_RISK_WINDOW_DAYS && readinessScore < AT_RISK_READINESS) return "at_risk";
  return "on_track";
}

/** Launch-clock notation: T–12d before launch, T–0 on the day, T+3d after. */
export function tMinus(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "T–0";
  return days > 0 ? `T–${days}d` : `T+${Math.abs(days)}d`;
}

export function describeDays(days: number | null): string {
  if (days === null) return "No launch date";
  if (days === 0) return "Launches today";
  if (days === 1) return "Launches tomorrow";
  if (days > 1) return `${days} days until launch`;
  return days === -1 ? "Launch date was yesterday" : `Launch date was ${Math.abs(days)} days ago`;
}
