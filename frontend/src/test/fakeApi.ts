/**
 * An in-memory stand-in for the LaunchOps API, for component tests. It follows
 * the backend contract closely enough to exercise real pages: requests act on the
 * organisation in X-Org-Id (or the user's first) and need the backend's role for
 * each change, SMTP passwords are write-only, approval creates drafts but never
 * sends, AI operations stop once the month's cost reaches the budget, changes are
 * announced on the live updates stream, and every request is recorded for assertions.
 */
import { delay, http, HttpResponse, type HttpHandler } from "msw";
import type {
  ActivityEntry,
  Brand,
  CalendarEvent,
  Capture,
  EmailItem,
  Invitation,
  Membership,
  OrganisationMember,
  OrgRole,
  Project,
  QueueItem,
  Source,
  Template,
  UsageBreakdown,
  UsageSummary,
  UsageTotals,
  User,
  WorkspaceSettings,
} from "@/lib/api/types";

export const API = "http://launchops.test";

/** Mirrors DATABASE_UNAVAILABLE_MESSAGE in backend/database.py: any signed-in request answers 503 with it during an outage. */
export const DATABASE_OUTAGE = "LaunchOps can't reach its database right now. Try again in a moment.";

/** A pending, accepted or withdrawn invitation, with the token its link carries. */
export interface FakeInvitation extends Invitation {
  org_id: string;
  /** The name of the organisation it's for. */
  organisation: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

/** A row of the AI usage ledger (backend table ai_usage). */
export interface FakeUsageRow {
  org_id: string;
  /** An ISO timestamp in UTC: its first seven characters are the month it counts towards. */
  created_at: string;
  user_id: string | null;
  product_id: string | null;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  web_search_requests: number;
  /** null when the model has no known price. */
  cost_usd: number | null;
}

export interface FakeState {
  /** The signed-in user; `user.organisations` decides which organisations and roles requests may use. */
  user: User;
  /** Members of the user's organisations. */
  members: Array<OrganisationMember & { org_id: string }>;
  invitations: FakeInvitation[];
  /** The activity log, newest first. */
  activity: Array<ActivityEntry & { org_id: string }>;
  projects: Project[];
  queue: QueueItem[];
  emails: EmailItem[];
  templates: Template[];
  captures: Capture[];
  calendar: CalendarEvent[];
  brands: Brand[];
  settings: WorkspaceSettings;
  smtpPasswords: Record<string, string>;
  adminUsers: Array<{ id: string; name: string; email: string; role: "admin" | "user"; enabled: boolean; created_at: string }>;
  registrationEnabled: boolean;
  requests: RecordedRequest[];
  /** Override a report endpoint's response (e.g. to simulate a failure). */
  reportResponse?: () => Response | Promise<Response>;
  /** Override GET /api/auth/me's response (e.g. an expired token or an outage when the app opens). */
  meResponse?: () => Response | Promise<Response>;
  /** Whether POST /api/auth/refresh renews the session (a valid refresh cookie). Default: it has ended. */
  sessionRenews?: boolean;
  /** Password reset links that work, by token, with the account each is for. */
  passwordResets?: Record<string, string>;
  /** Whether a platform mail server is configured, so invitations are emailed. */
  mailConfigured?: boolean;
  /** Emails an account can send in 24 hours (backend: MAX_EMAILS_PER_DAY). Default 20; 0 switches sending off. */
  emailDailyLimit?: number;
  /**
   * SMTP errors by recipient address. Sending to one of these fails as it does in the backend:
   * the email is marked failed with the error, and the API answers 502 "Send failed: <error>".
   */
  smtpErrors?: Record<string, string>;
  /** Milliseconds of latency for specific endpoints, to reproduce slow connections. */
  latency?: Partial<Record<"projectDetail" | "checklistSave", number>>;
  /** The AI usage ledger, for Settings → Usage and the budget check. */
  aiUsage?: FakeUsageRow[];
  /** Monthly AI budgets in US dollars by organisation id; missing or null means no budget of its own. */
  budgets?: Record<string, number | null>;
  /**
   * The platform default budget (DEFAULT_MONTHLY_AI_BUDGET_USD), which caps any organisation without its own.
   * Unset or null here means switched off, so fixtures written before it are unaffected — unlike production,
   * where it defaults to 25. A test that needs it sets it.
   */
  defaultBudget?: number | null;
  /** Results whose job a worker has started: cancelling one answers 202 and it stays running. Others cancel at once. */
  runningJobs?: string[];
  /** Answer GET /api/events differently (e.g. a refusal or an outage); return nothing to open the stream as usual. */
  eventsResponse?: () => Response | undefined | Promise<Response | undefined>;
  /** The reconnection delay the live updates stream announces. Default 5000 ms, as the backend. */
  eventsRetryMs?: number;
}

let counter = 1;
export const id = (prefix: string) => `${prefix}-${counter++}`;

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: id("project"),
    name: "VybeCode DSP",
    tagline: "Design audio plugins without code",
    url: "https://dsp.vybecod.example",
    color: "#7654d8",
    status: "pre_launch",
    description: "A visual, node-based builder for VST3 and AU audio plugins with signed export.",
    keywords: ["audio"],
    project_type: "product",
    launch_date: null,
    brand_id: null,
    checklist: {},
    email_settings: {},
    company_details: {},
    created_at: "2026-09-01T10:00:00+00:00",
    updated_at: "2026-09-01T10:00:00+00:00",
    ...overrides,
  };
}

export function makeState(partial: Partial<FakeState> = {}): FakeState {
  return {
    user: {
      id: "user-1",
      email: "jordan@northstar.example",
      name: "Jordan Avery",
      role: "admin",
      organisations: [{ id: "org-1", name: "Northstar Ventures", role: "owner" }],
    },
    members: [
      { org_id: "org-1", user_id: "user-1", name: "Jordan Avery", email: "jordan@northstar.example", role: "owner", joined_at: "2026-09-01T00:00:00+00:00" },
      { org_id: "org-1", user_id: "user-2", name: "Sam Rivera", email: "sam@northstar.example", role: "editor", joined_at: "2026-09-02T00:00:00+00:00" },
    ],
    invitations: [],
    activity: [],
    projects: [],
    queue: [],
    emails: [],
    templates: [],
    captures: [],
    calendar: [],
    brands: [],
    settings: {
      platforms: { twitter: { connected: true, handle: "@north", mode: "manual" } },
      brand: { name: "Northstar", tagline: "", tone: "professional", keywords: [], avoid: [], elevator: "", company_name: "Northstar Ventures", logo_url: "" },
      prefs: { depth: "thorough", length: "medium", emoji: false, hashtags: "minimal", sources: true },
    },
    smtpPasswords: {},
    adminUsers: [
      { id: "user-1", name: "Jordan Avery", email: "jordan@northstar.example", role: "admin", enabled: true, created_at: "2026-09-01T00:00:00+00:00" },
      { id: "user-2", name: "Sam Rivera", email: "sam@northstar.example", role: "user", enabled: true, created_at: "2026-09-02T00:00:00+00:00" },
    ],
    registrationEnabled: true,
    requests: [],
    ...partial,
  };
}

