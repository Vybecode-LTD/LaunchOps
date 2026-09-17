import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { API } from "@/test/fakeApi";
import type { WorkspaceSettings } from "./types";
import {
  adminApi,
  authApi,
  brandsApi,
  calendarApi,
  capturesApi,
  emailApi,
  eventsApi,
  operationsApi,
  organisationApi,
  projectsApi,
  queueApi,
  settingsApi,
  templatesApi,
} from "./endpoints";

interface Sent {
  method: string;
  path: string;
  body: unknown;
  keepalive: boolean;
}

/** Answers every API call with an empty JSON object and records what was sent. */
function recordRequests(): Sent[] {
  const sent: Sent[] = [];
  server.use(
    http.all(`${API}/api/*`, async ({ request }) => {
      const url = new URL(request.url);
      const text = await request.text();
      sent.push({ method: request.method, path: `${url.pathname}${url.search}`, body: text ? JSON.parse(text) : null, keepalive: request.keepalive });
      return HttpResponse.json({});
    }),
  );
  return sent;
}

const url = "https://dsp.vybecod.example";
const settings: WorkspaceSettings = {
  platforms: { twitter: { connected: true, handle: "@north", mode: "manual" } },
  brand: { name: "Northstar", tagline: "", tone: "professional", keywords: [], avoid: [], elevator: "", company_name: "Northstar Ventures", logo_url: "" },
  prefs: { depth: "thorough", length: "medium", emoji: false, hashtags: "minimal", sources: true },
};

