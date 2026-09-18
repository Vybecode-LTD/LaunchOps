---
document: HANDOFF
version: 1.1.3
last-updated: 2026-09-18T03:32:06Z
last-audit: 2026-09-18T02:45:00Z
managed-by: session-orchestrator/handoff-builder
---

# Session Handoff

## Where the project stands

- **Phases 0 (stabilise), 1 (foundation) and 2 (interface rebuild) are complete.** Phase 3 (real actions) is next and not started.
- **Live in production** on Railway at **https://launchops.run** (HTTPS, certificate issued 2026-09-17, valid to 2026-12-16).
- **`main` = `origin/main` = `0ce65dd`**, the documentation-only merge of pull request #4. **Production runs `bc6143c`'s application code** — the last commit on `main` to change any, and the one that shipped the BUG-027 refresh-token fix. Every push to `main` deploys.
- **Pull request #5 is OPEN — not merged, not deployed; its code is frozen.** Branch `fix/spend-cap-and-mobile-overflow`, on GitHub. **The last code commit on pull request #5 is `7dbc35d`**, and **none of the branch is on `main` or in production.** Its commits, oldest first: `c7358fb` docs reconciliation · `522e40d` default AI budget · `2d57b35` phone-width overflow and a 27-test responsive suite · `a2124a9` docs · `597e94b` empty competitor columns · `8c9f2e2` playbook domain module · `908f46d` e2e checklist test made patient · `6b97da3` a re-run no longer reopens a finished playbook stage · `43ab3e6` Settings → Usage shows the budget that actually applies, and a negative default is refused · `a53b26e` BUG-031: an owner can no longer lift the default budget cap themselves · **`7dbc35d` Settings → Usage states which budget applies even in a month with no AI usage** (CodeRabbit's finding outside the diff) — and on top of it, this 1.1.3 documentation batch as one more commit.
- **One more branch exists only on this machine:** `feat/playbook-ui` — one commit, `f6261a6`, the playbook UI, stacked on **`a53b26e`, not on `7dbc35d`**. **Not pushed, not a pull request** (Next steps, item 2).
- **CI and the working tree — re-check both, don't trust this line.** **CI passed on `7dbc35d`**, the last code commit: all three jobs green (run 35298972693, finished 2026-09-18T02:26:54Z). The documentation commit on top of it, this file included, gets a CI run of its own once pushed, and that is the run the merge waits for. `gh pr checks 5` and `git status -sb` say what is true now; `.github/workflows/test-pipeline.yml` stays untracked by design.
- **The spending exposure is still live in production.** Registration is open (T-2, the owner's decision) and production's code has no default AI budget, so any self-registered account can spend on the one `ANTHROPIC_API_KEY` without limit. **Merging and deploying pull request #5 caps every self-registered organisation at $25 a month — per organisation, not in total** (Known open, below). Before `a53b26e` even that did not hold: every new account owns its own organisation, an owner could set any budget, and an organisation's own budget beat the default — so the default held only organisations that never touched their budget (BUG-031).
- **Measured this session, one suite at a time, on the branch's code (`7dbc35d`):** backend **564 passed / 98.32%** coverage; frontend Vitest **628 passed in 50 files / 99.21% lines**; Playwright **96 passed**. Both 95% gates pass.
- **Automated review on pull request #5: nine threads, plus two comments outside the diff.** Three threads were real bugs in this session's new code, **all fixed, with tests written to fail first**: Codex **P1** — Settings → Usage said "no budget" while the $25 default was enforced; Codex **P2** — a negative default silently switched the cap off; CodeRabbit **Major** — re-running a finished operation reopened its playbook stage (the one thread CodeRabbit has since resolved). Five were on the documents (`docs/CHANGELOG.md` → 1.1.3 → Reviewed); one asked for the Railway token to be rotated at once, which the owner's settled practice answers (T-4). Both comments outside the diff are addressed: plan wording (review of `a2124a9`), brought current in this batch; and a month with no AI usage showing no budget at all (review of `43ab3e6`, Minor), fixed by **`7dbc35d`** with two tests written to fail first. **The ninth thread** — CodeRabbit's review of `7dbc35d` at 02:33:16Z, Minor, on `backend/services/usage.py:83` — **is right, and is BUG-032: open, LOW, not fixed on pull request #5** (Next steps, item 3). **Eight threads are unresolved, and no thread or comment has a reply** (Next steps, item 1).

## Start here — confirm a green baseline

**Expect the test PostgreSQL cluster to be stopped at session start** — nothing listening on 56432 or 56433, so `python -m pytest` fails to connect before it tests anything. **`docs/TESTING.md` section 2** (How to run → Backend) says where the scratch clusters' data directories live and gives the `pg_ctl` command to start one, or how to `initdb` a fresh one in the current scratchpad — never under OneDrive.

```bash
cd backend;  python -m pytest        # once a cluster is up; set TEST_DATABASE_URL for any port but 56432
cd frontend; npm run lint; npm run typecheck; npx vitest run --maxWorkers=2
```

**Don't use `npm run check` for the baseline.** At default concurrency the Vitest suite fails intermittently on this machine with no change at all — **pre-existing on `main`, 4 of 4 runs red there**, green at `--maxWorkers=2` and in CI (`docs/TESTING.md` gap 14). **Don't believe a red frontend run until it repeats run alone.** The test DSN is `DEFAULT_TEST_DSN` in `backend/tests/conftest.py` (port 56432, database `launchops_test`); the local backend runs on **8765**, not 8000. Playwright cannot download its browser (use the installed headless shell via a temporary config), `npm audit` cannot reach the registry, gitleaks runs in CI only and pip-audit needs truststore — all written up in `docs/TESTING.md`.

## What this session delivered — pull request #5, plus one local branch

- **Default AI budget** (`522e40d`, `43ab3e6`, `7dbc35d`): **`DEFAULT_MONTHLY_AI_BUDGET_USD`, 25 unless set**, caps every organisation without a budget of its own; clearing one falls back to the default; `0` is the deliberate opt-out; a negative value fails settings validation instead of silently removing the cap. Settings → Usage shows the budget that applies and says when it is the default — since `7dbc35d` even in a month with no AI usage, so a brand-new organisation sees its cap. No migration or Railway variable is needed.
- **BUG-031 — the default cap could be lifted by the account it capped** (`a53b26e`). **Owner's decision (2026-09-17): owners may set any budget up to the platform default, lower it or clear it; only a platform admin may go above it.** Otherwise `usage.ensure_budget_allowed` answers 403 on `PUT /api/organisation/budget`. The 429 no longer tells an owner how to lift the cap; it names whoever can actually raise it. Budgets already stored above the default are left alone — the rule applies to changes, and it measures a new amount against the default, not the current budget, so an owner can move such a budget only to the default or below, or clear it (BUG-032, open). Six tests; the two that prove the bypass fail without the fix.
- **Phone widths** (`2d57b35`): Portfolio, Review, the review result and the SEO report no longer scroll sideways at 390px. New `frontend/e2e/responsive.spec.ts` checks 27 screens at that width (Playwright 69 → 96).
- **Competitor results** (`597e94b`): empty columns and empty headings are no longer rendered.
- **Launch playbook domain module** (`8c9f2e2`, `6b97da3`): `frontend/src/lib/domain/playbook.ts` puts 17 of the 18 operations in five ordered stages and derives each one's state, the current stage and the next operation to run. 18 tests.
- **Playbook UI — on `feat/playbook-ui` (`f6261a6`), not in pull request #5.** The Operations screen opens on the playbook: a **"Next up"** card naming the one operation to run and why (including when a stage is behind its T-minus window); the five stages as an ordered list, the current one open and the rest collapsed; per-operation progress (Done / In review / Running / Failed); **"Always available"** for the one tool (repurpose); and **"All operations"** (`?view=all`), which keeps the category catalogue. **It advises, never blocks**, and won't recommend from results that haven't loaded. On that branch, on its `a53b26e` base, **638 unit tests in 51 files and 99 browser tests passed**, including WCAG 2.2 A/AA scans of both views in both themes and phone-width checks.
- **Checklist e2e test** (`908f46d`): asserts the launch-plan tick with a retry. Test-only; no user-facing defect was demonstrated (`docs/TESTING.md` gap 13).
- **Known open — the launch board shows only the project name on a phone.** Its other columns are reachable only by scrolling the table, with no cue (LIM-003 in `docs/BUGS.md`).
- **Known open, newly seen — the project tab bar runs off the right edge on a phone.** Outbox, Launch plan and Settings are reachable only by swiping, with no cue: `.tabnav` in `frontend/src/components/ui/Display.module.css` scrolls with its scrollbar hidden. Pre-existing, not fixed.
- **Known open, for the owner to decide — nothing caps total AI spend across organisations (each sign-up gets its own $25 a month), and a platform admin can raise a budget only in an organisation where they are an Owner:** B-14 and B-15 in `docs/ROADMAP.md`.
- **Earlier:** pull requests #1–#4 are merged; #3 shipped the BUG-027 refresh-token replay fix, live in production (`docs/BUGS.md`). Phase status: **Progress** in `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`; decisions: `docs/PHASE1_DESIGN.md`.

## Next steps — priority order

1. **Merge pull request #5 (T-9) — it caps the live spending exposure.** Ask the owner first: merging deploys. Before merging, **wait for CI to pass on the pull request's latest commit** (`gh pr checks 5` — `7dbc35d` was green, and the documentation commit on top of it gets a run of its own once pushed; if that fails, fix it first) and read any review CodeRabbit posts on it. **Answer the eight unresolved review threads and reply to the two comments outside the diff — not done yet: posting on GitHub is on the owner's account and hasn't been authorised, so it needs the owner's go-ahead, or the owner does it.** Point the token thread at T-4, the ninth (`usage.py:83`) at BUG-032, the comment in the review of `43ab3e6` (not a thread, so easy to miss) at `7dbc35d`, and the one in the review of `a2124a9` at the plan update in this batch. **Merge commit, never a squash:** `.gitleaksignore` fingerprints are per-commit. After the deploy, sign in on https://launchops.run as an Owner of an organisation with no budget of its own and check that **Settings → Usage shows the $25 default for the current month — a brand-new organisation included; since `7dbc35d` it needs no AI usage first.** With none, the only sentence saying which budget applies, under `No AI usage in <month>`, is "The platform's default budget of $25.00 applies: operations stop when a month's cost reaches it." — no "only a platform administrator can set a higher one" note; that appears, after "This is the platform's default budget", once the month has usage. The ceiling on owners is proven by tests; checking it live would need a non-admin account — **never register one there**.
2. **Publish the playbook UI.** `feat/playbook-ui` is stacked on `a53b26e`, **not on `7dbc35d`**, so it lacks that fix until it is rebased. After pull request #5 merges, rebase it onto `main` (which then carries `7dbc35d`), push, and open it as **its own pull request** — kept separate so the security fix in #5 isn't held up by a large UI change. The two commits share no file, and a dry-run merge of them is clean. Until it is pushed it exists only in this clone; the rebase will give `f6261a6` a new hash.
3. **BUG-032 — a small follow-up after the merge,** on its own branch and pull request, failing test first. `ensure_budget_allowed` (`backend/services/usage.py:83`) measures a new budget against the platform default, not the organisation's current budget, so an owner who isn't a platform admin cannot lower an admin-set $500 to $400 — only to $25 or less, or clear it. It fails safe: it blocks a decrease, never permits an increase. Open, LOW (`docs/BUGS.md`); pull request #5's code stays frozen.
4. **T-1 — delete `guard-check@example.com`** and "Guard check's organisation" (platform admin, Settings → Team & access).
5. **T-4 — rotate the Railway project token at the end of every session.** That is the owner's settled practice: `railway login` will not authorise on this machine, so the owner pastes a token for the session and rotates it when the session ends — don't propose `railway login` instead. Never write a token value into a file, a document or a commit message: CI runs gitleaks over the full history.
6. **The owner's two remaining product choices:**
   - **Cost and duration per operation.** Accurate per-run cost needs a **migration adding `result_id` to `ai_usage`**: the ledger has one row per API call and nothing linking a row to the run it served, so it cannot tell one run from one call.
   - **The launch board as cards on a phone** — the proper fix for its hidden columns (Known open, above).
7. **An open design question for the owner — gates.** They asked for a playbook with *gates*; the one built only advises. Whether a gate should ever block a run is theirs to decide once they have seen the screen; don't add blocking before they do.
8. **T-5 to T-8** (P3, optional): Wait for CI on `launchops`, Postgres backups, delete volume `postgres-volume-qVKY`, set `MAIL_*`. Then Phase 2 follow-up (brand kernel D15, result history D16, billing) and Phase 3: real actions.

## Blocked on the owner

Fourteen are open: B-1 to B-12, and B-14 and B-15, which came out of the budget work in pull request #5 (B-13 is decided). Each is written up with its working default in `docs/ROADMAP.md` → Blocked.

- **Plan section 8** (B-1 to B-7): frontend rebuild confirmation, organisation model semantics, email posture, social scope, models and budgets, design sign-off, deploy shape.
- **D15 brand kernel** (B-8, B-9, B-10): does a project's brand override the organisation's voice field by field or wholesale; which role may edit it; should each result record the brand version it used.
- **D8 reset links** (B-11): may organisation owners create password reset links, or platform admins only (current behaviour)?
- **Billing** (B-12): what is metered and charged, so billing settings can be designed.
- **Budget follow-ups from pull request #5** (B-14, B-15): nothing caps total AI spend across organisations — is a platform-wide monthly cap wanted, or a tighter limit on sign-ups, or is a cap per organisation enough? And should a platform admin be able to set the budget of an organisation they don't belong to?

## Warnings — do not learn these the hard way

- **These documents go stale the moment work moves.** It happened again: this file said "Everything is committed and merged" while pull request #5 was open. Read anything about the working tree, a branch or a pull request **against its `last-updated`**, and re-check with `git log` and `gh pr view` before you trust it.
- **The Vitest suite is flaky at default concurrency on this machine** — pre-existing on `main`; green at `--maxWorkers=2` and in CI. No fix is applied; the three candidate fixes are the owner's call (`docs/TESTING.md` gap 14).
- **Never dispatch two agents that both run test suites at once.** This session it produced a batch of red runs that proved nothing. Two pytest runs on one test database are worse: deadlocks and foreign-key violations that read like real failures.
- **Never run sign-up or registration probes against the live site.** `ADMIN_EMAIL` guards only the first account; a probe created a real one (T-1).
- **Merge pull requests with merge commits, never squash or rebase.** `.gitleaksignore` entries are per-commit fingerprints; rewriting hashes breaks them and the secret scan fails on already-reviewed findings.
- **Never commit `.github/workflows/test-pipeline.yml`** — a generic template, permanently `??`. Never `git add -A` without reading the staged diff.
- **Managed docs are edited only through their subagents** — `CLAUDE.md` and the six in `docs/`. Hand edits drift the shared version and frontmatter.
- **Every push to `main` deploys to production.** Branch, pull request, merge after CI passes. Do not commit without asking the owner.
- **Bug fixes need a test that fails first** — fail-before, pass-after.
- **No automated test calls the real Anthropic API.** A fake transport and an autouse network guard cover every test; the live smoke test was manual and one-off.

## Key locations

| What | Where |
|---|---|
| Production | Railway project **"Launch Ops"**, environment production, US East — services **`launchops`** (root `Dockerfile`, worker in-process) and **`Postgres`** (Postgres 18 + volume). Also at `https://launchops-production-0457.up.railway.app` |
| Repo | GitHub **`Vybecode-LTD/LaunchOps`**, `main` at `0ce65dd`, deploys on every push. Open: **pull request #5** (`fix/spend-cap-and-mobile-overflow`; its last code commit is `7dbc35d`). Local only, not pushed: `feat/playbook-ui` (on `a53b26e`) |
| Set in Railway | `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `APP_URL`, `ADMIN_EMAIL`, `ANTHROPIC_API_KEY`. `MAIL_*` deliberately unset. `DEFAULT_MONTHLY_AI_BUDGET_USD` needn't be: it defaults to 25 in code |
| `CLAUDE.md` | The project in one file — what it is, stack, architecture, commands, environment variables, conventions, deployment. Read it first |
| `docs/CHANGELOG.md` | Newest first; **1.1.3** is pull request #5's entry, extended in this batch to cover everything on it, its review included |
| `docs/ROADMAP.md` | Milestones, Active (T-1…T-9), Blocked (B-1…B-12, B-14, B-15), Next up, Backlog |
| `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | Findings, the phased plan, and **Progress** — the authoritative status |
| `docs/BUGS.md` | Bug registry, open bugs first (**BUG-032**); each fix with the regression test that failed first |
| `docs/PHASE1_DESIGN.md` | Decisions D1–D16 and the reasoning behind them |
| `docs/TESTING.md` | Frameworks, how to run everything (section 2), inventory, coverage, known gaps — gap 14 is the Vitest flakiness |
| `docs/DESIGN_SYSTEM.md` · `SOURCE_MAP.md` | Design tokens and components · file-by-file map |