function publicProject(state: FakeState, p: Project): Project {
  const { smtp_password: _ignored, ...settings } = p.email_settings ?? {};
  return { ...p, email_settings: { ...settings, smtp_password_set: Boolean(state.smtpPasswords[p.id]) } };
}

const notFound = (detail = "Not found") => HttpResponse.json({ detail }, { status: 404 });

const ROLE_ORDER: OrgRole[] = ["viewer", "editor", "approver", "owner"];
const ROLE_NAMES: Record<OrgRole, string> = { viewer: "Viewer", editor: "Editor", approver: "Approver", owner: "Owner" };

/** Every route that calls the AI: running one needs the Editor role and stops when the budget is used. */
const AI_OPERATIONS = /^\/api\/(workflows\/launch|presskit\/generate|press-release\/generate|seo\/analyze|pricing\/analyze|market-analysis|repurpose)$/;

/**
 * The role each change needs, as enforced by the backend (services/access.py and the routers).
 * Reads need only membership. Removing yourself from an organisation needs no role.
 */
const MINIMUM_ROLES: Array<[method: string, path: RegExp, role: OrgRole]> = [
  ["POST", /^\/api\/products$/, "editor"],
  ["PATCH", /^\/api\/products\/[^/]+(\/checklist)?$/, "editor"],
  ["DELETE", /^\/api\/products\/[^/]+$/, "owner"],
  ["PATCH", /^\/api\/queue\/[^/]+$/, "approver"],
  ["DELETE", /^\/api\/queue\/[^/]+$/, "approver"],
  ["POST", /^\/api\/queue\/[^/]+\/cancel$/, "editor"],
  ["PATCH", /^\/api\/email-queue\/[^/]+$/, "editor"],
  ["POST", /^\/api\/email-queue\/[^/]+\/send$/, "approver"],
  ["DELETE", /^\/api\/email-queue\/[^/]+$/, "approver"],
  ["POST", AI_OPERATIONS, "editor"],
  ["POST", /^\/api\/(calendar|templates|captures|brands)$/, "editor"],
  ["PATCH", /^\/api\/(calendar|brands)\/[^/]+$/, "editor"],
  ["DELETE", /^\/api\/(calendar|templates|captures|brands)\/[^/]+$/, "editor"],
  ["PUT", /^\/api\/settings$/, "editor"],
  ["PATCH", /^\/api\/organisation$/, "owner"],
  ["GET", /^\/api\/organisation\/(invitations|activity|usage)$/, "owner"],
  ["PUT", /^\/api\/organisation\/budget$/, "owner"],
  ["POST", /^\/api\/organisation\/invitations$/, "owner"],
  ["DELETE", /^\/api\/organisation\/invitations\/[^/]+$/, "owner"],
  ["PATCH", /^\/api\/organisation\/members\/[^/]+$/, "owner"],
  ["DELETE", /^\/api\/organisation\/members\/[^/]+$/, "owner"],
];

/* ─── Live updates (GET /api/events) ─── */

