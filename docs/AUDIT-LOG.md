---
document: AUDIT-LOG
version: 1.1.0
last-updated: 2026-09-17T19:40:00Z
last-audit: 2026-09-17T19:30:00Z
managed-by: session-orchestrator/doc-reconciler
---

# Documentation Audit Log

Every reconciliation of this project's documents, newest first. Each entry records what was
checked, what was found, what was fixed and what was left for a document's owner.

**Method.** Claims are verified against the repository — files on disk, `git status`, `git log`,
`git show`, and the source itself — never against another document. Where two documents disagree,
the code decides. No test suite is ever run to produce these figures: they are read from the
session's own completed runs, because a second run against the shared test database corrupts it.

---

## Audit — 2026-09-17T19:30:00Z — first audit of this registry

**Trigger:** session end (`perform handoff`), commissioned on the understanding that every
document owner had finished. Three had not — see Concurrency.
**Scope:** `CLAUDE.md`, `docs/CHANGELOG.md`, `docs/ROADMAP.md`, `docs/BUGS.md`, `docs/TESTING.md`, `docs/HANDOFF.md`,
`docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`, `docs/PHASE1_DESIGN.md`, `docs/DESIGN_SYSTEM.md`,
`SOURCE_MAP.md`, `SETUP_PROMPT.md`.
**Repository state at open:** `main` at `f143f1c`; 6 modified, 4 untracked; no branch but `main`.
**At close:** `main` **unchanged at `f143f1c`** — production is exactly what it was. The session's
work now sits on the local branch `fix/refresh-token-clock-skew`, 4 commits ahead of `main`
(`35d24c5`, `584cff6`, `7c1f1cb`, `39ff28b`), **not pushed**. Six documents are modified in the
working tree — this audit's finding-14 corrections and this log itself.
`.github/workflows/test-pipeline.yml` stays untracked by design.
**This reconciler made no commit, stage, push or branch.** The commits were made by another agent
during the audit; see Concurrency.

### Findings

