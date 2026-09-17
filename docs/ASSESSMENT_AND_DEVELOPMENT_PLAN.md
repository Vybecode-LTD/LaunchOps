# LaunchOps — Assessment & Development Plan

**Date:** 2026-09-14 · **Scope:** full read of every source file at commit `97a0706` · **Target:** enterprise-grade launch-operations platform for corporate partners running portfolios of startups · **Future home:** `launchops.run`

---

## Progress (updated 2026-09-17)

All of this work is on `main`: merged from pull request #1 (merge commit `24eff91`) on 2026-09-17, after CI passed.

One later fix is not on `main` yet. Reconciling the documentation at session end turned up an
intermittent failure in the refresh-token tests, and behind it a real defect: `POST /api/auth/refresh`
decided whether a refresh token was a replay by comparing the application's clock with a `used_at`
timestamp PostgreSQL had written. In production the app and the database are separate services, so a
few seconds of clock skew could let a stolen, already-rotated token through instead of revoking the
whole token family. The database now makes the comparison itself
(`r.used_at < NOW() - $2::interval AS reused`), and a test that monkeypatches the application clock
five seconds slow — failing against the old code, passing against the fix — holds it in place. It is
BUG-027 in `docs/BUGS.md`. It is committed on the local branch `fix/refresh-token-clock-skew`
(`35d24c5`), which is not pushed and not merged, so the fix is not yet in production.

| Phase | Status |
|---|---|
| 0 — Stabilise | Complete. |
| 1 — Foundation | Complete, except the brand kernel and a result history, which moved to Phase 2 follow-up (`docs/PHASE1_DESIGN.md`, D15 and D16). |
| 2 — Interface rebuild | Complete, including the parts that waited for Phase 1: organisation settings, live updates and sources. Billing settings wait for a billing decision. |
| 3 — Real actions | Not started. |

### Phase 1 — Foundation: complete

`docs/PHASE1_DESIGN.md` records each decision and why. Phase 1 follows the plan's recommended defaults, with two departures: jobs run on PostgreSQL rather than arq and Redis (D9), and only platform admins create password reset links (D8).

| Area | What exists now |
|---|---|
| Organisations and roles | **Roles:** members are Viewers, Editors, Approvers or Owners, and each role includes the ones before it.<br>**Ownership:** projects, results, the Outbox, the calendar, the library, company profiles and settings belong to the organisation.<br>**Access:** another organisation's things answer 404; a role that's too low answers 403 and names the role needed.<br>**Interface:** an organisation switcher, and every control follows the member's role. |
| Members | Invitations by email or link. People accept, or register through an invitation even while registration is closed. Owners change roles and remove members; members can leave. An organisation always keeps an owner. |
| Activity log | Records approvals and rejections, sends, deletions and cancellations, plus changes to members, invitations, settings and the budget. Owners read it in Settings → Activity. |
| Sessions | 15-minute access tokens, and refresh tokens that rotate in an HttpOnly cookie. Reusing a replaced refresh token ends that session. Forgot-password and reset pages; platform admins can also create one-time reset links. |
| Jobs | Durable jobs in PostgreSQL, run inside the web process or by `python -m worker`. A job survives restarts. It's retried when a retry might help (after 30 s, then 2 min; 3 attempts). It can be cancelled, and it stops after 15 minutes per attempt. |
| Live updates | `GET /api/events` streams changes to results and the Outbox, so Review, the Outbox and the activity list update straight away. While the stream is connected, polling slows to every 30 s. |
| AI layer | Uses the official SDK.<br>**Results:** every operation returns a structured result, validated before it's stored.<br>**Sources:** web research ends with a strict submit tool and lists only sources its searches returned.<br>**Caching and resuming:** the stable parts of each prompt are cached, and paused research resumes.<br>**Models:** Sonnet 5 by default; market analysis and pricing use Opus 5. |
| Usage and cost | Every API call is recorded with an estimated cost for its tokens and web searches. Settings → Usage shows a month by operation, project, member and model. An optional monthly budget stops new operations once it's reached. |

Exit criteria:

| Criterion | Evidence |
|---|---|
| Two organisations with three ventures each, members with different roles | `backend/tests/test_organisations.py` checks every route for every role, and from another organisation. Also `test_tenancy.py` and `frontend/src/test/app.roles.*.test.tsx`. |
| Jobs surviving a restart | `backend/tests/test_jobs.py`: a job whose worker stopped runs again when its lease runs out; a stopping worker hands unfinished jobs back; queued operations wait for the worker across a restart. |
| Cost visible per organisation | `backend/tests/test_usage.py` (month totals, breakdowns, budgets) and `frontend/src/test/app.usage.test.tsx`. |

### Phase 0 — Stabilise: complete