interface LiveStream {
  orgId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

const liveStreams = new Set<LiveStream>();
const encoder = new TextEncoder();

function writeLive(text: string, orgId?: string) {
  for (const stream of [...liveStreams]) {
    if (orgId && stream.orgId !== orgId) continue;
    try {
      stream.controller.enqueue(encoder.encode(text));
    } catch {
      liveStreams.delete(stream);
    }
  }
}

const liveEvent = (type: "queue" | "email", id: string, status: string) => `event: ${type}\ndata: ${JSON.stringify({ id, status })}\n\n`;

/** Mirrors services/events.py publish(): tell an organisation's open streams what changed. */
function publish(orgId: string, type: "queue" | "email", id: string, status: string) {
  writeLive(liveEvent(type, id, status), orgId);
}

function closeLive(how: "end" | "drop") {
  for (const stream of liveStreams) {
    try {
      if (how === "end") stream.controller.close();
      else stream.controller.error(new TypeError("network error"));
    } catch {
      /* the reader already cancelled it */
    }
  }
  liveStreams.clear();
}

/** Test controls for the open live updates streams (the handlers publish the backend's own events). */
export const liveUpdates = {
  /** How many streams the fake has opened and not ended, optionally only an organisation's. It doesn't know when the app stops reading one. */
  openStreams: (orgId?: string) => [...liveStreams].filter((stream) => !orgId || stream.orgId === orgId).length,
  /** Announce a change on every open stream, as another person's action or a worker would. */
  publish: (type: "queue" | "email", id: string, status: string, orgId?: string) => writeLive(liveEvent(type, id, status), orgId),
  /** Write raw text to every open stream. */
  write: (text: string) => writeLive(text),
  /** End every open stream, as a server restart or deploy does. */
  end: () => closeLive("end"),
  /** Break every open stream, as a dropped connection does. */
  drop: () => closeLive("drop"),
};

/* ─── AI usage and budgets ─── */

function usageTotals(rows: FakeUsageRow[]): UsageTotals {
  const sum = (pick: (row: FakeUsageRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    cost_usd: Math.round(sum((row) => row.cost_usd ?? 0) * 1e6) / 1e6,
    calls: rows.length,
    input_tokens: sum((row) => row.input_tokens),
    output_tokens: sum((row) => row.output_tokens),
    cache_creation_input_tokens: sum((row) => row.cache_creation_input_tokens),
    cache_read_input_tokens: sum((row) => row.cache_read_input_tokens),
    web_search_requests: sum((row) => row.web_search_requests),
    unpriced_calls: rows.filter((row) => row.cost_usd === null).length,
  };
}

/** Mirrors summary() in backend/services/usage.py. */
function usageSummary(state: FakeState, orgId: string, month: string): UsageSummary {
  const rows = (state.aiUsage ?? []).filter((row) => row.org_id === orgId && row.created_at.slice(0, 7) === month);
  const breakdown = (keyOf: (row: FakeUsageRow) => string, labelOf: (row: FakeUsageRow) => string): UsageBreakdown[] => {
    const groups = new Map<string, { key: string; label: string; rows: FakeUsageRow[] }>();
    for (const row of rows) {
      const key = keyOf(row);
      const label = labelOf(row);
      const group = groups.get(JSON.stringify([key, label])) ?? { key, label, rows: [] };
      group.rows.push(row);
      groups.set(JSON.stringify([key, label]), group);
    }
    return [...groups.values()]
      .map(({ key, label, rows: grouped }) => ({ key, label, ...usageTotals(grouped) }))
      .sort((a, b) => b.cost_usd - a.cost_usd || b.calls - a.calls || a.label.localeCompare(b.label));
  };
  const emailOf = (userId: string | null) =>
    state.adminUsers.find((u) => u.id === userId)?.email ?? state.members.find((m) => m.user_id === userId)?.email;
  return {
    month,
    budget_usd: state.budgets?.[orgId] ?? null,
    default_budget_usd: state.defaultBudget != null && state.defaultBudget > 0 ? state.defaultBudget : null,
    effective_budget_usd: effectiveBudget(state, orgId).amount,
    budget_source: effectiveBudget(state, orgId).source,
    total: usageTotals(rows),
    by_operation: breakdown((row) => row.operation, (row) => row.operation),
    by_project: breakdown(
      (row) => row.product_id ?? "",
      (row) => state.projects.find((p) => p.id === row.product_id)?.name ?? "A deleted project",
    ),
    by_member: breakdown((row) => row.user_id ?? "", (row) => emailOf(row.user_id) ?? "A deleted account"),
    by_model: breakdown((row) => row.model, (row) => row.model),
  };
}

const usd = (amount: number) => `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Mirrors effective_budget() in backend/services/usage.py: the budget that actually applies, and whose it is. */
function effectiveBudget(state: FakeState, orgId: string): { amount: number | null; source: "organisation" | "default" | "none" } {
  const own = state.budgets?.[orgId];
  if (own !== undefined && own !== null) return { amount: own, source: "organisation" };
  const fallback = state.defaultBudget;
  return fallback != null && fallback > 0 ? { amount: fallback, source: "default" } : { amount: null, source: "none" };
}

/** Mirrors ensure_within_budget() in backend/services/usage.py: 429 once this UTC month's cost reaches the budget. */
function budgetRefusal(state: FakeState, membership: Membership): Response | null {
  const { amount: budget, source } = effectiveBudget(state, membership.id);
  if (budget === null) return null;
  const ceiling = state.defaultBudget ?? 0;
  const now = new Date();
  const spent = usageTotals((state.aiUsage ?? []).filter((row) => row.org_id === membership.id && row.created_at.slice(0, 7) === now.toISOString().slice(0, 7))).cost_usd;
  if (spent < budget) return null;
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return HttpResponse.json(
    {
      detail: `${membership.name} has used ${source === "organisation" ? "its AI budget" : "the default AI budget"} for ${month} (${usd(budget)}). ${
        source === "organisation" && !(ceiling > 0 && budget >= ceiling)
          ? "An owner can raise it in Settings → Usage."
          : "A platform administrator can raise it."
      }`,
    },
    { status: 429 },
  );
}

/** Mirrors services/access.py: the request's organisation membership, or the response refusing it. */
function membershipFor(state: FakeState, request: Request): Membership | Response {
  const requested = request.headers.get("X-Org-Id");
  const organisations = state.user.organisations;
  const membership = requested ? organisations.find((o) => o.id === requested) : organisations[0];
  if (!membership) {
    return requested
      ? HttpResponse.json({ detail: "Organisation not found" }, { status: 404 })
      : HttpResponse.json({ detail: "You aren't a member of any organisation. Ask an owner to invite you." }, { status: 403 });
  }
  return membership;
}

function refusedForRole(membership: Membership, minimum: OrgRole): Response | null {
  if (ROLE_ORDER.indexOf(membership.role) >= ROLE_ORDER.indexOf(minimum)) return null;
  return HttpResponse.json(
    { detail: `You need the ${ROLE_NAMES[minimum]} role in ${membership.name} to do this. Ask an owner of the organisation.` },
    { status: 403 },
  );
}

/**
 * Sources as the backend stores them at the end of a web research result (services/claude.py): pages the searches
 * returned, as returned, most important first. The search engine doesn't always say when a page was updated.
 */
export const RESEARCH_SOURCES: Source[] = [
  { title: "PatchForge pricing and plans", url: "https://patchforge.example/pricing", page_age: "September 2, 2026" },
  { title: "The best audio plugin builders compared", url: "https://synthweekly.example/plugin-builders", page_age: "3 days ago" },
  { title: "KnobWorks: build effects without code", url: "https://knobworks.example/", page_age: null },
];

/** The reports whose operations research the web, so their results end with sources (services/results.py). */
const RESEARCH_REPORTS = new Set(["/api/press-release/generate", "/api/pricing/analyze", "/api/market-analysis"]);

/** Mirrors `workflow_tags` in backend/routers/extras.py (GET /api/templates/for-workflow/{id}). */
export const BACKEND_WORKFLOW_TAGS: Record<string, string[]> = {
  cold_outreach: ["outreach", "email"],
  partnerships: ["outreach", "email"],
  social_posts: ["social", "content"],
  ad_copy: ["social", "content", "ads"],
  blog: ["content", "blog"],
  announcement: ["content", "social", "email"],
  reddit: ["social", "community"],
  competitor: ["research"],
  trend: ["research"],
  directories: ["outreach"],
  launch_platforms: ["outreach", "community"],
  podcasts: ["outreach"],
};

/** Mirrors _email_quota in backend/routers/queue.py: sends in a sliding 24-hour window. */
function emailQuota(state: FakeState) {
  const limit = state.emailDailyLimit ?? 20;
  const windowStart = Date.now() - 24 * 3_600_000;
  const sentTimes = state.emails
    .filter((e) => e.status === "sent" && e.sent_at && Date.parse(e.sent_at) > windowStart)
    .map((e) => Date.parse(e.sent_at!))
    .sort((a, b) => a - b);
  const remaining = Math.max(0, limit - sentTimes.length);
  const freeing = remaining === 0 && limit > 0 ? sentTimes[sentTimes.length - limit] : undefined;
  return {
    limit,
    sent: sentTimes.length,
    remaining,
    next_available_at: freeing === undefined ? null : new Date(freeing + 24 * 3_600_000).toISOString(),
  };
}

/** Mirrors EMAIL_WORKFLOWS in backend/routers/queue.py: approving these turns contacts into drafts. */
const EMAIL_WORKFLOWS = new Set(["cold_outreach", "partnerships", "press_targets", "announcement"]);
const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

interface Contact {
  name: string;
  email: string;
  context: string;
}

/**
 * Mirrors extract_contacts_from_content in backend/services/email.py (structured contact objects
 * and addresses anywhere in text). Guessing a name from the words before an address isn't mirrored.
 */
function extractContacts(content: unknown): Contact[] {
  const contacts: Contact[] = [];
  const seen = new Set<string>();
  const add = (email: string, name: string, context: string) => {
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    contacts.push({ name, email: key, context });
  };
  const scan = (value: unknown, context: string): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(EMAIL_PATTERN)) add(match[1]!, "", context);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const record = item as Record<string, unknown>;
          const itemEmail = String(record.email || record.contact_email || "");
          if (!itemEmail) {
            Object.values(record).forEach((v) => scan(v, String(record.name ?? context)));
          } else {
            for (const match of itemEmail.matchAll(EMAIL_PATTERN)) {
              add(match[1]!, String(record.name ?? record.contact_name ?? ""), String(record.type ?? context));
            }
          }
        } else if (typeof item === "string") {
          scan(item, context);
        }
      }
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, v]) => scan(v, key));
    }
  };
  scan(content, "");
  return contacts;
}

/** Mirrors _extract_and_queue_emails in backend/routers/queue.py: drafts only, once per result. */
function draftsFromApproval(state: FakeState, item: QueueItem): EmailItem[] {
  const p = state.projects.find((candidate) => candidate.id === item.product_id);
  if (!p || !EMAIL_WORKFLOWS.has(item.workflow_id) || state.emails.some((e) => e.source_queue_id === item.id)) return [];
  const content = (item.content ?? {}) as Record<string, unknown>;
  return extractContacts(content).map((contact) => {
    let subject = `Regarding ${p.name}`;
    let body = `Hi ${contact.name || "there"},\n\n`;
    if (item.workflow_id === "cold_outreach") {
      const emails = Array.isArray(content.emails) ? content.emails : [];
      const match = emails.find((e) => e && typeof e === "object" && JSON.stringify(e).includes(contact.email)) as
        | { subject?: string; body?: string }
        | undefined;
      if (match) {
        subject = match.subject ?? subject;
        body = match.body ?? body;
      }
    } else if (item.workflow_id === "partnerships") {
      body += `I'd love to explore a potential partnership opportunity between our teams.\n\nContext: ${contact.context}\n\nBest regards`;
    } else if (item.workflow_id === "announcement") {
      const emailVersion = content.email_version;
      body = typeof emailVersion === "string" && emailVersion.trim() ? emailVersion : `${body}I wanted to share some exciting news about ${p.name}.\n\n`;
    }
    return {
      id: id("email"),
      product_id: p.id,
      source_queue_id: item.id,
      recipient_name: contact.name,
      recipient_email: contact.email,
      subject,
      body,
      status: "pending",
      error: "",
      sent_at: null,
      created_at: new Date().toISOString(),
    };
  });
}