| # | Severity | Document | Issue | Resolution |
|---|---|---|---|---|
| 1 | HIGH | `ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | "Railway was still issuing its certificate at the time of writing" — contradicted by the repository's other four documents and by fact: the certificate was issued 2026-09-17 16:51 UTC, valid to 2026-12-16, and the site is live over HTTPS | **Fixed.** Rewritten to record the issued certificate, and the new CNAME target `xesm2hmr.up.railway.app` against Spaceship's stale `5rlc9k25.up.railway.app` (ROADMAP T-3) |
| 2 | HIGH | `ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | "Still to do" opened with "once https://launchops.run answers, sign up with the `ADMIN_EMAIL` address" — superseded: the site answers, the admin account exists, and a sign-up probe created the stray account `guard-check@example.com` | **Fixed.** Replaced with T-1 and T-2, and the list now points at `docs/ROADMAP.md` → Active (T-1 to T-8) as the authority rather than restating it |
| 3 | MEDIUM | `CLAUDE.md`, `HANDOFF.md`, `ROADMAP.md` | The uncommitted batch was listed as five files; `git status` showed six — `docs/TESTING.md` was modified and named nowhere. The batch list is the commit list, so the omission would have lost a file | **Fixed** in all three, and kept in step as the tree moved — `SOURCE_MAP.md`, `SETUP_PROMPT.md` and `docs/AUDIT-LOG.md` were added as they appeared. Then **superseded by finding 14**: once the batch was committed there was no working-tree list left to keep, and all three now describe the branch instead |
| 4 | MEDIUM | `CLAUDE.md`, `HANDOFF.md` | Both cite the blocked range as "B-1 to B-12"; `ROADMAP.md` defines **B-13** (commit the session-end batch). `HANDOFF.md` carried B-13's content as an unnumbered bullet | **Fixed.** Range corrected in three places; the bullet now names B-13 |
| 5 | MEDIUM | `CLAUDE.md`, `ROADMAP.md` | Both say `.gitleaksignore` pins **two** reviewed findings. It pins **three**: two launch plan keys in `frontend/src/lib/domain/checklist.test.ts` (`d7752c3`) and the earlier wording of the note about them in `docs/TESTING.md` (`4f433ee`), added by `b0beeaf`. `TESTING.md` had it right | **Fixed** in both |
| 6 | MEDIUM | `CLAUDE.md`, `HANDOFF.md` | `docs/CHANGELOG.md` is referenced as a managed document but is not on disk | **Resolved by `doc-versioner`** at 19:40, which created it at 1.1.0 with entries for 1.1.0 and 1.0.0. The reference now resolves |
| 7 | MEDIUM | all managed docs | **Version drift.** At open: `CLAUDE.md` 0.2.0 · `ROADMAP.md` 1.0.0 · `BUGS.md` 1.1.0 · `TESTING.md` 0.2.0 · `HANDOFF.md` 1.0.0 · `AUDIT-LOG.md` 1.0.0 · `CHANGELOG.md` absent — four distinct values where the directive requires one | **Resolved by `doc-versioner`,** which ran at 19:40 while this entry was being finalised and set all six existing documents to **1.1.0**. Nothing was renumbered by this reconciler |
| 8 | LOW | `SOURCE_MAP.md` | `docs/` described as holding three documents ("assessment and development plan, design system, testing guide"); it holds nine. Its header also routed "the roadmap" to the assessment plan rather than `docs/ROADMAP.md` | **Fixed.** Both entries corrected; no restructuring |
| 9 | LOW | `SETUP_PROMPT.md` | The session-start prompt tells the next session to read `CLAUDE.md`, `HANDOFF.md`, `SOURCE_MAP.md` and the plan's Progress — it predated `ROADMAP.md` and `BUGS.md` and named neither | **Resolved by its owner mid-audit,** not by this reconciler (see "Concurrency" below). Both documents are now in the prompt; the wording was re-read and is correct |
| 10 | LOW | `ROADMAP.md` | M0 reads "All eighteen findings F-1 to F-18"; the closed-findings table carries nineteen rows because of `F-7b`. The ID range is right, the count is one short | **Left for `roadmap-manager`** — wording, not data |
| 11 | LOW | `HANDOFF.md` | "fixed **18 bugs**" sits one paragraph above BUG-027 described as "found and fixed after that", so the 18 reads as if it excludes it. It does include it (BUG-001…017 from the session brief, plus BUG-027) | **Left for `handoff-builder`** — ambiguous phrasing, not a wrong number |
| 12 | LOW | five managed docs | `last-audit` predated this reconciliation (`CLAUDE.md` still on 2026-09-14) | **Fixed.** Set to `2026-09-17T19:30:00Z` on the five documents audited. `version` and `last-updated` untouched |
| 13 | MEDIUM | `DESIGN_SYSTEM.md` | The theme is applied before first paint by "an **inline script** in `index.html`, repeated in `main.tsx` for the desktop app, whose CSP blocks inline scripts". `index.html` carries no inline script: it loads `<script src="/theme-init.js">`, and `frontend/public/theme-init.js` says in its own first comment that it is "a file rather than an inline script, so the Content Security Policy can forbid inline scripts". The document had the mechanism and its rationale backwards | **Fixed.** Rewritten to name the real file and the real reason |
| 14 | CRITICAL | `CLAUDE.md`, `HANDOFF.md`, `ROADMAP.md`, `BUGS.md`, `ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | The session-end batch was **committed to a branch at 19:31, mid-audit**, and the five documents were committed still saying the work was uncommitted — "This session's work is not committed", "Uncommitted at handoff", "sits uncommitted in the working tree", "still an uncommitted working-tree change". Observable state contradicted every one. A next session would have hunted for changes that were not there, and would not have learned that a **security fix sits on an unpushed branch** | **Fixed in all five.** Each now names the branch `fix/refresh-token-clock-skew`, head `39ff28b`, its four commits, and the fact that it is neither pushed nor merged, so BUG-027 is not in production |

**Totals:** 14 findings — 1 critical, 2 high, 6 medium, 5 low.
**Auto-fixed by this reconciler: 9** (1, 2, 3, 4, 5, 8, 12, 13, 14).
**Resolved by their owners while the audit ran: 3** (6, 7, 9 — see Concurrency).
**Left open: 2** — the wording items 10 and 11.

### Concurrency

`SETUP_PROMPT.md` changed on disk **while this audit was running** (19:24, between writing this log and
the last `CLAUDE.md` edit), adding the `ROADMAP.md` and `BUGS.md` lines that finding 9 asked for. The
edit was not made by this reconciler. It was re-read and is correct, and the file was added to the
uncommitted batch lists in `CLAUDE.md`, `HANDOFF.md` and `ROADMAP.md` (B-13).

The audit was commissioned on the understanding that every document owner had finished. Three had not,
and the repository moved under the audit three times:

| Time | What happened | Effect |
|---|---|---|
| 19:24 | `SETUP_PROMPT.md` gained its `ROADMAP.md` / `BUGS.md` lines | Closed finding 9 |
| 19:40 | `doc-versioner` aligned all managed documents to **1.1.0** and created `docs/CHANGELOG.md` | Closed findings 6 and 7 |
| 19:31–19:41 | The session-end batch was **committed** onto a new local branch, `fix/refresh-token-clock-skew`, in four commits — including this audit's own `DESIGN_SYSTEM.md` fix as `39ff28b` | **Opened finding 14:** five documents had just been committed describing that work as uncommitted |

Finding 14 is the reason this entry ends with a CRITICAL. It was not a pre-existing error — it was
created *by* the commit, a minute after the documents were written, and it is exactly the drift a
reconciler exists to catch: five documents asserting a working-tree state that no longer existed, while
a security fix sat on an unpushed branch none of them named.

Every fix made by this reconciler was re-checked after each of those events and survived. Every figure
in this entry is true as of the final sweep, not of the moment each document was first read.

### Verified clean — checked and correct, no action

- **Every regression test named in `BUGS.md` exists.** 24 pytest node ids and 6 continuation
  `::names` resolve to real functions; 13 frontend test titles resolve **at the exact line number
  claimed**. Eight source-line references (`email.py:113,17,116,108`, `database.py:128`,
  `config.py:41`, `queue.py:275`, `values.ts:103`) all land on the code they describe.
- **BUG-027 is real and present.** `backend/routers/auth.py:199-209` computes
  `r.used_at < NOW() - $2::interval AS reused` in SQL, with the comment explaining the two-clock
  hazard; the regression test is `backend/tests/test_sessions.py:100`
  `test_a_reused_token_is_caught_even_if_the_app_clock_lags_the_database`.
- **Every commit hash in every document resolves** and carries the subject it is credited with:
  `f143f1c`, `24eff91`, `d7752c3`, `4ecbcc4`, `4f433ee`, `b0beeaf`, `97a0706`.
- **`TESTING.md`'s inventory is exact.** All 24 backend test files and all 49 frontend test files
  named; none missing, none stale. Per-file and total counts reconcile (324 + 226 = 550;
  508 + 93 = 601; 3 + 12 + 54 = 69).
- **Structural counts match the code.** 18 operations in
  `frontend/src/lib/domain/operations.ts` (12 workflow / 5 report / 1 tool) · 7 migrations
  `0001`–`0007` · 7 routers · 14 services · 33 launch plan items in 3 phases · 27 screens in
  `frontend/e2e/a11y.spec.ts` × 2 themes.
- **Stack and defaults match.** `CLAUDE.md`'s tech table against `frontend/package.json` and
  `backend/requirements*.txt` (React 19, TypeScript ~6.0, Vite 8, Vitest 5, Playwright 1.61,
  axe 4.13, MSW 2, anthropic 1.6 on httpx2); its environment table against `backend/config.py`
  (every default — models, token lifetimes, worker, rate limits, mail — correct).
- **Gates match their config.** `backend/.coveragerc` `fail_under = 95`;
  `frontend/vitest.config.ts` `thresholds: { lines: 95 }`; `railway.toml` healthcheck `/health`;
  `.github/workflows/ci.yml` has the three documented jobs; `src-tauri` points at
  `https://launchops.run`; `.claude/launch.json` uses ports 8765 and 5173.
