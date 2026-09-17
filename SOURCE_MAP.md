# SOURCE_MAP.md — Where Things Live

Last updated 2026-09-17 (Phase 1: foundation). For how to run, see `CLAUDE.md`; for tests, `docs/TESTING.md`;
for the design system, `docs/DESIGN_SYSTEM.md`; for tasks and milestones, `docs/ROADMAP.md`; for findings and the
phased plan, `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`.

## Repository root

| Path | Purpose |
|---|---|
| `Dockerfile` | Two-stage image: Node 24 builds `frontend/dist`, Python 3.12 serves the API and the built SPA from `static/`. Uvicorn runs with `--proxy-headers` so rate limits and HSTS see the real client address and scheme. Used by Railway. |
| `railway.toml` | Railway deploy config (Dockerfile builder, `/health` healthcheck). Railway project "Launch Ops" runs two services: `launchops` (this image) and `Postgres`. |
| `.dockerignore` | Keeps `.env` files, `node_modules`, build output, tests and docs out of the image build context. |
| `.github/workflows/ci.yml` | CI, three jobs. Backend: ruff, `pip-audit` of the production dependencies, pytest against a Postgres 18 service (coverage gate 95%). Secret scan: gitleaks over the full git history. Frontend: `npm audit` (high and critical), lint, typecheck, Vitest coverage, build, Playwright. |
| `.github/workflows/test-pipeline.yml` | Untracked generic template; not wired to this repo. |
| `.gitleaksignore` | Reviewed gitleaks findings that aren't secrets, by exact fingerprint (commit, file, rule, line). |
| `package.json` | Tauri CLI only (`npm run tauri:dev` / `tauri:build`). |
| `src-tauri/` | Desktop shell: a webview onto `https://launchops.run`. |
| `docs/` | Managed documents: `ROADMAP.md`, `BUGS.md`, `TESTING.md`, `HANDOFF.md`, `CHANGELOG.md`, `AUDIT-LOG.md`; plus the assessment and development plan, `PHASE1_DESIGN.md` and the design system. |

## Backend (`backend/`) — FastAPI, asyncpg, PostgreSQL

