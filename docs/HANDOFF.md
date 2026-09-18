---
document: HANDOFF
version: 1.1.4
last-updated: 2026-09-18T06:39:21Z
last-audit: 2026-09-18T06:35:00Z
managed-by: session-orchestrator/handoff-builder
---

# Session Handoff

## Where the project stands

- **Phases 0 (stabilise), 1 (foundation) and 2 (interface rebuild) are complete.** Phase 3 (real actions) is next and not started.
- **Live in production** on Railway at **https://launchops.run** (HTTPS, certificate valid to 2026-12-16).
- **`main` = `origin/main` = `477eaa4`, the merge of pull request #5** (2026-09-18T04:43:03Z, a merge commit, not a squash). **Production serves `477eaa4`'s build:** at 04:43:44Z the live site's JavaScript bundle changed to `index-D1A5232b.js`, whose Settings → Usage chunk contains "default budget of", `43ab3e6`'s text, which only pull request #5's code has; re-confirmed at 05:14:16Z (same bundle, `GET /health` 200 `{"status":"ok"}`) and at 06:09:38Z, when the same chunk held `7dbc35d`'s sentence and still #5's note naming a platform administrator: all of #5's code, none of #6's. **The Railway dashboard's deployment record was not read.**
- **BUG-028 to BUG-031 are fixed on `main` and in production.** Every organisation without a budget of its own is held to the $25 platform default; owners can lower or clear their budget; only a platform admin can set one above the default. That caps each organisation, not the total (B-14, decided: no total cap). **BUG-032 is now in production too:** it came in with the merge, it fails safe (it refuses some decreases the rule allows and permits nothing the rule forbids), and it stays live until pull request #6 merges and deploys.
- **Pull request #6 is open, not merged:** https://github.com/Vybecode-LTD/LaunchOps/pull/6, branch `feat/playbook-ui`, based on `main` at `477eaa4`. Oldest first: `53456fc` the playbook on the Operations screen · `08705de` BUG-032 and B-15 · `4af499c` Codex's review · `b607021` CodeRabbit's review. **The last code commit on pull request #6 is `b607021`**, and this 1.1.4 documentation is committed on top of it. Nothing on #6 is on `main` or in production.
- **CI and the working tree — re-check both, don't trust this file.** All three CI jobs passed on `08705de`, and again on `b607021`, the last code commit (green by 05:57:07Z). The documentation commit on top of it gets its own run, and that is the one the merge waits for: read `gh pr checks 6` until all three are green on the pull request's latest commit. `git status -sb` says what is true locally; `.github/workflows/test-pipeline.yml` stays untracked by design.
- **Measured 2026-09-18 at `b607021`, one suite at a time:** backend pytest **570 passed, 98.33%** of application code (3,356 statements, 56 missed), against the scratch cluster on 56433 via `TEST_DATABASE_URL`; Vitest (`npm run coverage -- --maxWorkers=2`, run twice, identical) **652 passed in 51 files, 99.19% lines** (3,317 of 3,344; statements 97.13%, branches 90.24%, functions 96.59%); Playwright (Chromium, through the temporary local-browser config, at `--workers=4`) **99 passed**: 3 smoke, 12 golden path, 56 accessibility (28 screens × 2 themes), 28 at 390px. ESLint (zero warnings), `tsc -b` and ruff are clean; both 95% gates pass. Since 1.1.3 (564 / 628 in 50 files / 96, at `7dbc35d`): backend +6, frontend +24, Playwright +3 ("All operations" in both themes and at phone width).

## Start here — confirm a green baseline

**Expect both test clusters to be stopped at session start**, so `python -m pytest` fails to connect before it tests anything. This session's run used **56433** (`launchops_test`); **56432** (`launchops_test` beside the local dev database `launchops`, 4 local accounts) was started for a signed-in check that wasn't done, then stopped again. Check with `pg_isready -h 127.0.0.1 -p 56433`. **`docs/TESTING.md` section 2** (How to run → Backend) says where the scratch clusters' data directories live and gives the `pg_ctl` command to start one, or how to `initdb` a fresh one in the current scratchpad — never under OneDrive.

