/**
 * Types for the LaunchOps REST API (backend/routers/*).
 *
 * AI-generated result objects come back from a language model, so every field
 * in them is optional and renderers must tolerate missing or mistyped values.
 */

export type ProjectType = "product" | "service" | "persona";
export type ProjectStatus = "pre_launch" | "launched" | "post_launch";

/**
 * A role in an organisation. Each includes everything the roles before it can do:
 * viewer → editor → approver → owner (backend/services/access.py).
 */
export type OrgRole = "viewer" | "editor" | "approver" | "owner";

/** An organisation the signed-in user belongs to, and their role in it. */
export interface Membership {
  id: string;
  name: string;
  role: OrgRole;
}

export interface User {
  id: string;
  email: string;
  name: string;
  /** Platform role: administrators manage every account (Settings → Team & access). */
  role: "admin" | "user";
  created_at?: string;
  /** Owner memberships first. */
  organisations: Membership[];
}

export interface OrganisationMember {
  user_id: string;
  name: string;
  email: string;
  role: OrgRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  created_at: string;
  expires_at: string;
  /** Only in the response that creates it: the path to share, e.g. /invite/<token>. */
  link?: string;
  /** Only in the response that creates it: whether LaunchOps emailed the invitation (a mail server is configured). */
  emailed?: boolean;
}

/** What an invitation link offers (GET /api/invitations/{token}, public). */
export interface InvitationDetails {
  organisation: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  expires_at: string;
  account_exists: boolean;
}

