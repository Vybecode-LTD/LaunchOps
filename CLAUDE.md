---
document: CLAUDE
version: 1.1.4
last-updated: 2026-09-18T06:39:21Z
last-audit: 2026-09-18T06:35:00Z
managed-by: session-orchestrator/memory-updater
---

# CLAUDE.md — VybeCod.ing Launch Ops

## What This Project Is

VybeCod.ing Launch Ops is a **multi-product launch operations platform**. It uses Claude AI to automate marketing, outreach, SEO, content generation and launch coordination across many software products at once. It was built for the owner of VybeCod.ing, who runs many products at the same time without a marketing team. **AI output flows through human review.** Nothing goes out unless a person acts on it.

| | |
|---|---|
| **Positioning** | Being prepared for corporate partners who run portfolios of startups (multi-venture first). |
| **Production domain** | https://launchops.run — **live over HTTPS** since 2026-09-17 (certificate issued 16:51 UTC, valid to 2026-12-16). The app also answers at https://launchops-production-0457.up.railway.app. See [Deployment & CI](#deployment--ci). |
| **Tasks, milestones, blocked-on-owner items** | `docs/ROADMAP.md` |
| **Findings, phased plan, phase status** | `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`, section "Progress" |
| **Bugs** | `docs/BUGS.md` |
| **Session handoff** (read it at session start) | `docs/HANDOFF.md` |
| **Changelog / audit log** | `docs/CHANGELOG.md` — what each version of the documentation set changed, newest first; the top entry is where things stand (1.1.4: pull request #5 merged and deployed; pull request #6 open, with the launch playbook screen, BUG-032's fix, the owner's decisions of 2026-09-18 and both automated reviews' fixes; a fifth audit) / `docs/AUDIT-LOG.md` — the reconciliation audits, newest first |
| **Phase 1 decisions (D1–D16)** | `docs/PHASE1_DESIGN.md` |
| **Design system** | `docs/DESIGN_SYSTEM.md` |
| **Testing** | `docs/TESTING.md`: frameworks, how to run, inventory, coverage |
| **File-by-file map / session prompt** | `SOURCE_MAP.md` / `SETUP_PROMPT.md` |

---

## Current State

- **Phase:** Phases 0 (stabilise), 1 (foundation) and 2 (interface rebuild) are complete (milestones M0–M2 in `docs/ROADMAP.md`), and the app is live in production. **Phase 3 (real actions) is next and not started.** Two Phase 1 items moved to Phase 2 follow-up: the brand kernel (D15) and a versioned result history (D16). The guided launch playbook on the Operations screen — the owner's product choice of 2026-09-17, which pulls part of M4 (Phase 4's Campaign Playbooks) forward — is on pull request #6, not merged.
- **Last completed task:** **pull request #5, merged and deployed.** Branch `fix/spend-cap-and-mobile-overflow` merged into `main` as `477eaa4` at 2026-09-18T04:43:03Z — a merge commit, not a squash — after all three CI jobs passed on its last commit, `ce12024` (the 1.1.3 documentation). Production serves `477eaa4`'s build, checked from the live site rather than the Railway dashboard (see [Deployment & CI](#deployment--ci)). So BUG-028 to BUG-031 are fixed on `main` and in production — the default AI budget and its ceiling (BUG-028, BUG-031), the screens that scrolled sideways on a phone (BUG-029) and the empty competitor columns (BUG-030) — along with the playbook domain module. Every organisation without a budget of its own is now held to the $25 platform default, which its owner can lower or clear, and only a platform admin can set a budget above it: a cap on each organisation, not on the total (B-14). T-9's second half, checking Settings → Usage on the live site signed in as an Owner, was not done — the assistant cannot sign in — and moves to T-10. With the owner's go-ahead, pull request #5's review threads were answered on GitHub on 2026-09-18: 9 of its 12 are resolved, and the last 3, CodeRabbit's on `ce12024` (all on documents), are answered by this 1.1.4 documentation and get their replies once it is pushed. Earlier work — Phases 0 to 2 and pull requests #1 to #4 — is recorded in `docs/ROADMAP.md` → Milestones and `docs/CHANGELOG.md`.
- **Active task:** **pull request #6, open and not merged** (https://github.com/Vybecode-LTD/LaunchOps/pull/6) — branch `feat/playbook-ui`, based on `main` at `477eaa4`. Its commits, oldest first:
  - `53456fc` opens the Operations screen on the guided launch playbook
  - `08705de` lets owners lower any budget (BUG-032) and stops promising that an administrator will raise one (B-15)
  - `4af499c` answers Codex's review: a stage that becomes current opens, a launch date that has passed no longer reads "launch is -3 days away", and completion counts every result (`GET /api/queue/summary`)
  - `b607021` answers CodeRabbit's review: a budget is checked and written under one row lock, and Settings → Usage promises no raise an owner can't make

  **The last code commit on pull request #6 is `b607021`**; this 1.1.4 documentation is committed on top of it. In brief: the Operations screen opens on the playbook — "Next up", the five stages, "Always available" — with "All operations" (`?view=all`) keeping the catalogue, and it advises and never blocks a run, by the owner's decision of 2026-09-18 ([Architecture](#architecture) → the launch playbook); a new route, `GET /api/queue/summary?product_id=…`, counts a project's results per operation and status over every result, for the playbook to read instead of the newest 500 results; and the budget rule changes as set out under [Key behaviours](#key-behaviours) → Usage and budgets. CI passed all three jobs on `08705de`, and again on `b607021` (green by 2026-09-18T05:57:07Z); the documentation commit on top of it gets its own run, read with `gh pr checks 6`. The merge waits until all three are green on the pull request's latest commit, and uses a **merge commit, not a squash**, so the `.gitleaksignore` fingerprints still resolve. The automated review of #6 (Codex and CodeRabbit, on `08705de`) is fixed in `4af499c` and `b607021`, but none of its threads is answered on GitHub yet: posting on #6 waits for the owner's go-ahead. **Nothing on pull request #6 is on `main` or in production.** Merging it is T-10.