| Finding | Status |
|---|---|
| F-1 settings clobber | Fixed. Settings belong to the organisation, and migration `0002` removes the empty settings rows the old startup script added. |
| F-2 SMTP password exposure | Fixed: never returned, and encrypted at rest with `FIELD_ENCRYPTION_KEY`. |
| F-3 approve sends email | Fixed. Approving only creates drafts. Sending is explicit and limited per account in any 24 hours (`MAX_EMAILS_PER_DAY`; 0 switches sending off). |
| F-4, F-7b, F-12, F-13 | Fixed by the rebuild. |
| F-5 brand create with founders | Fixed. |
| F-6 SSRF in the scraper | Fixed: public addresses only, checked on every redirect and pinned for the connection; HTML only; 2 MB cap. |
| F-7 secrets and hardening | Fixed:<br>- the app refuses a weak `JWT_SECRET` and logs no secrets<br>- API docs are served only in debug mode<br>- responses carry security headers<br>- sign-in, registration, password resets and AI operations are rate limited |
| F-8 competitor preview | Fixed. |
| F-9 in-process jobs | Fixed by durable jobs (Phase 1). |
| F-10 AI timeouts | Fixed. Every request streams, paused research resumes, and a whole call stops after 10 minutes with a readable error. |
| F-11 calendar UTC day | Fixed. |
| F-14 retired `press_targets` | Done. Old results show as retired; the one remaining reference lets approving them still create drafts. |
| F-15, F-16, F-17 | Fixed. |
| F-18 duplicate deploy files | Fixed: `backend/Dockerfile` and `backend/railway.toml` are deleted. |
| Schema changes | Alembic migrations in hand-written SQL, applied at startup. The old startup script is gone. |

Also found and fixed during Phases 0 and 1, each with a regression test:
- **Email over SMTP:**
  - STARTTLS without certificate checks
  - a crash on header values containing line breaks
  - unchecked recipients
  - connections left open after a failure
- **Database helpers:** they converted ids and ISO-looking text into dates and times in text columns.
- **Default model:** `claude-sonnet-4-20250514` reached end of life on 15 June 2026. The default is now `claude-sonnet-5`.
- **Sign-in:** the app signed people out when the server answered 5xx at startup.
- **Zero email limit:** it said "You've sent 0 emails"; it now says sending is switched off.
- **Approvals:** approving an outreach result left its Outbox drafts to a task run after the response, so a restart at that moment lost them. The drafts are now created before the approval is answered.
- **First account:** the first account created becomes the platform admin, so on a new public deployment whoever signed up first took control. With `ADMIN_EMAIL` set, only that address can create the first account.
- **Screen readers:**
  - the navigation rail ran link names and counts together ("Review1 awaiting review")
  - the press release form's three contact groups repeated fields named only "Name" and "Email"

Found and fixed earlier, during the rebuild:
- Creating a calendar event failed on its date type.
- Saving platform settings returned 500.
- A transferred project kept reading its previous owner's brand.
- Malformed ids returned 500 instead of 404, and editing an unknown admin user returned 500.
- AI failures on report endpoints returned a bare 500.
- `.gitignore`'s Python `lib/` rule silently excluded `frontend/src/lib` from git.
- Operation names lowercased acronyms ("Run seo metadata").
- Launch plan ticks could show late or drop a quick second tick.
- Scraped pages sent their inline JavaScript and CSS to the AI as page text.

### Phase 2 — Interface rebuild: complete

The single-file `App.jsx` is gone. The frontend is now TypeScript on:
- React 19
- React Router 7 (deep links for every screen)
- TanStack Query
- Radix primitives
- a token-based design system with light and dark themes (`docs/DESIGN_SYSTEM.md`)

Every module reached parity or better, and each screen's actions do exactly what their labels say.

| Screen | What it does now |
|---|---|
| Portfolio | Summary strip, launch board (filter, search, sort by attention), needs attention, next 14 days. |
| Project | Overview, Operations catalogue with a run sheet that states each operation's contract, Reports as documents with sources and export (print/PDF, Markdown, AI prompt), Review, Outbox, Launch plan, Settings. |
| Review | Cross-project queue with status filters, J/K navigation, approve/reject/run again/export/save as template, cancel running operations, undoable delete. Updates live. |
| Outbox | Email drafts: edit, bulk select, send only after a confirmation listing recipients and sender. Updates live. |
| Calendar | Month and week views. Drag an entry or a launch to another day (with Undo), or edit entries and launch dates from the agenda without a mouse. |
| Library | Templates and ideas. |
| Settings | General and white-label, voice and AI, company profiles, channels, organisation, activity, usage and budget, team and access. |
| Sign-in and invitations | Sign in, forgot and reset password, accept an invitation or register through one. |
| Shell | Left rail with an organisation switcher, command palette (Ctrl/⌘K), capture, an activity indicator that flags operations running over 60 minutes as possibly stuck, responsive navigation. |

Exit criteria:

| Criterion | Status |
|---|---|
| Old `App.jsx` deleted | Done. |
| Playwright covers the golden path per screen | Done: 12 main-task tests and 3 smoke tests against the production build, sharing one fake of the backend contract with the component tests. |
| Accessibility (plan said Lighthouse ≥ 90) | Replaced by a stricter gate: axe-core WCAG 2.2 A/AA scans of 27 screens in both themes, with zero violations required. |
| Design canvas signed off before code | Skipped. The working build and screenshots are the review surface; sign-off is still needed (decision 6). |