export interface ActivityEntry {
  id: number;
  /** The email address of whoever acted. */
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EmailSettings {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  /** Write-only: send a value to replace the stored password. Never returned. */
  smtp_password?: string;
  /** Returned by the API instead of the password itself. */
  smtp_password_set?: boolean;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  use_tls?: boolean;
}

export interface CompanyDetails {
  company_name?: string;
  industry?: string;
  location?: string;
  founded?: string;
  founder_name?: string;
  founder_title?: string;
  phone?: string;
  email?: string;
  company_size?: string;
  boilerplate?: string;
}

/** Checklist state: `${phase}_${index}` → checked, `_custom_${phase}` → custom item labels. */
export type Checklist = Record<string, boolean | string[] | undefined>;

export interface Project {
  id: string;
  /** The organisation the project belongs to. */
  org_id?: string;
  user_id?: string | null;
  name: string;
  tagline: string;
  url: string;
  color: string;
  status: ProjectStatus;
  description: string;
  keywords: string[];
  project_type?: ProjectType | null;
  launch_date?: string | null;
  brand_id?: string | null;
  checklist: Checklist;
  email_settings: EmailSettings;
  company_details: CompanyDetails;
  press_kit?: PressKit | null;
  press_release?: PressRelease | null;
  pricing_result?: PricingResult | null;
  market_analysis?: MarketAnalysis | null;
  seo_result?: SeoResult | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  tagline?: string;
  url?: string;
  color?: string;
  description?: string;
  keywords?: string[];
  project_type?: ProjectType;
  launch_date?: string | null;
  brand_id?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  tagline?: string;
  url?: string;
  color?: string;
  status?: ProjectStatus;
  description?: string;
  keywords?: string[];
  project_type?: ProjectType;
  launch_date?: string | null;
  brand_id?: string | null;
  email_settings?: EmailSettings;
  company_details?: CompanyDetails;
}

export type QueueStatus = "running" | "pending" | "approved" | "rejected" | "failed";

export interface QueueItem {
  id: string;
  product_id: string;
  user_id?: string;
  workflow_id: string;
  status: QueueStatus;
  content: unknown;
  /**
   * A one-line summary. While running: "Running <workflow id>..." at first, then "Trying again in 30 seconds: <reason>"
   * while a retry waits; when failed: "Failed: <reason>".
   */
  preview: string;
  input_params: string;
  notes: string;
  created_at: string;
}

/** One line of `GET /api/queue/summary`: how many of a project's results one operation has in one status. */
export interface QueueSummaryRow {
  product_id: string;
  workflow_id: string;
  status: QueueStatus;
  count: number;
}

/**
 * POST /api/queue/{id}/cancel: "cancelled" when the job hadn't started (the result is now failed), "cancelling" when
 * it was running and stops at its next heartbeat (the result stays running until then).
 */
export interface CancelResponse {
  status: "cancelled" | "cancelling";
}

/** What the live updates stream (GET /api/events) announces changed: an id and its new status, never the data. */
export type LiveEvent =
  | { type: "queue"; id: string; status: QueueStatus | "deleted" }
  /** "drafts": approving a result created Outbox drafts (the id is the result's). */
  | { type: "email"; id: string; status: "drafts" | "sent" | "failed" | "deleted" };

/** AI usage over a month, or for one operation, project, member or model within it (GET /api/organisation/usage). */
export interface UsageTotals {
  /** Estimated cost in US dollars from published token and web search prices. Excludes unpriced calls. */
  cost_usd: number;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  web_search_requests: number;
  /** Calls on a model without a known price: they have no cost estimate. */
  unpriced_calls: number;
}

export interface UsageBreakdown extends UsageTotals {
  /** Operation id, project id ("" for none), user id or model id. */
  key: string;
  /** Operation id, project name ("A deleted project"), email ("A deleted account") or model id. */
  label: string;
}

export interface UsageSummary {
  /** YYYY-MM, a UTC month. */
  month: string;
  /** The budget the organisation set itself, in US dollars, or null when it has none. The budget form edits this. */
  budget_usd: number | null;
  /** The platform default (DEFAULT_MONTHLY_AI_BUDGET_USD) that covers organisations without their own, or null when switched off. */
  default_budget_usd: number | null;
  /** The budget that actually stops operations — show this, not budget_usd. Null means no cap at all. */
  effective_budget_usd: number | null;
  /** Whose budget effective_budget_usd is. */
  budget_source: "organisation" | "default" | "none";
  total: UsageTotals;
  /** Each list is sorted most expensive first. */
  by_operation: UsageBreakdown[];
  by_project: UsageBreakdown[];
  by_member: UsageBreakdown[];
  by_model: UsageBreakdown[];
}

export type EmailStatus = "pending" | "sent" | "failed";

export interface EmailItem {
  id: string;
  product_id: string;
  user_id?: string;
  source_queue_id: string | null;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: EmailStatus;
  error: string;
  sent_at: string | null;
  created_at: string;
}

/** Sends in the last 24 hours against the account's daily limit (GET /api/email-queue/quota). */
export interface EmailQuota {
  limit: number;
  sent: number;
  remaining: number;
  /** When a sending slot frees up, if the limit is reached. */
  next_available_at: string | null;
}

export interface EmailDraftUpdate {
  recipient_name?: string;
  recipient_email?: string;
  subject?: string;
  body?: string;
}

export interface Template {
  id: string;
  name: string;
  type: string;
  tags: string[];
  content: string;
  source_product: string;
  created_at: string;
}

export interface TemplateCreate {
  name: string;
  type: string;
  tags: string[];
  content: string;
  source_product?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  product_id: string;
  product_name: string;
  platform: string;
  title: string;
  color: string;
}

export interface CalendarEventCreate {
  date: string;
  product_id: string;
  platform: string;
  title: string;
}

/** Reschedule or edit an entry; omitted fields are left unchanged. */
export type CalendarEventUpdate = Partial<CalendarEventCreate>;

export interface Capture {
  id: string;
  text: string;
  product_id: string;
  created_at: string;
}

export interface PlatformConfig {
  connected: boolean;
  handle: string;
  mode: "auto" | "manual";
}

export interface BrandVoice {
  name: string;
  tagline: string;
  tone: string;
  keywords: string[];
  avoid: string[];
  elevator: string;
  company_name: string;
  logo_url: string;
}

export interface AgentPrefs {
  depth: string;
  length: string;
  emoji: boolean;
  hashtags: string;
  sources: boolean;
}

export interface WorkspaceSettings {
  platforms: Record<string, PlatformConfig>;
  brand: BrandVoice;
  prefs: AgentPrefs;
}

export interface Brand {
  id: string;
  name: string;
  tagline: string;
  tone: string;
  keywords: string[];
  avoid: string[];
  elevator: string;
  company_name: string;
  industry: string;
  location: string;
  founded: string;
  founder_name: string;
  founder_title: string;
  phone: string;
  email: string;
  company_size: string;
  boilerplate: string;
  logo_url: string;
  created_at: string;
  updated_at: string;
}

export type BrandInput = Partial<Omit<Brand, "id" | "created_at" | "updated_at">>;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  enabled: boolean;
  created_at: string;
}