- **Next** (priority order; full list in `docs/ROADMAP.md` → Active):
  - **T-10 (P1):** merge pull request #6 once all three CI jobs are green on its latest commit (`gh pr checks 6`), with a merge commit. Then check the live site **signed in as an Owner — never by registering a probe account**: the Operations screen opens on the playbook with a "Next up" card, and, in an organisation with no budget of its own, Settings → Usage shows the $25 platform default (T-9's unfinished check). The merge also takes BUG-032's fix to production.
  - **T-1 (owner):** delete the stray account `guard-check@example.com` and "Guard check's organisation" (Settings → Team & access): a sign-up probe created it on the live site.
  - **T-4 (owner), at session end:** rotate the Railway project token. This is the owner's settled practice: `railway login` will not authorise on this machine, so the owner pastes a project token into the session and rotates it at the end of every session; the one in use now is owed that rotation. Never write a token value into a file, a document or a commit message: CI runs gitleaks over the full git history.
  - optional (T-5 to T-8): turn on Wait for CI in the `launchops` service's source settings, turn on database backups, delete the leftover volume `postgres-volume-qVKY`, set `MAIL_*`
  - owner decisions still open (B-1 to B-12): plan section 8; the brand kernel questions in D15; whether organisation owners should also create reset links (D8); billing (B-12)
  - product work (`docs/ROADMAP.md` → Next up): cost and duration per operation; the Portfolio launch board as cards on a phone (LIM-003); the project tab bar on a phone (LIM-004)
  - Phase 2 follow-ups: brand kernel, result history, billing settings
  - Phase 3: real actions
- **Open bugs:** none open in the registry, but one fix is not on `main` yet: **BUG-032 (LOW) is fixed on pull request #6's branch (`08705de`) and stays live on `main` and in production until #6 merges and deploys.** It arrived with pull request #5's merge (it came in with `a53b26e`): an owner who isn't a platform admin cannot lower a budget stored above the default to an amount still above it — $500 to $400, say — only to the default or below, or clear it. It fails safe: it can refuse a decrease, but never allows a budget the rule forbids. `docs/BUGS.md` records 32 bugs, all fixed; BUG-001 to BUG-031 are on `main` and in production. Every fix landed with a test that failed first except BUG-023's, a `.gitignore` change verified by a tracking check instead. Four known limitations, LIM-001 to LIM-004; the new one, LIM-004, is the project tab bar on a phone, which scrolls with its scrollbar hidden, so Outbox, Launch plan and Settings can be reached only by swiping, with no cue. Remaining findings and phase status are in `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`.
- **Doc version:** 1.1.4 — this is the `version:` in this file's frontmatter, not a separate number. All seven managed documents carry that one shared version and are raised together.

**Tests (2026-09-18, measured on branch `feat/playbook-ui` at `b607021`, one suite at a time)**

| Suite | Result | Coverage |
|---|---|---|
| Backend pytest | 570 passed | 98.33% of application code — 3,356 statements, 56 missed (tests excluded). `backend/.coveragerc` enforces the 95% deploy gate (`fail_under = 95`; omits `tests/`, `.venv/` and `venv/`) whenever coverage is collected (`python -m pytest --cov`, as CI runs it). |
| Frontend Vitest | 51 files, 652 passed | 99.19% lines (3,317 of 3,344); statements 97.13% (3,825 of 3,938), branches 90.24% (3,110 of 3,446), functions 96.59% (1,502 of 1,555). `frontend/vitest.config.ts` enforces 95% lines (`coverage.thresholds`) in `npm run coverage`. |
| Playwright (chromium) | 99 passed (3 smoke, 12 golden path, 56 accessibility: 28 screens × 2 themes, 28 responsive: the same 28 screens at a 390px phone viewport). "All operations" is the new screen. | n/a |