```bash
cd backend;  python -m pytest        # once a cluster is up; set TEST_DATABASE_URL for any port but 56432
cd frontend; npm run lint; npm run typecheck; npx vitest run --maxWorkers=2
```

**Don't use `npm run check` for the baseline:** at default concurrency the Vitest suite fails intermittently on this machine with no change at all; it is green at `--maxWorkers=2` and in CI (`docs/TESTING.md` gap 14). **Playwright can't download its browser here:** run it through a temporary `frontend/playwright.local-browser.config.ts` (section 2; delete it afterwards and never commit it — none is left in the repository) at **`--workers=4`**. At the default 8 workers (16 cores), two full runs each had one different phone-width screen time out — "Run sheet", then "Calendar month" — and both passed alone (new evidence for gap 13; CI is unaffected). **Don't believe a red run until it repeats run alone.** The test DSN is `DEFAULT_TEST_DSN` in `backend/tests/conftest.py` (port 56432, database `launchops_test`); the local backend runs on **8765**, not 8000. `npm audit` cannot reach the registry, gitleaks runs in CI only and pip-audit needs truststore (`docs/TESTING.md`).

## What this session delivered — pull request #5 merged, pull request #6 open

- **Pull request #5 merged and deployed (T-9)** as `477eaa4`, after all three CI jobs passed on its last commit, `ce12024` (the 1.1.3 documentation). T-9's signed-in check of Settings → Usage was not done — the assistant can't sign in — and moves to T-10.
- **The Operations screen opens on the launch playbook** (`53456fc`; `frontend/src/components/operations/Playbook.tsx`, `OperationCard.tsx`): a **"Next up"** card naming the one operation to run now and its stage, and saying so when the stage is behind its T-minus window; the five stages as an ordered list, the current one open; each operation's progress (Done / In review / Running / Failed); **"Always available"** for `repurpose`; and **"All operations"** (`?view=all`), the catalogue by category. **It advises and never blocks** — the owner's decision of 2026-09-18 on gates.
- **BUG-032 and B-15** (`08705de`), both the owner's decisions of 2026-09-18: an owner who isn't a platform admin can now lower a budget stored above the default to any lower amount, but not raise it (403); and no message promises an administrator — at or above the default, the 429 ends "Operations can start again next month."
- **Codex's review** (`4af499c`): a stage that becomes current while the screen is open now opens; a passed launch date reads "the launch date was 3 days ago", not "launch is -3 days away"; completion is counted over **every** result by the new **`GET /api/queue/summary?product_id=…`** — the playbook used to read the newest 500 from `GET /api/queue`, so an operation whose only approved result was older was recommended again.
- **CodeRabbit's review** (`b607021`): a budget is checked and written in one transaction with the organisation's row locked (`SELECT … FOR UPDATE` in `usage.set_budget`) — before, two owners lowering $500 at once, to $400 and to $450, could both pass and end at $450 (never on `main`); and Settings → Usage promises a raise only to someone who can make one (`canRaiseBudget` in `frontend/src/lib/domain/usage.ts`).
- **Test-first throughout:** new tests were seen failing before their fixes — backend 3 before `4af499c` and 1 before `b607021` (5 before `08705de`, as its commit message records); frontend 7 before `4af499c` and 3 before `b607021`.
- **Review of pull request #5 — final tally: 12 threads and 2 comments outside the diff.** Codex 2 (P1 and P2, fixed in `43ab3e6`). CodeRabbit 10: **8 on documents** — 5 in its first reviews, the Railway-token thread among them, and 3 in its review of `ce12024` — plus 1 Major on `playbook.ts` (fixed in `6b97da3`) and 1 on `usage.py:83` (BUG-032). (The 1.1.3 handoff's nine was right at the time, but it listed the token thread again after the five on documents, which read as ten.) **Answered 2026-09-18 with the owner's go-ahead:** four threads replied to and resolved — Codex's two, the token thread (T-4) and BUG-032 (`08705de`) — plus one comment answering both comments outside the diff (`7dbc35d`, `ce12024`). With the five CodeRabbit resolved itself, **9 of 12 are resolved**; the last 3, on `ce12024`, are answered by this 1.1.4 documentation (Next steps, item 3).
- **Review of pull request #6** (on `08705de`): **5 threads and 1 comment outside the diff**, all fixed, **none answered on GitHub yet** (Next steps, item 2).
- **Gaps found on the way:** the fake backend's `GET /api/queue` (`frontend/src/test/fakeApi.ts`) ignores `limit` and keeps insertion order (the backend returns the newest first, at most `limit`), so no frontend test could see the 500-row problem; the backend test `test_summary_counts_results_older_than_the_newest_500` covers it. No automated test runs the frontend against the real backend (gap 3): the new route's contract was checked by reading both sides. `BudgetStatement`'s own-budget wording ("Your organisation's budget of $X applies…") has no test.
- **Known open — LIM-003:** on a phone the Portfolio launch board shows only its project column; the owner's chosen fix is cards (Next steps, item 7).
- **Known open, newly registered — LIM-004:** on a phone the project tab bar runs off the right edge — `.tabnav` in `frontend/src/components/ui/Display.module.css` scrolls with its scrollbar hidden, so Outbox, Launch plan and Settings are reachable only by swiping, with no cue. Seen again 2026-09-18 on the Operations screen at 390px.
- **Known open — also:** gap 14 (Vitest at default concurrency) and gap 13 (Playwright under CPU contention), both in Start here; BUG-032, live until #6 deploys; budgets stored above $25 before the ceiling (Warnings).