- **Cross-references resolve.** Both markdown links, the `#deployment--ci` anchor, and every
  backtick path in every document — except `docs/CHANGELOG.md` (finding 6). Paths named as
  deleted (`backend/Dockerfile`, `backend/railway.toml`), as generated
  (`frontend/test-results/.last-run.json`), as temporary
  (`frontend/playwright.local-browser.config.ts`) or as living outside the repo
  (`TESTING_PROCEDURES.md` in `C:\DEV`) are labelled as such and are not broken references.
- **ID spaces are complete and consistent.** D1–D16 in `PHASE1_DESIGN.md`; F-1…F-18 (+F-7b) in the
  plan's §2 and Appendix A; the plan's §8 holds exactly seven decisions, matching ROADMAP B-1…B-7;
  T-1…T-8 agree across `ROADMAP.md`, `HANDOFF.md` and `CLAUDE.md`.
- **`DESIGN_SYSTEM.md`'s values are exact.** Every token quoted — `--ground`, `--surface`,
  `--surface-sunken`, `--line`, `--ink`/`-2`/`-3`/`-disabled`, `--signal` and its variants,
  `--primary-bg`, `--ok`/`--warn`/`--crit`, `--viz-1..3`, spacing, radii, `--rail-width` 244px,
  `--topbar-height` 56px, `--duration-fast` 120ms, `--stretch-display` 112% and
  `--stretch-placard` 82% — matches `frontend/src/styles/tokens.css`, as do the 8 project
  swatches in `lib/domain/projects.ts`. Only the theme bootstrap was wrong (finding 13).
