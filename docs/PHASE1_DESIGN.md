# Phase 1 — Foundation: design and decisions

**Status:** complete (2026-09-16 to 2026-09-17), except D15 and D16, which moved to Phase 2 follow-up · **Plan:** `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` §6, Phase 1
**Exit criteria (from the plan):** two organisations with three ventures each, members with different roles,
jobs surviving a restart, AI cost visible per organisation.

The plan's section 8 lists decisions for the owner. Until they're made, this phase follows the plan's
recommended defaults. Every decision below says which default it follows or why it departs from it, and
each can be reversed.

---

## Decisions

| # | Decision | Choice | Basis |
|---|---|---|---|
| D1 | What an organisation and a workspace are | **Organisation = the corporate partner** (or a founder's own organisation). **Workspace = a venture = a project** (today's `products` table, called "project" in the interface). No parent organisations yet. | Plan decision 2, recommended default. The table keeps its name: renaming it would churn every API path and screen for no user-visible gain. |
| D2 | Roles | Four roles on an organisation membership, each including the one below: **Viewer** (read everything) → **Editor** (create and edit projects, run operations, edit drafts, calendar, library, brand voice, channels) → **Approver** (approve or reject results, send email, delete results and drafts) → **Owner** (members and invitations, organisation settings, usage and budget, delete projects, activity log). | Roles named in the plan (§2 E). A single ladder keeps every check to one comparison. Separate permissions can replace it later. |
| D3 | Platform administration | `users.role = 'admin'` stays the **platform** operator role (all accounts, registration switch). It grants no access to an organisation's data by itself. | Keeps the operator's powers where they are today, and keeps tenants' data behind membership. |
| D4 | Choosing the organisation for a request | The client sends `X-Org-Id`. Without it, the user's first organisation (owner memberships first) applies. A resource in an organisation the user isn't a member of answers **404**, and a role that's too low answers **403**. | Existing routes keep their paths; the interface adds an organisation switcher. A 404 doesn't confirm that another tenant's resource exists. |
| D5 | Settings | Channels, brand voice, output preferences and white-label settings move from per user to **per organisation**. Theme stays in the browser. | A team sharing a venture needs one voice and one set of channels. |
| D6 | Existing data | Migration `0003` gives every existing user their own organisation, with them as owner, and moves their projects, results, drafts, calendar, ideas, templates, company profiles and settings into it. Rows with no user (from before multi-tenancy) keep no organisation and stay invisible, as they are today. | Plan: "each existing user becomes an org owner". |
| D7 | Sessions | Access tokens (JWT) last **15 minutes**. A rotating **refresh token** (random, stored hashed, 30 days) lives in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`, and is `Secure` over https. Reusing a rotated token revokes that whole family of tokens. Signing out, changing or resetting a password, and disabling an account revoke refresh tokens. | Plan §4: "JWT access (15 min) + refresh (rotating)". The cookie keeps the long-lived credential away from page scripts. |
| D8 | Email the platform sends (password resets, invitations) | A **platform mailer** configured by `APP_URL` and `MAIL_*` environment variables (any SMTP relay, including Resend or Postmark SMTP). Without it, owners copy invitation links, and **platform admins** create one-time reset links. Organisation owners can't: a person can belong to several organisations, so an owner who could reset a member's password could reach that member's other organisations. | Plan decision 3 recommends a platform sender. SMTP relays avoid tying the code to one provider. |
| D9 | Background jobs | A **durable job queue in PostgreSQL** (`jobs` table, `FOR UPDATE SKIP LOCKED`, leases with heartbeats, retries with backoff, cancellation, time limits). The worker runs inside the web process by default, or on its own (`python -m worker`, for example as a second Railway service from the same image). **Departs from the plan's "arq on Redis":** Postgres already gives durability, transactional enqueueing and locking, so Redis would add a service, a cost and a failure mode without adding a capability at this scale. Revisit if job volume outgrows it. | Exit criterion "jobs surviving a restart". |
| D10 | Live updates | `GET /api/events`: a Server-Sent Events stream per organisation (job progress, results, Outbox changes), fed by PostgreSQL `LISTEN/NOTIFY`, so a separate worker's events reach every web process. The browser reads it with `fetch` so the bearer token stays in a header. Polling remains the fallback. | Plan §4: "SSE for job/queue updates". |
| D11 | AI results | Every operation gets a **Pydantic result model** (`backend/services/results.py`), validated before it's stored.<br><br>**Operations without web search** use structured outputs (`output_config.format`).<br><br>**Operations with web search** end with a **strict `submit_result` tool** whose input schema is the result model. Web search always cites its sources, and the API can't combine citations with a response format. If the research ends without a submission, Claude is asked for it once in the same conversation. An answer cut off at the token limit isn't used and isn't retried.<br><br>**Sources:** web research results end with the sources they rely on. Only pages the operation's searches actually returned are kept, stored as the search returned them (title, URL, page age).<br><br>**Schemas** keep every field required, with no unions or limits (a test checks this). **Stored results** keep the keys they always had.<br><br>`_parse_json_response` is removed. The interface still shows the unstructured text of results stored before this change. | Plan §4: "structured outputs via tool-use schemas". |
| D12 | Usage and cost | A **usage ledger** row for every Claude API call. Each row records the organisation, user, project and operation, the model, input, output and cache tokens, web searches, the request id, and an estimated cost. The cost comes from Anthropic's published prices: per token by model, plus $10 per 1,000 web searches. An optional **monthly budget per organisation** is checked before an operation starts. | Plan decision 5: "Budget per org configurable"; exit criterion "cost visible per org". |
| D13 | Prompt caching | The system prompt goes in three parts, most stable first:<br>1. The operation's instructions, cached and shared by every project.<br>2. The brand context, cached and shared by every run on a project.<br>3. This run's material and today's date, never cached.<br><br>Web-research requests also use automatic caching, so each `pause_turn` resume and the follow-up for a missing result read the turn so far from the cache. Prompts shorter than the model's cache minimum (1,024 tokens on Sonnet 5, 512 on Opus 5) aren't cached, and the API doesn't charge for trying. | Plan §4: prompt caching on the brand kernel. |
| D14 | Activity log | An `audit_log` of governed actions: approvals and rejections, sends, deletions, role and membership changes, invitations, settings changes, project transfers. Owners can read it. | Plan §3 pillar 4 and §2 E. |
| D15 | Brand kernel | One versioned brand and company object per workspace, merging `brands`, `products.company_details` and the organisation's brand voice.<br><br>**Moved to Phase 2 follow-up (2026-09-16), as this row allowed if the phase ran long.** Four reasons:<br>- Phase 1's exit criteria are met without it.<br>- It changes where people edit brand details on three screens (Companies, project settings, Voice & AI), which belongs with Phase 2's report surfaces.<br>- It needs decisions from the owner first:<br>  - Does a project's brand override the organisation's voice field by field, or as a whole?<br>  - Which role may edit it?<br>  - Should each result record the brand version it used?<br>- D13 already caches today's brand context, which is the cost saving the plan tied to the kernel. | Plan Phase 1. |
| D16 | Result history | **Not built in this phase.** The plan's data model lists a versioned `results` table. For now, workflow results stay on their review items, and each report keeps its latest version on the project (a failed run never overwrites it). The table and a report history move to Phase 2 follow-up with the brand kernel (D15), since both belong with the report surfaces. | Plan Phase 1 data model. |

---

## Order of work

Each step is a vertical slice (migration, API, interface, tests) that leaves the app working.

1. **Organisations, memberships and roles** (D1–D6): migration `0003`, a membership dependency on every route, role checks, the organisation switcher, role-aware controls, members list.
2. **Invitations and member management** (D2, D8): invite by email or link, accept (including registering through an invitation while registration is closed), change roles, remove members; last-owner protection.
3. **Activity log** (D14).
4. **Sessions** (D7) and **password reset** (D8): refresh tokens, silent refresh in the client, forgot-password and reset pages, admin reset links.
5. **Durable jobs and live updates** (D9, D10): jobs table and worker, retry, cancel and time limits, `/api/events`, live Review and Outbox, a cancel control.
6. **Structured results, usage ledger, budgets and prompt caching** (D11–D13), with a Usage screen per organisation.
7. **Brand kernel** (D15): moved to Phase 2 follow-up (see D15).

## Testing

- Every migration: upgrade and downgrade on scratch databases, and upgrade from the Phase 0 schema with data in it (as `tests/test_migrations.py` does).
- A tenancy suite with two organisations and a member of each role, checking every route for 404 across organisations and 403 below the required role.
- Jobs: a worker killed mid-job (lease expiry) resumes; retries stop at the limit; cancellation; time limits.
- The frontend fake API (`frontend/src/test/fakeApi.ts`) follows each contract change, with component and browser tests for the new screens.
