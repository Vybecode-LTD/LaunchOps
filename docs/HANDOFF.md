---
document: HANDOFF
version: 1.1.1
last-updated: 2026-09-17T20:10:00Z
last-audit: 2026-09-17T20:05:00Z
managed-by: session-orchestrator/handoff-builder
---

# Session Handoff

## Where the project stands

- **Phases 0 (stabilise), 1 (foundation) and 2 (interface rebuild) are complete.** Phase 3 (real actions) is next and not started.
- **Live in production** on Railway at **https://launchops.run** (HTTPS, certificate issued 2026-09-17, valid to 2026-12-16). First ever deployment of this app.
- `main` is at **`bc6143c`** and is what production runs. Every push to `main` deploys.
- **This session's work is merged and live.** Pull request #3 (branch `fix/refresh-token-clock-skew`) merged as merge commit **`bc6143c`** after all three CI jobs passed — backend (550 tests, 95% coverage gate, `postgres:18` service), frontend (lint, typecheck, Vitest, build, Playwright) and the gitleaks secret scan. Six commits: `35d24c5` the BUG-027 fix, `584cff6` a regression test, `7c1f1cb` the session-end documents, `39ff28b` the design-system correction, `ee4932a` the reconciliation fixes, `c486949` the branch-state notes. Railway deployed `bc6143c` at **19:47:08Z**; the previous deployment (`f143f1c`) is being removed. **The BUG-027 security fix is in production.**
- **Verified live after the deploy:** `GET /health` → 200 `{"status":"ok"}` · `POST /api/auth/refresh` with no cookie → 401 `{"detail":"Your session has ended. Sign in again."}` · `GET /api/auth/me` with no token → 401 · HSTS present.
- Everything in pull request #3 is committed, merged and deployed. As of the 2026-09-17T20:05:00Z documentation audit the only working-tree changes were the post-merge documentation updates themselves — uncommitted, on branch `docs/record-the-merge`, which carries no commits of its own yet; confirm with `git status`. `.github/workflows/test-pipeline.yml` is permanently untracked.
- **All quality gates green:** backend 550 passed / 98.31% coverage, frontend 601 passed in 49 files / 99.19% lines, Playwright 69 passed, ruff + ESLint clean, pip-audit and npm advisories clear, gitleaks passing in CI.

## Start here — confirm a green baseline

```bash
cd backend;  python -m pytest        # needs local PostgreSQL (db name must contain "test")
cd frontend; npm run check           # lint + typecheck + Vitest
```

The test DSN is `DEFAULT_TEST_DSN` in `backend/tests/conftest.py` (`postgresql://postgres@127.0.0.1:56432/launchops_test?sslmode=disable`); override with `TEST_DATABASE_URL`. **Never let two pytest runs share one test database** — two suites running concurrently left the 56432 cluster deadlocking with foreign-key violations mid-session, so this session finished against a freshly created scratch cluster on **56433**, pointed at with `TEST_DATABASE_URL`. The local backend runs on **8765**, not 8000. **This machine has tooling limits** — Playwright cannot download its browser (use the installed headless shell via a temporary config), `npm audit` cannot reach the registry, gitleaks runs in CI only, pip-audit needs truststore. All of it is written up in **`docs/TESTING.md`**.

## What this session delivered

Took a working tree uncommitted since March (272 files, +53,795 / −5,076) to committed, CI-green and deployed. Closed findings F-1 to F-18, landed decisions D1–D16 (organisations and the Viewer → Editor → Approver → Owner ladder, invitations, activity log, refresh-token sessions, durable PostgreSQL jobs, SSE live updates, structured AI results with verified sources, prompt caching, usage ledger and budgets), finished the Phase 2 leftovers, and fixed **18 bugs, each with a test written to fail first**: 17 during that work — including the `ADMIN_EMAIL` fix that closed first-account takeover *before* going public — and, as the eighteenth, BUG-027, the refresh-token replay in the next paragraph. The first 17 shipped as PR #1 and PR #2; BUG-027 shipped as PR #3. All of it is deployed.

**Found and fixed after that, during reconciliation:** `POST /api/auth/refresh` decided whether a refresh token was a replay by comparing the application's clock (`datetime.now(UTC)`) against a `used_at` that PostgreSQL had written with `NOW()`. Two clocks — and on Railway the app and the database are separate services, so the skew is real. When the app's clock read behind the database's, an already-rotated (stolen) token was **accepted** instead of revoking the whole token family. It showed up as an intermittent failure of `tests/test_sessions.py::test_reusing_an_old_refresh_token_ends_every_session_from_that_sign_in`: one full run in, one out. The fix in `backend/routers/auth.py` lets the database's own clock decide — the same `SELECT` now computes `r.used_at < NOW() - $2::interval AS reused`. The regression test was written first and confirmed failing against the old code (200 instead of 401): `test_a_reused_token_is_caught_even_if_the_app_clock_lags_the_database`, which monkeypatches the app clock five seconds slow.

Full detail: the **Progress** section of `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`. Decisions: `docs/PHASE1_DESIGN.md`.

## Next steps — priority order

All four P1 items are account/DNS/console housekeeping, not code — nothing this session touched moved them. IDs are from `docs/ROADMAP.md` → Active.