### Quality gates today

| Gate | Status |
|---|---|
| Backend lint (ruff) | Passing; CI runs it. |
| Backend tests | 550 passed; 98.3% coverage of application code (gate 95%). |
| Frontend lint and type check | Passing: ESLint with zero warnings, strict TypeScript. |
| Frontend tests (Vitest) | 601 passed in 49 files; 99.2% line coverage (gate 95%). |
| Browser tests (Playwright) | 69 passed: 3 smoke, 12 golden path, and axe WCAG 2.2 A/AA scans of 27 screens in both themes. |
| Dependency and secret scans | Checked 2026-09-16: pip-audit found no known vulnerabilities, and npm's advisory service found none in the 614 installed package versions. CI also runs `npm audit` and gitleaks; gitleaks hasn't run on the development machine. |

### Next

1. Decisions for the owner:
   - section 8
   - the brand kernel questions in `docs/PHASE1_DESIGN.md` D15
   - whether organisation owners should also be able to create reset links (D8)
2. Finish the deployment. It's live on Railway (2026-09-17): project "Launch Ops" has `launchops` (built from `main` of `Vybecode-LTD/LaunchOps`, deploying every push; the worker runs inside it) and `Postgres`, and answers at https://launchops-production-0457.up.railway.app. `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `APP_URL`, `ADMIN_EMAIL` and `ANTHROPIC_API_KEY` are set.

   **Live smoke test (2026-09-17):** `generate_result` was run against the real API with the deployment's key, and all three calls returned valid results (about $0.10 in total):
   - a non-research operation on Sonnet 5 (response format)
   - a research operation on Sonnet 5: 3 web searches, the strict submit tool, 6 verified sources, cache reads
   - a non-research operation on Opus 5, with the server-side fallback beta

   launchops.run is the custom domain and is **live over HTTPS**: the certificate was issued 2026-09-17 16:51 UTC and is valid to
   2026-12-16. Re-adding the domain to clear a stalled first attempt gave it a new CNAME target, `xesm2hmr.up.railway.app`, and
   Spaceship still points at the old `5rlc9k25.up.railway.app` (traffic and the certificate work; `docs/ROADMAP.md` T-3).

   Still to do (the full list, with IDs, is `docs/ROADMAP.md` → Active, T-1 to T-8):
   - delete the account `guard-check@example.com` and "Guard check's organisation", created on the live site by a sign-up probe
     after the admin account already existed (T-1), and confirm who holds the admin account and whether registration stays open (T-2)
   - consider turning on Wait for CI in the service's source settings, so only commits that pass CI deploy
   - optionally set the `MAIL_*` settings, turn on database backups, and delete the detached empty volume `postgres-volume-qVKY`
3. Phase 2 follow-up: brand kernel (D15), result history (D16), billing settings.
4. Phase 3: real actions.

---

## 0. Executive summary

LaunchOps is a working **single-operator prototype**: 51 commits, ~4,900 lines of hand-written code, 11 AI-driven modules, JWT auth with admin panel, multi-tenant row isolation, a Tauri desktop shell and a Docker/Railway deploy path. The idea is strong and the AI prompts are already thoughtfully written (real names, real URLs, no placeholders).

It is **not yet a product a corporate partner can be handed**. Four things stand between today's code and that goal:

| # | Gap | Severity |
|---|-----|----------|
| 1 | **Six correctness/security defects** that would surface within the first hour of a partner demo — including one cross-tenant data-clobbering bug and one "approve → auto-email real people with a canned message" behaviour. | Critical |
| 2 | **Zero automated tests**, no migrations, no job runner, no observability. Every change is a gamble. | Critical |
| 3 | **Several features are promised in the UI but not real** (platform "Auto-post", Quick-Capture "expansion", SEO CMS OAuth). Partners who read "operates exactly as described" will find these. | High |
| 4 | **No organisation model.** Corporates need *Org → Workspace (per startup) → Members with roles*, plus SSO, audit log, cost showback, exports. Today there is only `user` + `admin`. | High |

The recommended path is **not a rewrite**. The backend design (FastAPI + Postgres + queue-first AI) is right; it needs hardening and an org layer. The frontend (`App.jsx`, 2,217 lines, inline styles, no router) should be **rebuilt on a real design system** — that is where the "seriously high-end interface" lives, and it can't be retro-fitted into one file.

**Estimated effort to a partner-demo-ready v2:** ~12 weeks in five phases (one senior engineer working with Claude Code; see §6). Phase 0 (stabilise) is one week and should happen regardless.

---

## 1. What exists today — honest module inventory

Status legend: ✅ works as described · 🟡 works with caveats · 🔴 broken · ⚪ cosmetic only (UI exists, nothing behind it)

