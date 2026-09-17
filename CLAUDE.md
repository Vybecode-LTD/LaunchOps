---
document: CLAUDE
version: 1.1.2
last-updated: 2026-09-17T21:24:00Z
last-audit: 2026-09-17T20:45:00Z
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
| **Changelog / audit log** | `docs/CHANGELOG.md` — what each version of the documentation set changed, newest first; the top entry is where things stand (1.1.2: the stale `bc6143c` current-state claims corrected after pull request #4, T-2 and T-3 settled, T-4 retitled, a third audit) / `docs/AUDIT-LOG.md` — the reconciliation audits, newest first |
| **Phase 1 decisions (D1–D16)** | `docs/PHASE1_DESIGN.md` |
| **Design system** | `docs/DESIGN_SYSTEM.md` |
| **Testing** | `docs/TESTING.md`: frameworks, how to run, inventory, coverage |
| **File-by-file map / session prompt** | `SOURCE_MAP.md` / `SETUP_PROMPT.md` |

---

## Current State

- **Phase:** Phases 0 (stabilise), 1 (foundation) and 2 (interface rebuild) are complete (milestones M0–M2 in `docs/ROADMAP.md`), and the app is live in production. **Phase 3 (real actions) is next and not started.** Two Phase 1 items moved to Phase 2 follow-up: the brand kernel (D15) and a versioned result history (D16).
- **Last completed task:** Phase 1 foundation:
  - organisations and roles (Viewer → Editor → Approver → Owner) with role-aware controls and an organisation switcher
  - invitations and member management
  - activity log
  - refresh-token sessions and password reset (platform mailer)
  - durable PostgreSQL jobs with retries, cancel and time limits
  - SSE live updates
  - structured AI results with verified web sources
  - prompt caching
  - usage ledger with monthly budgets and a Settings → Usage page

  Plus the rest of Phase 0: encrypted SMTP passwords, SSRF guard, startup guards, Alembic migrations, the daily email cap, deleted duplicate deploy files, CI security scans. Then, on 2026-09-17: the `ADMIN_EMAIL` setting, the Railway deployment, pull request #1 (branch `feature/launchops-v2-foundation`: `d7752c3` the v2 work, `4ecbcc4` `.gitleaksignore`), merged into `main` as `24eff91` after all CI checks passed, and pull request #2 (documentation: `4f433ee`, `b0beeaf`), merged as `f143f1c`. After that, `ANTHROPIC_API_KEY` was set on Railway, a live smoke test passed, and **launchops.run went live over HTTPS**.
- **Active task:** none. **`main` is at `0ce65dd`, the merge of pull request #4** (branch `docs/record-the-merge`, two commits: `9f7e930` recording the merge, the deployment and a second audit, `6a54c04` pointing the changelog row at the newest entry) — documentation only: it touched `CLAUDE.md` and `docs/` alone, no application code, no tests, no CI config. So **`bc6143c` is still the last commit that changed application code, and what production runs is unchanged in behaviour.** This session's work merged as **pull request #3** (branch `fix/refresh-token-clock-skew`, six commits: `35d24c5` the BUG-027 refresh-token fix, `584cff6` the text-block regression test, `7c1f1cb` the session-end documents, `39ff28b` the design-system correction, `ee4932a` the reconciliation fixes, `c486949` the branch-state notes), after all three CI jobs passed: backend lint and tests (550 tests, the 95% coverage gate, against a `postgres:18` service), frontend lint/typecheck/Vitest/build/Playwright, and the gitleaks secret scan. It was merged with a **merge commit, not a squash**, so the `.gitleaksignore` fingerprints still resolve. Railway deployed `bc6143c` at 2026-09-17T19:47:08Z, so **the BUG-027 refresh-token fix is now in production.** Only `.github/workflows/test-pipeline.yml` remains deliberately untracked.
- **Next** (priority order; the first two are owner-only account and console work, not code — full list in `docs/ROADMAP.md` → Active):
  - delete the stray account `guard-check@example.com` and "Guard check's organisation" (Settings → Team & access): a sign-up probe created it on the live site
  - **rotate the Railway project token again.** The token that was pasted into chat was deleted and a new one issued, but the replacement was pasted into chat too, so it is exposed the same way and has to be replaced. Issue the next one somewhere the value cannot reach a transcript: `railway login` in the owner's own shell, never a token passed through a tool call or a shell argument.
  - optional: turn on Wait for CI in the `launchops` service's source settings, turn on database backups, delete the leftover volume `postgres-volume-qVKY`, set `MAIL_*`
  - owner decisions: plan section 8; the brand kernel questions in D15; whether organisation owners should also create reset links (D8)
  - Phase 2 follow-up: brand kernel, result history, billing settings
  - Phase 3: real actions
- **Open bugs:** none. The record is `docs/BUGS.md` (27 bugs, all fixed, each with a test that failed first; two known limitations). Remaining findings and phase status are in `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`.
- **Doc version:** 1.1.2 — this is the `version:` in this file's frontmatter, not a separate number. All seven managed documents carry that one shared version and are raised together.

**Tests (2026-09-17)**

| Suite | Result | Coverage |
|---|---|---|
| Backend pytest | 550 passed | 98.31% of application code — 3,316 statements, 56 missed (tests excluded). `backend/.coveragerc` enforces the 95% deploy gate (`fail_under = 95`; omits `tests/`, `.venv/` and `venv/`) whenever coverage is collected (`python -m pytest --cov`, as CI runs it). |
| Frontend Vitest | 49 files, 601 passed | 99.19% lines (statements 97.03%, branches 89.97%, functions 96.47%). `frontend/vitest.config.ts` enforces 95% lines (`coverage.thresholds`) in `npm run coverage`. |
| Playwright (chromium) | 69 passed (3 smoke, 12 golden path, 54 accessibility: 27 screens × 2 themes) | n/a |

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
│   │                          #   domain/ (operations catalogue, projects: readiness + launch state, checklist,
│   │                          #   dates, exporters, channels, queue, reports, sources, usage, values, chart, order)
│   ├── src/components/        # ui primitives, shell, access (role-aware controls), project, operations/RunSheet,
│   │                          #   results renderers, review, outbox
│   ├── src/pages/             # auth (sign in, password reset, invitation), portfolio, project/*, review, outbox,
│   │                          #   calendar, library, settings/*
│   ├── src/test/              # fakeApi.ts (shared fake backend), renderApp, roles, app-level tests
│   ├── e2e/                   # smoke, golden, a11y specs; support/ (fakeBackend, sample workspace); capture.mjs (screenshots)
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
    ├── 5 synchronous reports ────→ Claude → stored on the project
    ├── live updates ─────────────→ GET /api/events (SSE), fed by PostgreSQL LISTEN/NOTIFY
    └── URL scraping ─────────────→ httpx + HTMLParser behind the SSRF guard (press kit, press release, SEO)
Every Claude API response ──→ ai_usage ledger (estimated cost; optional monthly budget per organisation)
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
- **Usage and budgets:** every Claude API response goes in the `ai_usage` ledger with an estimated cost, including $10 per 1,000 web searches. An optional monthly budget per organisation gives 429 once reached. Owners see both in Settings → Usage.
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
| Project | Overview · Operations (the run sheet states each operation's contract) · Reports (with a Sources section; export to print/PDF, Markdown, AI prompt) · Review · Outbox · Launch plan (33 items + custom items) · Settings |
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

The test database name must contain `test`. `TEST_DATABASE_URL` overrides the local default set in `backend/tests/conftest.py` (`postgresql://postgres@127.0.0.1:56432/launchops_test?sslmode=disable`). Nothing is listening on **56432** at session start — it is a scratch cluster an earlier session created and stopped, so `python -m pytest` fails until it is started again, and the always-on server on 5432 is no substitute, because its `postgres` user needs a password nobody recorded. **Never let two pytest runs share one test database** — two suites against the same cluster deadlock and raise foreign-key errors that read like real failures. This session finished against a scratch cluster on port **56433**, pointed at with `TEST_DATABASE_URL`.

### Frontend
```bash
cd frontend
npm install
# create frontend/.env.local containing: LAUNCHOPS_API_URL=http://localhost:8765
npm run dev                        # http://localhost:5173, proxies /api
npm run check                      # lint + typecheck + unit/component tests (no coverage gate)
npm run coverage                   # fails below 95% lines
npx playwright install chromium    # once; npm run e2e needs it
npm run e2e                        # builds, serves on :4173, runs smoke, golden-path and accessibility tests; no backend needed
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
- **Status (2026-09-17):** live. `launchops` answers at https://launchops.run over HTTPS and at https://launchops-production-0457.up.railway.app. The last code-bearing deployment is `bc6143c` (the pull request #3 merge), deployed successfully at 2026-09-17T19:47:08Z; the previous deployment, `f143f1c`, is being removed. `main` has since moved to `0ce65dd` (the pull request #4 merge, documentation only), and **whether Railway has deployed that was not confirmed in the dashboard** — every push to `main` deploys, so a deploy is expected, but it carries no code change either way. Verified against https://launchops.run after the `bc6143c` deploy, and re-confirmed at 2026-09-17T20:36Z:
  - `GET /health` answers 200 `{"status":"ok"}`, and the interface loads
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

`docs/ROADMAP.md` is the task list: **Active** (T-1 to T-8, the owner-only follow-ups — two were settled on 2026-09-17: T-2, the admin account and the registration policy, and T-3, the Spaceship CNAME; T-4 stays open at P1, because the token issued to replace the exposed one was exposed the same way), **Blocked / needs the owner** (B-1 to B-12), **Decided** (B-13, the session-end merge, done 2026-09-17) and **Next up**. `docs/HANDOFF.md` is the last session's handoff — read it at session start. The **"Progress"** section of `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` has the phase status, the findings and the reasoning; the open owner questions on the brand kernel (D15) and reset links (D8) are in `docs/PHASE1_DESIGN.md`. Every session ends with **"perform handoff"**.

---

Last-verified: 2026-09-17 · `main` at `0ce65dd` (the pull request #4 merge, documentation only) · the last application-code commit is `bc6143c` (the pull request #3 merge, deployed 19:47:08Z) · the post-merge documentation updates that the 2026-09-17T20:05:00Z audit found uncommitted on `docs/record-the-merge` are now merged, and the working tree is clean apart from `.github/workflows/test-pipeline.yml`; confirm with `git status`. That file stays untracked by design