- **No test suite was run.** Every figure in this entry was read from the session's completed runs.

### Document state at close

| Document | Version | State | Action taken |
|---|---|---|---|
| `CLAUDE.md` | 1.1.0 | Accurate | 5 fixes: batch list, gitleaks count, B-range, audit stamp, branch state (14) |
| `docs/ROADMAP.md` | 1.1.0 | Accurate | 4 fixes: gitleaks count, batch list, audit stamp, B-13 rewritten to the branch's real state (14) |
| `docs/BUGS.md` | 1.1.0 | Every entry verified against the code; no pre-existing error | Audit stamp, plus BUG-027's commit state (14) |
| `docs/TESTING.md` | 1.1.0 | Accurate; **no factual error found** | Audit stamp only |
| `docs/HANDOFF.md` | 1.1.0 | Accurate | 6 fixes: batch list, B-range ×2, B-13 named, branch state ×2 (14) |
| `docs/AUDIT-LOG.md` | 1.1.0 | New | Created by this audit |
| `docs/CHANGELOG.md` | 1.1.0 | Created by `doc-versioner` at 19:40; entries for 1.1.0 and 1.0.0 | None by this reconciler |
| `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | n/a | Was the only document contradicting reality at open | 4 fixes: deployment status, next-steps list, BUG-027's commit state (14) |
| `docs/PHASE1_DESIGN.md` | n/a | Consistent throughout | None |
| `docs/DESIGN_SYSTEM.md` | n/a | Every token value verified against `tokens.css`; one mechanism claim was wrong | 1 fix: the theme bootstrap (finding 13) |
| `SOURCE_MAP.md` | n/a | Accurate after fix | 2 fixes to the `docs/` listing and header pointers |
| `SETUP_PROMPT.md` | n/a | Complete after its owner's mid-audit edit | Verified only; added to the batch lists |

### Follow-ups for owners

1. **Owner — B-13 is now "push and merge", not "commit".** The branch `fix/refresh-token-clock-skew`
   is local and unpushed, so the BUG-027 refresh-token fix is **not in production**. `main` is still
   `f143f1c`. Push, open the pull request, wait for CI, merge with a **merge commit**.
2. `roadmap-manager` — the "eighteen findings" count in M0 (finding 10).
3. `handoff-builder` — disambiguate "18 bugs" against BUG-027 (finding 11).
4. Frontend owner — `frontend/src/main.tsx:11-12` carries the same wrong claim finding 13 fixed in
   the document ("repeat it here for environments whose content security policy blocks that inline
   script"). It is a **code comment**, so this reconciler left it; it should be corrected to match
   `frontend/public/theme-init.js`.
5. **Standing:** re-audit at the next session end, and **again immediately after B-13 merges**.
   Six documents now describe a branch that is not merged; the moment it lands on `main`, every
   one of them is stale again. Finding 14 is what that looks like when it is missed by a minute.