// The method, address and body of each call must match the route in backend/routers/*.py.
const calls: Array<{ action: string; call: () => Promise<unknown>; method: string; path: string; body?: unknown }> = [
  {
    action: "signing in",
    call: () => authApi.login("jordan@northstar.example", "correct-horse"),
    method: "POST",
    path: "/api/auth/login",
    body: { email: "jordan@northstar.example", password: "correct-horse" },
  },
  {
    action: "creating an account",
    call: () => authApi.register("Jordan Avery", "jordan@northstar.example", "correct-horse"),
    method: "POST",
    path: "/api/auth/register",
    body: { name: "Jordan Avery", email: "jordan@northstar.example", password: "correct-horse" },
  },
  { action: "loading the signed-in person", call: () => authApi.me(), method: "GET", path: "/api/auth/me" },

  { action: "listing people", call: () => adminApi.users(), method: "GET", path: "/api/auth/admin/users" },
  {
    action: "adding a person",
    call: () => adminApi.createUser({ name: "Sam Rivera", email: "sam@northstar.example", password: "long-enough" }),
    method: "POST",
    path: "/api/auth/admin/users",
    body: { name: "Sam Rivera", email: "sam@northstar.example", password: "long-enough" },
  },
  {
    action: "changing a person's role",
    call: () => adminApi.updateUser("user-2", { role: "admin" }),
    method: "PATCH",
    path: "/api/auth/admin/users/user-2",
    body: { role: "admin" },
  },
  {
    action: "disabling a person",
    call: () => adminApi.updateUser("user-2", { enabled: false }),
    method: "PATCH",
    path: "/api/auth/admin/users/user-2",
    body: { enabled: false },
  },
  { action: "deleting a person", call: () => adminApi.deleteUser("user-2"), method: "DELETE", path: "/api/auth/admin/users/user-2" },
  { action: "reading the sign-up setting", call: () => adminApi.registration(), method: "GET", path: "/api/auth/admin/registration" },
  {
    action: "closing sign-up",
    call: () => adminApi.setRegistration(false),
    method: "PUT",
    path: "/api/auth/admin/registration",
    body: { registration_enabled: false },
  },
  { action: "listing every account's projects", call: () => adminApi.projects(), method: "GET", path: "/api/auth/admin/projects" },
  {
    action: "transferring a project",
    call: () => adminApi.transferProject("project-1", "user-2"),
    method: "POST",
    path: "/api/auth/admin/transfer-project",
    body: { product_id: "project-1", target_user_id: "user-2" },
  },

  { action: "listing projects", call: () => projectsApi.list(), method: "GET", path: "/api/products" },
  { action: "loading a project", call: () => projectsApi.get("project-1"), method: "GET", path: "/api/products/project-1" },
  {
    action: "creating a project",
    call: () => projectsApi.create({ name: "Fieldnote", project_type: "service", launch_date: "2026-10-01" }),
    method: "POST",
    path: "/api/products",
    body: { name: "Fieldnote", project_type: "service", launch_date: "2026-10-01" },
  },
  {
    action: "updating a project",
    call: () => projectsApi.update("project-1", { status: "launched" }),
    method: "PATCH",
    path: "/api/products/project-1",
    body: { status: "launched" },
  },
  { action: "deleting a project", call: () => projectsApi.remove("project-1"), method: "DELETE", path: "/api/products/project-1" },
  {
    action: "saving a launch plan",
    call: () => projectsApi.updateChecklist("project-1", { domain: true, custom: ["Book the studio"] }),
    method: "PATCH",
    path: "/api/products/project-1/checklist",
    body: { domain: true, custom: ["Book the studio"] },
  },

  {
    action: "launching a workflow",
    call: () => operationsApi.launchWorkflow("project-1", "blog", "Aim at Ableton users"),
    method: "POST",
    path: "/api/workflows/launch",
    body: { product_id: "project-1", workflow_id: "blog", instructions: "Aim at Ableton users" },
  },
  {
    action: "generating a press kit",
    call: () => operationsApi.pressKit("project-1", url),
    method: "POST",
    path: "/api/presskit/generate",
    body: { product_id: "project-1", url },
  },
  {
    action: "generating a press release",
    call: () => operationsApi.pressRelease({ product_id: "project-1", url, media_contact_email: "press@northstar.example" }),
    method: "POST",
    path: "/api/press-release/generate",
    body: { product_id: "project-1", url, media_contact_email: "press@northstar.example" },
  },
  { action: "analysing SEO", call: () => operationsApi.seo("project-1", url), method: "POST", path: "/api/seo/analyze", body: { product_id: "project-1", url } },
  {
    action: "analysing pricing",
    call: () => operationsApi.pricing("project-1", "Target 70% margin"),
    method: "POST",
    path: "/api/pricing/analyze",
    body: { product_id: "project-1", notes: "Target 70% margin" },
  },
  {
    action: "running a market analysis",
    call: () => operationsApi.marketAnalysis("project-1", "$29/mo"),
    method: "POST",
    path: "/api/market-analysis",
    body: { product_id: "project-1", custom_pricing: "$29/mo" },
  },
  {
    action: "repurposing content",
    call: () => operationsApi.repurpose("project-1", "We launched", ["twitter", "linkedin"]),
    method: "POST",
    path: "/api/repurpose",
    body: { product_id: "project-1", content: "We launched", platforms: ["twitter", "linkedin"] },
  },

  { action: "listing review results", call: () => queueApi.list(), method: "GET", path: "/api/queue" },
  {
    action: "listing a project's pending results",
    call: () => queueApi.list({ product_id: "project-1", status: "pending", limit: 500 }),
    method: "GET",
    path: "/api/queue?product_id=project-1&status=pending&limit=500",
  },
  { action: "loading a review result", call: () => queueApi.get("queue-1"), method: "GET", path: "/api/queue/queue-1" },
  {
    action: "approving a result",
    call: () => queueApi.review("queue-1", "approved"),
    method: "PATCH",
    path: "/api/queue/queue-1",
    body: { status: "approved", notes: "" },
  },
  {
    action: "rejecting a result with a note",
    call: () => queueApi.review("queue-1", "rejected", "Too salesy"),
    method: "PATCH",
    path: "/api/queue/queue-1",
    body: { status: "rejected", notes: "Too salesy" },
  },
  { action: "deleting a result", call: () => queueApi.remove("queue-1"), method: "DELETE", path: "/api/queue/queue-1" },
  { action: "cancelling an operation", call: () => queueApi.cancel("queue-1"), method: "POST", path: "/api/queue/queue-1/cancel" },

  { action: "reading this month's AI usage", call: () => organisationApi.usage(), method: "GET", path: "/api/organisation/usage" },
  { action: "reading a month's AI usage", call: () => organisationApi.usage("2026-08"), method: "GET", path: "/api/organisation/usage?month=2026-08" },
  {
    action: "setting the monthly AI budget",
    call: () => organisationApi.setBudget(49.99),
    method: "PUT",
    path: "/api/organisation/budget",
    body: { monthly_ai_budget_usd: 49.99 },
  },
  {
    action: "removing the monthly AI budget",
    call: () => organisationApi.setBudget(null),
    method: "PUT",
    path: "/api/organisation/budget",
    body: { monthly_ai_budget_usd: null },
  },

  { action: "listing a project's emails", call: () => emailApi.list({ product_id: "project-1" }), method: "GET", path: "/api/email-queue?product_id=project-1" },
  {
    action: "editing an email draft",
    call: () => emailApi.update("email-1", { subject: "Quick question" }),
    method: "PATCH",
    path: "/api/email-queue/email-1",
    body: { subject: "Quick question" },
  },
  { action: "sending an email", call: () => emailApi.send("email-1"), method: "POST", path: "/api/email-queue/email-1/send" },
  { action: "reading the daily email quota", call: () => emailApi.quota(), method: "GET", path: "/api/email-queue/quota" },
  { action: "deleting an email", call: () => emailApi.remove("email-1"), method: "DELETE", path: "/api/email-queue/email-1" },

  { action: "listing templates", call: () => templatesApi.list(), method: "GET", path: "/api/templates" },
  {
    action: "listing templates for a workflow",
    call: () => templatesApi.forWorkflow("cold_outreach"),
    method: "GET",
    path: "/api/templates/for-workflow/cold_outreach",
  },
  {
    action: "saving a template",
    call: () => templatesApi.create({ name: "Intro email", type: "email", tags: ["outreach"], content: "Keep it short." }),
    method: "POST",
    path: "/api/templates",
    body: { name: "Intro email", type: "email", tags: ["outreach"], content: "Keep it short." },
  },
  { action: "deleting a template", call: () => templatesApi.remove("template-1"), method: "DELETE", path: "/api/templates/template-1" },

  { action: "listing ideas", call: () => capturesApi.list(), method: "GET", path: "/api/captures" },
  {
    action: "capturing an idea",
    call: () => capturesApi.create("Testimonial clips", "project-1"),
    method: "POST",
    path: "/api/captures",
    body: { text: "Testimonial clips", product_id: "project-1" },
  },
  { action: "deleting an idea", call: () => capturesApi.remove("capture-1"), method: "DELETE", path: "/api/captures/capture-1" },

  { action: "listing calendar entries", call: () => calendarApi.list(), method: "GET", path: "/api/calendar" },
  {
    action: "adding a calendar entry",
    call: () => calendarApi.create({ date: "2026-10-01", title: "Launch thread", product_id: "project-1", platform: "twitter" }),
    method: "POST",
    path: "/api/calendar",
    body: { date: "2026-10-01", title: "Launch thread", product_id: "project-1", platform: "twitter" },
  },
  {
    action: "moving a calendar entry",
    call: () => calendarApi.update("event-1", { date: "2026-10-02" }),
    method: "PATCH",
    path: "/api/calendar/event-1",
    body: { date: "2026-10-02" },
  },
  { action: "deleting a calendar entry", call: () => calendarApi.remove("event-1"), method: "DELETE", path: "/api/calendar/event-1" },

  { action: "loading settings", call: () => settingsApi.get(), method: "GET", path: "/api/settings" },
  { action: "saving settings", call: () => settingsApi.save(settings), method: "PUT", path: "/api/settings", body: settings },

  { action: "listing companies", call: () => brandsApi.list(), method: "GET", path: "/api/brands" },
  {
    action: "creating a company",
    call: () => brandsApi.create({ name: "VybeCod.ing Ltd", founder_name: "Alex Morgan" }),
    method: "POST",
    path: "/api/brands",
    body: { name: "VybeCod.ing Ltd", founder_name: "Alex Morgan" },
  },
  {
    action: "updating a company",
    call: () => brandsApi.update("brand-1", { industry: "Audio software" }),
    method: "PATCH",
    path: "/api/brands/brand-1",
    body: { industry: "Audio software" },
  },
  { action: "deleting a company", call: () => brandsApi.remove("brand-1"), method: "DELETE", path: "/api/brands/brand-1" },
];

