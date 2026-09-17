import { describe, expect, it } from "vitest";
import { OPERATIONS } from "@/lib/domain/operations";
import type { OrgRole } from "@/lib/api/types";
import { API, BACKEND_WORKFLOW_TAGS, RESEARCH_SOURCES, handlers, makeProject, makeState, type FakeState, type FakeUsageRow } from "./fakeApi";
import { stateAs } from "./roles";
import { server } from "./server";

describe("backend contract mirrored by the fake API", () => {
  it("saves workflow templates with the same tags the backend matches them on", () => {
    // BACKEND_WORKFLOW_TAGS copies backend/routers/extras.py; update both if either changes.
    const catalogue = Object.fromEntries(OPERATIONS.filter((op) => op.kind === "workflow").map((op) => [op.id, op.templateTags]));
    expect(catalogue).toEqual(BACKEND_WORKFLOW_TAGS);
  });
});

/** Send a request to the fake as the signed-in app would. */
async function call(state: FakeState, method: string, path: string, body?: unknown) {
  server.use(...handlers(state));
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: "Bearer token-1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const thisMonth = new Date().toISOString().slice(0, 7);

function usage(overrides: Partial<FakeUsageRow>): FakeUsageRow {
  return {
    org_id: "org-1",
    created_at: new Date().toISOString(),
    user_id: "user-1",
    product_id: null,
    operation: "competitor",
    model: "claude-sonnet-5",
    input_tokens: 1000,
    output_tokens: 500,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    web_search_requests: 0,
    cost_usd: 1,
    ...overrides,
  };
}

describe("fake API: roles for cancelling, usage and the budget", () => {
  it.each<[string, string, OrgRole, unknown]>([
    ["POST", "/api/queue/queue-1/cancel", "viewer", undefined],
    ["GET", "/api/organisation/usage", "approver", undefined],
    ["PUT", "/api/organisation/budget", "approver", { monthly_ai_budget_usd: 10 }],
  ])("refuses %s %s for a %s", async (method, path, role, body) => {
    const { status, json } = await call(stateAs(role), method, path, body);
    expect(status).toBe(403);
    expect(json.detail).toMatch(/^You need the (Editor|Owner) role in Northstar Ventures to do this\./);
  });
});

describe("fake API: sources", () => {
  it("ends only the web research reports' results with sources, last", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const researching = ["/api/press-release/generate", "/api/pricing/analyze", "/api/market-analysis"];
    for (const path of [...researching, "/api/presskit/generate", "/api/seo/analyze"]) {
      const { json } = await call(state, "POST", path, { product_id: project.id, url: "https://dsp.vybecod.example" });
      if (researching.includes(path)) {
        expect(json.sources, path).toEqual(RESEARCH_SOURCES);
        expect(Object.keys(json).at(-1), path).toBe("sources");
      } else {
        expect(json, path).not.toHaveProperty("sources");
      }
    }
    // Every source is a page with a title and a web address; the search doesn't always date it.
    expect(RESEARCH_SOURCES.every((source) => source.title && /^https:\/\//.test(source.url))).toBe(true);
    expect(RESEARCH_SOURCES.some((source) => source.page_age === null)).toBe(true);
  });
});

describe("fake API: email sending limit", () => {
  it("refuses every send when the server's daily limit is 0, as the backend does", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example" } });
    const state = makeState({
      projects: [project],
      smtpPasswords: { [project.id]: "secret" },
      emailDailyLimit: 0,
      emails: [
        {
          id: "email-1", product_id: project.id, source_queue_id: null, recipient_name: "", recipient_email: "dana@synthweekly.example",
          subject: "Hello", body: "Hi", status: "pending", error: "", sent_at: null, created_at: new Date().toISOString(),
        },
      ],
    });

    expect(await call(state, "GET", "/api/email-queue/quota")).toEqual({ status: 200, json: { limit: 0, sent: 0, remaining: 0, next_available_at: null } });
    expect(await call(state, "POST", "/api/email-queue/email-1/send")).toEqual({
      status: 429,
      json: { detail: "Sending email is switched off on this server: its daily limit is 0. Ask the administrator to raise MAX_EMAILS_PER_DAY." },
    });
    expect(state.emails[0]?.status).toBe("pending");
  });
});

describe("fake API: usage and budget", () => {
  it("summarises a UTC month, most expensive first, labelling what no longer exists", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const state = makeState({
      projects: [project],
      budgets: { "org-1": 25 },
      aiUsage: [
        usage({ product_id: project.id, cost_usd: 2.5, web_search_requests: 3 }),
        usage({ product_id: "project-gone", operation: "press_kit", user_id: "user-gone", cost_usd: 4 }),
        usage({ operation: "press_kit", model: "claude-unknown", cost_usd: null }),
        usage({ created_at: "2026-01-15T10:00:00+00:00", cost_usd: 100 }),
        usage({ org_id: "org-2", cost_usd: 100 }),
      ],
    });

    const { status, json } = await call(state, "GET", "/api/organisation/usage");

    expect(status).toBe(200);
    expect(json).toMatchObject({ month: thisMonth, budget_usd: 25, total: { cost_usd: 6.5, calls: 3, unpriced_calls: 1, web_search_requests: 3 } });
    expect((json.by_operation as Array<{ key: string; cost_usd: number; calls: number }>).map((row) => [row.key, row.cost_usd, row.calls])).toEqual([
      ["press_kit", 4, 2],
      ["competitor", 2.5, 1],
    ]);
    expect((json.by_project as Array<{ key: string; label: string }>).map((row) => [row.key, row.label])).toEqual([
      ["project-gone", "A deleted project"],
      [project.id, "Fieldnote"],
      ["", "A deleted project"],
    ]);
    expect((json.by_member as Array<{ label: string }>).map((row) => row.label)).toEqual(["A deleted account", "jordan@northstar.example"]);
    expect((await call(state, "GET", "/api/organisation/usage?month=2026-1")).json.total).toMatchObject({ cost_usd: 100 });
    expect((await call(state, "GET", "/api/organisation/usage?month=2026-13")).json).toEqual({ detail: "Give the month as YYYY-MM, for example 2026-09." });
  });

  it("validates the budget as the backend's model does, and logs changes", async () => {
    const state = makeState();
    const invalid = async (body: unknown) => (await call(state, "PUT", "/api/organisation/budget", body)).json.detail;

    expect(await invalid({})).toEqual([{ msg: "Field required" }]);
    expect(await invalid({ monthly_ai_budget_usd: -1 })).toEqual([{ msg: "Input should be greater than or equal to 0" }]);
    expect(await invalid({ monthly_ai_budget_usd: 1.234 })).toEqual([{ msg: "Decimal input should have no more than 2 decimal places" }]);
    expect(await invalid({ monthly_ai_budget_usd: 1e10 })).toEqual([{ msg: "Decimal input should have no more than 12 digits in total" }]);
    expect(await invalid({ monthly_ai_budget_usd: "fifty" })).toEqual([{ msg: "Decimal input should be an integer or a valid decimal" }]);

    expect((await call(state, "PUT", "/api/organisation/budget", { monthly_ai_budget_usd: 1234.5 })).json).toEqual({ monthly_ai_budget_usd: 1234.5 });
    expect((await call(state, "PUT", "/api/organisation/budget", { monthly_ai_budget_usd: null })).json).toEqual({ monthly_ai_budget_usd: null });
    expect(state.activity.map((entry) => [entry.action, entry.summary])).toEqual([
      ["organisation.budget_changed", "Removed the monthly AI budget"],
      ["organisation.budget_changed", "Set the monthly AI budget to $1,234.50"],
    ]);
  });

  it("stops AI operations once this month's cost reaches the budget", async () => {
    const project = makeProject();
    const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const state = makeState({ projects: [project], budgets: { "org-1": 5 }, aiUsage: [usage({ cost_usd: 4.99 })] });

    expect((await call(state, "POST", "/api/pricing/analyze", { product_id: project.id, notes: "" })).status).toBe(200);
    state.aiUsage!.push(usage({ cost_usd: 0.01 }));
    const refused = await call(state, "POST", "/api/workflows/launch", { product_id: project.id, workflow_id: "blog", instructions: "" });
    expect(refused).toEqual({
      status: 429,
      json: { detail: `Northstar Ventures has used its AI budget for ${month} ($5.00). An owner can raise it in Settings → Usage.` },
    });
    expect(state.queue).toEqual([]);
  });
});
