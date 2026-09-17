import type { ReportKey } from "@/lib/api/types";

export const REPORT_SLUGS: Record<ReportKey, string> = {
  market_analysis: "market-analysis",
  pricing_result: "pricing",
  press_kit: "press-kit",
  press_release: "press-release",
  seo_result: "seo",
};

export function reportKeyFromSlug(slug: string | undefined): ReportKey | null {
  const entry = Object.entries(REPORT_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as ReportKey) : null;
}

export const routes = {
  login: "/login",
  portfolio: "/portfolio",
  project: (id: string) => `/projects/${id}`,
  projectOperations: (id: string, run?: string) => `/projects/${id}/operations${run ? `?run=${encodeURIComponent(run)}` : ""}`,
  projectReports: (id: string) => `/projects/${id}/reports`,
  projectReport: (id: string, key: ReportKey) => `/projects/${id}/reports/${REPORT_SLUGS[key]}`,
  projectReview: (id: string, itemId?: string) => `/projects/${id}/review${itemId ? `/${itemId}` : ""}`,
  projectOutbox: (id: string) => `/projects/${id}/outbox`,
  projectPlan: (id: string) => `/projects/${id}/plan`,
  projectSettings: (id: string, section?: string) => `/projects/${id}/settings${section ? `#${section}` : ""}`,
  review: (itemId?: string) => `/review${itemId ? `/${itemId}` : ""}`,
  outbox: "/outbox",
  calendar: "/calendar",
  library: "/library",
  settings: (section?: string) => `/settings${section ? `/${section}` : ""}`,
};