## Next steps — priority order

1. **T-10 — merge pull request #6, then the owner checks it live.** Ask the owner first: merging deploys. Wait until all three CI jobs are green on its latest commit (`gh pr checks 6`), then merge with a **merge commit**; that also takes BUG-032's fix to production. The assistant can confirm the deploy as it did for #5 (a new live bundle, `/health` 200), but **the signed-in check is the owner's — the assistant can't sign in, and never registers a probe account (T-1)**: signed in as an Owner on https://launchops.run, the Operations screen opens on the playbook with a "Next up" card, and in an organisation with no budget of its own Settings → Usage shows the $25 platform default (T-9's check) — in a month with no AI usage, "The platform's default budget of $25.00 applies: operations stop when a month's cost reaches it."
2. **If the owner says yes, answer pull request #6's review** — 5 threads and 1 comment outside the diff. Codex's three P2s → `4af499c`: `Playbook.tsx:229` (a stage that becomes current stays collapsed), `Playbook.tsx:187` ("launch is -3 days away"), `OperationsPage.tsx:27` (completion read from the newest 500 results). CodeRabbit's Major on `backend/services/usage.py:90` (the race) → `b607021`; its Minor on `Playbook.tsx:229` (the same as Codex's) → `4af499c`; its Minor outside the diff on `UsageSettings.tsx:181-183` (promise a raise only when the owner can make one) → `b607021`.
3. **Check that pull request #5's last three threads have replies** — CodeRabbit's review of `ce12024`: `CLAUDE.md:186`, `docs/CHANGELOG.md:198`, `docs/ROADMAP.md:173`. 1.1.4 answers them, and their replies are posted after this documentation is pushed; the owner's go-ahead covers #5's threads, so post and resolve any that are missing.
4. **T-1 — delete `guard-check@example.com`** and "Guard check's organisation" (platform admin, Settings → Team & access).
5. **T-4 — the owner rotates the Railway project token at session end**, every session. That is the owner's settled practice: `railway login` won't authorise on this machine, so the owner pastes a token for the session and rotates it when the session ends — don't propose `railway login` instead.
6. **The owner's open decisions, B-1 to B-12** (Blocked on the owner, below).
7. **Product work:** cost and duration per operation (accurate per-run cost needs a migration adding `result_id` to `ai_usage`: the ledger has one row per API call and nothing tying a row to its run); the launch board as cards on a phone (LIM-003); the project tab bar on a phone (LIM-004).
8. **Phase 2 follow-ups:** brand kernel (D15), result history (D16), billing settings (blocked by B-12).
9. **Phase 3 — real actions.** T-5 to T-8 (Wait for CI, Postgres backups, deleting volume `postgres-volume-qVKY`, `MAIL_*`) stay optional.

## Blocked on the owner

