---
document: TESTING
version: 1.1.4
last-updated: 2026-09-18T06:39:21Z
last-audit: 2026-09-18T06:35:00Z
managed-by: session-orchestrator/test-doc-manager
---

# Testing Guide — LaunchOps

The testing reference for this repo: tools, commands, how the suites are built, every test file, coverage and known gaps.
Per-file counts were first taken from the test files on 2026-09-17 (`pytest --collect-only`, `vitest list` plus the `it.each` tables, `playwright test --list`). At `b607021`, the last code commit on pull request #6, every file's Defined count in section 4 was checked against its source again without running anything, and the Run counts of the files pull request #6 changed were recounted from their `parametrize` and `it.each` tables and the two browser specs' screen lists. All agree with the runs. Pass counts and coverage come from the full runs of 2026-09-18 at `b607021`, one suite at a time.

## At a glance

| Suite | Location | Runner | Latest run, 2026-09-18 at `b607021` |
|---|---|---|---|
| Backend API, database, jobs and AI client | `backend/tests/` | pytest | 570 collected, 570 passed |
| Frontend units, components, whole app | `frontend/src/**/*.test.ts(x)` | Vitest (jsdom) | 51 files, 652 passed |
| Browser, production build | `frontend/e2e/*.spec.ts` | Playwright (Chromium) | 99 passed |

**Total: 1,321 tests, all passed. There are no xfails or skips.**

The other gates were clean at `b607021`: `ruff check .`, `npm run lint` (zero warnings) and `npm run typecheck` (`tsc -b`). The dependency audits last ran on 2026-09-16/17 — pip-audit found no known vulnerabilities, and npm's advisory service none in 614 installed package versions (checked from Python; see section 2) — and pull request #6 changes no dependency. **CI on pull request #6** passed all three jobs on `08705de`, and again on `b607021`, its last code commit (run 35312501264, green by 2026-09-18 05:57:07 UTC); `4af499c` has no run of its own. The documentation commit on top gets its own run, and that is the one the merge waits for — read `gh pr checks 6` until all three are green on the pull request's latest commit. **Pull request #5** passed every job and step at `7dbc35d` (run 35298972693, 2026-09-18 02:20–02:26 UTC: ruff, pip-audit and pytest with the coverage gate; the gitleaks history scan; npm audit, ESLint, typecheck, Vitest with the coverage gate, the build and Playwright) and all three jobs again on its last commit, `ce12024` (green by 03:38:11 UTC), then merged into `main` as `477eaa4`.

Test output lands in git-ignored folders inside the repo (`backend/.coverage`, `backend/.pytest_cache/`, `backend/.ruff_cache/`, `frontend/coverage/`, `frontend/test-results/`, `frontend/dist/`) or in pytest's `tmp_path` under the system temp folder (`%LOCALAPPDATA%\Temp` on this machine). `test_migrations.py` creates scratch databases on the test server and drops them afterwards. Nothing goes to OneDrive.

---

## 1. Frameworks and tools

### Backend: `backend/requirements-dev.txt` (includes `requirements.txt`)

Python 3.12 (CI uses 3.12; the local venv is 3.12.10).

| Tool | Version constraint | Installed 2026-09-17 | Purpose |
|---|---|---|---|
| pytest | `>=9.0,<10.0` | 9.1.1 | Test runner. Config: `backend/pytest.ini` (`testpaths = tests`, `pythonpath = .`) |
| pytest-asyncio | `>=1.0,<2.0` | 1.4.0 | Async tests and fixtures (`asyncio_mode = auto`, function-scoped event loop). On Windows, `conftest.py` runs them on a selector event loop, because the default Proactor loop can add about half a second to every asyncpg round trip |
| pytest-cov | `>=7.0,<8.0` | 7.1.0 (coverage 7.16.1) | Statement coverage. Config: `backend/.coveragerc`, which measures application code only (omits `tests/*`, `.venv/*`, `venv/*`; `migrations/` counts), sets `fail_under = 95` (the deploy gate), `skip_covered` and `show_missing`. No branch coverage |
| ruff | `>=0.16.7,<0.17` | 0.16.7 | Lint, a CI gate. The repo has no ruff config, so ruff's default rules apply. Pinned to 0.16.x because minor releases can change the default rule set |
| pip-audit | `>=2.10,<3` | 2.10.1 | Known-vulnerability audit of the production dependencies (`requirements.txt`) in CI |
| httpx | `>=0.28,<1.0` (runtime, `requirements.txt`) | 0.28.1 | In-process API client (`httpx.AsyncClient` over `ASGITransport(app=main.app)`); `httpx.MockTransport` in the scraper tests |
| anthropic, httpx2 | `>=1.6,<2` and `>=2.13,<3` (runtime) | 1.6.0, 2.13.0 | The real Claude SDK and its HTTP layer. `test_claude.py` runs the SDK against a fake Messages API through `httpx2.MockTransport` |
| alembic | `>=1.20,<1.21` (runtime) | 1.20.0 | Database migrations. The suite builds its schema with them; `test_migrations.py` upgrades and downgrades scratch databases |

Not in the stack yet: mypy, hypothesis, pytest-xdist, bandit. All are on the minimum Python list in the workspace directive `TESTING_PROCEDURES.md` (in `C:\DEV`, not copied into this repo).

### Frontend: `frontend/package.json` devDependencies

Node `>=22.12` (from `engines`); CI uses Node 24, and this machine has Node 26.1.0. npm with `package-lock.json`.

| Tool | Version constraint | Installed 2026-09-17 | Purpose |
|---|---|---|---|
| Vitest | `^5.0.0` | 5.0.0 | Unit, component and whole-app tests in jsdom. Config: `vitest.config.ts` (merges `vite.config.ts`) |
| @vitest/coverage-v8 | `^5.0.0` | 5.0.0 | V8 coverage for `npm run coverage` (text summary plus per-file table). Fails below 95% lines (`coverage.thresholds`) |
| @testing-library/react | `^16.3.3` | 16.3.3 | Rendering; queries by role and label |
| @testing-library/user-event | `^14.6.7` | 14.6.7 | Realistic typing, clicks and keyboard shortcuts |
| @testing-library/jest-dom | `^7.0.1` | 7.0.1 | DOM matchers (`toBeInTheDocument`, `toBeChecked`, `toHaveAccessibleName`, ...) |
| jsdom | `^30.0.1` | 30.0.1 | DOM environment for Vitest |
| MSW (`msw`) | `^2.15.0` | 2.15.0 | The fake API. `setupServer` in Vitest; `getResponse` answers Playwright's routed requests |
| @playwright/test | `1.61.0` (exact pin) | 1.61.0 | Browser tests against the production build. One project, `chromium` (the `Desktop Chrome` device) |
| @axe-core/playwright | `^4.13.0` | 4.13.0 (axe-core 4.13.0) | WCAG scans in `e2e/a11y.spec.ts` |
| ESLint | `^9.0.0` | 9.39.5 | Lint gate (`eslint . --max-warnings 0`). Flat config `eslint.config.js`, with `@eslint/js`, `eslint-plugin-react-refresh` (0.5.6) and `globals` |
| typescript-eslint | `^8.70.0` | 8.70.0 | TypeScript recommended rules |
| eslint-plugin-jsx-a11y | `^6.10.2` | 6.10.2 | Static accessibility rules (recommended flat config) |
| eslint-plugin-react-hooks | `^7.1.1` | 7.1.1 | Rules of hooks (recommended) |
| TypeScript | `~6.0.3` | 6.0.3 | Type gate: `tsc -b`. Covers `tsconfig.app.json` (`src/`: strict, `noUncheckedIndexedAccess`) and `tsconfig.node.json` (config files and `e2e/`) |

Config details that affect tests:

- **`vitest.config.ts`:**
  - `environment: "jsdom"`.
  - `VITE_API_BASE=http://launchops.test`. MSW needs an absolute URL to match requests under Node's fetch.
  - Setup file `src/test/setup.ts`; `testTimeout` 30 s, because app tests drive real pages through several steps and CI runners can be slow.
  - Test files: `src/**/*.test.{ts,tsx}`. CSS Module class names aren't scoped in tests (`classNameStrategy: "non-scoped"`).
  - Coverage measures `src/**/*.{ts,tsx}`, excluding test files, `src/test/**`, `src/main.tsx` and `*.d.ts`.
  - `thresholds: { lines: 95 }` (the deploy gate). Statements, branches and functions are not gated.
- **`src/test/setup.ts`** raises Testing Library's `asyncUtilTimeout` to 10 s. The first lookup in a file waits for a lazy route to load, which took up to 7 s on a busy Windows machine.
- **`playwright.config.ts`:**
  - `testDir: "e2e"`, `testMatch: "*.spec.ts"`.
  - Test timeout 60 s, `expect` timeout 10 s.
  - `baseURL http://localhost:4173`, `trace: "retain-on-failure"`.
  - Reporter `list` locally, `github` in CI.
  - The web server gets 180 s to start.

---

## 2. How to run

### Backend (from `backend/`, Windows venv)

Requirements:

- **PostgreSQL 13 or newer** (developed and tested on 18; CI runs `postgres:18`). The database must exist, but it can be empty: the suite builds the schema once per run by running the migrations (`database.run_migrations()`).
- **The database name must contain `test`.** `tests/conftest.py` checks the URL path and stops the run (`pytest.exit`) if it doesn't. Every test empties all app tables, so never point the suite at a real database.
- **The database user must be allowed to create databases.** `test_migrations.py` creates and drops scratch databases named `launchops_test_migrations_*` on the same server.
- **Default DSN:** `DEFAULT_TEST_DSN` in `backend/tests/conftest.py`, currently `postgresql://postgres@127.0.0.1:56432/launchops_test?sslmode=disable` (port 56432). Set `TEST_DATABASE_URL` to use a different server. CI sets `postgresql://postgres@localhost:5432/launchops_test?sslmode=disable` for its `postgres:18` service.
- **At session start, nothing is usually listening on 56432** — or on 56433. Both are scratch clusters that earlier sessions created and then stopped cleanly, so `python -m pytest` fails to connect before any of the guidance here applies. Their data directories sit under an **earlier** session's scratchpad: `%LOCALAPPDATA%\Temp\claude\C--DEV-LaunchOps\<session-id>\scratchpad\pgdata` (port 56432, holding `launchops_test` beside the `launchops` dev database) and `...\scratchpad\pgdata2` (port 56433, holding `launchops_test`). **Neither path is durable** — they live in a temp folder and can be cleaned up at any time. The always-on service on port **5432 is not a substitute**: its `postgres` user needs a password that is recorded nowhere in this project (`psql` there answers `fe_sendauth: no password supplied`). To check whether a cluster is up: `& "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 56433` (or `-p 56432`).
- **Starting a stopped cluster** uses PostgreSQL 18's `pg_ctl` (`C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe`), with `-D` at the data directory, `-l` at a log file **outside the repository and outside OneDrive** — this session's scratchpad — and `-o "-p <port>"` at the port: `& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "<scratchpad>\pgdata2" -l "<scratchpad>\pg.log" -o "-p 56433" start`. If the scratch directories have been cleaned, `initdb` a fresh cluster in the **current** session's scratchpad (never `Documents`, `Desktop` or anywhere else OneDrive syncs) and create a database whose **name contains `test`**, owned by a user allowed to create databases, as the two notes above require. Both clusters were restarted this way on 2026-09-17, and the 19:0x run against 56433 through `TEST_DATABASE_URL` was green: 550 passed, 98.31% coverage. The 2026-09-18 run at `b607021` used 56433 the same way: 570 passed, 98.33%.
- **Two pytest runs must never share a test database.** Every test empties all app tables, and `test_migrations.py` creates and drops databases on the same server, so a second run on the same cluster fights the first. On 2026-09-17 a second agent's run against this machine's default cluster produced deadlocks and foreign-key violations that read like real failures and were not. Give the second run its own server through `TEST_DATABASE_URL`: the 2026-09-17 19:0x run used a fresh scratch cluster on port 56433, while `conftest.py`'s default stays on 56432.

```powershell
cd backend
python -m venv .venv                          # first time only
.\.venv\Scripts\Activate.ps1                  # Git Bash: source .venv/Scripts/activate
python -m pip install -r requirements-dev.txt

python -m pytest                              # full suite (no coverage, so no coverage gate)
python -m pytest -q                           # quick check
python -m pytest --cov=.                      # with coverage; fails if application coverage is below 95%
python -m pytest --cov=. --cov-report=term-missing:skip-covered   # exactly what CI runs
python -m coverage report --no-skip-covered --precision=2        # re-print the last coverage run, every module to two decimals
python -m pytest tests/test_queue.py          # one file
python -m pytest tests/test_workflows.py -k timeout               # matching tests only

$env:TEST_DATABASE_URL = "postgresql://postgres@localhost:5432/launchops_test?sslmode=disable"   # another server, this shell only
python -m ruff check .                        # lint (a CI gate)
python -m pip_audit -r requirements.txt --progress-spinner off    # dependency audit, as CI runs it
```

No test reaches the network:

- **An autouse guard, `_no_network`,** replaces the Anthropic client factory (`services.claude._client`), the scraper's DNS lookup (`services.scraper._resolve`) and `smtplib.SMTP` / `SMTP_SSL` in `services.email` with a function that fails the test. A test that forgets its fake fails loudly instead of going out. `test_mailer.py::test_the_real_smtp_client_is_never_reached_in_tests` proves the guard fires.
- **`fake_ai`** replaces `routers.workflows.generate_result` and `routers.workflows.scrape_url`.
  - Set `.response` to a result dict or an exception to raise, `.responses` to answer calls in turn, `.delay` to take that many seconds, and `.scrape_result` to override the scraped page.
  - `.calls` records each call's `prompt`, `system` (the prompt's full text), `user_message`, `result_type`, `web_search`, `max_tokens`, `model` and `usage`. `.scraped_urls` records the scraped URLs.