1. **T-1 — Delete `guard-check@example.com`** and "Guard check's organisation" on the live site. A verification probe created it after the admin account already existed. Platform admin removes it in **Settings → Team & access**.
2. **T-2 — Confirm who holds the first (admin) account**, and decide whether open registration stays on (the switch is platform-wide, in `app_config`).
3. **T-3 — Update the Spaceship CNAME** for `launchops.run` to **`xesm2hmr.up.railway.app`**. Re-adding the domain to clear a stalled certificate produced a new target; DNS still points at the old `5rlc9k25.up.railway.app`. Traffic and the certificate work today anyway.
4. **T-4 — Delete the Railway project token** that was pasted into chat. Treat it as exposed; issue a new one when needed.
5. **T-5 to T-8 (P3, optional):** turn on Wait for CI on the `launchops` service; turn on Postgres backups; delete the detached empty volume `postgres-volume-qVKY`; set `MAIL_*`.
6. Then **Phase 2 follow-up** — brand kernel (D15), result history (D16), billing settings — then **Phase 3: real actions**.

## Blocked on the owner

Nothing below moves without a decision; each is written up with its working default in `docs/ROADMAP.md` → Blocked (B-1 … B-12). B-13 (merging this session's pull request) is **resolved** — #3 is merged and deployed.

- **Plan section 8** (B-1 to B-7): frontend rebuild confirmation, organisation model semantics, email posture, social scope, models and budgets, design sign-off, deploy shape.
- **D15 brand kernel** (B-8, B-9, B-10): does a project's brand override the organisation's voice field by field or wholesale; which role may edit it; should each result record the brand version it used.
- **D8 reset links** (B-11): may organisation owners create password reset links, or platform admins only (current behaviour)?
- **Billing** (B-12): what is metered and charged, so billing settings can be designed.

## Warnings — do not learn these the hard way

- **These documents go stale the moment work merges.** It happened twice today: five documents were committed a minute after being written while still calling the work uncommitted, then the same lines needed correcting when the pull request opened and again when it merged. Read anything describing the working tree, a branch or a pull request **against its `last-updated`**, and re-check it with `git log` before you trust it.
- **Frontend failures seen under heavy parallel load are suspect.** An `npm run check` during this session reported 4 failures while the backend suite and several documentation agents were competing for the machine; a clean re-run passed 601/601 and CI passed the frontend job too. **Re-run alone before believing a red frontend.**
- **Never run sign-up or registration probes against the live site.** One did this session and created a real account (T-1).
- **Never run two pytest suites against the same test database.** That is what produced this session's deadlocks and foreign-key violations; a second run corrupts the first one's fixtures.
- **Merge pull requests with merge commits, never squash or rebase.** `.gitleaksignore` entries are per-commit fingerprints (`commit:file:rule:line`); rewriting hashes breaks them and the secret scan starts failing on already-reviewed findings. All three pull requests so far were merged this way.
- **Never commit `.github/workflows/test-pipeline.yml`.** It is a generic template, not wired to this repo, and shows permanently as `??` in `git status`. Never `git add -A` without reading the staged diff.
- **Managed docs are edited only through their subagents** — `CLAUDE.md`, `docs/ROADMAP.md`, `docs/TESTING.md`, `docs/HANDOFF.md` and the rest. Hand edits drift the shared version and frontmatter.
- **Every push to `main` deploys to production.** Commit on a branch, open a pull request, merge after CI passes. Do not commit without asking the owner.
- **Bug fixes need a test that fails first** — fail-before, pass-after. All 18 fixes this session follow it.
- **No automated test calls the real Anthropic API.** Everything uses a fake transport and an autouse guard fails any test that reaches the network; the live smoke test was manual and one-off, so real-API regressions are not covered by CI.

## Key locations

| What | Where |
|---|---|
| Production | Railway project **"Launch Ops"**, environment production, US East — services **`launchops`** (root `Dockerfile`, worker in-process) and **`Postgres`** (Postgres 18 + volume). Also reachable at `https://launchops-production-0457.up.railway.app` |
| Repo | GitHub **`Vybecode-LTD/LaunchOps`**, branch `main` at `bc6143c`, deploys on every push |
| Set in Railway | `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `APP_URL`, `ADMIN_EMAIL`, `ANTHROPIC_API_KEY`. `MAIL_*` deliberately unset — nothing is emailed; links are shared by hand |
| `CLAUDE.md` | The project in one file: what it is, current state, stack, architecture, the 18 operations, screens, commands, environment variables, conventions, deployment and CI. Read it first |
| `docs/ROADMAP.md` | Milestones, Active tasks (T-1…T-8), Blocked (B-1…B-12), Next up, Backlog |
| `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | Findings, the full phased plan, and **Progress** — the authoritative status |
| `docs/BUGS.md` | Bug registry — 27 bugs, none open, each with the regression test that failed first |
| `docs/PHASE1_DESIGN.md` | Decisions D1–D16 and the reasoning behind them |
| `docs/TESTING.md` | Frameworks, how to run everything, per-file inventory, coverage, and this machine's workarounds |
| `docs/DESIGN_SYSTEM.md` · `SOURCE_MAP.md` | Design tokens and components · file-by-file map |