| Module | Status | Notes |
|---|---|---|
| Auth (register/login/JWT, admin panel) | 🟡 | Works. No password reset, no email verification, no MFA/SSO, 72 h tokens in `localStorage`, no revocation. |
| Multi-tenant isolation (`user_id` on all tables) | 🟡 | Products/queue/templates/captures/calendar are isolated. **Settings are not** (see F-1). |
| Multi-brand (brands table, assign to project) | 🔴 | Creating a brand with any founder entry fails silently (F-5). Brand form loses focus every keystroke (F-6). |
| 12 AI workflows → approval queue | 🟡 | Solid pattern. Runs in-process (`BackgroundTasks`) — lost on redeploy, no retry, no timeout, stuck at "running" forever (F-9). Competitor preview text always wrong (F-8). |
| Approval queue (approve/reject/delete/expand/export) | 🟡 | Rich rendering. Approving outreach/partnership items **auto-sends emails** to every address found in the content (F-3). |
| Email actions queue + SMTP per project | 🟡 | Works. SMTP passwords stored plaintext and **returned to the browser on every product fetch** (F-2). |
| Press Kit | 🟡 | Generates. "Regenerate" button is a no-op (F-4). |
| Press Release (with web-searched distribution list) | ✅ | Best module in the app. |
| Cross-platform Repurposer | 🔴 | Button throws `settings is not defined` on every click (F-7). Results never persisted. |
| Pricing Advisor | ✅ | Persists to product. Single slot — re-run overwrites history. |
| Market Analysis (6-section report) | ✅ | Good output. 8 k tokens + web search regularly exceeds the 120 s HTTP timeout (F-10). |
| SEO Optimizer | 🟡 | Analyses & generates head block. "CMS OAuth" mode is a placeholder. |
| Launch Checklist | ✅ | Static 33-item list + custom items. Not connected to calendar or queue. |
| Content Calendar | 🟡 | Manual events only, 14-day window, UTC date bug (F-11). Not connected to approved content. |
| Quick Capture | ⚪ | Stores a line of text. The promised "queued for later expansion" does not exist; no delete in UI. |
| Template Library | 🟡 | Save/copy/delete. "Load into workflow" pastes text into the instructions box. |
| Platform connections (Connect / Auto / Manual) | ⚪ | **Pure UI.** No OAuth, no posting. Label says "AI posts after approval" — it never does. |
| White-label (company name, logo) | ✅ | Per-user header branding. Not per-organisation. |
| Command Center "Pending" stat | 🔴 | Hard-coded `0` (`App.jsx:438`). |
| Tauri desktop app | 🟡 | Thin webview onto the hosted URL. Config + CSP still point at `launchops.vybecod.ing`; must change to `launchops.run`. |
| Tests / CI | 🔴 | **0 test files.** `test-pipeline.yml` is an untracked generic template that would fail on this repo. |
| Docs | 🔴 | `CLAUDE.md`, `SOURCE_MAP.md`, `SETUP_PROMPT.md` describe Supabase, a ~900-line App.jsx, and 13 workflows — all stale. No `docs/` folder existed before this file. |

---

## 2. Findings

### A. Critical — data integrity & security (fix before anyone else logs in)

**F-1 · Settings save clobbers every user's settings.**
`database.py:279` drops `settings_pkey` but leaves `id INTEGER DEFAULT 1`. Every per-user settings row inserted at `auth.py:43` therefore gets `id = 1`. `extras.py:224` then saves with `UPDATE settings SET … WHERE id = 1` — which updates **all** rows. User A saving their brand voice overwrites User B's platforms, brand and prefs. `auth.py:20/279` read "the" settings row by `id = 1` and get an arbitrary user's row.
*Fix:* `id UUID` PK, `user_id` unique, move `registration_enabled` to a real `app_config` table. Regression test: two users, one saves, assert the other is untouched.

**F-2 · SMTP passwords stored plaintext and shipped to the browser.**
`email_settings` JSONB holds `smtp_password`; `GET /api/products` returns it verbatim, and `App.jsx:1516` renders it into a password field. Any XSS, browser extension or shoulder-surf leaks mail credentials.
*Fix:* encrypt at rest (Fernet with a `FIELD_KEY` env var), never return it (`***` marker), write-only endpoint.

**F-3 · "Approve" silently sends email to strangers.**
`queue.py:60-70`: approving a `cold_outreach`, `partnerships` or `announcement` item extracts **every email address anywhere in the JSON** (`services/email.py:14`) and, if SMTP is configured, sends immediately. Partnerships and announcements get a generic canned body ("I'd love to explore a potential partnership…"). A partner approving a research item could email a dozen real companies with boilerplate under their brand.
*Fix:* approval ≠ send. Email drafts land in an *Outbox* with per-recipient checkboxes, editable subject/body, an explicit "Send N emails" confirmation, and a daily cap (`max_emails_per_day` exists in config and is unused).

**F-4 · Press Kit "Regenerate" does nothing.**
`App.jsx:884` PATCHes `{press_kit: null}`, but `ProductUpdate` (`models.py:91`) has no `press_kit` field, so Pydantic drops it and only `updated_at` changes. The button appears to work and nothing happens.