- **`fake_smtp`** replaces `routers.queue.send_email`. Set `.result` to control the outcome. `.calls` records each send and the thread it ran on.
- **`mailer`** configures the platform mail server settings and replaces `services.mailer._deliver`. `.sent` records each email's recipient, subject and body.
- **Fakes inside test files:**
  - `test_claude.py`: `anthropic_api`, a fake Messages API behind the real SDK client (`httpx2.MockTransport`).
  - `test_scraper.py`: `network`, fake DNS answers and HTTP responses (`httpx.MockTransport`).
  - `test_email.py`: `smtp`, a recording `smtplib.SMTP`. `test_mailer.py`: `smtp`, a recording stand-in for the `send_email` function the mailer calls.
- **`conftest.py` sets the environment before importing the app:** test values for `JWT_SECRET` and `FIELD_ENCRYPTION_KEY` (marked `gitleaks:allow`), a blank `ANTHROPIC_API_KEY`, `RATE_LIMIT_ENABLED=false` (`test_security.py` switches limits on where it checks them) and `WORKER_ENABLED=false`. An autouse fixture lowers bcrypt to 4 rounds for speed.

### Frontend (from `frontend/`)

```powershell
cd frontend
npm ci                                        # install from the lockfile, as CI does

npm run check                                 # lint + typecheck + tests (eslint --max-warnings 0, tsc -b, vitest run); no coverage gate
npm test                                      # Vitest once
npm run test:watch                            # Vitest in watch mode
npm run coverage                              # Vitest with V8 coverage; fails below 95% lines
npx vitest run src/test/app.review.test.tsx   # one file
npm audit --audit-level=high                  # dependency audit, as CI runs it (can't reach the registry on this machine)

npx playwright install chromium               # once per machine, and after upgrading @playwright/test (fails on this machine; see below)
npm run e2e                                   # Playwright
npx playwright test e2e/golden.spec.ts        # one spec
```

Coverage gates apply only when coverage is collected: `python -m pytest --cov` and `npm run coverage`, both of which CI runs. Plain `python -m pytest` and `npm run check` don't check them.

Playwright notes:

- **Server:**
  - Locally, `npm run e2e` runs `npm run build && npx vite preview --port 4173 --strictPort` and tests `http://localhost:4173`.
  - In CI (`CI` is set), the job has already run `npm run build`, so Playwright only serves `dist/`.
- **Stale builds:** `reuseExistingServer` is on locally. If something already answers on :4173, Playwright uses it without rebuilding. Stop old `vite preview` processes or you will test a stale build.
- **No backend needed:**
  - `e2e/support/fakeBackend.ts` routes every browser `**/api/**` request through MSW's `getResponse`.
  - The handlers are the ones in `src/test/fakeApi.ts`, the same in-memory fake the Vitest app tests use.
  - A request with no handler gets a 404 `No fake for METHOD /path`.
  - `GET /api/events` is answered with `retry: 5000` and the response ends at once, because Playwright can't stream a routed response. The app reconnects every 5 s, as it does after a server restart.
- **Run results:**
  - Failed tests keep a trace in `frontend/test-results/` (git-ignored). Open one with `npx playwright show-trace <trace.zip>`.
  - `test-results/.last-run.json` records only the most recent Playwright run of any kind, including one-off runs, so it isn't a record of the suite.
- **This development machine can't download Playwright's browser.**
  - Local runs use a temporary `frontend/playwright.local-browser.config.ts` that points `use.launchOptions.executablePath` at `%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe`, passed with `npx playwright test --config playwright.local-browser.config.ts`.
  - Delete it afterwards and never commit it. `.gitignore` doesn't cover it.
  - **For a full local run, add `--workers=4`:** `npx playwright test --config playwright.local-browser.config.ts --workers=4`. `playwright.config.ts` sets no `workers`, so Playwright starts half the logical processors — 8 of this machine's 16 — and at that count phone-width screens have timed out under CPU contention (gap 13). CI is unaffected.
  - CI installs its browser normally (`npx playwright install --with-deps chromium`).
- **Browser install location:** Chromium goes to `%LOCALAPPDATA%\ms-playwright` by default, outside OneDrive.

### Listing tests (for audits of this document)

```powershell
python -m pytest --collect-only -q            # backend, every parametrized case
npx vitest list                               # frontend Vitest; lists each it.each once, not each case
npx playwright test --list                    # Playwright, every generated test
```

### CI: `.github/workflows/ci.yml`

Runs on every push to `main` and on every pull request. A newer run on the same ref cancels the older one.

| Job | What it runs |
|---|---|
| Backend lint and tests | ubuntu-latest, Python 3.12, `postgres:18` service (`launchops_test`, trust auth), `TEST_DATABASE_URL` as above. In order: `python -m pip install -r requirements-dev.txt`, `python -m ruff check .`, `python -m pip_audit -r requirements.txt --progress-spinner off`, then `python -m pytest --cov=. --cov-report=term-missing:skip-covered`, which fails below 95% application coverage (`.coveragerc`) |
| Secret scan | ubuntu-latest. Checks out the full history (`fetch-depth: 0`), downloads gitleaks 8.30.1 and its checksums file, verifies the archive with `sha256sum --check`, then runs `./gitleaks git --redact --verbose .` over every commit |
| Frontend lint, types, tests and build | ubuntu-latest, Node 24. In order: `npm ci`, `npm audit --audit-level=high` (fails on high or critical advisories), `npm run lint`, `npm run typecheck`, `npm run coverage` (fails below 95% lines), `npm run build`, `npx playwright install --with-deps chromium`, `npm run e2e` |

Secret scan findings that were reviewed and aren't secrets:

- **They go in `.gitleaksignore`** at the repo root, one fingerprint per finding (`commit:file:rule:line`). An inline `gitleaks:allow` comment can't clear them: the scan covers every commit, so a comment added in a later commit leaves the finding in the earlier one. Only the listed fingerprints are skipped, so any new finding is still reported.
- **A fingerprint names its commit.** A finding keeps its fingerprint after its pull request is merged only if the pull request is merged with a merge commit. Squash and rebase merges change commit hashes, so the entries stop matching and the scan reports those findings again.
- **Listed now:** the keys of the first and sixteenth pre-launch items in `frontend/src/lib/domain/checklist.test.ts` (lines 11 and 23), flagged by the `generic-api-key` rule in commit `d7752c3`. `.gitleaksignore` also lists this line's earlier wording from commit `4f433ee`, which quoted those two keys in the test's own syntax and matched the same rule. Rewording the line can't clear that finding, because the scan covers every commit.

Not in CI: mypy, `ruff format --check`, branch or diff coverage.

Other workflow files:

- **`build-desktop.yml`** builds the Tauri installers on `v*` tags or manual dispatch. It runs no tests.
- **`test-pipeline.yml`** is an untracked generic template (see gap 10). It is not wired to this repo; don't treat its gates as this project's.

### Dependency and secret scans on this machine

Three scans can't run on this development machine the way CI runs them:

- **`npm audit`** can't reach the registry. On 2026-09-16 the npm bulk advisory API was queried from Python instead: no advisories in 614 installed package versions.
- **pip-audit** needs the Windows certificate store (truststore) here. It reported no known vulnerabilities.
- **gitleaks** runs in CI only. It hasn't run on this machine.

---

## 3. Test design

### Backend

- **Real app, real database, in process.** Tests send requests with `httpx.AsyncClient` over `ASGITransport(app=main.app)`. ASGITransport doesn't run the app lifespan, so the fixtures do its setup:
  - an autouse session fixture builds the schema once per run with `database.run_migrations()`;
  - the `client` fixture empties every table in `APP_TABLES` with `DELETE` before each test (`TRUNCATE` was slow on some Windows disks), skipping tables that don't exist yet;
  - `client` closes the pool at teardown, so the next test's event loop builds its own.

  `APP_TABLES`, children before parents: `jobs`, `ai_usage`, `email_queue`, `queue`, `calendar_events`, `captures`, `templates`, `settings`, `products`, `brands`, `audit_log`, `invitations`, `memberships`, `organisations`, `refresh_tokens`, `password_resets`, `users`, `app_config`.