export function handlers(state: FakeState): HttpHandler[] {
  const record = async (request: Request) => {
    const url = new URL(request.url);
    let body: unknown = null;
    if (request.method !== "GET" && request.method !== "DELETE") {
      body = await request.clone().json().catch(() => null);
    }
    state.requests.push({ method: request.method, path: `${url.pathname}${url.search}`, body });
    return body;
  };
  const project = (pid: string) => state.projects.find((p) => p.id === pid);

  const orgOf = (request: Request) => membershipFor(state, request) as Membership;
  const audit = (request: Request, action: string, summary: string, targetId = "") => {
    state.activity.unshift({
      id: state.activity.length + 1, org_id: orgOf(request).id, actor: state.user.email, action,
      target_type: "", target_id: targetId, summary, details: {}, created_at: new Date().toISOString(),
    });
  };

  return [
    http.all(`${API}/api/*`, async ({ request }) => {
      const path = new URL(request.url).pathname;
      if (path.startsWith("/api/auth/") || path.startsWith("/api/invitations/")) return undefined;
      const membership = membershipFor(state, request);
      if (membership instanceof Response) {
        await record(request);
        return membership;
      }
      const leaving = request.method === "DELETE" && path === `/api/organisation/members/${state.user.id}`;
      const rule = MINIMUM_ROLES.find(([method, pattern]) => method === request.method && pattern.test(path));
      const refused =
        (rule && !leaving ? refusedForRole(membership, rule[2]) : null) ??
        (request.method === "POST" && AI_OPERATIONS.test(path) ? budgetRefusal(state, membership) : null);
      if (refused) {
        await record(request);
        return refused;
      }
      return undefined;
    }),
    /** Mirrors backend/routers/events.py: the stream opens with the reconnection delay, then carries each change. */
    http.get(`${API}/api/events`, async ({ request }) => {
      await record(request);
      const override = await state.eventsResponse?.();
      if (override) return override;
      const orgId = orgOf(request).id;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // The fake can't tell reliably when the app stops reading: MSW gives the app a copy of the body, and the
          // request a handler sees only follows the app's abort until it's garbage collected. A stream stays open
          // until the test ends it (or setup.ts does, after each test).
          liveStreams.add({ orgId, controller });
          controller.enqueue(encoder.encode(`retry: ${state.eventsRetryMs ?? 5000}\n\n`));
        },
      });
      return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }),
    /** Mirrors refresh_session in backend/routers/auth.py. */
    http.post(`${API}/api/auth/refresh`, async ({ request }) => {
      await record(request);
      if (!state.sessionRenews) return HttpResponse.json({ detail: "Your session has ended. Sign in again." }, { status: 401 });
      return HttpResponse.json({ token: "token-renewed", user: state.user });
    }),
    http.post(`${API}/api/auth/logout`, async ({ request }) => {
      await record(request);
      return HttpResponse.json({ status: "signed_out" });
    }),
    http.post(`${API}/api/auth/password-reset`, async ({ request }) => {
      await record(request);
      return HttpResponse.json({ status: "requested" }, { status: 202 });
    }),
    http.get(`${API}/api/auth/password-reset/:token`, async ({ request, params }) => {
      await record(request);
      const email = state.passwordResets?.[String(params.token)];
      if (!email) return notFound("This reset link has expired or has already been used. Ask for a new one.");
      return HttpResponse.json({ email });
    }),
    http.post(`${API}/api/auth/password-reset/:token`, async ({ request, params }) => {
      const body = (await record(request)) as { password: string };
      const email = state.passwordResets?.[String(params.token)];
      if (!email) return notFound("This reset link has expired or has already been used. Ask for a new one.");
      if ((body.password ?? "").length < 8) return HttpResponse.json({ detail: "Password must be at least 8 characters" }, { status: 400 });
      delete state.passwordResets![String(params.token)];
      return HttpResponse.json({ token: "token-after-reset", user: { ...state.user, email } });
    }),
    http.post(`${API}/api/auth/admin/users/:id/reset-link`, async ({ request, params }) => {
      await record(request);
      const target = state.adminUsers.find((u) => u.id === params.id);
      if (!target) return notFound("User not found");
      const token = `reset-${params.id}-0123456789abcdefghijklmnopqrstuvwxyz`;
      state.passwordResets = { ...state.passwordResets, [token]: target.email };
      return HttpResponse.json({ link: `/reset-password/${token}`, expires_at: new Date(Date.now() + 86_400_000).toISOString() }, { status: 201 });
    }),
    http.get(`${API}/api/auth/me`, async ({ request }) => {
      await record(request);
      if (state.meResponse) return state.meResponse();
      return HttpResponse.json(state.user);
    }),
    http.post(`${API}/api/auth/login`, async ({ request }) => {
      const body = (await record(request)) as { email: string; password: string };
      if (body.password !== "correct-horse") return HttpResponse.json({ detail: "Invalid email or password" }, { status: 401 });
      return HttpResponse.json({ token: "token-1", user: state.user });
    }),
    /** Mirrors register in backend/routers/auth.py; the new account becomes the signed-in user. */
    http.post(`${API}/api/auth/register`, async ({ request }) => {
      const body = (await record(request)) as { name?: string; email: string; password: string };
      if (!body.email || !body.password) return HttpResponse.json({ detail: "Email and password are required" }, { status: 400 });
      if (body.password.length < 8) return HttpResponse.json({ detail: "Password must be at least 8 characters" }, { status: 400 });
      if (!state.registrationEnabled) return HttpResponse.json({ detail: "Registration is currently disabled" }, { status: 403 });
      const email = body.email.toLowerCase().trim();
      if (state.adminUsers.some((u) => u.email === email)) {
        return HttpResponse.json({ detail: "An account with this email already exists" }, { status: 409 });
      }
      const role = state.adminUsers.length ? ("user" as const) : ("admin" as const);
      const created = { id: id("user"), name: (body.name ?? "").trim(), email, role, enabled: true, created_at: new Date().toISOString() };
      state.adminUsers.push(created);
      const organisation = { id: id("org"), name: `${created.name || email.split("@")[0]}'s organisation`, role: "owner" as const };
      state.user = { id: created.id, email, name: created.name, role, organisations: [organisation] };
      return HttpResponse.json({ token: "token-1", user: state.user });
    }),

    http.get(`${API}/api/products`, async ({ request }) => {
      await record(request);
      const orgId = orgOf(request).id;
      return HttpResponse.json(state.projects.filter((p) => !p.org_id || p.org_id === orgId).map((p) => publicProject(state, p)));
    }),
    http.get(`${API}/api/products/:id`, async ({ request, params }) => {
      await record(request);
      if (state.latency?.projectDetail) await delay(state.latency.projectDetail);
      const p = project(String(params.id));
      return p ? HttpResponse.json(publicProject(state, p)) : notFound("Product not found");
    }),
    http.post(`${API}/api/products`, async ({ request }) => {
      const body = (await record(request)) as Partial<Project>;
      const created = makeProject({ ...body, id: id("project") });
      state.projects.unshift(created);
      return HttpResponse.json(publicProject(state, created), { status: 201 });
    }),
    http.patch(`${API}/api/products/:id/checklist`, async ({ request, params }) => {
      const body = (await record(request)) as Project["checklist"];
      if (state.latency?.checklistSave) await delay(state.latency.checklistSave);
      const p = project(String(params.id));
      if (!p) return notFound();
      p.checklist = body;
      return HttpResponse.json(publicProject(state, p));
    }),
    http.patch(`${API}/api/products/:id`, async ({ request, params }) => {
      const body = (await record(request)) as Partial<Project>;
      const p = project(String(params.id));
      if (!p) return notFound();
      const { email_settings, ...rest } = body;
      Object.assign(p, rest);
      if (email_settings) {
        const { smtp_password, smtp_password_set: _set, ...settings } = email_settings;
        if (smtp_password) state.smtpPasswords[p.id] = smtp_password;
        p.email_settings = settings;
      }
      return HttpResponse.json(publicProject(state, p));
    }),

    http.delete(`${API}/api/products/:id`, async ({ request, params }) => {
      await record(request);
      state.projects = state.projects.filter((p) => p.id !== params.id);
      return HttpResponse.json({ deleted: true });
    }),
    http.post(`${API}/api/repurpose`, async ({ request }) => {
      const body = (await record(request)) as { platforms: string[]; content: string };
      return HttpResponse.json({
        platforms: body.platforms.map((platform) => ({ platform, content: `${platform}: ${body.content}`, hashtags: ["#launch"], notes: "" })),
      });
    }),

    http.get(`${API}/api/queue`, async ({ request }) => {
      await record(request);
      const url = new URL(request.url);
      const productId = url.searchParams.get("product_id");
      const status = url.searchParams.get("status");
      return HttpResponse.json(state.queue.filter((q) => (!productId || q.product_id === productId) && (!status || q.status === status)));
    }),
    http.patch(`${API}/api/queue/:id`, async ({ request, params }) => {
      const body = (await record(request)) as { status: QueueItem["status"]; notes: string };
      const item = state.queue.find((q) => q.id === params.id);
      if (!item) return notFound();
      const changed = item.status !== body.status;
      item.status = body.status;
      item.notes = body.notes;
      if (changed) publish(orgOf(request).id, "queue", item.id, body.status);
      if (body.status === "approved") {
        const drafts = draftsFromApproval(state, item);
        state.emails.push(...drafts);
        if (drafts.length) publish(orgOf(request).id, "email", item.id, "drafts");
      }
      return HttpResponse.json(item);
    }),
    http.delete(`${API}/api/queue/:id`, async ({ request, params }) => {
      await record(request);
      state.queue = state.queue.filter((q) => q.id !== params.id);
      publish(orgOf(request).id, "queue", String(params.id), "deleted");
      return HttpResponse.json({ deleted: true });
    }),
    /** Mirrors cancel_operation in backend/routers/queue.py and cancel() in services/jobs.py. */
    http.post(`${API}/api/queue/:id/cancel`, async ({ request, params }) => {
      await record(request);
      const item = state.queue.find((q) => q.id === params.id);
      if (!item) return notFound("Queue item not found");
      if (item.status !== "running") return HttpResponse.json({ detail: "This operation has already finished." }, { status: 409 });
      audit(request, "operation.cancelled", `Cancelled ${item.workflow_id} for ${project(item.product_id)?.name ?? "a deleted project"}`, item.id);
      // A running job stops at its next heartbeat; the test decides when.
      if (state.runningJobs?.includes(item.id)) return HttpResponse.json({ status: "cancelling" }, { status: 202 });
      const message = `Cancelled by ${state.user.email}.`;
      Object.assign(item, { status: "failed", content: { error: message }, preview: `Failed: ${message}` });
      publish(orgOf(request).id, "queue", item.id, "failed");
      return HttpResponse.json({ status: "cancelled" });
    }),
    http.post(`${API}/api/workflows/launch`, async ({ request }) => {
      const body = (await record(request)) as { product_id: string; workflow_id: string; instructions: string };
      const item: QueueItem = {
        id: id("queue"),
        product_id: body.product_id,
        workflow_id: body.workflow_id,
        status: "running",
        content: {},
        preview: `Running ${body.workflow_id}...`,
        input_params: body.instructions,
        notes: "",
        created_at: new Date().toISOString(),
      };
      state.queue.unshift(item);
      publish(orgOf(request).id, "queue", item.id, "running");
      return HttpResponse.json({ task_id: item.id, status: "running", message: "launched" });
    }),

    ...["/api/presskit/generate", "/api/press-release/generate", "/api/seo/analyze", "/api/pricing/analyze", "/api/market-analysis"].map((path) =>
      http.post(`${API}${path}`, async ({ request }) => {
        const body = (await record(request)) as { product_id: string };
        if (state.reportResponse) return state.reportResponse();
        const result = {
          tiers: [{ name: "Pro", price: "$29/mo", features: ["All"] }],
          generated_at: new Date().toISOString(),
          ...(RESEARCH_REPORTS.has(path) ? { sources: RESEARCH_SOURCES } : {}),
        };
        const p = project(body.product_id);
        if (p && path === "/api/pricing/analyze") p.pricing_result = result;
        return HttpResponse.json(result);
      }),
    ),

    http.get(`${API}/api/email-queue/quota`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(emailQuota(state));
    }),
    http.get(`${API}/api/email-queue`, async ({ request }) => {
      await record(request);
      const productId = new URL(request.url).searchParams.get("product_id");
      return HttpResponse.json(state.emails.filter((e) => !productId || e.product_id === productId));
    }),
    http.patch(`${API}/api/email-queue/:id`, async ({ request, params }) => {
      const body = (await record(request)) as Partial<EmailItem>;
      const email = state.emails.find((e) => e.id === params.id);
      if (!email) return notFound();
      Object.assign(email, body);
      return HttpResponse.json(email);
    }),
    http.post(`${API}/api/email-queue/:id/send`, async ({ request, params }) => {
      await record(request);
      const email = state.emails.find((e) => e.id === params.id);
      if (!email) return notFound();
      const quota = emailQuota(state);
      if (quota.limit === 0) {
        return HttpResponse.json(
          { detail: "Sending email is switched off on this server: its daily limit is 0. Ask the administrator to raise MAX_EMAILS_PER_DAY." },
          { status: 429 },
        );
      }
      if (quota.remaining === 0) {
        return HttpResponse.json(
          { detail: `You've sent ${quota.limit} emails in the last 24 hours, which is the daily limit. Try again in 24 hours.` },
          { status: 429 },
        );
      }
      const smtpError = state.smtpErrors?.[email.recipient_email];
      if (smtpError) {
        email.status = "failed";
        email.error = smtpError;
        publish(orgOf(request).id, "email", email.id, "failed");
        return HttpResponse.json({ detail: `Send failed: ${smtpError}` }, { status: 502 });
      }
      email.status = "sent";
      email.sent_at = new Date().toISOString();
      publish(orgOf(request).id, "email", email.id, "sent");
      return HttpResponse.json({ status: "sent" });
    }),
    http.delete(`${API}/api/email-queue/:id`, async ({ request, params }) => {
      await record(request);
      if (!state.emails.some((e) => e.id === params.id)) return notFound("Email not found");
      state.emails = state.emails.filter((e) => e.id !== params.id);
      publish(orgOf(request).id, "email", String(params.id), "deleted");
      return HttpResponse.json({ deleted: true });
    }),

    http.get(`${API}/api/templates`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.templates);
    }),
    http.get(`${API}/api/templates/for-workflow/:wf`, async ({ request, params }) => {
      await record(request);
      const tags = BACKEND_WORKFLOW_TAGS[String(params.wf)] ?? [];
      return HttpResponse.json(state.templates.filter((t) => t.tags.some((tag) => tags.includes(tag))));
    }),
    http.post(`${API}/api/templates`, async ({ request }) => {
      const body = (await record(request)) as Template;
      const created = { ...body, id: id("template"), created_at: new Date().toISOString() };
      state.templates.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),

    http.get(`${API}/api/captures`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.captures);
    }),
    http.delete(`${API}/api/captures/:id`, async ({ request, params }) => {
      await record(request);
      state.captures = state.captures.filter((c) => c.id !== params.id);
      return HttpResponse.json({ deleted: true });
    }),

    http.get(`${API}/api/calendar`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.calendar);
    }),

    http.get(`${API}/api/settings`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.settings);
    }),
    http.put(`${API}/api/settings`, async ({ request }) => {
      const body = (await record(request)) as WorkspaceSettings;
      state.settings = body;
      return HttpResponse.json({ ...body, id: 1 });
    }),

    http.get(`${API}/api/brands`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.brands);
    }),
    http.post(`${API}/api/brands`, async ({ request }) => {
      const body = (await record(request)) as Partial<Brand>;
      const created = { ...body, id: id("brand"), created_at: "", updated_at: "" } as Brand;
      state.brands.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(`${API}/api/brands/:id`, async ({ request, params }) => {
      const body = (await record(request)) as Partial<Brand>;
      const brand = state.brands.find((b) => b.id === params.id);
      if (!brand) return notFound();
      Object.assign(brand, body);
      return HttpResponse.json(brand);
    }),
    http.delete(`${API}/api/brands/:id`, async ({ request, params }) => {
      await record(request);
      state.brands = state.brands.filter((b) => b.id !== params.id);
      state.projects.forEach((p) => {
        if (p.brand_id === params.id) p.brand_id = null;
      });
      return HttpResponse.json({ deleted: true });
    }),

    http.post(`${API}/api/calendar`, async ({ request }) => {
      const body = (await record(request)) as CalendarEvent;
      const p = project(body.product_id);
      const created = { ...body, id: id("event"), product_name: p?.name ?? "", color: p?.color ?? "#00f0ff" };
      state.calendar.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(`${API}/api/calendar/:id`, async ({ request, params }) => {
      const body = (await record(request)) as Partial<CalendarEvent>;
      const event = state.calendar.find((e) => e.id === params.id);
      if (!event) return notFound("Event not found");
      Object.assign(event, body);
      if (body.product_id) {
        const p = project(body.product_id);
        if (!p) return HttpResponse.json({ detail: "Project not found" }, { status: 400 });
        Object.assign(event, { product_name: p.name, color: p.color });
      }
      return HttpResponse.json(event);
    }),
    http.delete(`${API}/api/calendar/:id`, async ({ request, params }) => {
      await record(request);
      state.calendar = state.calendar.filter((e) => e.id !== params.id);
      return HttpResponse.json({ deleted: true });
    }),
    http.post(`${API}/api/captures`, async ({ request }) => {
      const body = (await record(request)) as { text: string; product_id: string };
      const created = { ...body, id: id("capture"), created_at: new Date().toISOString() };
      state.captures.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete(`${API}/api/templates/:id`, async ({ request, params }) => {
      await record(request);
      state.templates = state.templates.filter((t) => t.id !== params.id);
      return HttpResponse.json({ deleted: true });
    }),

    http.get(`${API}/api/organisation`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(orgOf(request));
    }),
    http.patch(`${API}/api/organisation`, async ({ request }) => {
      const body = (await record(request)) as { name: string };
      const name = (body.name ?? "").trim();
      if (!name) return HttpResponse.json({ detail: "The organisation needs a name." }, { status: 422 });
      const membership = orgOf(request);
      state.user = { ...state.user, organisations: state.user.organisations.map((o) => (o.id === membership.id ? { ...o, name } : o)) };
      audit(request, "organisation.renamed", `Renamed the organisation from “${membership.name}” to “${name}”`);
      return HttpResponse.json({ ...membership, name });
    }),
    http.get(`${API}/api/organisation/members`, async ({ request }) => {
      await record(request);
      const orgId = orgOf(request).id;
      return HttpResponse.json(state.members.filter((m) => m.org_id === orgId).map(({ org_id: _org, ...m }) => m));
    }),
    http.patch(`${API}/api/organisation/members/:userId`, async ({ request, params }) => {
      const body = (await record(request)) as { role: OrgRole };
      const orgId = orgOf(request).id;
      const member = state.members.find((m) => m.org_id === orgId && m.user_id === params.userId);
      if (!member) return notFound("Member not found");
      const owners = state.members.filter((m) => m.org_id === orgId && m.role === "owner").length;
      if (member.role === "owner" && body.role !== "owner" && owners === 1) {
        return HttpResponse.json({ detail: "An organisation needs at least one owner. Make someone else an owner first." }, { status: 409 });
      }
      audit(request, "member.role_changed", `Changed ${member.email} from ${ROLE_NAMES[member.role]} to ${ROLE_NAMES[body.role]}`);
      member.role = body.role;
      return HttpResponse.json({ user_id: member.user_id, role: member.role });
    }),
    http.delete(`${API}/api/organisation/members/:userId`, async ({ request, params }) => {
      await record(request);
      const orgId = orgOf(request).id;
      const member = state.members.find((m) => m.org_id === orgId && m.user_id === params.userId);
      if (!member) return notFound("Member not found");
      const owners = state.members.filter((m) => m.org_id === orgId && m.role === "owner").length;
      if (member.role === "owner" && owners === 1) {
        return HttpResponse.json({ detail: "An organisation needs at least one owner. Make someone else an owner first." }, { status: 409 });
      }
      state.members = state.members.filter((m) => m !== member);
      if (member.user_id === state.user.id) {
        state.user = { ...state.user, organisations: state.user.organisations.filter((o) => o.id !== orgId) };
        audit(request, "member.left", "Left the organisation");
      } else {
        audit(request, "member.removed", `Removed ${member.email} from the organisation`);
      }
      return HttpResponse.json({ deleted: true });
    }),
    http.get(`${API}/api/organisation/invitations`, async ({ request }) => {
      await record(request);
      const orgId = orgOf(request).id;
      return HttpResponse.json(
        state.invitations
          .filter((i) => i.org_id === orgId && i.status === "pending")
          .map(({ org_id: _org, organisation: _name, token: _token, status: _status, link: _link, ...i }) => i),
      );
    }),
    http.post(`${API}/api/organisation/invitations`, async ({ request }) => {
      const body = (await record(request)) as { email: string; role: OrgRole };
      const email = (body.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return HttpResponse.json({ detail: "Enter a valid email address." }, { status: 422 });
      const orgId = orgOf(request).id;
      if (state.members.some((m) => m.org_id === orgId && m.email === email)) {
        return HttpResponse.json({ detail: `${email} is already a member of this organisation.` }, { status: 409 });
      }
      for (const earlier of state.invitations) {
        if (earlier.org_id === orgId && earlier.email === email && earlier.status === "pending") earlier.status = "revoked";
      }
      const token = `token-${id("invite")}-${"x".repeat(32)}`;
      const invitation: FakeInvitation = {
        id: id("invitation"), org_id: orgId, organisation: orgOf(request).name, email, role: body.role, invited_by: state.user.name, token, status: "pending",
        created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      };
      state.invitations.push(invitation);
      audit(request, "invitation.created", `Invited ${email} as ${ROLE_NAMES[body.role]}`, invitation.id);
      const { org_id: _org, organisation: _name, token: _token, status: _status, ...visible } = invitation;
      return HttpResponse.json({ ...visible, link: `/invite/${token}`, emailed: Boolean(state.mailConfigured) }, { status: 201 });
    }),
    http.delete(`${API}/api/organisation/invitations/:id`, async ({ request, params }) => {
      await record(request);
      const invitation = state.invitations.find((i) => i.id === params.id && i.org_id === orgOf(request).id && i.status === "pending");
      if (!invitation) return notFound("Invitation not found");
      invitation.status = "revoked";
      audit(request, "invitation.revoked", `Withdrew the invitation for ${invitation.email}`, invitation.id);
      return HttpResponse.json({ deleted: true });
    }),
    http.get(`${API}/api/organisation/activity`, async ({ request }) => {
      await record(request);
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const before = url.searchParams.get("before");
      const orgId = orgOf(request).id;
      const entries = state.activity
        .filter((a) => a.org_id === orgId && (before === null || a.id < Number(before)))
        .slice(0, limit)
        .map(({ org_id: _org, ...a }) => a);
      return HttpResponse.json(entries);
    }),
    /** Mirrors usage_summary in backend/routers/organisations.py. */
    http.get(`${API}/api/organisation/usage`, async ({ request }) => {
      await record(request);
      const requested = new URL(request.url).searchParams.get("month");
      const match = requested === null ? null : /^(\d{4})-(\d{1,2})$/.exec(requested);
      if (requested !== null && (!match || Number(match[2]) < 1 || Number(match[2]) > 12)) {
        return HttpResponse.json({ detail: "Give the month as YYYY-MM, for example 2026-09." }, { status: 422 });
      }
      const month = match ? `${match[1]}-${match[2]!.padStart(2, "0")}` : new Date().toISOString().slice(0, 7);
      return HttpResponse.json(usageSummary(state, orgOf(request).id, month));
    }),
    /** Mirrors set_budget in backend/routers/organisations.py, with BudgetUpdate's validation (backend/models.py). */
    http.put(`${API}/api/organisation/budget`, async ({ request }) => {
      const body = (await record(request)) as { monthly_ai_budget_usd?: unknown } | null;
      const invalid = (msg: string) => HttpResponse.json({ detail: [{ msg }] }, { status: 422 });
      if (!body || !("monthly_ai_budget_usd" in body)) return invalid("Field required");
      const amount = body.monthly_ai_budget_usd;
      if (amount !== null) {
        if (typeof amount !== "number" || !Number.isFinite(amount)) return invalid("Decimal input should be an integer or a valid decimal");
        if (amount < 0) return invalid("Input should be greater than or equal to 0");
        if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return invalid("Decimal input should have no more than 2 decimal places");
        if (amount >= 1e10) return invalid("Decimal input should have no more than 12 digits in total");
      }
      // Mirrors usage.ensure_budget_allowed: only a platform admin may go above the default (BUG-031).
      const ceiling = state.defaultBudget ?? 0;
      if (amount !== null && ceiling > 0 && amount > ceiling && state.user.role !== "admin") {
        return HttpResponse.json(
          { detail: `An organisation can set a monthly AI budget of up to ${usd(ceiling)}. A platform administrator can set a higher one.` },
          { status: 403 },
        );
      }
      const orgId = orgOf(request).id;
      state.budgets = { ...state.budgets, [orgId]: amount };
      audit(request, "organisation.budget_changed", amount === null ? "Removed the monthly AI budget" : `Set the monthly AI budget to ${usd(amount)}`);
      return HttpResponse.json({ monthly_ai_budget_usd: amount });
    }),
    http.get(`${API}/api/invitations/:token`, async ({ request, params }) => {
      await record(request);
      const invitation = state.invitations.find((i) => i.token === params.token && i.status === "pending");
      if (!invitation) {
        return notFound("This invitation has expired, was withdrawn or has been used. Ask for a new one.");
      }
      return HttpResponse.json({
        organisation: invitation.organisation, email: invitation.email, role: invitation.role, invited_by: invitation.invited_by,
        expires_at: invitation.expires_at, account_exists: state.adminUsers.some((u) => u.email === invitation.email),
      });
    }),
    http.post(`${API}/api/invitations/:token/accept`, async ({ request, params }) => {
      await record(request);
      const invitation = state.invitations.find((i) => i.token === params.token && i.status === "pending");
      if (!invitation) return notFound("This invitation has expired, was withdrawn or has been used. Ask for a new one.");
      if (invitation.email !== state.user.email) {
        return HttpResponse.json(
          { detail: `This invitation is for ${invitation.email}. Sign in with that email address to accept it.` },
          { status: 403 },
        );
      }
      invitation.status = "accepted";
      const membership = { id: invitation.org_id, name: invitation.organisation, role: invitation.role };
      state.user = { ...state.user, organisations: [...state.user.organisations.filter((o) => o.id !== membership.id), membership] };
      return HttpResponse.json(membership);
    }),
    http.post(`${API}/api/invitations/:token/register`, async ({ request, params }) => {
      const body = (await record(request)) as { name?: string; password: string };
      const invitation = state.invitations.find((i) => i.token === params.token && i.status === "pending");
      if (!invitation) return notFound("This invitation has expired, was withdrawn or has been used. Ask for a new one.");
      if ((body.password ?? "").length < 8) return HttpResponse.json({ detail: "Password must be at least 8 characters" }, { status: 400 });
      if (state.adminUsers.some((u) => u.email === invitation.email)) {
        return HttpResponse.json({ detail: "An account with this email already exists. Sign in to accept the invitation." }, { status: 409 });
      }
      invitation.status = "accepted";
      const created = { id: id("user"), name: (body.name ?? "").trim(), email: invitation.email, role: "user" as const, enabled: true, created_at: new Date().toISOString() };
      state.adminUsers.push(created);
      state.user = {
        id: created.id, email: created.email, name: created.name, role: "user",
        organisations: [{ id: invitation.org_id, name: invitation.organisation, role: invitation.role }],
      };
      return HttpResponse.json({ token: "token-invited", user: state.user });
    }),
    http.get(`${API}/api/auth/admin/users`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.adminUsers);
    }),
    http.post(`${API}/api/auth/admin/users`, async ({ request }) => {
      const body = (await record(request)) as { name: string; email: string };
      const created = { id: id("user"), name: body.name, email: body.email, role: "user" as const, enabled: true, created_at: new Date().toISOString() };
      state.adminUsers.push(created);
      return HttpResponse.json(created);
    }),
    http.patch(`${API}/api/auth/admin/users/:id`, async ({ request, params }) => {
      const body = (await record(request)) as Partial<FakeState["adminUsers"][number]>;
      const u = state.adminUsers.find((x) => x.id === params.id);
      if (!u) return notFound("User not found");
      Object.assign(u, body);
      return HttpResponse.json(u);
    }),
    /** Mirrors admin_delete_user in backend/routers/auth.py. */
    http.delete(`${API}/api/auth/admin/users/:id`, async ({ request, params }) => {
      await record(request);
      if (params.id === state.user.id) return HttpResponse.json({ detail: "Cannot delete your own account" }, { status: 400 });
      state.adminUsers = state.adminUsers.filter((u) => u.id !== params.id);
      return HttpResponse.json({ status: "deleted" });
    }),
    http.get(`${API}/api/auth/admin/registration`, async ({ request }) => {
      await record(request);
      return HttpResponse.json({ registration_enabled: state.registrationEnabled });
    }),
    http.put(`${API}/api/auth/admin/registration`, async ({ request }) => {
      const body = (await record(request)) as { registration_enabled: boolean };
      state.registrationEnabled = body.registration_enabled;
      return HttpResponse.json(body);
    }),
    http.get(`${API}/api/auth/admin/projects`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(state.projects.map((p) => ({ id: p.id, name: p.name, user_id: state.user.id, user_email: state.user.email, status: p.status, url: p.url })));
    }),
    http.post(`${API}/api/auth/admin/transfer-project`, async ({ request }) => {
      await record(request);
      return HttpResponse.json({ status: "transferred" });
    }),
  ];
}