export interface AdminProject {
  id: string;
  name: string;
  user_id: string;
  user_email: string;
  status: string;
  url: string;
}

export interface WorkflowLaunchResponse {
  task_id: string;
  status: string;
  message: string;
}

/* ─── AI results ─── */

/**
 * A web page an operation's web research relied on. Web research results end with `sources`: only pages the
 * operation's searches actually returned, as the search returned them, deduplicated, most important first.
 * Results stored before sources existed don't have them.
 */
export interface Source {
  title: string;
  url: string;
  /** The search engine's own words for when the page was updated ("September 2, 2026", "3 days ago"), or null. */
  page_age: string | null;
}

interface ResultBase {
  generated_at?: string;
  /** For reports built from a web page: the URL that was read. */
  source_url?: string;
  /** Present when the model's reply could not be parsed as JSON. */
  raw_response?: string;
  error?: string;
}

export interface PressKit extends ResultBase {
  boilerplate?: string;
  key_features?: string[];
  features?: string[];
  target_audience?: string;
  founder_bio?: string;
  media_assets?: string[];
  assets?: string[];
  suggested_angles?: string[];
}

export interface DistributionChannel {
  name?: string;
  type?: string;
  url?: string;
  contact_email?: string;
  submission_url?: string;
  notes?: string;
}

export interface PressRelease extends ResultBase {
  headline?: string;
  subheadline?: string;
  body?: string;
  summary?: string;
  suggested_distribution?: Array<DistributionChannel | string>;
  seo_keywords?: string[];
  sources?: Source[];
}

export interface PricingTier {
  name?: string;
  price?: string;
  features?: string[];
  recommended?: boolean;
}

export interface PricingResult extends ResultBase {
  tiers?: PricingTier[];
  insights?: string[];
  competitor_prices?: Array<{ name?: string; price?: string; model?: string }>;
  launch_strategy?: string;
  sources?: Source[];
}

export interface MarketAnalysis extends ResultBase {
  executive_summary?: string;
  key_players?: Array<{
    name?: string;
    url?: string;
    description?: string;
    market_position?: string;
    estimated_users?: string;
    funding?: string;
    differentiator?: string;
  }>;
  pricing_benchmarks?: {
    market_range_low?: string | number;
    market_range_high?: string | number;
    common_models?: string[];
    positioning_recommendation?: string;
    benchmark_table?: Array<{ competitor?: string; plan?: string; price?: string; model?: string }>;
  };
  differentiation?: {
    summary?: string;
    unique_advantages?: Array<{ advantage?: string; why_it_matters?: string; competitor_gap?: string }>;
    positioning_statement?: string;
  };
  barriers_to_entry?: Array<{ barrier?: string; severity?: string; description?: string; implication?: string }>;
  revenue_projections?: {
    pricing_used?: string;
    scenarios?: Record<string, { y1?: string | number; y2?: string | number; y3?: string | number; assumptions?: string }>;
  };
  target_segments?: Array<{
    name?: string;
    description?: string;
    segment_size?: string;
    willingness_to_pay?: string;
    acquisition_channel?: string;
    priority?: number | string;
  }>;
  sources?: Source[];
}

export interface SeoResult extends ResultBase {
  current_score?: number;
  optimized_score?: number;
  issues?: string[];
  optimized?: Record<string, unknown>;
  head_block?: string;
}

/** POST /api/repurpose: validated before it's returned and never stored, so it has no unstructured reply or timestamps. */
export interface RepurposeResult {
  platforms?: Array<{
    platform?: string;
    content?: string;
    hashtags?: string[] | string;
    notes?: string;
    character_count?: number;
  }>;
}

export type ReportKey = "market_analysis" | "pricing_result" | "press_kit" | "press_release" | "seo_result";