- **Startup behaviour** is tested by entering `main.lifespan(main.app)` directly, for example in `test_database.py` and `test_workflows.py`.
- **Fixtures:**
  - `register` and `create_product` go through the API. Registering creates the user's own organisation, and the first user registered in a test becomes admin.
  - `auth` builds the bearer headers.
  - `make_queue_item`, `make_email` and `make_event` insert rows directly, with the product's `org_id`, because in the app only workflows create queue rows.
  - `smtp_config` is a complete per-product SMTP configuration.
  - `run_jobs` runs every ready job the way the worker does (`jobs.drain`) and returns how many ran. `WORKER_ENABLED=false`, so no worker runs alongside the tests.
  - Test files add scenario fixtures: `team` in `test_organisations.py` (Olivia's organisation with an approver, an editor and a viewer), `org` in `test_members.py`, `world` in `test_tenancy.py`, `owner` and `stranger` in `test_usage.py` (Olivia registers first, so she is also the platform admin; Mallory registers second, an ordinary user who owns only her own organisation), `launch` and `queued` in the job tests, `subscription` in `test_events.py`, `scratch_database` in `test_migrations.py`, `spa_build` in `test_main.py`, and `settings` and `rate_limits` in `test_security.py`.
- **Service-level tests** call modules directly: the Claude client, the scraper, email sending, the platform mailer, job queue edge cases, result schemas, prices and migrations.
- **Section headers say what a group proves:**
  - `Baseline` groups pin existing behaviour.
  - `B1`–`B13` and `B15`–`B19` groups are regression tests for numbered bugs. There is no `B14` group. These IDs are defined only in the test headers so far (see gap 11).
  - `F-2`, `F-3`, `F-6`, `F-7`, `F-9` and `F-10` groups, and all of `test_security.py` (F-7), test the fixes for findings in `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`.
  - The Phase 1 test files name the design decisions they cover in `docs/PHASE1_DESIGN.md`, for example D9 (durable jobs) in `test_jobs.py`.
  - The scraper fix's regression test is named instead: `test_body_text_leaves_out_scripts_and_styles`.
- **Positive controls keep negative assertions honest.**
  - `test_transferred_project_stops_using_previous_owners_brand` first proves the owner's brand reaches the prompt. Only then does it assert the brand is gone after the transfer.
  - `test_the_schema_check_catches_what_structured_outputs_would_not_keep` proves the schema check in `test_results.py` finds defaults, minimums, unions and optional fields before the 18 result types are passed through it.
  - `test_the_real_smtp_client_is_never_reached_in_tests` proves the network guard fires.
- **A race is tested by holding a lock, not by timing.** `test_usage.py::test_two_budget_changes_at_once_cannot_raise_what_the_first_set` (`b607021`) holds a first budget change open in a transaction on a second connection, starts the competing request, and polls `pg_locks` until a lock in the test database is waiting — the request, blocked on the organisation's row — before it commits. So the order is the same on any machine: no fixed sleep decides it (the 20 ms pauses only pace the polling, for up to 5 s), and the test fails if the request never waits. Before the fix the request answered 200 and wrote $450 over the first change's $400.
- **Known bugs are strict xfails** (`xfail(strict=True)`). Strict means the run fails once the bug is fixed (XPASS). That forces the marker's removal in the fix commit, and the test becomes the regression test.
  - None are open now. Both earlier xfails were fixed.
  - The orphan `settings` rows are now covered by `test_database.py::test_restarts_do_not_add_settings_rows`.
  - `test_extras.py::test_template_source_product_can_be_a_product_id` passes.
- **Bug fixes follow fail-before/pass-after:** write the failing test first, then fix.

### Frontend (Vitest)

- **`src/test/setup.ts`:**
  - Registers the jest-dom matchers and raises the async lookup timeout to 10 s.
  - Stubs what jsdom lacks: `ResizeObserver`, `matchMedia` (desktop `min-width` queries match), `scrollIntoView`, pointer capture and the clipboard.
  - Starts MSW with `onUnhandledRequest: "error"`, so any request without a handler fails the test.
  - After each test it cleans up, ends any live-update stream still open, resets handlers, clears pending deferred deletes and clears `localStorage`.
- **Unit and component tests** sit next to their modules:
  - Unit tests: domain modules (`src/lib/domain/`), hooks, the API client and endpoints, the Server-Sent Events parser, the live-updates connection and the query client.
  - Component tests: `LiveUpdatesProvider`, the result renderers, `Markdown`, `RouteError` and `App`.
- **App tests render the whole app** (`src/test/app.*.test.tsx`), with real routes and pages, at a URL. `renderApp(path, state, { signedIn })` in `src/test/renderApp.tsx`:
  - builds the real route tree (`createMemoryRouter(routeObjects)`) and the real query client (retries off, data never stale, no refetch on window focus);
  - wraps it in the toast, tooltip and auth providers;
  - installs the fake API for `state`;
  - returns `router`, `user` (user-event) and `queryClient`.
- **Role tests** (`src/test/app.roles.*.test.tsx`, and parts of other app tests) use `src/test/roles.ts`:
  - `stateAs(role)` signs in as a Viewer, Editor or Approver of Northstar Ventures (`org-1`) instead of the default Owner.
  - `changesRequested(state)` lists every request except GETs and `/api/auth/` requests. The fake records refused requests too, so an empty list means nothing was changed or refused.
- **App tests assert on what reached the API, not only on the DOM.**
  - The fake records every request in `state.requests`.
  - `requestsTo(state, method, pathPrefix)` filters them. Example: the exact body of `PATCH /api/products/:id/checklist`, or proof that no `/send` request was made.
- **The fake backend** (`src/test/fakeApi.ts`) is an in-memory model of the backend contract:
  - **Organisations and roles:** requests act on the organisation in `X-Org-Id` (or the user's first) and need the backend's minimum role for each change, refused with the backend's message. Members, invitations, the activity log, sessions (renewal and sign-out) and password reset links are modelled too.
  - **Results:** `GET /api/queue/summary` counts one project's results by operation and status, as the backend route does, and answers 404 for an unknown project. `GET /api/queue` filters by project and status but ignores `limit` and returns results in the order they were added, where the backend returns the newest first and at most `limit` (gap 15).
  - **Approval** mirrors `backend/routers/queue.py` and `backend/services/email.py`:
    - only `EMAIL_WORKFLOWS` (`cold_outreach`, `partnerships`, the retired `press_targets`, `announcement`) create drafts;
    - contacts come from structured objects and from addresses in free text;
    - drafts are created once per result, using the backend's subject and body rules for each workflow;
    - nothing is sent.
  - **Sending:** SMTP passwords are write-only (`smtp_password_set`). Sends follow the daily limit over a sliding 24 hours (default 20). A limit of 0 refuses every send with the backend's "switched off" message. SMTP errors by recipient fail as they do in the backend (502).
  - **AI:** web research results end with `RESEARCH_SOURCES`, pages stored the way the backend stores them. The usage ledger is summarised per UTC month, and AI operations are refused (429) once the month's cost reaches the budget that applies: the organisation's own, or else the platform default. `effectiveBudget` picks it, a copy of `effective_budget()` in `backend/services/usage.py`. The usage summary reports that budget and whose it is, and the refusal says which one was reached and what happens next, in the backend's words: "An owner can raise it in Settings → Usage." while the organisation's own budget is under the platform default (or there is no default), otherwise "Operations can start again next month." No message promises a platform administrator (B-15). Above the platform default, `PUT /api/organisation/budget` is refused (403) unless the signed-in user is a platform admin (`state.user.role`) or the change lowers a budget already above the default, as `ensure_budget_allowed()` does (BUG-031, BUG-032), with the backend's two messages. `makeState()` signs in a platform admin, so a test meets that ceiling only by setting the role to `"user"`.
  - **Live updates:** the handlers publish the backend's queue and email events on open streams. With `liveUpdates.publish`, `write`, `end` and `drop` a test announces a change, writes raw text, ends the streams as a restart does, or breaks them as a dropped connection does.
  - **Templates per workflow:** `GET /api/templates/for-workflow/:wf` filters templates by `BACKEND_WORKFLOW_TAGS`, an exported copy of `workflow_tags` in `backend/routers/extras.py`.
  - **Not mirrored:** guessing a contact's name from the words before an address.

  Build state with `makeState()` and `makeProject()`. Sign-in succeeds only with the password `correct-horse`.
- **Keeping the fake honest:** `src/test/fakeApi.test.ts` fails if the frontend operations catalogue's workflow `templateTags` differ from `BACKEND_WORKFLOW_TAGS`. Its other tests pin the fake's own rules to the backend's behaviour as written by hand: role refusals, sources, the limit of 0, usage summaries, budget validation and the budget stop. Nothing compares the fake with the backend code.
- **Simulating trouble** with `FakeState`:
  - `latency` (`projectDetail`, `checklistSave`, in ms) reproduces slow connections. The Launch plan race regression test uses it.
  - `reportResponse` overrides the report endpoints, for example with a 503. `meResponse` overrides `GET /api/auth/me`, for an expired token or an outage as the app opens.
  - `sessionRenews`, `passwordResets` and `mailConfigured` set up session renewal, reset links and invitation email.
  - `emailDailyLimit` and `smtpErrors` shape sending. `aiUsage`, `budgets` and `defaultBudget` shape usage and the budget stop. `defaultBudget` is the platform default (`DEFAULT_MONTHLY_AI_BUDGET_USD`). Unset means off, so fixtures written before it are unaffected — unlike production, where it defaults to 25.
  - `runningJobs` marks results a worker has started: cancelling one answers 202 and it stays running.
  - `eventsResponse` and `eventsRetryMs` change how `GET /api/events` answers.
  - A test can also add a one-off handler with `server.use(...)`, as the failed-calendar-move test does.
- **Bug fixes:** reproduce at the lowest level that shows the bug (domain unit, app test or backend API test). Watch it fail, then fix.

### Browser (Playwright)

- **Production build in Chromium,** so real CSS, bundled fonts and lazy route chunks are exercised.
- **Sample data:** `sampleWorkspace()` in `e2e/support/workspace.ts` is a fictional portfolio.
  - It has projects in each launch state, all five reports, results in every review status (a research result and the market analysis with their sources), email drafts, templates, ideas, calendar entries and a company.
  - It also has a pending invitation, activity, and this month's AI usage: $41.27 of a $50 budget, with one call on a model without a known price.
  - `SAMPLE_INVITATION_TOKEN` and `SAMPLE_RESET_TOKEN` open the invitation and password reset pages.
- **Live updates:** the fake answers `GET /api/events` with `retry: 5000` and ends the response, so the browser reconnects every 5 s and never receives an event (gap 3).
- **`e2e/golden.spec.ts`** covers the main task on each screen. Like the app tests, it asserts on recorded requests. The report tests check that a Markdown download ends with its numbered sources and their addresses, and that a printed report (print media) shows each source's address.
  - **Controlled inputs: click and assert, never `check()`.** `locator.check()` clicks once and throws immediately if the box isn't already in the new state — it doesn't retry. A launch plan tick is a controlled input: the click toggles it natively, then React re-renders it from the query cache, so the state read in the instant after the click isn't reliably the settled one on a loaded machine. Use `await item.click()` then `await expect(item).toBeChecked()`, which retries, and keep the request assertion so the test still proves the save. "Launch plan: ticking an item saves the checklist" was changed to that shape in `908f46d`; the flake behind it is written up in gap 13.
- **`e2e/a11y.spec.ts`** runs axe-core with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`:
  - on 28 screens, in light and dark themes, with reduced motion;
  - after the page's `h1` (or the run-sheet dialog) is visible, the Sources section too where a screen has one, and the network is idle;
  - zero violations are required. A failure prints each rule, its impact and help text, and up to five offending nodes.

  Screens scanned: Sign in, Forgot password, Reset password, Invitation, Portfolio, Project overview, Operations (the playbook, its default view), All operations (`?view=all`), Run sheet (dialog), Reports, Market analysis report, SEO report, Review, Research result with sources, Outbox, Launch plan, Project settings, Calendar month, Calendar week, Library, Workspace settings, Brand voice, Companies, Channels, Organisation settings, Activity, Usage, Team.
- **`e2e/responsive.spec.ts` checks that no screen scrolls sideways on a phone.**
  - A **390×844** viewport (an iPhone 15/16 in portrait) with reduced motion, on the same 28 screens the accessibility scan covers. Each test asserts that the document is no wider than the viewport (`documentElement.scrollWidth` against `clientWidth`).
  - **Why it exists:** the accessibility scans run at the default desktop viewport, so three screens shipped scrolling sideways — Portfolio by 136px, Review by 133px and the review result by 133px — without anything failing. The spec found a fourth on its first run, the SEO report's section header.
  - It measures the symptom rather than any particular cause, then hides candidate elements one at a time and names the one whose removal would fix the overflow, so a regression says where to look.
  - The causes fixed were the launch board's auto-layout table leaking its intrinsic width past the wrapper that clips it (`contain: content`), a segmented control whose flex items could not shrink, and a section header that would not wrap.
- **`e2e/capture.mjs` is a manual screenshot tool, not a test.** Playwright only collects `*.spec.ts` — but it collects **every** `*.spec.ts` in `e2e/`, so a temporary file named that way joins the suite (gap 12).
  - Usage: `node e2e/capture.mjs <outDir> <token> [baseUrl]`.
  - Runs against a live dev server backed by a real backend (default `http://localhost:5173`, which proxies `/api`).
  - The data must include projects named "VybeCode DSP" and "Orbit Payroll".
  - `<token>` is an access token, and access tokens last 15 minutes (`test_sessions.py`), so use a fresh one.
  - Set `THEME` to `light` or `dark` to capture only one theme.
  - Choose an `outDir` outside OneDrive: not `Documents`, `Desktop` or `Pictures`, which are all redirected into OneDrive. Also avoid `frontend/test-results/`, which Playwright clears on every run.

---

## 4. Test inventory

**Defined** counts `def test_`, `it(` and `test(` call sites in the file; an `it.each` counts once. **Run** counts tests after expansion by `@pytest.mark.parametrize`, `it.each` or loops.

How the totals reconcile with the latest runs:

- **Backend:** 344 plain tests + 226 cases from 31 parametrized tests = 570. The largest expansions are in `test_organisations.py` (59 cases), `test_workflows.py` (51), `test_results.py` (36) and `test_scraper.py` (23).
- **Vitest:** 555 plain tests + 97 cases from 7 `it.each` tables = 652. The tables: `endpoints.test.ts` 58, `results.test.tsx` 12 + 12 + 5 + 3, `app.playbook.test.tsx` 4, `fakeApi.test.ts` 3. `npx vitest list` lists each `it.each` once, so it shows 562.
- **Playwright:** 3 + 12 + 28 × 2 + 28 = 99.

### Backend: `backend/tests/` (pytest)

| File | Defined | Run | What it covers |
|---|---|---|---|
| `conftest.py` | — | — | Fixtures, not tests. Test-database guard and environment; schema built once per run; selector event loop on Windows; `client`, `register`, `auth`, `create_product`, `make_queue_item`, `make_email`, `make_event`, `smtp_config`, `fake_smtp`, `fake_ai`, `run_jobs`, `mailer`; autouse `_no_network` guard and 4-round bcrypt |
| `test_auth.py` | 26 | 26 | Register, login and `/me` (email normalisation, first user is admin, validation). The `ADMIN_EMAIL` guard: while no account exists, registering from any other address answers 403 and creates nothing; the administrator's address (matched case-insensitively and trimmed) becomes the platform admin; after that, others register as ordinary users. Token required on `/api` routes; public `/health`. Admin-only routes; admin creates, updates and deletes users (not self). Cross-user project list and transfer with all related rows; a transferred project stops using the previous owner's brand. Registration toggle in `app_config`: survives restarts, isn't stored on user settings rows, missing means enabled, a legacy value is carried over (B8). Disabled users rejected immediately (B9). A deleted account's token doesn't sign in a new account with the same email (B16). A database error while authenticating isn't reported as a bad token (B17) |
| `test_claude.py` | 34 | 41 | The Claude client: the real Anthropic SDK against a fake Messages API at the HTTP transport. `generate_result()` streams a request with the result type as its response format when there's no web search; an answer that citations split across several text blocks is joined exactly, because anything between the pieces, even a newline, would corrupt the JSON. Web research uses the web search tool (the basic one on other models), submits through the strict `submit_result` tool (`eager_input_streaming`) and sets top-level `cache_control`; research that ends without a submission is reminded once, then fails; the last submission in a turn wins; cut-off or non-JSON submissions (2) aren't used. Only sources the searches returned are kept. The three-part system prompt caches its stable parts. `pause_turn` resumes send the whole turn so far, and endless pausing is stopped. Errors carry a `retryable` flag: missing key, refusal, rejected requests (4), overload retried, provider errors that outlast the retries (3), mid-stream errors and drops, unreachable provider, timeouts and the whole-call deadline. Every response is recorded in the organisation's usage ledger, and a failed ledger write doesn't lose the answer. Default models are current generation; models that can decline opt in to server-side fallbacks (2) |
| `test_database.py` | 10 | 10 | SSL argument chosen from the DSN (B13); a real pool connects without SSL; `select_one` returns `None` for IDs that cannot exist. Restarts add no `settings` rows (formerly a strict xfail). UUID-shaped and ISO datetime text is stored as text; ISO strings become dates and datetimes for date columns |
| `test_email.py` | 11 | 16 | Sending through a project's SMTP server with a recording `smtplib`: STARTTLS with the server certificate verified (or switched off), only the draft recipient, header line breaks can't add recipients, one-line subjects, invalid recipient addresses not sent (4), the connection closed when sending fails, incomplete settings (3) and unreachable servers reported. Contacts found in structured entries and free text; none in content that isn't an object |
| `test_events.py` | 7 | 7 | Live updates over PostgreSQL LISTEN/NOTIFY: members receive only their organisation's events; the listening connection closes with the last subscriber; operations publish their progress, failures, retries and deletions; the stream sends events and keeps the connection alive; the stream needs a signed-in member; the events endpoint streams Server-Sent Events |
| `test_extras.py` | 24 | 24 | Template CRUD and tag matching per workflow; a product ID in `source_product` (formerly a strict xfail). Captures. Calendar create, filter, delete, reschedule and edit (validation, owner only). Settings defaults, round trip, first save, and platform connections. Brand CRUD. Saving settings touches only the caller's row (B5). White-label fields persist and default to empty (B6). Brands accept only known fields, can't move to another user, require a name, leave null fields unchanged and validate lists (B7) |
| `test_jobs.py` | 13 | 16 | Durable jobs in PostgreSQL: launching queues a job the worker runs; a job whose worker stopped runs again when its lease runs out; temporary AI failures are retried, a waiting retry shows why, then delivers or reports; failures a retry won't change are reported at once (4); cancelling before and during a run; a time limit stops long runs; only the organisation's editors can cancel; a restart leaves queued operations for the worker; the in-process and standalone workers run jobs, and stopping hands unfinished jobs back |
| `test_jobs_edges.py` | 12 | 15 | Job queue and live-update edge cases: retry delays in words (4); a job cancelled while its worker was gone; a last attempt that stopped responding fails; a worker that lost its lease leaves the job to the new holder; the heartbeat rides out a database blip; a cancelled job stops as soon as its worker hears; a worker that can't listen still polls; workers keep going through a database outage, and a job released during one is left to its lease; publishing without an organisation does nothing; a publish that can't reach the database is logged, not raised; a subscriber that stops reading misses events instead of blocking others |
| `test_mailer.py` | 5 | 9 | The platform mailer (`MAIL_*` settings): sends through the platform mail server, logs and reports a failed send, sends nothing without complete settings (5), makes links absolute, and never reaches the real SMTP client in tests |
| `test_main.py` | 7 | 10 | SPA static files and client-route fallback, plus `/health`. Unknown `/api` route is a JSON 404, never the SPA (B10). The SPA fallback serves no file outside the build for encoded `..` paths (4, B18). Startup runs the migrations; a failed migration stops the app; the app starts without a reachable database; the JWT secret is never logged (F-7) |
| `test_members.py` | 17 | 17 | Organisation settings, members, invitations and the activity log: members see the organisation and owners rename it; the member list with roles; owners change roles and remove members, members leave, and an organisation always keeps an owner. Invitations: sent by email and listed while pending, inviting again replaces the earlier one, members can't be invited again, the link describes the invitation without signing in, accepting adds the signed-in user and works only for the invited address, invited people create an account even when registration is closed (valid password, new address), expired and withdrawn invitations don't work. The activity log records governed actions and pages backwards |
| `test_migrations.py` | 7 | 7 | Alembic on scratch databases: the migrations build the schema the old startup script built (`legacy_setup_schema.sql`), and a database that script created upgrades cleanly; `0003` gives every user an organisation, moves their data into it and downgrades; running the migrations again changes nothing; downgrading reaches an empty database; the test database is at the newest revision |
| `test_organisations.py` | 11 | 67 | Organisations, memberships and roles. Every action (36, from reading a project to setting the AI budget) against the viewer, editor, approver and owner roles, refused below its minimum role with the backend's message. From another organisation, every action on a specific resource (20) is not found; a calendar entry for another organisation's project doesn't reveal it; an organisation the user isn't in is not found (3). Requests without an organisation header use the user's own; `/me` lists organisations and roles, owned ones first; registering creates an organisation the user owns; members share the organisation's settings in operations; approved drafts belong to the organisation and sends record the sender; deleting an account keeps its work in a shared organisation; a transferred project moves into the target user's organisation |
| `test_password_reset.py` | 8 | 8 | Password reset: the same answer whether or not the account exists; nothing sent and no link logged without a mail server; rate limited; a reset link sets a new password and ends every session; expired or unknown links do nothing; administrators create one-time reset links. Invitations are emailed only when a mail server is configured |
| `test_products.py` | 26 | 26 | Product CRUD and checklist; 404 for unknown and malformed IDs. `project_type`, `launch_date` and `brand_id`: validation, brand ownership, unassign when the brand is deleted (B1). The SMTP password is write-only: kept through UI round trips, replaced when a new one is sent, used for sending (B2). SMTP passwords are encrypted at rest; passwords saved before encryption keep working and get encrypted; an unreadable one explains the fix; rotated keys still read older passwords (F-2). Saved timestamps are the current UTC time wherever the server runs (B19) |
| `test_queue.py` | 35 | 35 | Approval queue list and filters, get, review, delete. Approval creates email drafts from partnerships, cold outreach, announcements and saved press-target results inside the request, before the response, so the drafts exist even if post-response background tasks never run (as when the process stops straight after answering). Approval never sends and doesn't duplicate drafts on re-approval; the retired press targets workflow can't run; SMTP runs off the event-loop thread (B3). Email queue list, send (no SMTP, already sent, success, failure) and delete. Editable drafts: recipient validation, 409 once sent, failed resets to pending, empty edits, missing or foreign drafts (B4). Queue `limit` 1–500 (B15). Daily sending limit per account: sending stops at it, a limit of 0 says sending is switched off, and the quota counts this account's sends in the last 24 hours (F-3). The results summary behind the Operations playbook (`GET /api/queue/summary`, `4af499c`; all three seen failing first): a project's results counted by operation and status, and not another project's; results older than the newest 500 still counted — 500 newer ones inserted in bulk with `generate_series`, and a page of `GET /api/queue` shown to leave the old one out; an unknown or malformed project id is a 404, and no `product_id` a 422 |
| `test_resource_ids.py` | 1 | 6 | Malformed IDs return 404 on every `/{id}` route of queue, email queue, templates, brands, calendar and captures (one case per resource) |
| `test_results.py` | 6 | 40 | Structured AI results: every operation has a result type; the schema check catches what structured outputs wouldn't keep (a positive control); each of the 18 result schemas stays within what structured outputs accept, with closed objects and every field required (18); web research results list `sources` last, and other results have none (18); results reject fields they don't have; SEO structured data is stored as an object when it's JSON |
| `test_scraper.py` | 15 | 36 | The real scraper on a fake network (fake DNS, `httpx.MockTransport`). `MetadataParser`: head metadata, headings, JSON-LD and body text; body text leaves out inline scripts and styles (bug fix); incomplete markup is tolerated (4). `scrape_url`: follows redirects with the bot User-Agent, connects to the address it checked (so a second DNS answer can't redirect it), caps headings at 20, reports HTTP errors, connection failures and unknown websites. Only public web pages (F-6): 19 addresses refused before any request, such as non-web schemes, credentials in the URL, loopback, private, link-local and cloud metadata addresses, internal hostnames and DNS answers that mix public and private addresses; no redirects into private networks; at most five redirects; at most 2 MB read; web pages only |
| `test_security.py` | 15 | 22 | Hardening (F-7): outside debug mode, startup refuses a weak JWT secret (3) and a missing or invalid encryption key (2); debug mode starts with a development secret; API docs only in debug mode; cross-origin calls only from configured origins; security headers, and HSTS on HTTPS responses; rate limits on sign-in per account and per address, account creation per address, and AI operations per account; a cap on running operations per account; new passwords must be 8 to 72 bytes (5), including admin-created accounts; unknown accounts get the same password check, so response time doesn't reveal which emails have accounts |
| `test_sessions.py` | 14 | 15 | Sessions: signing in sets a refresh cookie scripts can't read, secure over HTTPS; access tokens last 15 minutes and expired ones are refused; refreshing rotates the cookie and issues a new access token; two tabs refreshing at once both stay signed in; refreshing without a cookie, with an expired refresh token or for a disabled account ends the session; reusing an old refresh token ends every session from that sign-in, and other sign-ins survive; a replayed token is still caught when the application's clock runs five seconds behind the database's, because the comparison is made in SQL against the `used_at` the database wrote; signing out revokes the refresh token; session routes need no access token (2) |
| `test_tenancy.py` | 9 | 9 | Isolation between two users' own organisations for products, queue (including the results summary, where another organisation's project is a 404), templates, captures, calendar (including not leaking a foreign project's name and color), brands and email queue (no SMTP call). Seven AI endpoints answer 404 for another organisation's product, without calling Claude or the scraper |
| `test_usage.py` | 27 | 30 | AI usage ledger, costs and budgets: costs follow the published prices (4 models); a model without a known price costs nothing and says so; web searches cost $10 per 1,000 on top of tokens; operations record who used what for which project; owners set a monthly budget; operations stop once this month's budget is used, and last month's spending doesn't count; owners see the month's usage by operation, project, member and model, and earlier months; calls to models without a price are counted separately. The platform default budget (`DEFAULT_MONTHLY_AI_BUDGET_USD`, default 25): an organisation that never set its own is capped by it, its own budget wins (the fixture's owner, being the platform admin, may set one above the default), clearing a budget falls back to it, and `0` leaves the organisation uncapped. Registration creates an organisation with no budget, and `ensure_within_budget` used to return at once when the budget was `NULL`, so a self-registered organisation had no cap on the deployment's single API key; all four tests were written to fail first. A negative default is refused at startup (`ge=0` on the setting), because the budget check treats anything at or below 0 as no cap, so a mistyped value would have removed the safeguard silently; `0` and positive values are accepted. The usage summary reports the budget that actually applies and whose it is (`effective_budget_usd`, `budget_source`): the platform default, the organisation's own, or none only when the default is `0`. `budget_usd` stays the organisation's own, for the budget form. The summary used to return only the stored budget, so under the default Settings → Usage said operations never stop for cost while they were capped. These five tests were written to fail first too. **Only a platform admin may set a budget above the platform default (BUG-031).** Registration makes every new account the owner of its own organisation, and an organisation's own budget wins over the default, so anyone could sign up and lift the cap on the deployment's API key with one request. Against `stranger`, a second registrant who isn't the platform admin: a budget above the default is refused (403, "The most an organisation can set is $25.00 a month.") and the default still applies; written to fail first, that test showed a stranger's $1,000,000 budget accepted. Three guard legitimate use and pass either way: an owner can set a budget below or at the default, or clear it; a platform admin can go above the default; with the default switched off (`0`), an owner sets any budget. **No refusal promises a raise nobody can make (B-15, `08705de`):** a platform admin can't reach an organisation they don't belong to, so the 429 at the default ends "Operations can start again next month.", for the fixture's owner and for `stranger` (`test_a_refusal_at_the_default_promises_no_one_can_raise_it`, renamed from `test_a_refusal_at_the_default_says_only_an_admin_can_raise_it`). **An owner can lower a budget stored above the default (BUG-032, `08705de`):** $500 to $400 is accepted, and raising it past its current amount is still refused (403, "This organisation's budget can be lowered, but not raised above its current $500.00."). `08705de`'s commit message records five tests failing before it: those two and three for the wording. **Two changes at once can't raise what the first set (`b607021`):** the check and the write run in one transaction with the organisation's row locked (`SELECT … FOR UPDATE` in `usage.set_budget`), so a change to $450 made while a change to $400 holds the row is checked against $400 and refused; before the fix it answered 200 and wrote $450 (section 3) |
| `test_workflows.py` | 35 | 78 | A background workflow result lands in the queue (pending, or failed with the readable AI error); unknown workflows are rejected, or fail if one reaches the job; a workflow for a deleted project fails. Operations ask for their structured result type with the right model and tools, and search the web only when their prompt needs it (12 workflows, 6 synchronous endpoints); market analysis gets room for a long report; the scraped page and notes go in the run details, not the cached parts of the three-part prompt (F-10). Startup fails operations a restart interrupted (F-9). Press kit generated and stored; press kit, press release and SEO report unreachable URLs. Repurpose. Social posts for the connected platforms. Press release contacts and notes. Market analysis is given the pricing to build on (4). Competitor preview text (B11) and previews of unexpected answers. Server-set `generated_at` and `source_url` on 5 report endpoints (B12). On 6 synchronous endpoints: AI configuration error 503 with the reason, provider error 502, timeout 504, refusal 422. A failed report keeps the saved one. Missing or foreign projects |
| **Total** | **375** | **570** | 570 passed |

### Frontend units: `frontend/src/lib/` and `frontend/src/app/` (Vitest)

| File | Defined | Run | What it covers |
|---|---|---|---|
| `src/app/queryClient.test.ts` | 3 | 3 | Query retries: none for a request the server refused, two when the server fails or can't be reached, and never for a change, so nothing (an email, say) is sent twice |
| `src/lib/api/client.test.ts` | 19 | 19 | `request()`: bearer token and JSON body; the chosen organisation sent with signed-in requests; FastAPI error messages (string and validation list); non-JSON fallback; an expired access token renewed once and the request retried, one renewal shared by requests that fail together, no renewal after a failed sign-in; a 401 that can't be renewed ends the session and tells the app why; unreachable-server message. `openEventStream()`: session headers, one renewal, ends the session when renewal fails, rejects refusals with the server's reason and answers that aren't an event stream, unreachable server. `tokenStore` when the browser blocks storage; `errorMessage` |
| `src/lib/api/endpoints.test.ts` | 4 | 61 | API helpers send the right method, path and body (58 cases, `it.each`); the live updates stream at `GET /api/events`; empty filters left out of list addresses; undoable deletes use keepalive only when told to. Not every helper is in the table: 18 of the 72 in `endpoints.ts` aren't called in this file — sign-out, the password reset, organisation, invitation and reset-link helpers, and `queueApi.summary`, whose request `app.playbook.test.tsx` asserts |
| `src/lib/api/sse.test.ts` | 10 | 10 | Server-Sent Events parser: the backend's stream (retry delay, keep-alive comments, named events); an event however chunks split it; CRLF, CR and LF line endings, including a CRLF split between chunks; data lines joined with newlines and empty data kept; exactly one space stripped after the colon; comments, unknown fields, events without data and a bad retry ignored; event type forgotten after dispatch; last event ID, but not one containing NULL; a cut-off event never dispatched; a byte order mark skipped at the start only |
| `src/lib/domain/channels.test.ts` | 7 | 7 | Channel names however the model spelled them, unknown platforms kept or called Channel; compose links for Threads, Reddit (project link titled with the post's first line, or a plain submission with the title cut to 280 characters), Facebook (link only, only when there is one), and none for channels without a share link |
| `src/lib/domain/checklist.test.ts` | 9 | 9 | Launch plan model: stored item keys, launch-day times on a 24-hour clock (hours before 8 are afternoon), custom items after built-in ones, progress that ignores custom-item arrays and stale keys, adding and removing custom items without moving ticks, an out-of-range index, immutable `setChecked` |
| `src/lib/domain/dates.test.ts` | 15 | 15 | Local date keys without UTC shift, malformed keys, day counts across month ends and DST, adding days, Monday-first month grid and weeks across month and year ends, month stepping, week and month labels, elapsed time (a date after two weeks), local timestamps, nothing formatted for missing or malformed values |
| `src/lib/domain/exporters.test.ts` | 12 | 12 | Plain text and Markdown exports (labelled lines, numbered lists, indented groups, no metadata or empty fields, text results); a numbered Sources list with addresses in Markdown, plain text and AI-assistant prompts, left out when there are none that can be listed; `downloadText` file name, type and release; `slugify` |
| `src/lib/domain/formatting.test.ts` | 23 | 23 | Field order restored after JSONB, with sources last; scenario and JSON-LD ordering; revenue chart parsing and ticks; compose links for X, Threads, LinkedIn and Instagram; Markdown, plain-text and assistant-prompt exporters (emoji stripped); queue helpers: stalled running items (not while retries could still be running a job), polling with and without live updates, running previews, SMTP readiness; report sections and SEO prompt; operations catalogue: retired and unknown workflows, which approvals create drafts, and exactly the web research operations list their sources |
| `src/lib/domain/playbook.test.ts` | 18 | 18 | The launch playbook (`src/lib/domain/playbook.ts`): the catalogue arranged as the order a launch actually runs in, seventeen operations in five stages. **Every catalogue operation is accounted for exactly once**, so a new operation can't be dropped from the playbook without the test saying so, and **tools stay out of the sequence**, because a tool's use can't be observed and counting it would leave the playbook permanently one step from finished. Stages build only on stages before them and open in a sensible order as launch approaches. Per operation: a saved report counts as done; a result still awaiting review counts too, so the work isn't asked for twice; a first run shows as running and isn't asked for again meanwhile; a failed one is asked for again; another project's result doesn't count. **Completion wins over a rerun.** Running an operation again (`POST /api/workflows/launch`) adds a running result and keeps the earlier ones; a finished operation stays done and one awaiting review stays counted while that happens, and the playbook moves on to the next stage when a finished one has a rerun in progress. `stateFromQueue` used to check `running` first, so re-running a finished operation reopened its stage; those three tests were written to fail first. Per project: a fresh project starts at the first stage with one operation named, nothing is recommended once every stage is finished, the current stage is behind only once its window has opened and there is a launch date to be behind, and unfinished groundwork is named without blocking the stage. The file is unchanged by pull request #6; the screen built on the module is tested in `app.playbook.test.tsx`, and since `4af499c` the module reads `ResultRecord`s (a project, an operation and a status), so a full result and a line of `GET /api/queue/summary` both fit |
| `src/lib/domain/projects.test.ts` | 18 | 18 | Project type (stored value or legacy prefix, default product), swatch colors and invalid values, `hasReport`, readiness score (plan 50, reports 30, profile 20; 80-character description; an assigned company counts), launch state (launched, unscheduled, overdue, at risk, on track), T-minus labels |
| `src/lib/domain/reports.test.ts` | 9 | 9 | Report contents: the sections with content, in reading order, for market analysis, press kit (including older field names), press release and SEO; sources last; nothing for a reply that couldn't be structured. SEO prompt for a coding assistant: each tag, JSON-LD as a script block or as given text, instructions even without usable tags |
| `src/lib/domain/sources.test.ts` | 5 | 5 | `resultSources`: title, safe address, site and age, in the order given; nothing for results without sources. Source exports in Markdown and plain text; a title with line breaks kept on one line |
| `src/lib/domain/usage.test.ts` | 12 | 12 | Usage months in UTC, stepping across year ends, never a malformed or future month, month names; dollars to the cent (tiny costs shown as under a cent), grouped counts, operation names from the catalogue; budget warning from 80% and used up from 100%; `canRaiseBudget` (2, `b607021`), the backend's rule on who can raise the budget that applies: a platform admin, anyone while the platform sets no default, and anyone else only while their organisation's own budget is below the default; `parseBudget` amounts and error messages |
| `src/lib/domain/values.test.ts` | 11 | 11 | Text and list coercion, threat-level and money parsing (refuses ranges and prose), compact money format, safe URLs (rejects unsafe protocols), emoji stripping, mid-sentence casing (keeps acronyms and proper nouns) |
| `src/lib/hooks/deferredDelete.test.ts` | 3 | 3 | Undoable delete: commits after the delay, undo cancels, closing the page sends pending deletes with keepalive (fake timers) |
| `src/lib/hooks/useTheme.test.ts` | 7 | 7 | Theme: follows the system until someone picks one, applies and remembers a choice, starts from a saved one, treats an unrecognised saved value as the system theme, going back to the system theme removes the override, keeps every control in step, still switches when the browser blocks storage |
| `src/lib/live/connection.test.ts` | 13 | 13 | Live updates connection: hands on queue and email changes and ignores comments, other events and unreadable data; opens the stream again after the server's retry delay (5 s by default) and says changes may have been missed; waits twice as long after each failure up to 5 minutes, also when the organisation or stream is refused, and gives up after 8 failures in a row; stops at once on a 401 that couldn't be renewed; resets the count once a stream opens; ending when aborted or stopped while waiting or opening |
| `src/lib/live/LiveUpdatesProvider.test.tsx` | 8 | 8 | Connected only while the stream is open; opens it through the API; refetches results on queue changes and the Outbox on email changes, once per burst, and both after reconnecting; starts again for another organisation, stops when unmounted, doesn't listen without an organisation; tries again when the browser is back online; drops a waiting refetch when it stops |

### Frontend components and pages (Vitest)

| File | Defined | Run | What it covers |
|---|---|---|---|
| `src/app/App.test.tsx` | 1 | 1 | The real app: a signed-out visitor opens on sign-in, and signing in lands on the portfolio |
| `src/components/results/results.test.tsx` | 33 | 61 | `WorkflowResult`: renders each of 12 workflow types and survives malformed output for each (`it.each`); empty competitor results, all three written to fail first: a column no competitor fills is left out, a competitor missing a value the column does carry is marked "Not found", and a profile heading with nothing under it is omitted; Reddit self-promotion warnings; launch platform priorities in words; unparsed, failed, text-only and empty results; unknown-workflow fallback; announcement version switch; a compose link that says what it prefills. `ReportBody`: renders each of 5 report types (`it.each`); SEO tag and JSON-LD order; revenue chart and scenario order; no chart for unreadable amounts; unstructured text notice; a prompt that tells a coding assistant to apply the SEO changes. Sources: numbered pages at the end of a research result, no update date when the search gave none, unsafe addresses as plain text, printed addresses, nothing without sources, a generic result's sources listed once, and the end of 3 research reports (`it.each`). Structured result shapes: trend players and direction, free directories, barrier severities and press distribution types in words. `RevenueChart`: amounts on hover and keyboard focus, and sizing |
| `src/components/ui/Markdown.test.tsx` | 4 | 4 | AI Markdown: links open in a new tab without access to LaunchOps; wide tables scroll sideways; HTML from the model shows as text and unsafe link addresses are dropped; web search citation tags are removed |
| `src/pages/RouteError.test.tsx` | 5 | 5 | Route error page: asks for a reload when a page's code changed since the app was opened (including Safari's wording); explains a crashed page and keeps the details for an administrator; reloads on request; offers a way back to the portfolio |

### Frontend app and contract tests: `frontend/src/test/` (Vitest)

| File | Defined | Run | What it covers |
|---|---|---|---|
| `src/test/app.auth.test.tsx` | 9 | 9 | Creating an account (opens the workspace signed in; sign-up closed; the server's reason). Showing the password. Session: expiry during a visit signs out with an explanation, then returns to the page; a disabled account is told why; an invalid saved session asks to sign in again; an unreachable server as the app opens, and carrying on once it's back; a temporary server problem as the app opens keeps you signed in |
| `src/test/app.calendar.test.tsx` | 15 | 15 | Navigation: months and today, a day's entries in the agenda, week back to month, filtering to one project (new entries go to it). Entries: the add dialog on a double-clicked day (month and week) or the agenda's day; edit and launch date dialogs stay open with the server's reason; removal from the agenda with deletion when the undo window closes. Drag and drop: drop-day highlight, only drags carrying a readable entry move, a launch moved back on Undo, a failed launch move put back with the reason, and a failed Undo leaves an entry or a launch on its new day and says so |
| `src/test/app.cancel.test.tsx` | 8 | 8 | Cancelling an operation: one that hasn't started fails at once with who cancelled it, and the log records it; a running one stops at its next check and shows failed when the live update arrives; nothing left to cancel; keeping it running, and why a cancel failed; a waiting retry in the list and the result; an operation running over an hour described as possibly stuck, with a cancel offer for editors. By role: a viewer is told cancelling needs the Editor role; an editor cancels from Review across projects |
| `src/test/app.library.test.tsx` | 7 | 7 | Templates: the selected template and the tag filter; copying, and a blocked clipboard; deleting with Undo before anything is sent; a failed delete brings it back with the reason; a new template stays open when it can't be saved. Switching between templates and ideas, and capturing an idea there |
| `src/test/app.live.test.tsx` | 10 | 10 | Live updates in the whole app: a finished result and new Outbox drafts appear without waiting for a poll; the stream reopens after a server restart and catches up; an event is read however lines and packets split it; reconnecting after a drop; listening to the organisation being worked in, and switching with it; stopping on sign-out; renewing an expired session when the stream is refused, or signing out and stopping when it can't be renewed; carrying on without live updates when the server refuses them, trying again later |
| `src/test/app.operations.test.tsx` | 12 | 12 | Operations page: stop using an idea. Workflows: the started workflow opens in Review from its notification; the run sheet stays open with the server's reason. Reports: market analysis based on the saved pricing strategy, or asks for pricing or says it will be estimated; the page address checked before a press kit; a press release with the given contacts; why a page couldn't be read for SEO; the saved report opens from its notification; a warning before closing the page while a report runs. Repurpose: why content couldn't be repurposed, and a version that can't be saved as a template |
| `src/test/app.optimisticUpdates.test.tsx` | 1 | 1 | A launch plan tick shown before the server confirms it is removed, with the reason, when it can't be saved |
| `src/test/app.organisation.test.tsx` | 16 | 16 | Switcher: organisation and role shown, switching shows that organisation's projects, the first organisation used when the remembered one is no longer the user's. Settings: an owner renames the organisation, changes a role or removes someone; why the last owner can't step down; invitation links created, listed and withdrawn; other members see the organisation without owner controls; leaving, then working in the remaining organisation; a member opening Activity is sent to the organisation page. Activity: who did what, newest first, with older entries; nothing recorded. Invitation links: joining when signed in with the invited address, creating an account, signing in first, a user signed in with another address, a link that no longer works |
| `src/test/app.outbox.test.tsx` | 15 | 15 | Sends only after confirmation showing recipient and sender; email server setup instead of Send when a project can't send; saving draft edits. Daily sending limit: how much is used, the reached limit explained without Send, why Send is unavailable, only as many selected drafts as the limit still allows, and a server limit of 0 described as sending switched off. Unsent, sent or all email with statuses; sending selected drafts with the refused ones reported; clearing a selection, and a cancelled confirmation sends nothing; sending from the editor after saving; a draft that can't be saved stays open; deletion when the undo window closes unless undone; a project's own Outbox |
| `src/test/app.pageErrors.test.tsx` | 2 | 2 | Not-found page with a way back; a crashed page's error shown inside the shell, so navigation keeps working |
| `src/test/app.planning.test.tsx` | 11 | 11 | Calendar: launch dates and adding an entry, drag to reschedule with undo, a failed move put back with the reason, dragging a launch date, editing an entry, changing a launch date without dragging, week view. Library: new template with tags; idea into operation instructions. Capture an idea from the top bar. New project with type and launch date |
| `src/test/app.playbook.test.tsx` | 15 | 18 | The Operations screen's launch playbook (`src/components/operations/Playbook.tsx`; its rules are tested in `playbook.test.ts`). It opens on "Next up": the one operation to run now and its stage ("Next up · Stage 1 of 5 · Understand the market"), with a Run button that opens that operation's run sheet. The recommendation moves on as results arrive, each operation shows Done, In review or Failed, and the stage heading counts "3 of 4"; the current stage is open and the others a click away. A stage behind its window says so, with the launch date in words (4, `it.each`: tomorrow, today, yesterday, 3 days ago), where a passed date used to read "launch is -3 days away". A stage that becomes current while the screen is open opens, and the finished one stays open. What's finished is read from `GET /api/queue/summary`, and the screen's other requests for results each ask for one status. Groundwork a stage builds on is named without stopping anyone running it; when every step is done it says so, with nothing to run; the tool that saves nothing stays out of the steps ("Always available"; the meter reads "0 of 17 steps done"); a viewer sees the plan with no way to run it; a stage whose work is all running or in review waits on review, with a link to Review; if results can't be loaded it says so and still guides from saved reports; and "All operations" (`?view=all`) switches to the catalogue by category, and back. Twelve came with `53456fc`; six with `4af499c`, seen failing first with the updated "can't be loaded" test |
| `src/test/app.portfolio.test.tsx` | 6 | 6 | Overview: launches, results awaiting review and unsent email summarised; what needs attention, most urgent first; launch days and calendar entries for the next 14 days in date order. Launch board: sort by launch date, readiness or name, filter by status or text; a project opens from anywhere on its row except the row's controls; an empty portfolio invites the first project |
| `src/test/app.project.test.tsx` | 9 | 9 | Launch plan: tick shows at once and survives slow loads (race regression test using `latency`); saves the whole checklist; removing a custom item keeps the other ticks. Project settings: assign a company profile; never send a blank SMTP password. Operations: run with instructions; the run sheet offers templates tagged for the operation and adds one to the instructions; show the server's reason when a report can't run (`reportResponse`); save a report and offer to open it |
| `src/test/app.projectPages.test.tsx` | 12 | 12 | Project overview: next-step links, inline status and launch date, T-minus and readiness breakdown. Reports: list with state, open and export as Markdown, the pages a report's research relied on in its contents and export, prompt to generate a missing report. Repurpose and save as template. Delete a project after typing its name. Shell: command palette, running workflows with any waiting retry and possibly stuck ones flagged, sign out |
| `src/test/app.projectSettings.test.tsx` | 6 | 6 | Project details: only changed details saved; the server's reason when they can't be saved; unsaved edits discarded per section. A new SMTP password is saved and never shown again. Deleting: the typed name is forgotten when the dialog is cancelled; a failed delete stays on the project and says why |
| `src/test/app.projectWorkspace.test.tsx` | 11 | 11 | Project header: a project that doesn't exist, with a way back; a load failure isn't called missing; capturing an idea from the header. Overview panels: results awaiting review first in next steps, recent operations with their state; this project's calendar entries for the next 30 days; a launch change that can't be saved keeps the saved status; this project's ideas listed, captured and removed. Launch plan: adding a custom item. Report pages: no report at an address; print, or copy as a prompt for an AI assistant; SEO changes copied as a prompt for the analysed page |
| `src/test/app.review.test.tsx` | 18 | 18 | Review: approving an outreach result explains what happens (no `/send` request); an approved partnership scan brings its contacts into the Outbox as drafts; run a failed operation again with the same instructions; a research result ends with its sources and exports them with addresses; competitor results as a ranked table. Across projects: filter by status and project; an empty status. Keyboard: J and K, but not while typing or with a modifier key; on a narrow screen J opens the first result. Reviewing: reject, move back and approve; a failed action leaves the result waiting; a running operation explained, with cancel or delete for one that may be stuck; delete with Undo. Exporting: copy as plain text, Markdown or an AI prompt; a blocked clipboard; a Markdown download named after project and operation; save as a template tagged for its operation, including a retired operation's result |
| `src/test/app.roles.project.test.tsx` | 14 | 14 | Organisation roles in a project: a Viewer sees the overview without changing controls (told capturing ideas needs the Editor role), operations and the run sheet without Run, reports they can open and export but not generate or run again, the launch plan locked, and project settings locked with deleting needing the Owner role. An Editor changes the launch status, captures ideas, runs an operation, ticks and adds plan items and changes settings, but can't delete the project; nor can an Approver. An Owner still has the header actions, next-step links, Generate and Run again |
| `src/test/app.roles.review.test.tsx` | 8 | 8 | Organisation roles in Review and the Outbox: a Viewer reads and exports results and drafts with nothing to approve, reject, delete, edit, send or save as a template, and isn't pointed to email server setup; an Editor saves results as templates, runs failed ones again, edits drafts and sets up sending, but approving, sending and deleting need the Approver role; an Approver approves, moves back, selects, sends and deletes. Asserts no changing request is sent |
| `src/test/app.roles.settings.test.tsx` | 9 | 9 | Organisation roles in Settings: a Viewer sees workspace branding, brand voice and AI preferences, channels and company profiles locked (no New, Edit or Delete, and no offer to create the first company) while the theme stays theirs; an Editor saves each of them |
| `src/test/app.roles.workspace.test.tsx` | 14 | 14 | Organisation roles in the shell, portfolio, calendar and library: a Viewer gets no way to create a project, capture an idea or run an operation, isn't invited to create the first project, sees the launch board without New project, isn't advised to cancel a possibly stuck operation, sees calendar entries without ways to add, change or move them, and reads and copies templates and ideas without saving, using or deleting them, with the role requirement where a gap would confuse. An Editor captures, creates, adds and moves entries, and saves and deletes templates; an Owner still has every control |
| `src/test/app.sessions.test.tsx` | 8 | 8 | Staying signed in: a session that expired while the app was closed is renewed; signing out ends the session on the server. Forgotten passwords: a reset link from the sign-in page, a new password from a reset link and carrying on signed in, a link that no longer works explained with a new one offered. Administrators create one-time reset links. Invitations say whether they were emailed, depending on the mail server |
| `src/test/app.settings.test.tsx` | 24 | 24 | Workspace settings: white-label branding with logo preview and wordmark fallback, a non-http(s) logo refused, a channel in use and its handle, companies created and edited sending only known or managed fields, a new company's save error, deleting a company warns how many projects fall back, and a company kept when deleting is cancelled or fails. Voice & AI: AI preferences saved without touching the brand voice, keywords as tags, edits kept when saving fails. Team & access: close sign-up and change a role; no self-disable or self-demotion; add a person (only once the password has 8 characters; a failure keeps the form); admins only; disable and re-enable a member; a failed change leaves the role; delete someone else after confirmation; transfer a project after confirmation, and a failed transfer |
| `src/test/app.shell.test.tsx` | 14 | 14 | Command palette: runs an operation on the open project (only while one is open), captures an idea or starts a project, switches the theme, goes to each workspace page, opens a project, its reports or its plan. Top bar and navigation: search opens and the shortcut closes it; the theme from the account menu; navigation counts named as separate words (regression test for rail link names); navigation on a small screen. Capture dialog: asks for a project first; Ctrl+Enter saves and links to the ideas; the idea stays on screen when it can't be saved. New project dialog: the description counts toward readiness, and why a project couldn't be created |
| `src/test/app.usage.test.tsx` | 26 | 26 | Settings → Usage: an owner sees this month's estimated cost, budget use and where it went; month navigation, never past this one, with this month shown for a future or malformed month; an empty month; calls without a cost estimate (several, or one); a used-up budget, and a past month over budget without saying operations are stopped now; setting the budget after checking the amount, and removing it; save and load errors; anyone but an owner is told usage needs the Owner role. When the budget is used up: the run sheet, report generation, repurposing and running a failed operation again each say why. The platform's default budget, all three written to fail first: an organisation without a budget of its own is shown the default it is held to, not "no budget"; removing its own budget says the default applies again; and an operation stopped at the default says it was the default budget that was reached — and, since `08705de`, that operations can start again next month. **Only someone who can raise a budget is told they can** (`08705de`, `b607021`; B-15): beside the default, a platform admin is told they can set a higher one, and an owner who isn't one that the default is the most an organisation can set, with no mention of a platform administrator; an owner on the default whose operations have stopped reads "AI operations can't start again until next month.", and the budget field's hint doesn't mention raising it, while an owner whose own budget is below the default is still told "…, unless the budget is raised." An owner who isn't a platform admin is shown the server's refusal when they ask for more than the default ("The most an organisation can set is $25.00 a month."), with nothing saved, and can lower a budget stored above the default, $500 to $400 (BUG-032). When nothing has run yet in the current month, an empty state takes the place of the month's summary, which used to be the only place the budget appeared, so a brand-new organisation saw no sign of its cap. Two tests, both written to fail first (`7dbc35d`): a new organisation is told the platform default applies, and "no monthly budget" is said only when there really is none. No test asserts the wording for an organisation's own budget (gap 16) |
| `src/test/app.workspace.test.tsx` | 6 | 6 | Sign-in returns to the requested page; wrong-password message. Portfolio launch board ordered by what needs attention. Saving the brand voice keeps other settings. Undoable idea delete: Undo sends nothing, and the delete is sent after the window |
| `src/test/fakeApi.test.ts` | 7 | 9 | Contract check: the operations catalogue's workflow `templateTags` equal `BACKEND_WORKFLOW_TAGS`, the fake's copy of the backend tag map. The fake's own rules: refusing a cancel for a viewer, and usage and the budget below Owner (3, `it.each`); only web research reports' results end with sources; every send refused at a daily limit of 0; usage summarised per UTC month, most expensive first; budget validation and logging; AI operations stop at the budget |

**Vitest total: 562 defined, 652 run in 51 files.**

### Browser: `frontend/e2e/` (Playwright, Chromium)

| File | Defined | Run | What it covers |
|---|---|---|---|
| `e2e/smoke.spec.ts` | 3 | 3 | Portfolio to project to market analysis report in the production build, with no page errors and the Mona Sans font applied. Dark theme chosen from the account menu persists across reload. Navigation collapses into a menu at 390×844 |
| `e2e/golden.spec.ts` | 12 | 12 | Main task per screen, asserting on recorded API requests: sign in and return, create a project, run a workflow with instructions, open an operation from the command palette, review with the keyboard and approve, send outbox drafts after confirmation, tick a launch plan item, drag a calendar entry and undo, download a report as Markdown (ending with its numbered sources), print a report with each source's address, save a library template, save the brand voice |
| `e2e/a11y.spec.ts` | 1 | 56 | axe-core WCAG 2.2 A/AA scan of 28 screens × light and dark themes (one `test()` inside two loops). "All operations" (`?view=all`) joined in `53456fc`, when Operations began opening on the playbook |
| `e2e/responsive.spec.ts` | 1 | 28 | The same 28 screens at 390×844: the document may not be wider than the viewport, and a failure names the element whose removal would fix the overflow (one `test()` inside a loop) |

**Playwright total: 17 defined, 99 run.**

### Test support files (not tests)

| File | Role |
|---|---|
| `backend/tests/conftest.py` | Backend fixtures, fakes and the network guard (see section 2) |
| `backend/tests/legacy_setup_schema.sql` | The frozen schema the old startup script built. `test_migrations.py` checks the migrations against it |
| `backend/.coveragerc` | Coverage scope (application code only, including `migrations/`) and the 95% gate |
| `frontend/src/test/setup.ts` | Vitest setup: jest-dom, a 10 s async lookup timeout, jsdom stubs, MSW lifecycle with unhandled requests as errors; ends open live-update streams after each test |
| `frontend/src/test/server.ts` | The MSW `setupServer()` instance |
| `frontend/src/test/fakeApi.ts` | In-memory backend fake and request recorder: organisation and role guard, members, invitations, activity, sessions and password resets, live-update controls (`liveUpdates`), usage ledger and budgets, including the platform default (`defaultBudget`, `effectiveBudget`) and the refusal of a budget above it from anyone but a platform admin unless it lowers one already above it, the results summary (`GET /api/queue/summary`), running jobs, `RESEARCH_SOURCES`, the daily email limit including the limit-0 refusal, template tags (`BACKEND_WORKFLOW_TAGS`) and approval-to-draft rules; also `makeState`, `makeProject`, `id` |
| `frontend/src/test/renderApp.tsx` | `renderApp()` and `requestsTo()` |
| `frontend/src/test/roles.ts` | `stateAs(role)` for tests as a Viewer, Editor or Approver; `changesRequested()` for asserting nothing was changed or refused |
| `frontend/e2e/support/fakeBackend.ts` | `useFakeBackend(page, state)` and `requestsTo()` for Playwright. Answers `/api/events` with `retry: 5000` and ends, because Playwright can't stream a routed response |
| `frontend/e2e/support/workspace.ts` | `sampleWorkspace()` sample data, including an invitation and a reset link (`SAMPLE_INVITATION_TOKEN`, `SAMPLE_RESET_TOKEN`), activity, usage against a $50 budget, and results with sources |
| `frontend/e2e/capture.mjs` | Manual screenshot tool (not a test) |

---

## 5. Coverage snapshot (2026-09-18, latest run at `b607021`)

### Backend (pytest-cov, statement coverage of application code)

**98.33%**: 3,356 statements, 56 missed. `backend/.coveragerc` leaves out the tests and virtual environments, and the run fails below 95%.

Application modules below 95%:

| Module | Coverage | What isn't run |
|---|---|---|
| `migrations/env.py` | 84.21% | Offline `--sql` mode, logging set up from `alembic.ini`, and the error for a missing `DATABASE_URL` |
| `services/ratelimit.py` | 90.74% | Hits leaving the time window, and the clean-up of idle keys every 1,000 checks |
| `services/audit.py` | 92.86% | Shortening quoted text over 80 characters in activity summaries |
| `worker.py` | 93.10% | The `python worker.py` entry point (`__main__`) |

Between 95% and 100%: `routers/organisations.py` 95.38%, `main.py` 95.83%, `routers/queue.py` 96.17%, `services/usage.py` 97.65%, `database.py` 97.66%, `services/scraper.py` 97.71%, `services/access.py` 98.25%, `routers/auth.py` 98.31% and `services/claude.py` 98.33%.

Everything else is at 100%: `config.py`, `models.py`, `routers/events.py`, `routers/extras.py`, `routers/products.py`, `routers/workflows.py`, `services/auth.py`, `services/email.py`, `services/events.py`, `services/field_crypto.py`, `services/jobs.py`, `services/mailer.py`, `services/pricing.py`, `services/results.py` and the seven migrations `0001`–`0007`.

The modules that were weakest on 2026-09-14 are now covered: `services/email.py` from 54.55% to 100%, `services/claude.py` from 57.69% to 98.33%, and `routers/workflows.py` from 82.73% to 100%.

Per-module figures come from the full runs' `backend/.coverage`, read with `python -m coverage report --no-skip-covered --precision=2`. The default report rounds to whole percentages. **The 2026-09-18 run at `b607021`** recorded the totals, and `coverage report` on that run's `.coverage` data gives the three application modules pull request #6 changed: `services/usage.py` 85 statements, 2 missed; `routers/queue.py` 209 statements, 8 missed; and `routers/organisations.py` 195 statements, 9 missed, 95.38%. The two-decimal figures above follow from those counts. `services/usage.py` gained nine statements (`08705de` and `b607021`: lowering a budget stored above the default, and `set_budget` checking and writing under one row lock) and kept its 2 missed. `routers/queue.py` gained the summary route (`4af499c`); since the pull request only added lines to the module, its earlier 96.02% can only have been 193 of 201 statements, so the route's eight statements are all run — worked out, not measured. In `routers/organisations.py` the separate check and write became one call to `usage.set_budget`, one statement fewer, with the same 9 missed — measured, and in step with the totals (3,340 + 9 + 8 − 1 = 3,356 statements, still 56 missed). Every other module's figure is from an earlier run, and none of their code has changed since. Earlier runs, newest first: the budget-statement run at `7dbc35d` recorded only the totals, which are the BUG-031 run's exactly, because that commit changed no backend application code, only a test's docstring. The BUG-031 run (2026-09-17, 564 tests with `--cov`, after `a53b26e`) moved two, both in files the fix changed: `services/usage.py`, 97.06% → 97.37% (76 statements, 2 missed), and `routers/organisations.py`, 95.38% → 95.41% (196 statements, 9 missed). The fix added nine statements — eight in `services/usage.py`, for `ensure_budget_allowed()` and the refusal's choice of who can raise a used-up budget, and one in `routers/organisations.py`, the call that applies the ceiling — and all of them run; the two missed in `services/usage.py` are still lines 21–22, `_uuid`'s answer for a value that isn't a UUID. Only those two per-module figures were recorded from that run; the others are from the review-fixes run, when every module was measured. None of their code had changed then, and the totals agreed: outside those two modules the application had 3,068 statements, 45 of them missed. The review-fixes run moved `services/usage.py` from 96.77% to 97.06% (68 statements, 2 missed), with six statements for `effective_budget()` and the usage summary's new fields, and gave `config.py` one statement, the import behind the setting's `ge=0` floor, which stays at 100%. The run before that moved `services/usage.py` from 96.43% to 96.77% (62 statements, 2 missed), when the platform default budget added code.

### Frontend (Vitest, V8)

| Date | Statements | Branches | Functions | Lines | Tests |
|---|---|---|---|---|---|
| 2026-09-18, pull request #6 at `b607021` (latest) | 97.13% | 90.24% | 96.59% | 99.19% | 652 passed in 51 files |

Behind those percentages: 3,825 of 3,938 statements, 3,110 of 3,446 branches, 1,502 of 1,555 functions and 3,317 of 3,344 lines. Pull request #6 grew the totals by 64 statements, 82 branches, 24 functions and 50 lines, and the missed counts went from 113, 332, 53 and 26 at `7dbc35d` to 113, 336, 53 and 27: four more branches and one more line are unrun than before. The run's saved per-file report, which leaves out files at 100% on all four measures, lists four of the files pull request #6 changed, and two of them hold misses it added: `components/operations/Playbook.tsx` (statements 97.67%, branches 92.59%, functions 100%, lines 97.14%), where `Playbook.tsx:36`, the multi-item branch of `listOf` ("A, B and C"), is the one missed line added since 1.1.3 — no test has two unfinished groundwork stages at once, and it has been there since `53456fc`; and `lib/domain/usage.ts` (branches 97.29%), where `lib/domain/usage.ts:77`, the `?? 0` fallback in `canRaiseBudget` for an own budget that is null, is a missed branch — a state the API never returns (`b607021`). The other two, `lib/api/endpoints.ts` (line 64) and `lib/queries/hooks.ts` (branches 69.23%), show only misses that predate pull request #6. Across the review fixes the missed lines and branches did not move: from `08705de` (lines 3,298 of 3,325; branches 3,086 of 3,422) to `b607021` (3,317 of 3,344; 3,110 of 3,446), still 27 and 336. Lines fell from 99.21% to 99.19%, still above the 95% gate. Vitest ran at `--maxWorkers=2` (gap 14), twice, with identical figures. At `7dbc35d` (the budget-statement run: 97.08% / 90.13% / 96.53% / 99.21%, 628 passed in 50 files), every total grew with `BudgetStatement` — 5 statements, 6 branches, 1 function and 5 lines — and no missed count moved.

`return "running"` in `stateFromQueue` — the one statement and branch in `src/lib/domain/playbook.ts` that the "later still" run left unrun, then on line 120 — has been run since the review fixes by "shows a first run as running, and does not ask for it again meanwhile". No run since has recorded that module's per-file figures, the 2026-09-18 run included; `4af499c` changed only the module's types (`ResultRecord`), which add no statements. The BUG-031 run's per-file table didn't list it: Vitest turns on the `text` reporter's `skipFull` when it detects an AI agent (through `std-env`, from variables such as `CLAUDECODE` and `AI_AGENT`, both set in this project's Claude Code sessions), and `skipFull` leaves out only files at 100% on statements, branches, functions and lines alike. From an ordinary terminal the table lists every file. So the module's absence is consistent with 100% on all four, but no figure for it was read. The "later still" run had it at **100% lines and 100% functions** (36 of 36, 24 of 24), 98.07% statements (51 of 52) and 96.96% branches (32 of 33), so with that line run it should now be at 100% on all four — worked out, not measured.

### Playwright

- **Result:** 99 passed: 3 smoke, 12 golden path, 56 accessibility (28 screens × light and dark) and 28 responsive (the same 28 screens at 390×844). "All operations" is the new screen.
- **Browser:** locally, the pre-installed headless shell through the temporary config (section 2), at `--workers=4`: at the default 8 workers, two full runs each had a different phone-width screen time out (gap 13). CI installs Chromium.
- **Last run record:** don't use `frontend/test-results/.last-run.json` as evidence for these figures. It holds only the most recent Playwright run of any kind, and temporary screenshot runs count: there were some on 2026-09-17 and on 2026-09-18.
- **Coverage:** browser runs collect none.

### History

| Run | Backend tests | Backend coverage | Vitest tests | Vitest S / B / F / L | Playwright |
|---|---|---|---|---|---|
| 2026-09-14, earlier | 151 passed, 2 xfailed | 92% with tests; 85% application code (1,522 statements, 228 missed) | 165 in 15 files | 82.17 / 71.45 / 77.47 / 86.43 | 54 passed |
| 2026-09-14, later | 162 passed, 2 xfailed | 90.84% application code (1,528 statements, 140 missed) | 168 in 16 files | 82.31 / 71.56 / 77.87 / 86.47 | 54 passed |
| 2026-09-16/17 | 548 passed | 98.31% application code (3,311 statements, 56 missed) | 601 in 49 files | 97.03 / 89.97 / 96.47 / 99.19 | 69 passed |
| 2026-09-17 19:0x | 550 passed in 164.63 s | 98.31% application code (3,316 statements, 56 missed) | 601 in 49 files | 97.03 / 89.97 / 96.47 / 99.19 | 69 passed |
| 2026-09-17, later | 554 passed | 98.32% application code (3,324 statements, 56 missed) | 601 in 49 files | 97.03 / 89.97 / 96.47 / 99.19 | 96 passed |
| 2026-09-17, later still | 554 passed | 98.32% application code (3,324 statements, 56 missed) | 618 in 50 files | 97.05 / 90.07 / 96.53 / 99.2 | 96 passed |
| 2026-09-17, review fixes | 559 passed | 98.32% application code (3,331 statements, 56 missed) | 625 in 50 files | 97.07 / 90.11 / 96.53 / 99.2 | 96 passed |
| 2026-09-17, BUG-031 fix | 564 passed | 98.32% application code (3,340 statements, 56 missed) | 626 in 50 files | 97.07 / 90.11 / 96.53 / 99.2 | 96 passed |
| 2026-09-17, budget-statement fix | 564 passed | 98.32% application code (3,340 statements, 56 missed) | 628 in 50 files | 97.08 / 90.13 / 96.53 / 99.21 | 96 passed |
| 2026-09-18, pull request #6 at `b607021` (latest) | 570 passed | 98.33% application code (3,356 statements, 56 missed) | 652 in 51 files | 97.13 / 90.24 / 96.59 / 99.19 | 99 passed |

The 2026-09-17 19:0x run was backend only, on a fresh scratch cluster (port 56433): it added `test_claude.py::test_an_answer_split_across_text_blocks_is_joined_exactly` and `test_sessions.py::test_a_reused_token_is_caught_even_if_the_app_clock_lags_the_database`. The Vitest and Playwright figures in that row are carried over unchanged from 2026-09-16/17. The later runs added the four platform default budget tests in `test_usage.py`, with the 8 new application statements they cover, and the 27 tests in `e2e/responsive.spec.ts`; its Vitest figures are carried over too, because no `src/**` TypeScript changed — only four CSS Modules files. The "later still" run was the frontend alone: it added `src/lib/domain/playbook.test.ts` (14 tests) and three empty-state tests in `results.test.tsx`, so its backend and Playwright figures are carried over unchanged, and both 95% gates still pass. The review-fixes run covers the fixes for the review of pull request #5 (`6b97da3` and `43ab3e6`); every figure in it was measured, one suite at a time, with Vitest at `--maxWorkers=2` (gap 14). It added five tests in `test_usage.py`, four in `playbook.test.ts` and three in `app.usage.test.tsx`, and all 7 application statements the fixes added are run (6 in `services/usage.py`, 1 in `config.py`). Playwright is unchanged at 96, and both 95% gates still pass. The BUG-031 run covers `a53b26e`, which stops an organisation owner who isn't a platform admin setting a budget above the platform default; every figure in it was measured, one suite at a time, with Vitest at `--maxWorkers=2`. It added five tests in `test_usage.py` and one in `app.usage.test.tsx`, and all 9 application statements the fix added are run (8 in `services/usage.py`, 1 in `routers/organisations.py`). Its Vitest coverage counts are identical to the review-fixes run's, because the only frontend application code `a53b26e` touched was the wording of one paragraph in `UsageSettings.tsx`, and the fake backend's new rule is in `src/test/**`, which coverage leaves out. Playwright is unchanged at 96, and both 95% gates still pass. The budget-statement run covers `7dbc35d`, the last code commit on pull request #5, which makes Settings → Usage say which budget applies when nothing has run yet in the current month; every figure in it was measured, one suite at a time, with Vitest at `--maxWorkers=2`. It added two tests in `app.usage.test.tsx`, both written to fail first. `test_usage.py` changed only in a docstring and no backend application code changed, so the backend measured exactly as in the BUG-031 run. The Vitest coverage counts moved this time, because `BudgetStatement` is new application code (section 5). Playwright is unchanged at 96, and both 95% gates still pass.

The 2026-09-18 run covers pull request #6 up to its last code commit, `b607021`: the playbook screen (`53456fc`), the budget rule for BUG-032 and B-15 (`08705de`), and the fixes for the automated review (`4af499c`, `b607021`). Every figure in it was measured one suite at a time: the backend against the scratch cluster on port 56433, Vitest at `--maxWorkers=2` (twice, identical) and Playwright at `--workers=4` (gap 13). It added six backend tests (three in `test_queue.py` and three in `test_usage.py`, plus an assertion in `test_tenancy.py`), 24 Vitest tests (18 in the new `app.playbook.test.tsx`, four in `app.usage.test.tsx`, two in `usage.test.ts`) and three Playwright tests ("All operations" in both themes and at phone width). Every change was written test-first. Seen failing before their fix: three backend tests before `4af499c` and one before `b607021` (and five before `08705de`, as its commit message records); seven frontend tests before `4af499c` (the six new ones and the updated "can't be loaded" test) and three before `b607021`. Both 95% gates still pass.

### Against the constitution's gates

| Gate | Threshold | Backend | Frontend |
|---|---|---|---|
| PR | 85% line | Met: 98.33% | Met: 99.19% lines |
| Deploy | 95% | Met: 98.33%. Enforced by `fail_under = 95` | Met for lines: 99.19%, enforced by `thresholds.lines = 95`. Branches are at 90.24% and not gated |
| New code | 95% | Not measured (no diff coverage) | Not measured |
| Security-critical (auth/payment/data) | 95% | Met for `routers/auth.py` (98.31%), `services/auth.py` (100%), `services/access.py` (98.25%), `services/field_crypto.py` (100%) and `database.py` (97.66%). Below it: `services/ratelimit.py` (90.74%) and `services/audit.py` (92.86%). All from earlier runs; none of these modules has changed since | Not recorded per file |

Tooling enforces the totals at the 95% deploy gate, which covers the 85% PR gate: backend statements via `.coveragerc`, frontend lines via `vitest.config.ts`. Per-module figures, branch coverage and function coverage are not enforced.

---

## 6. Known gaps and debt

1. **No automated test calls the real Anthropic API.**
   - The automated suites check the request shapes against a fake transport only (`test_claude.py`): structured outputs, the strict `submit_result` tool with `eager_input_streaming`, top-level `cache_control`, web search and the server-side fallback opt-in. Every other test fakes `generate_result`.
   - **Checked by hand on 2026-09-17:** a one-off manual smoke test ran `services.claude.generate_result` against the live API with the production key (`railway run --service launchops`). All three calls returned valid results, for about $0.10 in total:
     - a non-research operation on `claude-sonnet-5` (structured response format);
     - a research operation on `claude-sonnet-5`: 3 web searches, the strict `submit_result` tool with `eager_input_streaming`, top-level `cache_control` (about 15,000 cache-read tokens), and 6 sources kept after verification;
     - a non-research operation on `claude-opus-5` with the server-side fallback beta header.
   - The request shapes are confirmed against the live API, but nothing checks them automatically: the manual check covers the code as it was on 2026-09-17.

2. **Branch coverage is below statements and lines, and nothing gates it.**
   - Frontend: branches 90.24% (statements 97.13%, functions 96.59%, lines 99.19%). Only lines are gated.
   - Backend coverage is statement-only (no branch coverage in `.coveragerc`).
   - The gates apply to totals. Four backend modules are below 95%: `migrations/env.py`, `services/ratelimit.py`, `services/audit.py` and `worker.py` (section 5).
   - Coverage of new code (diff coverage) isn't measured.

3. **No browser test runs against the real backend.**
   - Every Playwright spec uses the in-memory fake. The real API contract, auth, CORS and schema are exercised only by the backend tests.
   - The fake mirrors backend rules by hand: template tags, approval-to-draft rules and contact extraction, role minimums, the daily email limit, usage summaries, the budget stop and which budget applies (`effectiveBudget`, a copy of `effective_budget()`), who may set a budget above the platform default or lower one already above it (a copy of `ensure_budget_allowed()`), and the results summary (`GET /api/queue/summary`).
     - `src/test/fakeApi.test.ts` ties the frontend catalogue to the fake's copy of the tag map. Its other tests check the fake against expectations written from the backend, not against backend code.
     - Not mirrored: name guessing from nearby words, and the result list's `limit` and newest-first order (gap 15).
   - Live updates in Playwright reconnect every 5 s against the fake instead of streaming, so no browser test sees an event arrive. Streamed events are covered in Vitest (`app.live.test.tsx`, `LiveUpdatesProvider.test.tsx`).
   - **`GET /api/queue/summary`, new in pull request #6, is checked by reading both sides rather than by a test that spans them.** The frontend's request (`/api/queue/summary?product_id=`) and the fields it reads (`product_id`, `workflow_id`, `status` and `count`, in `QueueSummaryRow`) were read against `backend/routers/queue.py` and match, and the route itself is covered against real Postgres by `test_queue.py` and `test_tenancy.py`. A signed-in check against a local backend wasn't done: the assistant doesn't create accounts or enter passwords.

4. **No mutation, load, property-based or visual-regression tests.** Examples of each: mutmut or StrykerJS; a load tool; hypothesis; Playwright screenshot comparison. `e2e/capture.mjs` only produces screenshots for manual review.

5. **Automated accessibility checks catch only part of WCAG issues.** Manual keyboard and screen-reader passes are still needed before a release. The scan itself also has gaps:
   - It runs at the desktop viewport only. `e2e/responsive.spec.ts` covers the same 28 screens at 390×844, but only for sideways scrolling, not for accessibility.
   - Not scanned: `/register`, the not-found page, three of the five report documents (pricing, press kit, press release), and dialogs other than the run sheet (for example New project, Capture an idea, send confirmation, command palette).

6. **The backend has no type gate.** mypy is in neither `requirements-dev.txt` nor CI. The frontend has `tsc -b`.

7. **Ruff runs with its default rules only, and formatting isn't checked.** There is no ruff config and no `ruff format --check`.

8. **Some checks run only in CI, and one audit is narrow.**
   - gitleaks has never run on this development machine, and `npm audit` can't reach the registry here (section 2).
   - pip-audit checks `requirements.txt` only, not the test and lint tools in `requirements-dev.txt`.

9. **Playwright runs Chromium only.**
   - There is no Firefox or WebKit project. Phone layout is checked at 390×844 by `e2e/responsive.spec.ts` (28 screens, sideways scrolling only) and one smoke test (navigation collapsing into a menu); nothing checks a tablet width, and nothing else about a small screen is asserted.
   - Locally, the browser is a pre-installed headless shell rather than one Playwright installs (section 2).

10. **An untracked `test-pipeline.yml` would fail if committed.**
   - It is a generic template that expects `app/`, a root `tsconfig.json` and pnpm.
   - Its Python job would run, because it detects `backend/requirements.txt`, then fail at install, since it installs from the repo root.

11. **The test headers' bug IDs are mapped nowhere.** `B1`–`B13` and `B15`–`B19` exist only as backend test section headers, and there is no `B14` group (unrelated to B-14 in `docs/ROADMAP.md`). `docs/BUGS.md` numbers bugs separately, BUG-001 to BUG-032, and doesn't map these IDs to its entries.

12. **Nothing stops a stray spec from joining the Playwright suite.** `frontend/playwright.config.ts` uses `testDir: "e2e"` with `testMatch: "*.spec.ts"`, so any file dropped in `e2e/` is collected silently. On 2026-09-17 a temporary screenshot file created as `e2e/_audit-shots.spec.ts` would have added 63 failing tests to `npm run e2e` had the suite been run before it was deleted; the convention that `e2e/capture.mjs` is a tool, not a test, is documented but unenforced. **Safe pattern** (used afterwards): name a temporary Playwright file `*.pwtest.ts` and point a throwaway config's `testMatch` at it, so the real suite can never collect it.

13. **Browser tests flake under CPU contention; investigated 2026-09-17, seen again 2026-09-18, cause not proved.** Recorded so the work isn't repeated.
   - **The failure:** `e2e/golden.spec.ts` → "launch plan: ticking an item saves the checklist" failed once in GitHub Actions on `a2124a9` (run 35281944055) with `locator.check: Clicking the checkbox did not change its state`; the other 95 of 96 passed. **Re-running the same job on the same commit, with no code change, passed all 96.** It reproduced locally at **2 in 25** with `--repeat-each=25 --workers=6`, that is only under CPU contention from several parallel browsers; later, on a quieter machine, **200 iterations produced zero failures**, so it could not be reproduced on demand.
   - **No user-facing defect was demonstrated.** In every instrumented run the `PATCH` reached the server with the correct body and the tick landed. The only thing that failed was the assertion window under six-way CPU contention, which is not a condition a user meets.
   - **Ruled out, with the method** (the diagnostics used the `*.pwtest.ts` plus throwaway config pattern from gap 12):
     - **Not the CSS on that branch.** The changed files were `Results.module.css`, `Display.module.css`, `PortfolioPage.module.css` and `ReviewPage.module.css`; the checkbox is styled by `src/components/ui/Field.module.css`, untouched.
     - **Not the role gate.** `ViewOnlyFieldset` uses a real `<fieldset disabled>`, so Playwright would wait rather than click. Instrumenting the page confirmed the checkbox is never inside a fieldset, never disabled, and not remounted when `GET /api/auth/me` resolves — the DOM node was tagged with an attribute and the same node survived.
     - **Not a slow single-project GET.** Delaying `GET /api/products/{id}` by 600 ms still ticked correctly.
     - **Not request ordering.** With every `/api/**` call jittered by 0–160 ms and the fake backend's checklist reset between attempts, 40 of 40 ticks landed. **The trap that made a first attempt at this misleading:** the fake backend keeps its state between navigations, so without resetting the checklist each iteration every second attempt merely un-ticks the previous one and looks like a failure.
   - **A hypothesis investigated and dropped — anyone drawn to it needs a different instrument.** The suspicion was that the optimistic write in `useUpdateChecklist` (`frontend/src/lib/queries/hooks.ts`) lands late, because `onMutate` awaits `queryClient.cancelQueries(...)` before calling `storeProject`. Three unit tests were written to pin the invariant "the tick is written to the cache before `onMutate` awaits anything". **They failed both before and after reordering the code, because the test itself was invalid: TanStack Query does not invoke `onMutate` synchronously from `mutate()`, so no ordering inside `onMutate` can satisfy a synchronous assertion.** The speculative reordering was reverted and the tests deleted.
   - **The change made:** `908f46d` replaced `.check()` with `await item.click()` then `await expect(item).toBeChecked()`, which retries (section 3, Browser). **The existing `PATCH` assertion is unchanged, so the test still proves the tick was saved** — nothing was loosened about what it verifies. **The fix could not be A/B'd**, because the flake stopped reproducing once the machine was quiet; the reasoning rests on the failure message, which only `.check()` can emit. If this test fails again it will fail differently, and more informatively.
   - **Seen again on 2026-09-18, on other screens** (pull request #6 at `b607021`). `playwright.config.ts` sets no `workers`, so a local run starts half the logical processors — 8 of this machine's 16 — and at that count two full local runs each had a different phone-width screen time out after 10 s waiting for the screen to render: "Run sheet", then "Calendar month". Both passed on their own ("Run sheet" 5 of 5 with `--repeat-each 5`; the whole responsive spec 28 of 28), and the full suite passed, 99 of 99, at `--workers=4`. Pull request #6 changed neither `RunSheet.tsx` nor the calendar page (the run sheet opens over the Operations screen, which it did change). A different screen each time, each passing alone, fits CPU contention rather than a defect in either screen; as before, the cause isn't proved. **Run the full suite locally with `--workers=4`** (section 2). CI is unaffected.

14. **The Vitest suite isn't reliable at default concurrency on this development machine — measured 2026-09-17; the cause is likely, not proved.** `npm run check` and `npm run coverage` go red here with no change at all, so **a red frontend run is not by itself a regression**: re-run the failing file on its own, or the suite with `--maxWorkers=2` (`npx vitest run --maxWorkers=2`, or `npm run coverage -- --maxWorkers=2`), before believing it. This goes further than gap 13's warning about CPU contention: it happens on a quiet machine at the default worker count, not only under heavy parallel load.
   - **First sign:** one `npm run coverage` run reported **1 failed of 618** between two green runs. The failing test's name wasn't captured, so that failure stays unattributed.
   - **Measured on a quiet machine.** Before measuring, every `node` process was checked by command line: all were `@modelcontextprotocol/server-pdf` MCP servers belonging to other sessions, and no test runner of any kind was running.
     - **Pull request #5's branch, full `npx vitest run`, 3 runs:** 618 passed; 3 failed; 2 failed.
     - **`main`'s frontend source, 4 runs:** 2 failed; 7 failed; 1 failed; 1 failed. **4 of 4 runs red, so the flakiness is pre-existing on `main`** and wasn't introduced by that branch's changes. Method: `git checkout main -- frontend/src`, then restored, with `frontend/src` confirmed identical to `HEAD` afterwards. That checkout left the branch's two new playbook files in place, but nothing else imported them then.
     - **Most frequent failures across the 7 runs:** `src/test/app.review.test.tsx` → "Review > opens the first result and explains what approving an outreach result does", **6 of 7**, including all 4 on `main` — close to deterministic on this machine at default concurrency; `app.library.test.tsx` → "Library templates > shows the template you pick and filters the list by tag", 3 of 7; `app.projectPages.test.tsx` → "Reports > lists reports with their state", 2 of 7; `app.planning.test.tsx` → "Library > creates a template with tags operations look for", 1 of 7.
     - **Green:** a run at `--maxWorkers=2` (618 passed), and CI on GitHub Actions.
   - **Likely mechanism — not confirmed.** `vitest.config.ts` sets no `maxWorkers`, so `vitest run` starts one worker per logical processor minus one: 15 on this machine's 16. Each test file sets up its own jsdom — Vitest's run summary reports it created 50 times a run, at 25–43% of tracked time, and itself suggests `pool: 'vmThreads'`. With 15 files starting together, a Testing Library lookup or `waitFor` runs out of time. The limit here is the **10 s** `asyncUtilTimeout` set in `src/test/setup.ts`, not Testing Library's 1 s default, and section 1 records the first lookup in a file taking up to 7 s to load its lazy route on a busy machine.
   - **No fix has been applied.** Candidates for the owner to decide: cap `maxWorkers` in `vitest.config.ts`; raise `asyncUtilTimeout` in `src/test/setup.ts` beyond 10 s; or `pool: 'vmThreads'`, which sets jsdom up once per worker instead of once per file.
   - **Runs that proved nothing.** Three earlier runs overlapped another documentation agent's repeated `npm run coverage` — one attempt couldn't even start, because the other run held `frontend/coverage`. They were red 3, 1 and 7 of 618 and count in neither direction: `app.operations.test.tsx` → "opens the started workflow in Review from its notification", which failed in two of them, passed **5 of 5** run alone on a quiet machine.
   - **Process lesson:** never let two documentation agents run the test suites at the same time. The 2026-09-17 session did, and it produced a batch of red runs that proved nothing.

15. **The fake backend's `GET /api/queue` ignores `limit` and ordering.** `frontend/src/test/fakeApi.ts` returns every matching result in the order it was added, where the backend returns the newest first and at most `limit` (1–500). So no frontend test could see the problem `4af499c` fixed: the playbook read what was finished from a page of the newest 500 results, and an operation whose only approved result was older looked unfinished and was recommended again. The backend test `test_queue.py::test_summary_counts_results_older_than_the_newest_500` covers it instead. Making the fake sort newest-first was considered and rejected: tests that create results a millisecond apart would then see them in an unpredictable order. Until the fake models the page, anything that depends on its size or order can be tested only in the backend.

16. **No test asserts `BudgetStatement`'s wording for an organisation's own budget.** In the current month, before anything has run, Settings → Usage says which budget applies (`BudgetStatement` in `frontend/src/pages/settings/UsageSettings.tsx`). The platform-default sentence and the no-budget sentence are tested in `app.usage.test.tsx`; the third, "Your organisation's budget of $X applies: operations stop when a month's cost reaches it.", is not, so a change to it would go unnoticed.