**F-5 · Creating a brand with founders fails silently.**
The brand form sends a `founders` array (`App.jsx:1695`); `POST /api/brands` passes the raw dict into `insert("brands", data)` → `column "founders" does not exist` → 500. The error is written to `adminError`, which is only rendered on the Admin tab, so the user sees nothing. The update path deletes `founders` (line 1732) — the create path doesn't.
*Also:* `brands` create/patch accept **arbitrary dict keys that are interpolated as SQL column names** (`database.py:116,157`). asyncpg's extended protocol blocks multi-statement injection, but this must be a whitelisted Pydantic model, not `data: dict`.

**F-6 · SSRF in the scraper.** `scraper.py:124` fetches any URL — including `http://169.254.169.254/`, `*.railway.internal`, localhost. *Fix:* scheme allow-list, resolve DNS and reject private/link-local ranges, size and redirect caps.

**F-7 · Secrets & hardening.** `main.py:46` logs the first 4 chars of `JWT_SECRET` at WARNING on every boot; defaults are `"change-me-in-production"` with no startup guard. CORS `*` + `allow_credentials=True`. `/docs` and `/openapi.json` are public. No rate limiting anywhere (`max_concurrent_tasks` unused) — one user can drain the Anthropic budget. No HSTS/CSP on the web app.

### B. Functional bugs (user-visible)

| ID | Where | What |
|---|---|---|
| F-7b | `App.jsx:684` | Repurposer references `settings`, which is not in `ProductDash` scope → every click fails with "settings is not defined". |
| F-8 | `workflows.py:167` vs `claude.py:216` | Competitor preview reads `competitor_name`/`threat_level` at top level; prompt returns `competitors[]`. Preview always says "Analysis of competitor — threat level ?/10". |
| F-9 | `workflows.py:224` | `BackgroundTasks` run in the web process. Redeploy/restart = job lost, queue row stuck at `running` forever. No timeout, no retry, no reaper. |
| F-10 | `claude.py:66` | 120 s httpx timeout; market analysis (8,192 tokens + web search) routinely exceeds it. No handling of `pause_turn` for server-side web search, no retry on 429/529. |
| F-11 | `App.jsx:358,377` | Calendar keys days by `toISOString()` (UTC) → wrong day after ~7–8 pm US time. |
| F-12 | `App.jsx:438` | Command Center "Pending" stat is a literal `0`. |
| F-13 | `App.jsx:1642` | `BrandForm` is defined inside render → new component identity every render → **inputs lose focus after each keystroke**. |
| F-14 | `queue.py:14`, `workflows.py:169`, `extras.py:43` | `press_targets` workflow was removed but is still referenced in three places. |
| F-15 | `main.py:153` | SPA catch-all returns `None` for unknown `/api/*` → HTTP 200 with `null` body instead of 404. |
| F-16 | `claude.py:184` | `project_type` is read from the product but never stored; it's smuggled into `description` as `[PRODUCT] …`. |
| F-17 | `.claude/launch.json` | Dev-server paths point at `D:/Development/LaunchOps` (repo is at `C:/DEV/LaunchOps`). |
| F-18 | Repo root | Two Dockerfiles and two `railway.toml`; `backend/` copies are dead. |

### C. Promised but not real

- **Platform "Connect / Auto"** — no OAuth, no posting API, no scheduling. The toggle text says "AI posts after approval".
- **Quick Capture "queued for later expansion"** — nothing expands it.
- **SEO "CMS OAuth"** — placeholder radio.
- **Template "Load into workflow"** — copies text into a textarea.
- **"Semi-autonomous marketing operations platform"** (`main.py:3`) — nothing is autonomous; every action is human-triggered, which is actually the correct posture for corporates, but the copy over-promises.

### D. Architecture & engineering quality

- **Frontend:** one 2,217-line file, 100 % inline styles, no router (no URLs, no deep links, browser back button breaks), no TypeScript, no lint, no error boundaries, `confirm()` dialogs, emoji as icons, Google Fonts imported and then overridden with Arial (`App.jsx:2178-2179`), `max-width: 1000px`, no responsive layout, polling every 4 s per open tab only.
- **Backend:** no migration tool (schema is a startup script that swallows errors statement-by-statement); hand-rolled query builder; `datetime.utcnow()` (deprecated); `anthropic` SDK installed but raw httpx used; model pinned to `claude-sonnet-4-20250514` (two generations old); JSON asked for in prose and repaired with heuristics rather than enforced via tool-use/structured output; exceptions in workflows swallowed into `content.error` with no logging; no request IDs, no Sentry, no metrics.
- **Data model:** results (pricing, market, SEO, press) are single JSONB slots on `products` — no history, no versioning, no diff. Repurposer results aren't stored at all.
- **Ops:** health check exists; no readiness distinction; no backups documented; no staging environment.

### E. Enterprise / go-to-market gaps