**Twelve are open, B-1 to B-12**, each with its working default in `docs/ROADMAP.md` → Blocked. B-13, B-14 and B-15 are decided.

- **Plan section 8** (B-1 to B-7): frontend rebuild confirmation, organisation model semantics, email posture, social scope, models and budgets, design sign-off, deploy shape.
- **D15 brand kernel** (B-8 to B-10): does a project's brand override the organisation's voice field by field or wholesale; which role may edit it; should each result record the brand version it used.
- **D8 reset links** (B-11): may organisation owners create password reset links, or platform admins only (current behaviour)?
- **Billing** (B-12): what is metered and charged, so billing settings can be designed.
- **Decided 2026-09-18 — B-14: no cap on total AI spend across organisations.** The owner's reason: AI usage is to be charged to customers at a markup, so more customer spend means more revenue. That depends on billing, which is not built (B-12 is open; billing settings are a Phase 2 follow-up). Until it exists, each self-registered organisation can spend up to $25 a month on the deployment's one `ANTHROPIC_API_KEY` with nothing recovering it, and open registration (T-2; at most 10 new accounts an hour per network address) adds organisations with nothing capping the sum.
- **Decided 2026-09-18 — B-15: no.** A platform admin may not set the budget of an organisation they don't belong to ("Absolutely not"); carried out in `08705de` and extended in `b607021`.

## Warnings — do not learn these the hard way

- **Never commit `.github/workflows/test-pipeline.yml`**, a generic template, untracked by design. Never `git add -A` without reading the staged diff.
- **Merge with merge commits, never squash or rebase.** `.gitleaksignore` entries are per-commit fingerprints; rewritten hashes make the secret scan fail on findings already reviewed. Every push to `main` deploys.
- **Never write a token value anywhere** — not in a file, a document or a commit message. CI runs gitleaks over the full history.
- **Never run sign-up or registration probes against the live site.** `ADMIN_EMAIL` guards only the first account; a probe created a real one (T-1).
- **Never run test suites in parallel** — not two agents at once, and never two pytest runs on one test database: that gives red runs that prove nothing, and deadlocks and foreign-key errors that read like real failures.
- **Budgets above $25 set before the ceiling existed are kept** — the rule applies to changes. The owner can list any from Railway's Postgres console: `SELECT id, name, monthly_ai_budget_usd FROM organisations WHERE monthly_ai_budget_usd > 25;`

## Key locations

| What | Where |
|---|---|
| Production | Railway project **"Launch Ops"**, environment production, US East — services **`launchops`** (root `Dockerfile`, worker in-process) and **`Postgres`** (Postgres 18 + volume). Also at `https://launchops-production-0457.up.railway.app` |
| Repo | GitHub **`Vybecode-LTD/LaunchOps`**, `main` at `477eaa4`, deploys on every push. Open: **pull request #6** (`feat/playbook-ui`; its last code commit is `b607021`) |
| Set in Railway | `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `APP_URL`, `ADMIN_EMAIL`, `ANTHROPIC_API_KEY`. `MAIL_*` not set (optional, T-8). `DEFAULT_MONTHLY_AI_BUDGET_USD` needn't be: it defaults to 25 in code |
| `CLAUDE.md` | The project in one file — what it is, stack, architecture, commands, environment variables, conventions, deployment. Read it first |
| `docs/CHANGELOG.md` | Newest first; **1.1.4** is this session's entry |
| `docs/ROADMAP.md` | Milestones, Active (T-1, T-4 to T-8 and T-10 open), Blocked (B-1…B-12 open; B-13…B-15 decided), Next up, Backlog |
| `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | Findings, the phased plan, and **Progress** — the authoritative status |
| `docs/BUGS.md` | Bug registry — BUG-032 fixed on pull request #6, live until it deploys; limitations LIM-001 to LIM-004 |
| `docs/PHASE1_DESIGN.md` | Decisions D1–D16 and the reasoning behind them |
| `docs/TESTING.md` | Frameworks, how to run everything (section 2), inventory, coverage, known gaps — 13 (Playwright under CPU contention), 14 (Vitest concurrency) |
| `docs/DESIGN_SYSTEM.md` · `SOURCE_MAP.md` | Design tokens and components · file-by-file map |
