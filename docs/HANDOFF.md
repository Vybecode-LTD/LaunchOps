---
document: HANDOFF
version: 1.1.2
last-updated: 2026-09-17T21:24:00Z
last-audit: 2026-09-17T20:45:00Z
managed-by: session-orchestrator/handoff-builder
---

# Session Handoff

## Where the project stands

- **Phases 0 (stabilise), 1 (foundation) and 2 (interface rebuild) are complete.** Phase 3 (real actions) is next and not started.
- **Live in production** on Railway at **https://launchops.run** (HTTPS, certificate issued 2026-09-17, valid to 2026-12-16). First ever deployment of this app.
- `main` is at **`0ce65dd`**, the merge of pull request #4 (branch `docs/record-the-merge`, two commits: `9f7e930` recording the merge, the deployment and a second audit, `6a54c04` pointing the changelog row at the newest entry). Pull request #4 was **documentation only** — `git diff --name-only bc6143c..0ce65dd` touches only `CLAUDE.md` and files under `docs/`, no application code — so **`bc6143c` remains the last commit that changed application code**, and production's behaviour is unchanged. Whether Railway deployed `0ce65dd` was **not confirmed** this session (no dashboard check was made; the token in use is itself exposed and awaiting rotation, T-4), and it carries no code change either way. Every push to `main` deploys.
- **This session's work is merged and live.** Pull request #3 (branch `fix/refresh-token-clock-skew`) merged as merge commit **`bc6143c`** after all three CI jobs passed — backend (550 tests, 95% coverage gate, `postgres:18` service), frontend (lint, typecheck, Vitest, build, Playwright) and the gitleaks secret scan. Six commits: `35d24c5` the BUG-027 fix, `584cff6` a regression test, `7c1f1cb` the session-end documents, `39ff28b` the design-system correction, `ee4932a` the reconciliation fixes, `c486949` the branch-state notes. Railway deployed `bc6143c` at **19:47:08Z**; the previous deployment (`f143f1c`) is being removed. **The BUG-027 security fix is in production.**
- **Verified live after the deploy:** `GET /health` → 200 `{"status":"ok"}` · `POST /api/auth/refresh` with no cookie → 401 `{"detail":"Your session has ended. Sign in again."}` · `GET /api/auth/me` with no token → 401 · HSTS present.
- **Everything is committed and merged.** The post-merge documentation updates that the 2026-09-17T20:05:00Z audit found uncommitted on `docs/record-the-merge` — a branch that then carried no commits of its own — were committed there and merged as pull request #4 (`0ce65dd`). The working tree is now clean apart from `.github/workflows/test-pipeline.yml`, which is permanently untracked; confirm with `git status`.
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

**Two of the four P1 items are now closed** — T-2 and T-3, both settled on 2026-09-17. The two still open, **T-1 and T-4**, remain account and console housekeeping rather than code, and **T-4 is the only open item with a security consequence**. IDs are from `docs/ROADMAP.md` → Active.

1. **T-1 — Delete `guard-check@example.com`** and "Guard check's organisation" on the live site. A verification probe created it after the admin account already existed. Platform admin removes it in **Settings → Team & access**.
2. **T-4 — Rotate the Railway project token again: the current one is exposed.** This has now happened twice. The first token was pasted into chat, then deleted and replaced — and **the replacement was pasted into chat as well**, so the token in use today is exposed and must be rotated again. The owner pastes it deliberately, because `railway login` will not authorise on this machine, and rotates at the end of every session, which bounds the exposure — an informed, settled decision, recorded here as context rather than a fault. The hard line: **a token must never reach a commit**, because CI runs gitleaks over the full git history. Never write a token value into a file, a document or a commit message.
3. **T-2 — DONE (2026-09-17).** The platform admin — `users.role = 'admin'`, and the holder of `ADMIN_EMAIL` — is **`color8studios@gmail.com`**. **Open registration deliberately stays on:** the platform-wide switch in `app_config` is unchanged and enabled, an owner decision with the residual risk accepted.
4. **T-3 — DONE (2026-09-17), independently verified.** The Spaceship record now points at **`xesm2hmr.up.railway.app`**, the target that re-adding the domain produced. The apex is CNAME-flattened, so there is no CNAME to read and the check is by address: against public DNS (Google `8.8.8.8`), `launchops.run` resolves to **`69.46.46.46`** — identical to `xesm2hmr.up.railway.app`, and different from the old `5rlc9k25.up.railway.app` at `69.46.46.62`.
5. **T-5 to T-8 (P3, optional):** turn on Wait for CI on the `launchops` service; turn on Postgres backups; delete the detached empty volume `postgres-volume-qVKY`; set `MAIL_*`.
6. Then **Phase 2 follow-up** — brand kernel (D15), result history (D16), billing settings — then **Phase 3: real actions**.

## Blocked on the owner

Nothing below moves without a decision; each is written up with its working default in `docs/ROADMAP.md` → Blocked (B-1 … B-12). B-13 (merging this session's pull request) is **resolved** — #3 is merged and deployed.

- **Plan section 8** (B-1 to B-7): frontend rebuild confirmation, organisation model semantics, email posture, social scope, models and budgets, design sign-off, deploy shape.
- **D15 brand kernel** (B-8, B-9, B-10): does a project's brand override the organisation's voice field by field or wholesale; which role may edit it; should each result record the brand version it used.
- **D8 reset links** (B-11): may organisation owners create password reset links, or platform admins only (current behaviour)?
- **Billing** (B-12): what is metered and charged, so billing settings can be designed.

## Warnings — do not learn these the hard way

- **These documents go stale the moment work merges.** It happened three times today: five documents were committed a minute after being written while still calling the work uncommitted, then the same lines needed correcting when the pull request opened and again when it merged — and then the documentation merge itself (pull request #4, `0ce65dd`) left six current-state claims across two documents still naming `bc6143c` as the head of `main`. It is the same failure recurring. Read anything describing the working tree, a branch or a pull request **against its `last-updated`**, and re-check it with `git log` before you trust it.
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
| Repo | GitHub **`Vybecode-LTD/LaunchOps`**, branch `main` at `0ce65dd`, deploys on every push |
| Set in Railway | `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `APP_URL`, `ADMIN_EMAIL`, `ANTHROPIC_API_KEY`. `MAIL_*` deliberately unset — nothing is emailed; links are shared by hand |
| `CLAUDE.md` | The project in one file: what it is, current state, stack, architecture, the 18 operations, screens, commands, environment variables, conventions, deployment and CI. Read it first |
| `docs/ROADMAP.md` | Milestones, Active tasks (T-1…T-8), Blocked (B-1…B-12), Next up, Backlog |
| `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | Findings, the full phased plan, and **Progress** — the authoritative status |
| `docs/BUGS.md` | Bug registry — 27 bugs, none open, each with the regression test that failed first |
| `docs/PHASE1_DESIGN.md` | Decisions D1–D16 and the reasoning behind them |
| `docs/TESTING.md` | Frameworks, how to run everything, per-file inventory, coverage, and this machine's workarounds |
| `docs/DESIGN_SYSTEM.md` · `SOURCE_MAP.md` | Design tokens and components · file-by-file map |