| Need (corporate partner with N startups) | Today |
|---|---|
| Organisation → Workspaces (one per venture) → Members with roles (Owner / Editor / Approver / Viewer) | `user` + global `admin`; "transfer project" is the only collaboration |
| SSO (SAML/OIDC), MFA, password reset, session management | none |
| Audit log (who approved/sent/changed what, when) | none |
| Per-org AI usage & cost showback, budgets, rate limits | none (no token accounting at all) |
| Portfolio view across ventures (readiness, activity, spend) | none — product grid only |
| Board-grade exports (PDF/DOCX, white-labelled per org) | copy / .txt / .md |
| Notifications (email/Slack when a job finishes or needs approval) | none |
| Public API + webhooks | none |
| Data retention / deletion / export (GDPR) | delete project only |
| Uptime/SLA posture, status page, backups | none documented |

---

## 3. What makes v2 *unique* — the product thesis

"AI marketing generator" is a crowded category. The pitch to corporate partners should not be *content generation*; it should be **launch operations with governance** — the thing a portfolio owner actually lacks. Seven pillars, each mapping to a concrete capability:

1. **Portfolio Command** — one screen across every venture: Launch Readiness Index (computed, not a checkbox %), days-to-launch, pending approvals, AI spend, last activity. Sortable, filterable, exportable. *Nobody in this category has this because nobody else is multi-venture-first.*
2. **Evidence-grade intelligence** — every competitor, price, podcast, subreddit and directory carries a **source URL, retrieval date and confidence**. Reports become citable in a board deck. Enforced via structured outputs and a `Source` schema, rendered as footnotes.
3. **Brand Kernel** — one canonical brand/company object per venture (voice, facts, people, boilerplate, legal name, assets) that every generation reads from and that a reviewer can lock. Changes propagate; drift is impossible.
4. **Governed actions, not autonomous ones** — the approval queue becomes an **Outbox**: every outbound action (email, social post, directory submission) is a discrete, editable, individually-consented item with an audit trail. This is the feature that makes a corporate legal team say yes.
5. **Campaign Playbooks** — chain workflows into a launch campaign with dependencies and dates (e.g. *Market Analysis → Pricing → Press Kit → Press Release → Outreach list → Social calendar*), run as a job graph with approval gates. Checklist, calendar and queue become three views of the same plan.
6. **Living Launch Plan** — the checklist is generated per venture type and stage, items link to the module that completes them, and completing a module ticks the item. The calendar is populated from approved content with real scheduling.
7. **Board-ready output** — one-click white-labelled PDF/DOCX: Market Analysis report, Launch Plan, Weekly Portfolio Digest. Corporates share PDFs, not app links.

Everything else (repurposer, SEO, templates, captures) stays but becomes a *tool inside* these pillars rather than a top-level tab.

---

## 4. Target architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Web (React 18 · TypeScript · Vite · React Router · TanStack Query) │
│  Design system: tokens → primitives (Radix UI) → components         │
│  Realtime: SSE for job/queue updates                                │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ REST + SSE (OpenAPI, versioned /api/v1)
┌──────────────────────────────┴─────────────────────────────────────┐
│  API  · FastAPI · Pydantic v2 · SQLAlchemy 2 async · Alembic        │
│  Auth · JWT access (15 min) + refresh (rotating) · OIDC/SAML later   │
│  Tenancy · org_id on every row · RLS-style query guards · roles     │
│  Modules · ventures · brand · intelligence · content · outbox ·     │
│            playbooks · calendar · reports · admin · billing-meter   │
└───────────┬───────────────────────────────┬────────────────────────┘
            │                               │