| File | Purpose |
|---|---|
| `main.py` | App factory and startup. Startup: refuses weak settings (`check_startup_settings`, field encryption key), applies database migrations (a failed migration stops the app; an unreachable database doesn't), encrypts SMTP passwords stored before encryption, marks results left running with no job to finish them as failed, and starts the job worker unless `WORKER_ENABLED=false`. Middleware: auth (Bearer JWT; disabled accounts and tokens issued before a password change get 401; database outage → 503), security headers (CSP, frame and referrer policy, HSTS over https), CORS only for `CORS_ORIGINS` (allows `X-Org-Id`). Public without a token: sign-in, registration, session refresh and sign-out, password reset and invitation links. API docs only in debug mode. `/health`, SPA fallback (unknown `/api/*` paths return 404 JSON; files outside the build are never served). |
| `worker.py` | `python -m worker`: runs the job worker on its own (for example as a second Railway service from the same image, with `WORKER_ENABLED=false` on the web service). Stops cleanly on SIGINT/SIGTERM. |
| `config.py` | Settings from environment variables: `DATABASE_URL`; secrets (`JWT_SECRET`, `FIELD_ENCRYPTION_KEY`); AI (`ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_REPORT_MODEL`); sessions (`ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`); `ADMIN_EMAIL` (the only address that can create the first account); the platform mailer (`APP_URL`, `MAIL_SMTP_HOST/PORT/USER/PASSWORD`, `MAIL_FROM_EMAIL/NAME`, `MAIL_USE_TLS`); jobs (`WORKER_ENABLED`, `WORKER_CONCURRENCY`, `JOB_TIMEOUT_MINUTES`); `CORS_ORIGINS`, `DEBUG` and limits. Also the startup guard for `JWT_SECRET`. |
| `database.py` | Connection pool (honours `sslmode=` in the DSN), CRUD helpers (`select`, `select_one`, `insert`, `update`, `delete`) that convert ISO strings for date and timestamp columns only, `app_config` get/set, and `run_migrations()` / `alembic_config()`. Malformed ids return `None` rather than a 500. |
| `alembic.ini`, `migrations/` | Alembic migrations, hand-written SQL (no ORM models, so no autogenerate). Migrations take an advisory lock and run in one transaction.<br>- `0001`: the schema the old startup script built, idempotently.<br>- `0002`: moves the registration switch into `app_config` and removes the empty settings rows the old script added at every start.<br>- `0003`: organisations and memberships; every existing user owns one with their data.<br>- `0004`: invitations and the activity log.<br>- `0005`: refresh tokens and password resets.<br>- `0006`: durable jobs.<br>- `0007`: the AI usage ledger and monthly budgets. |
| `models.py` | Pydantic request/response models. Update models are partial (`exclude_unset`); brand create/update are whitelisted. |
| `routers/auth.py` | `/api/auth`: register (creates the user's own organisation; the first account becomes platform admin, and with `ADMIN_EMAIL` set only that address can create it), login, me (with organisations and roles), rotating refresh-token sessions in an HttpOnly cookie (`/refresh`, `/logout`; reuse revokes the family), password reset by email link. Admin: users (list, create, patch, delete, one-time reset links), all projects, transfer a project into another user's organisation, registration toggle (in `app_config`). Passwords need 8–72 bytes; sign-in, registration and resets are rate limited; unknown accounts take as long to reject as wrong passwords. |
| `routers/organisations.py` | `/api/organisation`: the request's organisation (rename: Owner), members (list; change role and remove: Owner; members can leave; the last owner stays), invitations (Owner: list, invite by email or link, withdraw), activity log (Owner), AI usage by month and the monthly budget (Owner). `/api/invitations/{token}`: describe, accept (signed in, same address), register through an invitation even while registration is closed. |
| `routers/products.py` | `/api/products`: the organisation's projects, CRUD and checklist (create and edit: Editor; delete: Owner). SMTP passwords are encrypted at rest (`services/field_crypto.py`), never returned (`smtp_password_set` instead) and kept when a save omits them. |
| `routers/workflows.py` | AI operations for Editors, each checked against the organisation's monthly AI budget (429 when it's used up).<br>- **Workflows:** `POST /api/workflows/launch` saves the result as running and enqueues a durable job in one transaction. The job runs one of 12 workflows, and the result lands in Review. At most `MAX_CONCURRENT_TASKS` run per account. Failures a retry might fix are retried (see `services/jobs.py`).<br>- **Synchronous reports:** `/api/presskit/generate`, `/api/press-release/generate`, `/api/seo/analyze`, `/api/pricing/analyze`, `/api/market-analysis`. **Tool:** `/api/repurpose`.<br>- Each operation asks for its structured result (`services/results.py`), with a three-part prompt: instructions, brand context, this run's details.<br>- Every AI operation counts against `AI_OPERATIONS_PER_HOUR`. Reports stamp `generated_at`. AI failures return the error's status (503 unavailable, 502 provider error or unusable answer, 504 timeout, 422 declined) with a readable reason, and never overwrite a saved report. |
| `routers/queue.py` | `/api/queue`: list/get (Viewer), review (Approver), cancel a waiting or running operation (Editor: 200 cancelled, 202 stopping, 409 already finished), delete (Approver). Approving copies email addresses into drafts (never sends). `/api/email-queue`: list, edit draft (Editor; 409 once sent), quota, send one (Approver; explicit; 429 at the daily limit), delete (Approver). Changes are published as live updates and governed actions go to the activity log. |
| `routers/events.py` | `GET /api/events`: Server-Sent Events for the organisation (`queue` and `email` changes, a keep-alive comment every 15 s), read by the browser with fetch so the token stays in a header. |
| `routers/extras.py` | `/api/templates` (with tag matching per workflow), `/api/calendar` (list, create, **reschedule/edit via PATCH**, delete), `/api/captures`, `/api/settings` (per organisation), `/api/brands` (company profiles). Reading needs Viewer, changing needs Editor. |
| `services/access.py` | Organisation membership for a request (`X-Org-Id`, else the user's first organisation), the role ladder Viewer → Editor → Approver → Owner, `ensure()` (403 with the role needed) and loading a row only within the organisation (404 otherwise). |
| `services/audit.py` | Writes and reads the activity log. |
| `services/claude.py` | `generate_result()` on the official Anthropic SDK.<br>- **Structured results:** a response format for operations without web search; a strict `submit_result` tool for web research, with one reminder if the research ends without it; validated before they're returned.<br>- **Prompt caching:** the system prompt goes as instructions, brand context and run details, with the first two cached. Web research also caches its growing turn.<br>- **Reliability:** streaming, SDK retries, resuming turns that web search paused (`pause_turn`), a 10-minute deadline, server-side refusal fallbacks for Opus 5 and Fable 5.1.<br>- **Records:** every response goes in the usage ledger.<br>- **Errors:** `AIError` subclasses with readable messages and a `retryable` flag.<br>- **Prompts:** the brand-context builder and every operation's instructions.<br><br>Default model `claude-sonnet-5`; market analysis and pricing use `claude-opus-5`. |
| `services/results.py` | The Pydantic result model of every operation. Schemas stay within what structured outputs accept, and stored results keep the keys they always had (`Result.stored`). Web research results end with `sources`, which `services/claude.py` narrows to pages the searches actually returned. |
| `services/jobs.py` | Durable jobs in PostgreSQL: enqueue in the caller's transaction, claim with `FOR UPDATE SKIP LOCKED` under a heartbeat-renewed lease, retries (30 s, then 2 min; 3 attempts), cancellation, per-attempt time limit, `LISTEN/NOTIFY` wake-ups, and the `Worker`. |
| `services/events.py` | Publishes live updates with `NOTIFY` (never raises) and fans them out to each process's subscribers from one `LISTEN` connection. |
| `services/pricing.py` | Anthropic's published prices per model (longest prefix match), cache write and read multipliers, and $10 per 1,000 web searches. An unknown model has no estimate. |
| `services/usage.py` | The AI usage ledger: a row per API response, the monthly budget check, and a month's totals by operation, project, member and model. |
| `services/mailer.py` | The platform mailer for invitations and password resets (`APP_URL` + `MAIL_*`); `configured()` tells callers whether to email or show a link. |
| `services/scraper.py` | Fetches pages for press kit, press release and SEO with an SSRF guard (public addresses only, checked on every redirect and pinned for the connection; no credentials in URLs; HTML only; 2 MB cap), and parses head tags, headings, JSON-LD and page text without scripts or styles. |
| `services/email.py` | Email address extraction from AI results, and SMTP sending: STARTTLS with certificate verification, one recipient per message (validated), header values kept on one line. |
| `services/field_crypto.py` | Fernet encryption for secrets stored in the database (`enc:v1:` prefix; `FIELD_ENCRYPTION_KEY` accepts several comma-separated keys for rotation). |
| `services/ratelimit.py` | In-process sliding-window rate limits (sign-in per account and address, registration per address, password resets per account and address, AI operations per account). Single process only. |
| `services/auth.py` | Password hashing and JWT encode/decode (15-minute access tokens). |
| `tests/` | pytest suite against a real Postgres database (name must contain `test`; `TEST_DATABASE_URL` overrides the local default).<br>- **Setup:** the session applies the migrations once.<br>- **Fakes:** Claude (`fake_ai`), the scraper and SMTP (`fake_smtp`, `mailer`). An autouse guard fails any test that would reach the network. `run_jobs` runs queued jobs the way the worker does.<br>- `test_claude.py` runs the real SDK against a fake Messages API.<br>- `test_results.py` checks every result schema.<br>- `test_organisations.py` checks every route against every role and across organisations.<br>- `test_migrations.py` compares migrated and legacy schemas on scratch databases. `legacy_setup_schema.sql` is the frozen old startup script. |
| `requirements.txt` / `requirements-dev.txt` | Runtime / test, lint and audit dependencies. |
| `pytest.ini`, `.coveragerc` | Test settings; coverage of application code only, failing below 95%. |

## Frontend (`frontend/`) — React 19, TypeScript, Vite 8

### App and styles

| Path | Purpose |
|---|---|
| `src/main.tsx` | Entry: bundled fonts, global styles, applies the saved theme before first paint, renders `App`. |
| `src/app/App.tsx` | Provider stack: TanStack Query → toasts → tooltips → auth → router. |
| `src/app/routes.tsx` | Every route. Portfolio and project overview load eagerly; other pages are lazy chunks. Auth guard and error boundaries. |
| `src/app/queryClient.ts`, `router.ts` | Query defaults (no retry on 4xx) and the browser router. |
| `src/styles/tokens.css` | Design tokens for both themes (see `docs/DESIGN_SYSTEM.md`). |
| `src/styles/base.css`, `print.css` | Element defaults, `.placard`, `.num`, `.sr-only`, motion preferences; print layout for report export. |

### `src/lib` — logic with no UI

| Path | Purpose |
|---|---|
| `api/client.ts` | `request()` with bearer token and organisation (`X-Org-Id`), FastAPI error parsing (`ApiError`), network error message, one shared session renewal on 401, session-expiry event. `openEventStream()` opens a Server-Sent Events stream with the same headers and renewal. |
| `api/sse.ts` | Server-Sent Events parser: chunks split anywhere, CR/LF/CRLF, comments, `retry:`, multi-line `data:`. |
| `api/endpoints.ts`, `api/types.ts` | One typed function per backend endpoint (including cancelling an operation, usage and budget, and the live updates stream); request and response types. |
| `live/connection.ts` | The live updates loop for `GET /api/events`: hands on `queue` and `email` changes, reconnects after the server's retry delay, backs off after failures and gives up after 8 in a row, stops on a 401 that renewal couldn't fix. |
| `live/LiveUpdatesProvider.tsx`, `live/liveContext.ts` | Mounted once in the signed-in shell: refetches results or the Outbox when they change (and both after a reconnect), restarts for another organisation, retries when the browser comes back online; `useLiveUpdates()` says whether the stream is open. |
| `auth/` | `AuthProvider` (loading / offline / signed-out / signed-in, disabled-account notice) and `RequireAuth`. |
| `queries/hooks.ts`, `queries/keys.ts` | Every data hook: optimistic checklist saves, calendar moves and launch-date changes; queue polling while work runs (every 4 s, or every 30 s while live updates are connected); cancelling operations; usage and budget; undoable deletes. |
| `operations/OperationsProvider.tsx` | Tracks in-flight report operations across pages; warns before closing the tab while one runs. |
| `domain/operations.ts` | The catalogue of 18 operations and what each produces, reads and does on approval. |
| `domain/projects.ts` | Project type, launch state rules, T-minus, readiness score and its weights. |
| `domain/checklist.ts` | The 33-item launch plan, custom items, progress. |
| `domain/dates.ts` | Local calendar-day keys (never via UTC), month grids, weeks, labels, relative time. |
| `domain/exporters.ts`, `domain/order.ts`, `domain/reports.ts` | Plain text / Markdown / AI-assistant exports, ending with a numbered Sources list with addresses; canonical field order for AI results (JSONB reorders keys), with `sources` always last; report sections (Sources last when present) and SEO helpers. |
| `domain/sources.ts` | The pages a web research result relied on (`sources`): titles, safe addresses, sites and page ages, and their Markdown and plain text lines. |
| `domain/channels.ts`, `domain/queue.ts`, `domain/values.ts`, `domain/chart.ts` | Channels and compose links; display status (a durable job running over 60 minutes may be stuck), retry notes, poll intervals and SMTP readiness; safe value readers; chart scenario parsing. |
| `domain/usage.ts` | Usage months (UTC), dollar and count formats, budget use (warn from 80%, used up at 100%), budget input parsing. |
| `hooks/` | Theme, clock, and the deferred-delete store behind Undo. |
| `routes.ts`, `clipboard.ts` | Route builders; clipboard helper. |

### `src/components`

| Path | Purpose |
|---|---|
| `ui/` | Primitives: Button, Field family (inputs, switch, tag input), Pill/Count, Overlay (Modal, Sheet, ConfirmDialog, Menu, Tooltip, Popover), toasts, Display (Panel, PageHeader, EmptyState, Meter with optional state tone, Segmented, Notice…), Markdown, TabNav. |
| `shell/` | App shell (rail, top bar, mobile nav; mounts live updates), command palette (Ctrl/⌘K), new project and capture dialogs, organisation switcher, activity indicator (running operations with retry notes; ones that may be stuck, with role-aware advice). |
| `access/Access.tsx` | How the user's organisation role shows: `RoleNote` stands in for a control the role can't use; `ViewOnlyNotice` and `ViewOnlyFieldset` keep a form readable but unchangeable. |
| `project/` | Swatch, launch state pill, T-minus clock, readiness meter and breakdown, report lamps. |
| `operations/RunSheet.tsx` | The run sheet for every operation, with its contract (produces / uses / result / if it fails / on approval). The press release's media, technical and sales contacts are named field groups. |
| `results/` | Renderers for all 12 workflow results and 5 reports, revenue chart, shared result primitives, including `Sources`: the numbered pages a web research result relied on, at the end of every workflow result and report that has them (addresses print on paper). |
| `review/QueueStatusPill.tsx` | Result status pill. |

### `src/pages`

| Path | Screen |
|---|---|
| `auth/LoginPage.tsx`, `auth/PasswordResetPages.tsx`, `auth/InvitePage.tsx` | Sign in / create account; forgotten and reset password; joining an organisation from an invitation link. |
| `portfolio/PortfolioPage.tsx` | Portfolio: summary strip, launch board, needs attention, next 14 days. |
| `project/` | Project layout and tabs: Overview, Operations, Reports (index and document with export), Launch plan, Settings. |
| `review/ReviewPage.tsx` | Review queue (per project and across projects), J/K navigation; cancel a running operation (Editor, with confirmation). |
| `outbox/OutboxPage.tsx` | Email drafts: edit, confirm and send, within the daily sending limit; says when sending is switched off on the server (a limit of 0) and why Send is unavailable. |
| `calendar/CalendarPage.tsx` | Month and week views, drag to reschedule entries and launch dates, edit, undo. |
| `library/LibraryPage.tsx` | Templates and ideas. |
| `settings/` | Workspace settings: general and white-label, brand voice, companies, channels, organisation (members, invitations), activity log and usage (owners: a month's estimated AI cost, budget meter and form, breakdowns by operation, project, member and model), team and access (admins). |
| `NotFoundPage.tsx`, `RouteError.tsx` | 404 and error boundary (detects a stale deploy and offers Reload). |

### Tests

| Path | Purpose |
|---|---|
| `src/**/*.test.ts(x)` | Vitest + Testing Library. Domain units next to their modules; whole-app tests in `src/test/app.*.test.tsx`. |
| `src/test/fakeApi.ts` | In-memory fake of the backend contract (MSW handlers) that records every request, including organisation roles, template matching, approval drafts, cancelling operations, the usage ledger, budget refusals and switched-off sending (a daily limit of 0) copied from the backend. Web research reports end with `RESEARCH_SOURCES`. Streams `GET /api/events` and publishes the backend's events; `liveUpdates` lets tests publish, end or drop streams (`setup.ts` ends them after each test). Shared by Vitest and Playwright. `fakeApi.test.ts` guards the copied template tags, roles, usage and budget rules, sources and the sending limit. |
| `src/test/renderApp.tsx`, `setup.ts`, `server.ts` | Renders the real app at a route; jsdom stubs; MSW server. |
| `src/test/roles.ts` | `stateAs(role)` signs the fake API in with another organisation role; `changesRequested()` lists the requests that would change data. |
| `e2e/smoke.spec.ts`, `e2e/golden.spec.ts` | Playwright against the production build: smoke checks and the main task on every screen. |
| `e2e/a11y.spec.ts` | axe-core WCAG 2.2 A/AA scans of every screen in light and dark themes, including a research result and a report with their Sources sections. |
| `e2e/support/` | Routes browser API calls to `fakeApi.ts` (a routed response can't stream, so `/api/events` opens and ends, and the app reconnects every 5 s); the fictional sample workspace, including an invitation, a reset link, activity, this month's AI usage, and sources on a competitor result and the market analysis. |
| `e2e/capture.mjs` | Dev tool: full-page screenshots of every route against a running dev server. |

### Config

`package.json` (scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `coverage`, `e2e`, `check`), `vite.config.ts`
(`/api` proxy to `LAUNCHOPS_API_URL`, default `http://localhost:8000`), `vitest.config.ts`, `playwright.config.ts`,
`eslint.config.js` (typescript-eslint, react-hooks, jsx-a11y; zero warnings), `tsconfig.*.json` (strict,
`noUncheckedIndexedAccess`), `index.html`, `public/favicon.svg`.