Locally, run Vitest with `--maxWorkers=2` (gap 14) and Playwright with `--workers=4` (gap 13): at Playwright's default 8 workers, two full runs each had a different phone-width screen time out, and both passed alone. CI is unaffected; both gaps are in `docs/TESTING.md`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, FastAPI, Pydantic v2, asyncpg (hand-rolled query helpers in `backend/database.py`), PyJWT + bcrypt auth, cryptography (Fernet field encryption), httpx (scraper) |
| **Database** | PostgreSQL (Railway in production). Schema changes are Alembic migrations in hand-written SQL (`backend/migrations/versions/`, currently `0001`–`0007`), applied at startup by `run_migrations()` in `backend/database.py`. `SETUP_SQL` is gone. `DATABASE_URL` may include `?sslmode=disable` for a local Postgres. |
| **Jobs and live updates** | Durable jobs in PostgreSQL (`backend/services/jobs.py`: `FOR UPDATE SKIP LOCKED`, leases, heartbeats). Live updates are SSE over `LISTEN/NOTIFY` (`backend/services/events.py`). |
| **AI** | The official Anthropic Python SDK (`anthropic` 1.6 on `httpx2`) in `backend/services/claude.py`. `CLAUDE_MODEL` defaults to `claude-sonnet-5` (Sonnet 4 reached end of life on 15 June 2026). Market analysis and pricing use `CLAUDE_REPORT_MODEL` (default `claude-opus-5`). Research operations use the web search tool. There is no `SANDBOX_MODE`. |
| **Frontend** | React 19, TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), Vite 8, React Router 7 (data router, lazy routes), TanStack Query 5, Radix UI (`radix-ui` package), cmdk (command palette), lucide-react icons, react-markdown + remark-gfm. Fonts are bundled via `@fontsource-variable` (Mona Sans, JetBrains Mono). |
| **Styling** | CSS Modules + CSS variable design tokens. No Tailwind or CSS framework. |
| **Backend tests** | pytest + pytest-asyncio + pytest-cov against a real Postgres test database. Claude, the scraper and SMTP are faked (`test_claude.py` runs the real SDK against a fake Messages API), and an autouse guard fails any test that would reach the network. |
| **Frontend tests** | Vitest 5 + Testing Library + jsdom + MSW 2. Playwright 1.61 (chromium) + @axe-core/playwright 4.13 for browser tests and WCAG 2.2 A/AA scans. |
| **Lint** | Backend: ruff, passing, and CI runs it. Frontend: ESLint 9 with typescript-eslint, react-hooks, react-refresh and jsx-a11y, at zero warnings. |
| **Deploy** | Railway (Docker). See [Deployment & CI](#deployment--ci). |

---

## Project Structure

```
LaunchOps/
├── CLAUDE.md                  ← you are here
├── SETUP_PROMPT.md            ← session-start prompt
├── SOURCE_MAP.md              ← file-by-file map
├── DEBUG_PROTOCOL.md          ← anti-loop debugging directive
├── Dockerfile, railway.toml   ← production image + Railway config
├── .claude/launch.json        ← preview servers: "backend" (port 8765), "frontend" (port 5173)
├── .github/workflows/         ← ci.yml (backend, secrets, frontend), build-desktop.yml (Tauri installers on v* tags),
│                                test-pipeline.yml (untracked generic template, not wired to this repo)
├── src-tauri/                 ← desktop webview pointing at https://launchops.run
├── backend/
│   ├── main.py                # app factory, startup (settings guards, migrations, job worker), auth middleware, routers, /health, SPA fallback (unknown /api/* → 404 JSON)
│   ├── worker.py              # standalone job worker: python -m worker
│   ├── config.py              # Pydantic settings from env vars; JWT_SECRET startup guard
│   ├── database.py            # asyncpg pool, query helpers, app_config get/set, run_migrations()
│   ├── models.py              # Pydantic request/response models
│   ├── alembic.ini, migrations/   # Alembic; hand-written SQL migrations in migrations/versions/ (0001–0007)
│   ├── routers/               # auth.py, products.py, workflows.py, queue.py, extras.py, organisations.py, events.py (SSE)
│   ├── services/              # claude.py, results.py (result models), usage.py + pricing.py (ledger), jobs.py, events.py,
│   │                          #   access.py (organisation roles), audit.py (activity log), mailer.py (platform email),
│   │                          #   email.py (Outbox SMTP), scraper.py, auth.py, field_crypto.py, ratelimit.py
│   ├── tests/                 # pytest suite; conftest.py holds the test-database rules
│   └── requirements.txt, requirements-dev.txt, pytest.ini, .coveragerc, .env.example
├── frontend/
│   ├── src/app/               # App, routes, query client, router
│   ├── src/styles/            # tokens.css, base.css, print.css
│   ├── src/lib/               # api/ (client, endpoints, types, sse), auth/ (incl. organisation roles), queries/ + hooks/,
│   │                          #   live/ (live updates), operations/ provider,
│   │                          #   domain/ (operations catalogue, playbook: the order operations run in,
│   │                          #   projects: readiness + launch state, checklist, dates, exporters, channels,
│   │                          #   queue, reports, sources, usage, values, chart, order)
│   ├── src/components/        # ui primitives, shell, access (role-aware controls), project,
│   │                          #   operations/ (RunSheet, Playbook, OperationCard), results renderers, review, outbox
│   ├── src/pages/             # auth (sign in, password reset, invitation), portfolio, project/*, review, outbox,
│   │                          #   calendar, library, settings/*
│   ├── src/test/              # fakeApi.ts (shared fake backend), renderApp, roles, app-level tests
│   ├── e2e/                   # smoke, golden, a11y and responsive specs (responsive.spec.ts: 28 enumerated screens at 390px —
│   │                          #   not /register, the not-found page, 3 of the 5 report documents or any dialog but the run sheet;
│   │                          #   see docs/TESTING.md); support/ (fakeBackend, sample workspace); capture.mjs (screenshots)
│   └── vite / vitest / playwright / eslint / tsconfig.* configs
└── docs/                      ← managed documents: versioned together, edited through their subagents
    ├── ASSESSMENT_AND_DEVELOPMENT_PLAN.md   # findings, phased plan, Progress
    ├── ROADMAP.md                           # goals, milestones, active tasks, blocked on the owner
    ├── BUGS.md                              # bug registry; open bugs first
    ├── HANDOFF.md                           # session handoff; read it at session start
    ├── CHANGELOG.md                         # released and unreleased changes (new, 2026-09-17 handoff)
    ├── AUDIT-LOG.md                         # documentation audits (new, 2026-09-17 handoff)
    ├── PHASE1_DESIGN.md                     # Phase 1 decisions (D1–D16) and why
    ├── DESIGN_SYSTEM.md                     # full design system reference
    └── TESTING.md                           # frameworks, how to run, inventory, coverage
```

---

## Architecture

```
React SPA ── frontend/src/lib/api (15-minute access token in localStorage "launchops_token", X-Org-Id header;
             refresh token in an HttpOnly cookie scoped to /api/auth)
    ↓ /api/*
FastAPI (backend/main.py: auth middleware on /api/*; startup applies migrations and starts the job worker)
    ├── CRUD ─────────────────────→ PostgreSQL via asyncpg (backend/database.py), scoped to the organisation
    ├── 12 background workflows ──→ durable job → worker → Claude → result lands in Review
    ├── playbook progress ────────→ GET /api/queue/summary: a project's result counts per operation and status
    ├── 5 synchronous reports ────→ Claude → stored on the project
    ├── live updates ─────────────→ GET /api/events (SSE), fed by PostgreSQL LISTEN/NOTIFY
    └── URL scraping ─────────────→ httpx + HTMLParser behind the SSRF guard (press kit, press release, SEO)
Every Claude API response ──→ ai_usage ledger (estimated cost; each organisation's monthly budget, or the platform default)
```

**API base:**
- **Production:** relative `/api`. The image serves the SPA from `static/`.
- **`VITE_API_BASE`:** optional absolute base URL.
- **Dev:** Vite proxies `/api` to `LAUNCHOPS_API_URL`, set in `frontend/.env.local` (default `http://localhost:8000`).

### Operations (`frontend/src/lib/domain/operations.ts`)

There are 18 operations. **The catalogue's descriptions must stay true to backend behaviour.**

| Kind | # | Operations | Behaviour |
|---|---|---|---|
| Background workflow | 12 | competitor, trend, announcement, social posts, ad copy, blog, cold outreach, partnerships, podcasts, Reddit, directories, launch platforms | `POST /api/workflows/launch` saves a running result and a durable job in one transaction, then returns. A worker runs the job: inside the web process by default (`WORKER_ENABLED`), or `python -m worker`. The job survives restarts. Failures a retry might fix get 3 attempts (after 30 s, then 2 min). An Editor can cancel it (`POST /api/queue/{id}/cancel`), and each attempt stops after `JOB_TIMEOUT_MINUTES` (15). The result lands in Review. |
| Synchronous report | 5 | market analysis, pricing, press kit, press release, SEO | Stored on the project and stamped with `generated_at`. Market analysis and pricing use `CLAUDE_REPORT_MODEL`. If the AI call fails, the API returns 503 (unavailable), 502 (provider error or unusable result), 504 (timeout) or 422 (declined), each with a readable reason, and never overwrites a saved report. |
| Tool | 1 | repurpose | Returns platform-adapted copy directly. Not stored. |

**The launch playbook** (`frontend/src/lib/domain/playbook.ts`) arranges seventeen of the eighteen operations into five ordered stages — understand the market, fix the positioning, write the story, line up distribution, prepare the push — each with the purpose it serves, the T-minus window it is normally underway in, and the stages whose output it reads. From a project and its results (full results and the summary's counts both fit its `ResultRecord`) it derives every operation's state, each stage's progress, the current stage and the single operation to run next. **A finished operation stays counted while it is run again:** `POST /api/workflows/launch` keeps earlier results beside the new one, so completion takes precedence over a `running` rerun — an approved result still counts as done and a pending one as in review — and re-running never reopens a finished stage. Tools are left out of the sequence: `repurpose` returns copy directly and stores nothing, so its use cannot be observed, and counting it would leave the playbook permanently one step from finished — it sits in `ALWAYS_AVAILABLE` instead. Unlike the launch plan's phase names in `checklist.ts`, playbook stage ids and titles are presentation, not stored data, so they can be changed freely.

**On pull request #6, the Operations screen opens on the playbook** (`frontend/src/components/operations/Playbook.tsx`, rendered by `frontend/src/pages/project/OperationsPage.tsx`). A **"Next up"** card names the one operation to run now, its stage and what it produces, with a "Run …" button for Editors and above; it also says when the stage is behind its T-minus window (a launch date that has passed reads "the launch date was 3 days ago"), when everything in the stage is running or waiting for review ("Waiting on <stage>", with a link to Review), and when every step is done. Below it are the **five stages as an ordered list**, each with its window ("From T-45d"), "n of m" and a pill (Done / Now / Behind / Later). The current stage is open and the others collapse to one line; a stage that becomes current while the screen is open opens, and the one it leaves is not closed, so nothing is pulled out from under someone using it. Each operation shows its progress (Done, In review, Running, Failed). **"Always available"** holds `repurpose`, and **"All operations"** (`?view=all`) keeps the catalogue by category; both views share `OperationCard`. Progress comes from **`GET /api/queue/summary?product_id=…`** (`backend/routers/queue.py`): how many of the project's results each operation has in each status, over every result (404 for a project outside the organisation or a malformed id, 422 without `product_id`). It replaced reading `GET /api/queue?product_id=…&limit=500`, which returns the newest 500 at most, so an operation whose only approved result was older looked unfinished and was recommended again. The summary's query key sits under `["queue"]`, so live updates, launches and cancels refresh it. While results load, the screen says "Working out what's next…" rather than recommending from an empty list; if they fail to load, it shows a notice and still guides from the reports saved on the project. **It advises and never blocks a run** — the owner's decision of 2026-09-18.

### Key behaviours

- **Queue-first AI:** background workflow results land in Review (the approval queue). Nothing goes out without human review.
- **Organisations:**
  - `X-Org-Id` selects the organisation (without it, the API uses the user's first). Another organisation's things answer 404, and too low a role answers 403.
  - Roles build on each other: Viewer → Editor → Approver → Owner. Controls follow the member's role.
  - Settings, projects, results, the Outbox, the calendar, the library and company profiles (rows in the `brands` table) belong to the organisation. Settings are no longer per user.
  - Platform admin (`users.role = 'admin'`) is separate from organisation roles. The first account created becomes the platform admin; with `ADMIN_EMAIL` set, only that address can create it. The registration toggle is platform-wide, in the `app_config` table.
- **Sessions:** 15-minute access tokens plus rotating refresh tokens in an HttpOnly cookie scoped to `/api/auth`. There are forgot and reset password pages, and admins create one-time reset links. Reset and invitation emails go through the platform mailer (`MAIL_*`). Whether a returning refresh token is a replay is decided by the database's own clock (`r.used_at < NOW() - $2::interval` in the refresh query), never the application's, because the two run as separate services and an app clock reading behind the database would accept a stolen, already-rotated token instead of revoking its whole family.
- **Approving never sends email.** For cold outreach, partnerships and announcement results, it copies the contacts into Outbox drafts before the request answers. The Outbox sends only after an explicit confirmation that lists the recipients and the sender. `MAX_EMAILS_PER_DAY` limits sends per account in any 24 hours; 0 switches sending off.
- **SMTP passwords** are write-only (the API returns `smtp_password_set`, never the password) and encrypted at rest with `FIELD_ENCRYPTION_KEY`.
- **Live updates:** `GET /api/events` (SSE, read with fetch so the token stays in a header) refreshes Review and the Outbox. Polling slows to 30 s while connected.
- **Stalled operations:** the activity indicator and Review flag operations running over 60 minutes as possibly stuck.
- **Usage and budgets:** every Claude API response goes in the `ai_usage` ledger with an estimated cost, including $10 per 1,000 web searches. A monthly budget per organisation gives 429 once reached, and an organisation without one of its own — never set, or cleared — falls back to the platform default, `DEFAULT_MONTHLY_AI_BUDGET_USD` ($25). Enforcement and the usage summary both go through `effective_budget()` in `backend/services/usage.py`, so Settings → Usage shows owners the budget that actually applies: the organisation's own, the platform default or none.
  - **Who can set what** (`PUT /api/organisation/budget`, Owner-only; `ensure_budget_allowed()`, 403 otherwise): owners can set any budget up to the default or clear it; only a platform admin can set one above it, and only where they are an Owner — by the owner's decision (B-15), an admin does not set the budget of an organisation they don't belong to. There is no platform-default ceiling while the default is 0, but a request is still limited to $9,999,999,999.99 by `BudgetUpdate` (`Field(ge=0, max_digits=12, decimal_places=2)` in `backend/models.py`). A budget already stored above the default is kept, because the rule applies to changes.
  - **On `main` and in production**, an owner can lower a budget stored above the default only to the default or below (BUG-032), and the 403, the 429 and the note on Settings → Usage still name a platform administrator as the one who can go higher.
  - **On pull request #6 only:** an owner can lower any budget to any lower amount, including one stored above the default (BUG-032). Raising a budget stored above the default is refused with "This organisation's budget can be lowered, but not raised above its current $500.00."; any other request above the default gets "The most an organisation can set is $25.00 a month." The check and the write run in one transaction with the organisation's row locked (`SELECT … FOR UPDATE` in `usage.set_budget()`), so two owners lowering $500 at once, to $400 and to $450, can no longer both pass against $500 and end at $450. No message promises an administrator (B-15): the 429 at the default, or at an own budget at or above it, ends "Operations can start again next month.", while an owner below the default is still told "An owner can raise it in Settings → Usage." Settings → Usage promises a raise only to someone who can make one (`canRaiseBudget()` in `frontend/src/lib/domain/usage.ts`: a platform admin; anyone while the platform default is off; or an owner whose own budget is below the default). For anyone else, stopped operations read "AI operations can't start again until next month." and the budget field's hint no longer mentions the budget being raised.
  - **Where Settings → Usage says which budget applies** depends on the month. In a month with AI usage, the month summary shows it beside the costs, with a meter when there is a budget and, while the platform default is the one that applies, a note — on pull request #6, "This is the platform's default budget. As a platform administrator, you can set a higher one below." for a platform admin and "This is the platform's default budget, and the most an organisation can set. You can set a lower one below." for everyone else. In the current month with no usage yet, as in a brand-new organisation, the empty state is followed by one sentence saying which budget applies — on the default, "The platform's default budget of $25.00 applies: operations stop when a month's cost reaches it." (`BudgetStatement` in `frontend/src/pages/settings/UsageSettings.tsx`). In a past month with no usage, the month panel shows only the empty state.
- **Calendar:** month and week views. Dragging reschedules entries (`PATCH /api/calendar/{id}`) and launch dates (`PATCH /api/products/{id}`), and every move can be undone. The day agenda is the keyboard alternative.
- **Dates** the user picks are local `YYYY-MM-DD` keys and are never converted through UTC.
- **JSONB reorders object keys**, so the frontend restores the canonical field order for AI results (`frontend/src/lib/domain/order.ts`).
- **Destructive actions** can be undone for 6 s, or need typed confirmation (project delete).

### Claude integration (`backend/services/claude.py`, `backend/services/results.py`)

- `generate_result(prompt, user_message, result_type, ...)` is the only entry point. Every request streams.
- Every operation has a Pydantic result model (`results.py`) and is validated before it's stored.
- Operations without web search use structured outputs (`output_config.format`). Web research ends with a strict `submit_result` tool, gets one reminder if it doesn't submit, and keeps only the `sources` its searches actually returned.
- The system prompt has three parts (`Prompt`). The instructions and the brand context (`build_brand_context()`) are cached; the run details and today's date aren't.
- Prompts: `WORKFLOW_PROMPTS` covers the 12 background workflows. Press kit, press release, SEO, repurpose, pricing and market analysis each have their own `*_INSTRUCTIONS`.
- `pause_turn` resumes, and each call has a 10-minute deadline, retries and resumes included.
- Requests to `claude-opus-5` and `claude-fable-5-1` opt in to server-side fallbacks (`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta; `SERVER_FALLBACK_MODELS`). If the model's safety classifiers decline a request, Anthropic re-runs it on the recommended fallback model instead of returning the refusal. A refusal that remains is a 422 with a readable message.
- Every API response is recorded in the `ai_usage` ledger (`services/usage.py`; costs in `services/pricing.py`).
- The frontend still renders `raw_response` for results stored before structured outputs.

### Template matching

Templates carry `tags` (e.g. `["outreach", "email"]`). `GET /api/templates/for-workflow/{workflow_id}` returns the organisation's templates whose tags overlap with that workflow's tags. The workflow-to-tags map is in `backend/routers/extras.py`. The operation run sheet (`frontend/src/components/operations/RunSheet.tsx`) shows these templates as suggestions.

### URL scraping (`backend/services/scraper.py`)

A custom `HTMLParser` subclass (`MetadataParser`) extracts the title, meta description, OG tags, Twitter Card tags, canonical URL, JSON-LD, headings (h1–h3) and body text. The page text sent to the AI excludes inline scripts and styles; JSON-LD is still collected separately. Press kit, press release and SEO analysis use it. The SSRF guard allows public addresses only, checks every redirect and pins the connection to the checked address. It accepts HTML only and reads at most 2 MB.

---

## Screens

| Screen | Contents |
|---|---|
| Portfolio | Summary strip, launch board, needs attention, next 14 days |
| Project | Overview · Operations (on pull request #6, it opens on the launch playbook — "Next up", the five stages, "Always available" — and "All operations" keeps the catalogue; the run sheet states each operation's contract) · Reports (with a Sources section; export to print/PDF, Markdown, AI prompt) · Review · Outbox · Launch plan (33 items + custom items) · Settings |
| Review | Results from all projects; J/K keys move between items; cancel running operations; research results end with a Sources section; updates live |
| Outbox | Email drafts; sends only after confirmation; updates live |
| Calendar | Month and week views; drag to reschedule, with Undo |
| Library | Templates, ideas |
| Settings | General/white-label, voice & AI, companies, channels, organisation, activity (Owner), usage and budget (Owner), team & access (platform admins only) |
| Sign-in | Sign in, forgot password, reset password, accept an invitation or register through one |
| Shell | Organisation switcher, command palette (Ctrl/Cmd+K), capture dialog, activity indicator (flags operations running over 60 minutes as possibly stuck) |

---

## Design System

Full reference: `docs/DESIGN_SYSTEM.md`.

- **Themes:** light first, with a dark theme. The dark theme redefines **tokens only, never components**.
- **Colour:** primary buttons are monochrome. There is one accent, "signal": `#2f3dda` light / `#8d97ff` dark. Semantic ok/warn/crit colours are only for state.
- **Type:**
  - Mona Sans for body text.
  - Display text uses `font-stretch: 112%`.
  - Condensed uppercase "placard" labels use 82%.
  - JetBrains Mono for numbers, with tabular figures.
- **Tertiary text** `--ink-3`: `#686875` light / `#8e8ea0` dark, at least 4.6:1 contrast on every surface.
- **Contrast** is enforced in both themes by `frontend/e2e/a11y.spec.ts`.

---

## Development Commands (Windows)

On the dev machine, port 8000 is taken by a background service, so the local backend runs on **8765**. `.claude/launch.json` defines matching "backend" (8765) and "frontend" (5173) preview servers.

Full testing guide (frameworks, how to run, inventory, coverage): `docs/TESTING.md`.

### Backend
```bash
cd backend
python -m venv .venv                               # then use .venv\Scripts\python.exe as "python" below
python -m pip install -r requirements-dev.txt
# copy .env.example to .env; fill in DATABASE_URL, JWT_SECRET, FIELD_ENCRYPTION_KEY, ANTHROPIC_API_KEY
python -m uvicorn main:app --reload --port 8765    # applies migrations at startup; API docs at http://localhost:8765/docs only with DEBUG=true
python -m worker                                   # optional standalone job worker (the web process runs one unless WORKER_ENABLED=false)
python -m ruff check .
python -m pytest                                   # needs PostgreSQL 13 or newer (developed and tested on 18)
python -m pytest --cov                             # with the 95% coverage gate, as CI runs it
```

The test database name must contain `test`. `TEST_DATABASE_URL` overrides the local default set in `backend/tests/conftest.py` (`postgresql://postgres@127.0.0.1:56432/launchops_test?sslmode=disable`). Nothing is listening on **56432** or **56433** at session start — both are local clusters earlier sessions created and stopped — so `python -m pytest` fails until one is started again, and the always-on server on 5432 is no substitute, because its `postgres` user needs a password nobody recorded. **Never let two pytest runs share one test database** — two suites against the same cluster deadlock and raise foreign-key errors that read like real failures. The 2026-09-18 figures were measured against the scratch cluster on port **56433**, pointed at with `TEST_DATABASE_URL`; `pg_isready -h 127.0.0.1 -p 56433` shows whether it is up.

### Frontend
```bash
cd frontend
npm install
# create frontend/.env.local containing: LAUNCHOPS_API_URL=http://localhost:8765
npm run dev                        # http://localhost:5173, proxies /api
npm run check                      # lint + typecheck + unit/component tests (no coverage gate)
npm run coverage                   # fails below 95% lines
npx playwright install chromium    # once; npm run e2e needs it
npm run e2e                        # builds, serves on :4173, runs smoke, golden-path, accessibility and responsive tests; no backend needed
```

This machine can't download Chromium through `npx playwright install chromium`; see the Playwright notes in `docs/TESTING.md`.

---

## Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `DATABASE_URL` | backend | **Required.** PostgreSQL connection string (Railway provides it). Add `?sslmode=disable` for a local Postgres. |
| `JWT_SECRET` | backend | **Required.** Signs sign-in tokens. Outside debug mode, startup refuses the old placeholder or anything shorter than 32 characters. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `FIELD_ENCRYPTION_KEY` | backend | **Required** (unless `DEBUG=true`). Fernet key that encrypts secrets stored in the database, such as SMTP passwords. To rotate, list the new key first: `NEW,OLD`. The generate command is in `backend/.env.example`. |
| `ANTHROPIC_API_KEY` | backend | **Required.** Claude API key. Without it, AI operations fail with a readable error. |
| `ADMIN_EMAIL` | backend | **Recommended for any public deployment.** The first account created becomes the platform admin. When this is set and no account exists yet, registration from any other address is refused (403). Once the admin exists, registration works as before. In production it is `color8studios@gmail.com`, confirmed on 2026-09-17 as the holder of the platform admin account (`users.role = 'admin'`). **Open registration deliberately stays on:** the platform-wide switch in `app_config` is unchanged and enabled, so anyone who reaches launchops.run can register and create an organisation. That is an owner decision with the residual risk accepted; `ADMIN_EMAIL` still protects the admin account itself. |
| `CLAUDE_MODEL` | backend | Model for every operation except market analysis and pricing (default `claude-sonnet-5`) |
| `CLAUDE_REPORT_MODEL` | backend | Model for market analysis and pricing (default `claude-opus-5`) |
| `CORS_ORIGINS` | backend | Comma-separated origins allowed to call the API from another site. Default empty: same origin only (production serves the SPA itself; dev uses the Vite proxy). |
| `DEBUG` | backend | Default `false`. `true` serves API docs at `/docs` and tolerates a weak `JWT_SECRET`. Never in production. |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | backend | Access token lifetime (default 15 minutes) and refresh token lifetime (default 30 days) |
| `APP_URL`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` (587), `MAIL_SMTP_USER`, `MAIL_SMTP_PASSWORD`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` (LaunchOps), `MAIL_USE_TLS` (true) | backend | Platform mailer for password reset links and invitations. `APP_URL` is the base for links in emails. Unset: nothing is emailed; admins create reset links and owners share invitation links themselves. |
| `WORKER_ENABLED` | backend | Default `true`: the job worker runs inside the web process. Set `false` when a separate service runs `python -m worker`. |
| `WORKER_CONCURRENCY`, `JOB_TIMEOUT_MINUTES` | backend | Jobs one worker runs at once (default 3); time limit per attempt (default 15 minutes) |
| `RATE_LIMIT_ENABLED` | backend | Default `true`: rate limits on sign-in, registration, password resets and AI operations |
| `AI_OPERATIONS_PER_HOUR`, `MAX_CONCURRENT_TASKS` | backend | Per account: AI operations per hour (default 60) and background operations running at once (default 5) |
| `MAX_EMAILS_PER_DAY` | backend | Outbox sends per account in any 24 hours (default 20); 0 switches sending off |
| `DEFAULT_MONTHLY_AI_BUDGET_USD` | backend | Monthly AI spending cap for **any organisation that has not set a budget of its own** (default 25), and **the most an owner can set**. Registration creates an organisation with no budget, and every deployment bills AI to one `ANTHROPIC_API_KEY`, so without this a self-registered account could spend on that key without limit. An organisation's own budget wins over the default, but **only a platform admin can set one above it** (`ensure_budget_allowed()` in `backend/services/usage.py`, 403 otherwise). A budget already stored above it is kept, because the rule applies to changes; an owner can lower such a budget only to the default or below on `main` (BUG-032), and to any lower amount on pull request #6. **Clearing** an organisation's budget falls back to this default rather than meaning unlimited. It is **validated as non-negative** (`ge=0` in `backend/config.py`): a negative value fails at startup rather than silently removing the cap, and **only exactly `0`** opts out, meaning no default cap and no platform-default ceiling on what an owner can set — though a request is still limited to $9,999,999,999.99 by `BudgetUpdate` in `backend/models.py`. The usage summary returns `effective_budget_usd` and `budget_source` (`organisation`, `default` or `none`) alongside the organisation's own `budget_usd` (which the budget form edits) and `default_budget_usd`, so **Settings → Usage shows the budget that actually applies**. See Key behaviours → Usage and budgets. Documented in `backend/.env.example`. |
| `SECRET_KEY` | backend | Unused; kept so existing `.env` files still load |
| `TEST_DATABASE_URL` | backend tests | Overrides the local test database default |
| `LAUNCHOPS_API_URL` | frontend | Dev proxy target only (`frontend/.env.local`) |
| `VITE_API_BASE` | frontend | Optional absolute API base |

---

## PIP Note

The developer cannot configure pip/python in system PATH on Windows. Always use `python -m pip` and `python -m uvicorn` instead of bare `pip` / `uvicorn` commands.

---

## Conventions

- Never write into OneDrive or the Documents/Desktop folders.
- **Never run sign-up or registration probes against the live site.** `ADMIN_EMAIL` only guards the *first* account; once the admin exists, a probe creates a real account. One did on 2026-09-17 (`guard-check@example.com`), and a person has to delete it by hand. Test registration locally or against the test suite.
- Bug fixes need a failing test first. Keep ESLint at zero warnings. Update docs at the point of change.
- Don't commit without asking the owner, and create a branch first. Every push to `main` deploys to production on Railway.
- Keep the operation descriptions in `frontend/src/lib/domain/operations.ts` true to backend behaviour.
- Launch plan phase names and item order are part of the stored data format (`frontend/src/lib/domain/checklist.ts`). Never rename or reorder them.

---

## Deployment & CI

- **Railway:** project "Launch Ops", environment `production`, with exactly two services, both in US East:
  - `launchops`: built from the root `Dockerfile` and root `railway.toml`. The Dockerfile builds `frontend/dist` with Node 24, then Python 3.12 serves the API and the SPA from `static/`. `railway.toml` sets the `/health` healthcheck. The job worker runs inside this service; to split it out, run `python -m worker` as a second service and set `WORKER_ENABLED=false` here.
  - `Postgres`: the Railway Postgres 18 template, with a volume.
  - Startup applies pending migrations; a failed migration stops the app from starting.
  - Variables on `launchops`: `DATABASE_URL` (references `${{Postgres.DATABASE_URL}}` over the private network), `JWT_SECRET` and `FIELD_ENCRYPTION_KEY` (generated), `APP_URL=https://launchops.run`, `ADMIN_EMAIL`, `ANTHROPIC_API_KEY`. Not set yet: `MAIL_*` (optional).
  - Source: `launchops` is connected to GitHub `Vybecode-LTD/LaunchOps`, branch `main`, so every push to `main` deploys. Turning on Wait for CI in the service's source settings is suggested, so a deploy waits for CI to pass.
  - Domain: launchops.run is the custom domain of `launchops` (port 8080), **live over HTTPS**. DNS is at Spaceship, with the apex CNAME flattened to Railway's edge; no CAA or AAAA record is in the way. The first certificate attempt stalled at "polling authorizations" for about 3.5 hours with correct DNS; removing and re-adding the domain cleared it, and the certificate was issued 2026-09-17 16:51 UTC, valid to 2026-12-16.
  - **DNS target (settled 2026-09-17):** re-adding the domain gave it a new CNAME target, `xesm2hmr.up.railway.app`, and the Spaceship record now points there. Checked against public DNS (Google `8.8.8.8`): a flattened apex exposes no CNAME to read, so the check is by address — `launchops.run` → `69.46.46.46`, identical to `xesm2hmr.up.railway.app` → `69.46.46.46` and no longer the old `5rlc9k25.up.railway.app` → `69.46.46.62`.
  - The old `backend`, `frontend` and `src-tauri` services have been removed. A detached empty volume, `postgres-volume-qVKY`, is left over and can be deleted in the dashboard.
- **Status (2026-09-18):** live. `launchops` answers at https://launchops.run over HTTPS and at https://launchops-production-0457.up.railway.app. **Production runs `477eaa4`, the pull request #5 merge** — checked from the live site, not in the Railway dashboard, whose deployment record was not read. At 2026-09-18T04:43:44Z, about 41 seconds after the merge — fast for a Railway build, though the observation stands either way — the site's JavaScript bundle had changed to `index-D1A5232b.js`, whose Settings → Usage chunk (`UsageSettings-ZBCrvSWu.js`) contained "default budget of", from `43ab3e6`'s "The platform's default budget of $X applies again.": text only pull request #5's code has. At 2026-09-18T05:14:16Z it served the same bundle, and `GET /health` answered 200 `{"status":"ok"}`. Re-checked at 2026-09-18T06:09:38Z: the same chunk contains `7dbc35d`'s sentence ("…applies: operations stop when a month's cost reaches it."), `43ab3e6`'s, and still pull request #5's note naming a platform administrator, so production runs all of pull request #5's code and none of pull request #6's; `GET /health` answered 200. Settings → Usage has not been checked signed in as an Owner (T-10). Checked on 2026-09-17 against the deployment of `bc6143c` (the pull request #3 merge), and not repeated since:
  - unauthenticated API calls get 401: `POST /api/auth/refresh` with no cookie answers `{"detail":"Your session has ended. Sign in again."}`, and `GET /api/auth/me` with no token answers 401
  - security headers, including HSTS (`max-age=31536000; includeSubDomains`)
  - the database and migrations work: before the admin account existed, registration from another address was refused with 403. A later sign-up probe — run once the admin existed, when the guard no longer applies — created the real account `guard-check@example.com`, which has to be deleted by hand. Don't probe registration against the live site.
- **Live smoke test (2026-09-17):** passed with the deployment's key. `generate_result` made three calls against the real Anthropic API, all with valid results, for about $0.10 in total:
  - a non-research operation on Sonnet 5 (structured outputs)
  - a research operation on Sonnet 5: 3 web searches, the strict submit tool, 6 verified sources, cache reads of about 15,000 tokens
  - a non-research operation on Opus 5 with the server-side fallback beta

  It was a one-off manual check; the automated tests still use a fake API.
- **Desktop:** `src-tauri/` is a webview pointing at https://launchops.run. `.github/workflows/build-desktop.yml` builds installers on `v*` tags.
- **CI:** `.github/workflows/ci.yml` has three jobs:
  - Backend: ruff, pip-audit, then pytest with a `postgres:18` service and the 95% coverage gate.
  - Secrets: gitleaks over the full git history. `.gitleaksignore` lists three reviewed false positives by exact fingerprint: two launch plan keys in `frontend/src/lib/domain/checklist.test.ts` (commit `d7752c3`) and the earlier wording of the note about them in `docs/TESTING.md` (commit `4f433ee`).
  - Frontend: npm audit (fails on high or critical), lint, typecheck, Vitest coverage, build, Playwright.

---

## What Needs To Happen Next

`docs/ROADMAP.md` is the task list: **Active** — T-10 first (merge pull request #6, then check the live site signed in as an Owner), then T-1 and T-4 (at the end of every session), with T-5 to T-8 optional; T-2, T-3 and T-9 are done — **Blocked / needs the owner** (twelve open, B-1 to B-12), **Decided** (B-13, the session-end merge of 2026-09-17; B-14, B-15 and the playbook gates, decided 2026-09-18) and **Next up**. The playbook advises and never blocks a run. By B-15, a platform admin does not set the budget of an organisation they don't belong to. By B-14, nothing caps total AI spend across organisations; the owner's reason is that AI usage is to be charged to customers at a markup, so more spend by customers means more revenue. That reasoning depends on billing, which is not built (B-12 is open; billing settings are a Phase 2 follow-up). Until it exists, each self-registered organisation can spend up to $25 a month on the deployment's one `ANTHROPIC_API_KEY` with nothing recovering it, and open registration (T-2; at most 10 new accounts an hour per network address) adds organisations with nothing capping the sum. `docs/HANDOFF.md` is the last session's handoff — read it at session start. The **"Progress"** section of `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` has the phase status, the findings and the reasoning; the open owner questions on the brand kernel (D15) and reset links (D8) are in `docs/PHASE1_DESIGN.md`. Every session ends with **"perform handoff"**.

---

Last-verified: 2026-09-18T06:02Z · branch `feat/playbook-ui`, on **pull request #6, open and not merged**: its last code commit is `b607021`, with this 1.1.4 documentation committed on top · `main` = `origin/main` at `477eaa4` (the pull request #5 merge) · production runs `477eaa4`'s build (the live bundle and `/health` checked at 2026-09-18T05:14:16Z; the Railway dashboard record not read) · BUG-032 is live on `main` and in production until pull request #6 merges and deploys · `.github/workflows/test-pipeline.yml` stays untracked by design · confirm with `git status`, `gh pr view 6` and `gh pr checks 6`
