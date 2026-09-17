import { openEventStream, request } from "./client";
import type {
  ActivityEntry,
  AdminProject,
  AdminUser,
  AuthResponse,
  Brand,
  BrandInput,
  CalendarEvent,
  CancelResponse,
  CalendarEventCreate,
  CalendarEventUpdate,
  Capture,
  Checklist,
  EmailDraftUpdate,
  EmailItem,
  EmailQuota,
  Invitation,
  InvitationDetails,
  MarketAnalysis,
  Membership,
  OrganisationMember,
  OrgRole,
  PressKit,
  PressRelease,
  PricingResult,
  Project,
  ProjectCreate,
  ProjectUpdate,
  QueueItem,
  QueueStatus,
  RepurposeResult,
  SeoResult,
  Template,
  TemplateCreate,
  UsageSummary,
  User,
  WorkflowLaunchResponse,
  WorkspaceSettings,
} from "./types";

function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: { name, email, password } }),
  me: () => request<User>("/api/auth/me"),
  logout: () => request<{ status: string }>("/api/auth/logout", { method: "POST" }),
  requestPasswordReset: (email: string) =>
    request<{ status: string }>("/api/auth/password-reset", { method: "POST", body: { email } }),
  describePasswordReset: (token: string) => request<{ email: string }>(`/api/auth/password-reset/${encodeURIComponent(token)}`),
  resetPassword: (token: string, password: string) =>
    request<AuthResponse>(`/api/auth/password-reset/${encodeURIComponent(token)}`, { method: "POST", body: { password } }),
};

export const organisationApi = {
  get: () => request<Membership>("/api/organisation"),
  rename: (name: string) => request<Membership>("/api/organisation", { method: "PATCH", body: { name } }),
  members: () => request<OrganisationMember[]>("/api/organisation/members"),
  changeRole: (userId: string, role: OrgRole) =>
    request<{ user_id: string; role: OrgRole }>(`/api/organisation/members/${userId}`, { method: "PATCH", body: { role } }),
  removeMember: (userId: string) => request<{ deleted: boolean }>(`/api/organisation/members/${userId}`, { method: "DELETE" }),
  invitations: () => request<Invitation[]>("/api/organisation/invitations"),
  invite: (email: string, role: OrgRole) =>
    request<Invitation>("/api/organisation/invitations", { method: "POST", body: { email, role } }),
  withdrawInvitation: (id: string) => request<{ deleted: boolean }>(`/api/organisation/invitations/${id}`, { method: "DELETE" }),
  activity: (params: { limit?: number; before?: number } = {}) =>
    request<ActivityEntry[]>(`/api/organisation/activity${query(params)}`),
  /** A UTC month's AI usage (YYYY-MM; the current month when left out), with the budget (Owner). */
  usage: (month?: string) => request<UsageSummary>(`/api/organisation/usage${query({ month })}`),
  /** Set the monthly AI budget in US dollars, or remove it with null (Owner). */
  setBudget: (amount: number | null) =>
    request<{ monthly_ai_budget_usd: number | null }>("/api/organisation/budget", { method: "PUT", body: { monthly_ai_budget_usd: amount } }),
};

export const eventsApi = {
  /** The organisation's live updates (Server-Sent Events); see lib/live. */
  open: (signal: AbortSignal) => openEventStream("/api/events", signal),
};