describe("API endpoints", () => {
  it.each(calls)("$action sends $method $path", async ({ call, method, path, body }) => {
    const sent = recordRequests();
    await call();
    expect(sent.map(({ keepalive: _keepalive, ...rest }) => rest)).toEqual([{ method, path, body: body ?? null }]);
  });

  it("opens the live updates stream at GET /api/events", async () => {
    let path = "";
    server.use(
      http.get(`${API}/api/events`, ({ request }) => {
        path = new URL(request.url).pathname;
        return new HttpResponse("retry: 5000\n\n", { headers: { "Content-Type": "text/event-stream" } });
      }),
    );
    const body = await eventsApi.open(new AbortController().signal);
    expect(await new Response(body).text()).toBe("retry: 5000\n\n");
    expect(path).toBe("/api/events");
  });

  it("leaves empty filters out of list addresses", async () => {
    const sent = recordRequests();
    await queueApi.list({ product_id: "", status: undefined });
    await emailApi.list({ product_id: "project-1", status: "" });
    expect(sent.map((s) => s.path)).toEqual(["/api/queue", "/api/email-queue?product_id=project-1"]);
  });

  it("asks the browser to deliver undoable deletes even while the page closes, but only when told to", async () => {
    const sent = recordRequests();
    await Promise.all([
      queueApi.remove("queue-1", true),
      emailApi.remove("email-1", true),
      templatesApi.remove("template-1", true),
      capturesApi.remove("capture-1", true),
      calendarApi.remove("event-1", true),
    ]);
    expect(sent).toHaveLength(5);
    expect(sent.every((s) => s.method === "DELETE" && s.keepalive)).toBe(true);

    await templatesApi.remove("template-2");
    expect(sent.at(-1)).toMatchObject({ path: "/api/templates/template-2", keepalive: false });
  });
});