┌───────────┴────────────┐     ┌────────────┴────────────────────────┐
│ Postgres (Railway)      │     │ Worker (arq / Celery on Redis)      │
│ orgs, workspaces,       │     │ • AI jobs w/ retry, timeout, cancel │
│ members, jobs, results  │     │ • structured outputs (tool schema)  │
│ (versioned), outbox,    │     │ • web-search pause_turn handling    │
│ audit_log, usage_ledger │     │ • email/social senders, PDF render  │
└─────────────────────────┘     └─────────────────────────────────────┘
```

Key technical decisions (each reversible, each justified):

| Decision | Why |
|---|---|
| Keep FastAPI + Postgres on Railway | Already works; team knows it. Add **Redis + worker service** (Railway supports both). |
| SQLAlchemy 2 + Alembic instead of hand-rolled SQL | Migrations become reviewable, reversible, testable. The current `SETUP_SQL` is the source of F-1. |
| Official `anthropic` SDK, **structured outputs via tool-use schemas** | Removes `_parse_json_response` heuristics entirely; every module gets a Pydantic result model that is validated, versioned and rendered from a type. |
| Current-generation model (Sonnet 5 default, Opus 5 for Market Analysis), prompt caching on the brand kernel | Better output, lower cost; the brand context is identical across calls and cache-friendly. |
| Usage ledger (input/output tokens × price per call, per org/workspace/user/module) | Cost showback is a corporate requirement and a demo differentiator. |
| Frontend rebuild in TypeScript with a token-based design system | The "high-end interface" cannot be achieved inside a single inline-styled file. CSS Modules + CSS variables (no Tailwind, keeping the project's "no CSS framework" convention) + Radix primitives for accessible menus/dialogs/tabs. |
| SSE for live updates | Kills the 4 s polling; jobs/queue/outbox update instantly across tabs. |
| Playwright E2E + Vitest + pytest with the CLAUDE.md coverage gates | The constitution already mandates it; nothing exists. |

---

## 5. Interface direction

The current UI is a competent dark "hacker console" (neon cyan on near-black, mono labels, emoji). That reads as indie, not enterprise. Direction for v2:

- **Two-theme, light-first** design system with a deep-graphite dark mode — partners will screenshot this into decks.
- **App shell:** persistent left rail (Portfolio · Ventures · Outbox · Calendar · Reports · Settings), venture switcher in the header, command palette (⌘K) for "run X on Y".
- **Type:** a distinctive display face for headings and numbers, a highly legible workhorse for body, tabular numerals everywhere data lines up. Kill Arial-override.
- **Information design over decoration:** status encoded as pills/stripes, severity colours separate from the accent, sparklines on the portfolio table, skeleton loaders, real empty states with a next action, inline validation, undoable destructive actions (no `confirm()`).
- **Report surfaces** (Market Analysis, Press Release) get a document layout with a sticky section nav, footnoted sources, and Export → PDF.
- **Per-org white-label:** logo, accent, org name, custom domain later — set once at the org level, not per user.
- **Accessibility:** keyboard-complete, focus-visible, WCAG AA contrast in both themes, `prefers-reduced-motion`.

A clickable design canvas of the four key screens (Portfolio, Venture Overview, Outbox, Market Analysis report) should be produced and signed off **before** Phase 2 code starts.

---

## 6. Phased development plan

Assumes one senior engineer + Claude Code, full-time. Each phase ends with a demoable increment and the CLAUDE.md quality gates green.

### Phase 0 — Stabilise (Week 1)
Ship a build you'd let a partner touch.
- Fix F-1 → F-18. Each fix lands with a failing-then-passing test.
- Bootstrap testing: `pytest` + `httpx` TestClient against a throwaway Postgres (testcontainers); Vitest + RTL; a tracked CI workflow that actually runs them. Target: 60 % line coverage on backend, smoke coverage on frontend.
- Alembic baseline migration reproducing the current schema; delete `SETUP_SQL` startup mutation.
- Startup guards: refuse to boot with default secrets; remove secret logging; lock `/docs` behind auth in production; basic per-user rate limit (slowapi).
- Outbox behaviour: approval no longer sends; explicit send with per-recipient consent and daily cap.
- Docs reset: `CLAUDE.md`, `SOURCE_MAP.md`, `docs/HANDOFF.md`, `docs/TESTING.md`, `docs/BUGS.md` reflect reality. Remove dead Dockerfile/railway.toml; fix `launch.json`; point Tauri config at `launchops.run`.
- **Exit criteria:** all findings closed with tests; CI green; app boots from a clean database via migrations.

### Phase 1 — Foundation (Weeks 2–3)
- Data model: `organisations`, `workspaces` (ventures), `memberships` (roles), `jobs`, `results` (versioned, per module), `outbox_items`, `audit_log`, `usage_ledger`. Migration path from today's `user_id`-only rows (each existing user becomes an org owner).
- Auth: refresh tokens, password reset by email, invite flow (org owner invites members), role guards on every route.
- Worker service (arq on Redis) with retry/timeout/cancel; SSE endpoint for job + outbox updates; reaper for orphaned jobs.
- AI layer rewrite: official SDK, structured outputs per module, prompt caching for the brand kernel, `pause_turn` handling, usage ledger on every call, model routing (Sonnet 5 default / Opus 5 for deep reports).
- Brand Kernel: merge `brands` + `company_details` + `settings.brand` into one versioned object per workspace.
- **Exit criteria:** two orgs with three ventures each, members with different roles, jobs surviving a restart, cost visible per org.

### Phase 2 — Interface rebuild (Weeks 4–6)
- Design system: tokens (colour, type, space, radius, elevation), both themes, primitives, docs page.
- App shell, routing, command palette, notifications.
- Screens: Portfolio Command, Venture Overview, Intelligence (Market / Competitor / Pricing / Trends as one workspace with report layout + sources), Content (Repurposer / Social / Blog / Ads), PR (Press Kit / Release), Outbox, Calendar (month + week, drag-to-reschedule), Launch Plan, Settings (org / workspace / members / brand / billing).
- Every module reaches feature parity with today, rendered from typed result models.
- **Exit criteria:** old `App.jsx` deleted; Playwright covers the golden path per screen; Lighthouse ≥ 90 accessibility.

### Phase 3 — Real actions (Weeks 7–9)
- Email: transactional provider (Resend/Postmark) with per-org verified sending domains, or per-workspace SMTP kept but encrypted; open/reply tracking; templates.
- Social: X and LinkedIn OAuth + posting via official APIs, scheduled from the calendar through the Outbox. (Instagram/TikTok/Threads stay "copy & post" with a clear label — no false promises.)
- Exports: server-side PDF (Playwright/Chromium) and DOCX for reports and the launch plan, white-labelled per org.
- Notifications: email + Slack webhook on job complete / approval needed / send failed.
- **Exit criteria:** a venture can go from "Market Analysis" to "press release emailed to 10 journalists and a LinkedIn post scheduled" with every step in the audit log.

### Phase 4 — Differentiators (Weeks 10–12)
- Launch Readiness Index (weighted from plan completion, brand kernel completeness, assets, intelligence freshness).
- Campaign Playbooks: job graph with dependencies, dates and approval gates; three shipped playbooks (Product launch, Service launch, Persona launch).
- Living Launch Plan: generated per venture type; module completion ticks items; calendar auto-populated from approved content.
- Weekly Portfolio Digest (PDF + email) per org.
- Evidence layer polish: source freshness badges, "re-verify" action, confidence display.
- **Exit criteria:** partner demo script runs end-to-end in under 15 minutes with no manual workarounds.

### Phase 5 — Enterprise hardening (ongoing after v2)
SSO (OIDC first, SAML second), MFA, audit-log export, data retention & export/delete per org, public API + webhooks + API keys, staging environment, backups & restore drill, status page, security review (bandit, pip-audit, npm audit, dependency pinning, secret scanning in CI), pen-test before the first paid partner.

---

## 7. Quality gates (from CLAUDE.md, applied)

- Every bug fix: failing test first. Every new file: test file alongside.
- Coverage: PR ≥ 85 % line, deploy ≥ 95 %, auth/outbox/tenancy ≥ 95 %.
- CI: ruff + mypy + pytest + Vitest + ESLint (zero warnings) + Playwright on PR; bandit/pip-audit/npm audit/gitleaks nightly; Railway "wait for CI".
- Docs updated at the point of change; `perform handoff` at every session end.

---

## 8. Decisions needed

1. **Frontend rebuild confirmation** — TypeScript + CSS-variables design system + Radix, retiring `App.jsx`. (Recommended: yes.)
2. **Org model semantics** — is a "corporate partner" one org with many ventures, or does each startup get its own org under a partner umbrella? (Recommended: Org = partner, Workspace = venture; add a `parent_org` later only if a startup needs to leave the umbrella.)
3. **Email posture** — per-workspace SMTP (today) vs. platform sender with verified domains. (Recommended: platform sender; SMTP as an advanced option.)
4. **Social scope for v2** — X + LinkedIn only via official APIs; everything else stays copy-and-post with honest labelling. (Recommended.)
5. **Models** — Sonnet 5 default, Opus 5 for Market Analysis / Pricing. Budget per org configurable.
6. **Design sign-off** — produce the four-screen design canvas before Phase 2; who signs it off?
7. **Domain & deploy** — `launchops.run` on Railway with separate `api`, `worker`, `redis`, `postgres` services and a staging environment.

---

## Appendix A — Finding index

| ID | File:line | Class |
|---|---|---|
| F-1 | `backend/database.py:279`, `backend/routers/extras.py:224`, `backend/routers/auth.py:20,43,279` | Critical / tenancy |
| F-2 | `backend/models.py:71-79`, `backend/routers/products.py:26`, `frontend/src/App.jsx:1516` | Critical / security |
| F-3 | `backend/routers/queue.py:59-70,117-137`, `backend/services/email.py:14-66` | Critical / trust |
| F-4 | `frontend/src/App.jsx:884`, `backend/models.py:91-100` | Bug |
| F-5 | `frontend/src/App.jsx:1691-1704`, `backend/routers/extras.py:244-249`, `backend/database.py:108-122` | Bug + injection surface |
| F-6 | `backend/services/scraper.py:124-156` | Security / SSRF |
| F-7 | `backend/main.py:46,70-77,97`, `backend/config.py:14,25` | Security / hardening |
| F-7b | `frontend/src/App.jsx:684` | Bug |
| F-8 | `backend/routers/workflows.py:167`, `backend/services/claude.py:216-220` | Bug |
| F-9 | `backend/routers/workflows.py:224-231` | Architecture |
| F-10 | `backend/services/claude.py:66-73` | Reliability |
| F-11 | `frontend/src/App.jsx:358,377` | Bug |
| F-12 | `frontend/src/App.jsx:438` | Bug |
| F-13 | `frontend/src/App.jsx:1642` | UX bug |
| F-14 | `backend/routers/queue.py:14`, `backend/routers/workflows.py:169`, `backend/routers/extras.py:41` | Dead code |
| F-15 | `backend/main.py:150-153` | Minor |
| F-16 | `backend/services/claude.py:184`, `frontend/src/App.jsx:1942` | Data model |
| F-17 | `.claude/launch.json` | Config |
| F-18 | `backend/Dockerfile`, `backend/railway.toml` | Config |
| — | `src-tauri/tauri.conf.json:7,22` | Points at old domain; change to `launchops.run` |