export const invitationsApi = {
  describe: (token: string) => request<InvitationDetails>(`/api/invitations/${encodeURIComponent(token)}`),
  accept: (token: string) => request<Membership>(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" }),
  register: (token: string, name: string, password: string) =>
    request<AuthResponse>(`/api/invitations/${encodeURIComponent(token)}/register`, { method: "POST", body: { name, password } }),
};

export const adminApi = {
  users: () => request<AdminUser[]>("/api/auth/admin/users"),
  createUser: (data: { name: string; email: string; password: string }) =>
    request<AdminUser>("/api/auth/admin/users", { method: "POST", body: data }),
  updateUser: (id: string, data: { enabled?: boolean; role?: "admin" | "user" }) =>
    request<AdminUser>(`/api/auth/admin/users/${id}`, { method: "PATCH", body: data }),
  deleteUser: (id: string) => request<{ status: string }>(`/api/auth/admin/users/${id}`, { method: "DELETE" }),
  createResetLink: (id: string) =>
    request<{ link: string; expires_at: string }>(`/api/auth/admin/users/${id}/reset-link`, { method: "POST" }),
  registration: () => request<{ registration_enabled: boolean }>("/api/auth/admin/registration"),
  setRegistration: (enabled: boolean) =>
    request<{ registration_enabled: boolean }>("/api/auth/admin/registration", {
      method: "PUT",
      body: { registration_enabled: enabled },
    }),
  projects: () => request<AdminProject[]>("/api/auth/admin/projects"),
  transferProject: (productId: string, targetUserId: string) =>
    request<{ status: string }>("/api/auth/admin/transfer-project", {
      method: "POST",
      body: { product_id: productId, target_user_id: targetUserId },
    }),
};

export const projectsApi = {
  list: () => request<Project[]>("/api/products"),
  get: (id: string) => request<Project>(`/api/products/${id}`),
  create: (data: ProjectCreate) => request<Project>("/api/products", { method: "POST", body: data }),
  update: (id: string, data: ProjectUpdate) =>
    request<Project>(`/api/products/${id}`, { method: "PATCH", body: data }),
  remove: (id: string) => request<{ deleted: boolean }>(`/api/products/${id}`, { method: "DELETE" }),
  updateChecklist: (id: string, checklist: Checklist) =>
    request<Project>(`/api/products/${id}/checklist`, { method: "PATCH", body: checklist }),
};

export const operationsApi = {
  launchWorkflow: (productId: string, workflowId: string, instructions: string) =>
    request<WorkflowLaunchResponse>("/api/workflows/launch", {
      method: "POST",
      body: { product_id: productId, workflow_id: workflowId, instructions },
    }),
  pressKit: (productId: string, url: string) =>
    request<PressKit>("/api/presskit/generate", { method: "POST", body: { product_id: productId, url } }),
  pressRelease: (body: {
    product_id: string;
    url: string;
    media_contact_name?: string;
    media_contact_email?: string;
    media_contact_phone?: string;
    technical_contact_name?: string;
    technical_contact_email?: string;
    sales_contact_name?: string;
    sales_contact_email?: string;
    additional_notes?: string;
  }) => request<PressRelease>("/api/press-release/generate", { method: "POST", body }),
  seo: (productId: string, url: string) =>
    request<SeoResult>("/api/seo/analyze", { method: "POST", body: { product_id: productId, url } }),
  pricing: (productId: string, notes: string) =>
    request<PricingResult>("/api/pricing/analyze", { method: "POST", body: { product_id: productId, notes } }),
  marketAnalysis: (productId: string, customPricing: string) =>
    request<MarketAnalysis>("/api/market-analysis", {
      method: "POST",
      body: { product_id: productId, custom_pricing: customPricing },
    }),
  repurpose: (productId: string, content: string, platforms: string[]) =>
    request<RepurposeResult>("/api/repurpose", {
      method: "POST",
      body: { product_id: productId, content, platforms },
    }),
};

export const queueApi = {
  list: (params: { product_id?: string; status?: QueueStatus; limit?: number } = {}) =>
    request<QueueItem[]>(`/api/queue${query(params)}`),
  get: (id: string) => request<QueueItem>(`/api/queue/${id}`),
  review: (id: string, status: "approved" | "rejected" | "pending", notes = "") =>
    request<QueueItem>(`/api/queue/${id}`, { method: "PATCH", body: { status, notes } }),
  remove: (id: string, keepalive = false) =>
    request<{ deleted: boolean }>(`/api/queue/${id}`, { method: "DELETE", keepalive }),
  /** Stop a running operation (Editor). 409 when it has already finished. */
  cancel: (id: string) => request<CancelResponse>(`/api/queue/${id}/cancel`, { method: "POST" }),
};

export const emailApi = {
  list: (params: { product_id?: string; status?: string } = {}) =>
    request<EmailItem[]>(`/api/email-queue${query(params)}`),
  update: (id: string, data: EmailDraftUpdate) =>
    request<EmailItem>(`/api/email-queue/${id}`, { method: "PATCH", body: data }),
  send: (id: string) => request<{ status: string }>(`/api/email-queue/${id}/send`, { method: "POST" }),
  quota: () => request<EmailQuota>("/api/email-queue/quota"),
  remove: (id: string, keepalive = false) =>
    request<{ deleted: boolean }>(`/api/email-queue/${id}`, { method: "DELETE", keepalive }),
};

export const templatesApi = {
  list: () => request<Template[]>("/api/templates"),
  forWorkflow: (workflowId: string) => request<Template[]>(`/api/templates/for-workflow/${workflowId}`),
  create: (data: TemplateCreate) => request<Template>("/api/templates", { method: "POST", body: data }),
  remove: (id: string, keepalive = false) =>
    request<{ deleted: boolean }>(`/api/templates/${id}`, { method: "DELETE", keepalive }),
};

export const capturesApi = {
  list: () => request<Capture[]>("/api/captures"),
  create: (text: string, productId: string) =>
    request<Capture>("/api/captures", { method: "POST", body: { text, product_id: productId } }),
  remove: (id: string, keepalive = false) =>
    request<{ deleted: boolean }>(`/api/captures/${id}`, { method: "DELETE", keepalive }),
};

export const calendarApi = {
  list: () => request<CalendarEvent[]>("/api/calendar"),
  create: (data: CalendarEventCreate) => request<CalendarEvent>("/api/calendar", { method: "POST", body: data }),
  update: (id: string, data: CalendarEventUpdate) =>
    request<CalendarEvent>(`/api/calendar/${id}`, { method: "PATCH", body: data }),
  remove: (id: string, keepalive = false) =>
    request<{ deleted: boolean }>(`/api/calendar/${id}`, { method: "DELETE", keepalive }),
};

export const settingsApi = {
  get: () => request<Partial<WorkspaceSettings>>("/api/settings"),
  save: (data: WorkspaceSettings) => request<unknown>("/api/settings", { method: "PUT", body: data }),
};

export const brandsApi = {
  list: () => request<Brand[]>("/api/brands"),
  create: (data: BrandInput) => request<Brand>("/api/brands", { method: "POST", body: data }),
  update: (id: string, data: BrandInput) => request<Brand>(`/api/brands/${id}`, { method: "PATCH", body: data }),
  remove: (id: string) => request<{ deleted: boolean }>(`/api/brands/${id}`, { method: "DELETE" }),
};
