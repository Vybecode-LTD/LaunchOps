import type { QueueStatus } from "@/lib/api/types";

export const keys = {
  projects: ["projects"] as const,
  projectList: () => ["projects", "list"] as const,
  project: (id: string) => ["projects", "detail", id] as const,
  queueAll: ["queue"] as const,
  queue: (params: { product_id?: string; status?: QueueStatus; limit?: number }) => ["queue", "list", params] as const,
  // Under "queue", so whatever refreshes the results — live updates, a launch, a cancel — refreshes this too.
  queueSummary: (productId: string) => ["queue", "summary", productId] as const,
  emailsAll: ["emails"] as const,
  emails: (params: { product_id?: string }) => ["emails", "list", params] as const,
  emailQuota: () => ["emails", "quota"] as const,
  templates: () => ["templates", "list"] as const,
  templatesFor: (workflowId: string) => ["templates", "for", workflowId] as const,
  captures: () => ["captures", "list"] as const,
  calendar: () => ["calendar", "list"] as const,
  settings: () => ["settings"] as const,
  brands: () => ["brands", "list"] as const,
  organisationMembers: () => ["organisation", "members"] as const,
  organisationInvitations: () => ["organisation", "invitations"] as const,
  organisationActivity: () => ["organisation", "activity"] as const,
  organisationUsageAll: ["organisation", "usage"] as const,
  organisationUsage: (month: string) => ["organisation", "usage", month] as const,
  invitation: (token: string) => ["invitation", token] as const,
  adminUsers: () => ["admin", "users"] as const,
  adminProjects: () => ["admin", "projects"] as const,
  adminRegistration: () => ["admin", "registration"] as const,
};
