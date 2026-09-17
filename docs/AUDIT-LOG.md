---
document: AUDIT-LOG
version: 1.1.2
last-updated: 2026-09-17T21:24:00Z
last-audit: 2026-09-17T20:45:00Z
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

## Audit — 2026-09-17T20:45:00Z — after the pull request #4 merge: the stale production commit, and three Active tasks

**Trigger:** the owner asked for the stale commit reference in the documents to be corrected. Pull
request #4 merged as `0ce65dd` and, by merging, falsified every sentence that named `bc6143c` as the
head of `main` — precisely the recurrence the previous entry's standing follow-up predicted. Mid-way
the owner reported three Active tasks resolved, which widened the scope.
**Scope:** every current-state claim about `main` and production; the whole documentation set swept
for `bc6143c` and for every other current-state phrase, not only the three documents that changed;
Active tasks T-2, T-3 and T-4; and the figures re-run this session. `docs/PHASE1_DESIGN.md`,
`docs/DESIGN_SYSTEM.md`, `SOURCE_MAP.md` and `SETUP_PROMPT.md` were checked for stale hashes and
branch state only — they carry none.
**Repository state:** `main` = `origin/main` = **`0ce65dd`**. HEAD is the branch
`docs/correct-the-production-commit`, created *at* `0ce65dd` with **no commits of its own**
(`git rev-list --left-right --count main...HEAD` → `0 0`). Three tracked documents are modified —
`CLAUDE.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md` — and one file is untracked,
`.github/workflows/test-pipeline.yml`, by design. That is the state at **open and at close**; in
between, two more untracked files existed for about four minutes — see Concurrency and finding
25. **Everything recorded below is uncommitted working tree**, this log included.
**This reconciler made no commit, stage, push or branch, and ran no test suite.** Findings continue
the numbering.

### Findings

| # | Severity | Document | Issue | Resolution |
|---|---|---|---|---|
| 19 | HIGH | `docs/HANDOFF.md` | The **"Next steps — priority order"** list (lines 40–45) was not carried along with the T-2/T-3/T-4 update that reached `docs/ROADMAP.md` and `CLAUDE.md`. It still opens "**All four P1 items** are account/DNS/console housekeeping", lists T-2 and T-3 as work to do when the roadmap marks both **Done 2026-09-17**, and — worst of the three — states as fact that "**DNS still points at the old `5rlc9k25.up.railway.app`**", which the same session disproved by address comparison. Its T-4 line reads "issue a new one when needed", when the replacement has already been issued *and* exposed, so it understates a live credential exposure as a pending chore. Two documents in the same set now give opposite answers to "is T-3 done?" | **Left for `handoff-builder`.** Reported, not edited — this reconciler owns only `docs/AUDIT-LOG.md`. The correct state is in `docs/ROADMAP.md` rows T-2, T-3, T-4 |
| 20 | MEDIUM | `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | The same drift, one document further out. Line 157 still reads "Spaceship **still points at** the old `5rlc9k25.up.railway.app` … (`docs/ROADMAP.md` T-3)", and the "Still to do" list at lines 159–161 still carries "confirm who holds the admin account and whether registration stays open (**T-2**)". Separately, that list never mentions **T-4 at all** — so the plan's own summary of outstanding work omits the one P1 item that is a live security exposure | **Left for the plan's owner.** The plan cites `docs/ROADMAP.md` → Active as the authority (a fix from finding 2), so the cleanest repair is to stop restating task state and let the pointer do the work |
| 21 | MEDIUM | `CLAUDE.md` | Two in-body version strings restate the shared version as a literal: line 55 "**Doc version:** 1.1.1 — this is the `version:` in this file's frontmatter", and line 23 "the top entry is where things stand (**1.1.1**: pull request #3 merged, …)". The pending bump to **1.1.2** falsifies both, and neither sits in frontmatter, so a versioner editing only the YAML block will leave them behind. Line 55 is self-referential: it will assert it equals a frontmatter value it no longer equals | **Left for `doc-versioner` and `memory-updater`** — flagged *before* the bump rather than caught after it, which is the whole point of raising it here |
| 22 | LOW | all seven managed documents | The `last-audit` stamps are inconsistent and all predate this reconciliation: `docs/TESTING.md` and `docs/CHANGELOG.md` read `2026-09-17T19:30:00Z`, the other five read `2026-09-17T20:05:00Z`. `docs/CHANGELOG.md`'s is the odd one — the 20:05 audit raised three findings against that file (16, 17, 18), so it was audited then and its stamp says otherwise | **Left for `doc-versioner`,** which owns frontmatter and runs after this entry. All seven should move to this audit's timestamp |
| 23 | LOW | `CLAUDE.md` | Line 260 quotes the default test DSN as `postgresql://postgres@127.0.0.1:56432/launchops_test`. The literal in `backend/tests/conftest.py:23` is `postgresql://postgres@127.0.0.1:56432/launchops_test?sslmode=disable`, and `docs/TESTING.md:98` and `docs/HANDOFF.md:28` both quote it in full. A reader copying `CLAUDE.md`'s version against a local Postgres gets an SSL error whose cause is nowhere near the command. Pre-existing, not introduced this session | **Left for `memory-updater`** — a one-token correction to the quoted string |
| 24 | LOW | `docs/ROADMAP.md` | T-2 now records the platform admin's email address in a tracked document, directly beside the decision that **open registration stays on**. The pairing names the account worth attacking and confirms that anyone can create an account from which to try. This is **not a defect** — the owner supplied it deliberately, an email address is not a secret, and gitleaks does not flag one — but it is the kind of pairing that deserves a deliberate choice rather than arriving as a side effect of recording a decision | **Recorded for the owner.** No change made and none recommended without the owner's view |
| 25 | LOW | `docs/TESTING.md` (and the working tree, transiently) | Two temporary files appeared mid-audit and were gone before close: `frontend/e2e/_audit-shots.spec.ts` and `frontend/playwright.audit.config.ts`, both self-labelled "TEMPORARY — delete after use". The spec is a screenshot tool, but it is named **`*.spec.ts` inside `e2e/`**, so the **main** `frontend/playwright.config.ts` (`testDir: "e2e"`, `testMatch: "*.spec.ts"`) collects it: `npm run e2e` would now run **four spec files, not three**, adding 63 screenshot tests (27 + 12 × 3) to the documented **69**. They would also fail under that config, because they need the local headless shell the temporary config points at and this machine cannot download Playwright's own browser. `docs/TESTING.md:311` states the invariant this breaks — "`e2e/capture.mjs` is a manual screenshot tool, **not a test**. Playwright only collects `*.spec.ts`" — which is exactly why the existing manual tool is a `.mjs`. Neither file, nor the `frontend/audit-shots/` directory the spec creates at import time, is covered by `.gitignore`, so a `git add -A` would have swept all three in | **Closed during the audit by its author,** who deleted both at 21:10Z; nothing was staged, no suite was run while they existed, and this reconciler neither created nor removed them. Recorded because the hazard was real and the shape of it is durable: `docs/TESTING.md:311`'s invariant is a **naming convention with nothing enforcing it**, and `.gitignore` covers neither a stray `e2e/*.spec.ts` nor an `audit-shots/` output directory. Worth a `testIgnore` or an ignore rule for the next throwaway run |

**Totals:** 7 findings — 0 critical, 1 high, 2 medium, 4 low.
**Auto-fixed by this reconciler: 0.** Every finding lies in a document this reconciler does not own;
its own file is `docs/AUDIT-LOG.md`, and the session's constraint was to edit nothing else.
**Closed by its author while the audit ran: 1** (25 — see Concurrency).
**Left for an owner: 6** (19 `docs/HANDOFF.md` · 20 the plan · 21 `CLAUDE.md` + `doc-versioner` ·
22 `doc-versioner` · 23 `CLAUDE.md` · 24 the owner).

### Concurrency

The repository moved under this audit twice, as it did under the first — and both moves were the
same pair of files arriving and leaving.

| Time | What happened | Effect |
|---|---|---|
| 21:06Z | Two untracked files appeared in `frontend/` — `e2e/_audit-shots.spec.ts` and `playwright.audit.config.ts` — written by another agent for a visual audit, after this audit's opening `git status` had been taken and recorded | **Opened finding 25.** The spec's name would have put it inside the main Playwright suite |
| 21:10Z | Their author deleted both, and any `frontend/audit-shots/` output with them | **Closed finding 25.** The tree returned to exactly its state at open |

Neither file was made or removed by this reconciler. Deleting another agent's work in progress
mid-session is how evidence disappears, so they were recorded rather than touched — and then the
record was corrected again when they went. The Repository state above therefore describes the
tree **at close**, and says so, rather than freezing whichever moment happened to be observed
first. That is the specific mistake finding 14 was, and this entry came within one paragraph of
repeating it in both directions.

Two things about them are **clean and worth stating**, because the constitution makes both hard
rules. The screenshot output resolves to `frontend/audit-shots/`, inside the repository, and the
browser path is under `%LOCALAPPDATA%` — **neither is in OneDrive or a redirected `Documents`,
`Desktop` or `Pictures` folder**, which is the trap `docs/TESTING.md:317` warns about for exactly
this kind of throwaway screenshot run. Nothing in them touches a secret.

### Verified — the correction itself holds

- **The judgement that split stale from historical is sound, and it was applied correctly.**
  `bc6143c` appeared **24 times across 22 lines in seven documents** when this sweep was taken —
  a count that excludes this entry, which adds historical references of its own. (Twenty-two is a
  line count; two lines carry the hash twice — `CLAUDE.md:46` and `docs/HANDOFF.md:16` — so the
  honest figure for references is 24.) **Five occurrences asserted *current* state and were stale:** `CLAUDE.md`
  line 46 ("`main` is at `bc6143c`, and that is what production runs"), line 335 ("Production runs
  `bc6143c`") and line 360 (the `Last-verified` footer); `docs/HANDOFF.md` line 15 ("`main` is at
  `bc6143c` and is what production runs") and line 76 (the Key locations Repo row). **All five are
  corrected.** The remaining **nineteen are historical** — that pull request #3 merged as `bc6143c`,
  that Railway deployed it at 2026-09-17T19:47:08Z, that `35d24c5` is an ancestor of it, that
  BUG-027 shipped in it — and remain true no matter where `main` moves.
- **No historical claim was rewritten.** `docs/ROADMAP.md` (2), `docs/BUGS.md` (3),
  `docs/CHANGELOG.md` (2) and `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` (2) are untouched — none
  of those four files appears in `git status` at all — and this log's own 7 are untouched because
  this entry only appends: `git diff docs/AUDIT-LOG.md` against `0ce65dd` is **insertions only,
  zero deletions** — a claim phrased to stay checkable rather than to quote a figure that this
  sentence would itself change. The two historical halves
  that sit *inside* rewritten lines survived verbatim: `CLAUDE.md:46` still ends "Railway deployed
  `bc6143c` at 2026-09-17T19:47:08Z, so **the BUG-027 refresh-token fix is now in production**", and
  `docs/HANDOFF.md:16` is unchanged context in the diff.
- **No current-state claim naming a hash was missed.** A sweep of every tracked `.md` for
  `main is at`, `head of main`, `production runs`, `working tree`, `uncommitted`, `unpushed`,
  `not merged`, `not in production`, the branch names and `pull request #4` returns nothing stale
  outside the dated historical entries in this log and `docs/CHANGELOG.md`, which are correct
  history. The misses that *did* survive are about task state, not commit state — findings 19 and 20.
- **Pull request #4 really is documentation-only, so the rewritten claim is true.**
  `git diff --name-only bc6143c..0ce65dd` is exactly eight files: `CLAUDE.md` and seven under
  `docs/`. No `backend/`, no `frontend/`, no CI config. `0ce65dd` has two parents (`bc6143c`,
  `6a54c04`) and carries two commits, `9f7e930` and `6a54c04`. **`bc6143c` therefore remains the
  last commit to bring application code to `main`,** as `CLAUDE.md` and `docs/HANDOFF.md` now say.
  For precision: within that merge the last source change is `ee4932a`'s two-line comment in
  `frontend/src/main.tsx` (the first audit's follow-up 4), and the last backend change is `584cff6`.
- **The deployment of `0ce65dd` is stated honestly, not assumed.** `CLAUDE.md:333` and
  `docs/HANDOFF.md:15` both say it was **not confirmed** in the dashboard, give the reason (no
  access), and note it carries no code change either way. No document anywhere asserts that Railway
  deployed `0ce65dd`. Nothing overstates it, so there is no finding here — the claim was written to
  the strength of the evidence, which is what finding 15 asked for.
- **Version drift has not returned.** All seven managed documents read `version: 1.1.1`. No version
  number was touched by this audit; the bump to **1.1.2** is `doc-versioner`'s, and finding 21 is
  what it must not forget while making it.
- **The figures re-run this session reconcile with `docs/TESTING.md`,** which was not edited:
  **550 backend tests, 98.31%** (3,316 statements, 56 missed) against `fail_under = 95` in
  `backend/.coveragerc`; **601 Vitest tests in 49 files** against `thresholds: { lines: 95 }` in
  `frontend/vitest.config.ts`; ruff and ESLint clean, `tsc -b` clean. The inventory matches the
  disk: **24** `backend/tests/test_*.py`, **49** frontend `*.test.ts(x)`, **3**
  `frontend/e2e/*.spec.ts`.
- **Playwright was *not* re-run this session.** Its **69** (3 + 12 + 27 × 2) is carried from the
  previous session's run. It is still trustworthy — no application code has changed since `bc6143c`,
  which is the run it belongs to — but it is a carried figure standing beside two fresh ones in
  `docs/HANDOFF.md`'s "All quality gates green" line, and that line does not distinguish them. Not
  raised as a finding, because the number is not wrong; recorded here so its provenance is on file.
  For four minutes during this audit the number was at risk from the other direction too — an
  untracked spec file the suite would have collected. See finding 25; it is closed.
- **No test suite was run by this audit.** Every figure above was read from the session's own
  completed runs, for the reason given in the Method note.

### Owner-reported changes — what could and could not be verified here

**T-2 — done.** The half that is checkable in the repository checks out. `registration_enabled` is a
platform-wide key in the `app_config` table, read at `backend/routers/auth.py:141` as
`get_config("registration_enabled", True)` — **unset means enabled**, so "the switch is unchanged and
remains enabled" is consistent with the code, and the admin-only toggle behind it is
`GET`/`PUT /api/auth/admin/registration` (lines 525–541). The `ADMIN_EMAIL` guard at
`backend/routers/auth.py:149-154` fires only when no account exists
(`if not all_users and admin_email and email != admin_email`), so it protects the *first* account and
nothing after it — exactly as `CLAUDE.md` and `docs/ROADMAP.md` describe, and exactly why the
`guard-check@example.com` probe succeeded (T-1, still open). **Who holds the account is
owner-reported and cannot be verified from the repository**; it is recorded as reported, and finding
24 is the only observation made about recording it.

**T-3 — done, and the verification method is sound.** This audit makes no network calls, per the
Method note, so the addresses are the session's own observations, recorded as reported. The
*reasoning* is recorded correctly in `docs/ROADMAP.md`: a flattened apex exposes no CNAME to read, so
identity of A records is the available evidence — `launchops.run` and `xesm2hmr.up.railway.app` both
answering `69.46.46.46`, against the old `5rlc9k25.up.railway.app` at `69.46.46.62`, resolved against
Google `8.8.8.8`. Stating the method rather than just the conclusion is what makes it re-checkable.
**The old state is nevertheless still asserted as fact in two other documents — findings 19 and 20.**

**T-4 — open, and now a repeat, which changes what it is.** The item asked for the exposed Railway
project token to be deleted and a replacement issued; both were done, and **the replacement was then
pasted into chat as well**. The task is therefore not "delete a stale token" but "rotate a token that
is exposed right now", and it must not be closed until it is rotated again. A pasted secret is in the
conversation transcript and in the session log under the user profile's `.claude/projects/`
directory — not a path inside this repository — so deleting the message does not undo it and rotation
is the only remedy. The preventive practice, recorded in the T-4 row: the owner authenticates in
their own shell (`railway login`, or exporting the variable themselves) so the value never enters a
transcript, a tool call or a shell argument.

**No token value has reached any tracked file, and none appears in this log.** `git grep` over the
tracked tree finds no `RAILWAY_TOKEN`, no `RAILWAY_API_TOKEN` and no token-shaped literal; the only
UUIDs in tracked sources are the all-zero sentinels
(`00000000-0000-4000-8000-000000000000`) in seven backend tests. `.gitleaksignore` still pins exactly
**three** reviewed fingerprints — two on `d7752c3`, one on `4f433ee`. This matters concretely: CI runs
**gitleaks over the full git history**, and `bc6143c` was merged rather than squashed precisely so
those fingerprints keep resolving, so a token that ever reached a commit would both fail the build and
stay in the history permanently.

### The previous entry's follow-ups — closed

| # | Item | State |
|---|---|---|
| 1 | `doc-versioner` — `docs/CHANGELOG.md` findings 16, 17 and 18 | **All three done** in `9f7e930` / `6a54c04`. The "Not yet merged" section is gone, replaced by a **How it shipped** section under 1.1.0 recording the merge as `bc6143c` and the deploy; the first audit is now stated as "**14 findings — 1 critical**, 2 high, 6 medium, 5 low; 9 auto-fixed", so finding 14 is no longer erased; and B-13 is described as Decided. A **1.1.1** entry was added, and the summary table's top row points at it |
| 2 | **Standing:** the documents corrected in that entry — this log included — were uncommitted on `docs/record-the-merge`, and every statement they made about the working tree was true only until that batch was committed | **Discharged, and the warning came true as written.** The batch was committed and merged as `0ce65dd`, and the merge falsified five hash claims and one working-tree claim across two documents. The corrections written to survive the commit did survive it; the ones that named a hash did not, because a hash claim cannot be phrased to outlive the commit it names — only re-checked |

### Left open

1. **`handoff-builder` — finding 19.** The highest-value repair in this entry: `docs/HANDOFF.md` is
   the document the next session reads first, and it currently tells that session to update a DNS
   record that is already updated, to decide a question already decided, and to treat a live
   credential exposure as an errand.
2. **The plan's owner — finding 20**, and the absent T-4.
3. **`doc-versioner` — findings 21 and 22**, to be applied *with* the 1.1.2 bump, not after it.
4. **`memory-updater` — finding 23.**
5. **The owner — T-4, and T-1.** T-4 is the only open item with a security consequence; T-1 is the
   account the probe created.
6. **Standing, and narrowed by what this entry found.** The lesson of finding 19 is that the drift
   which survives a reconciliation is no longer the commit hash — that class is now swept for
   directly — but **task state restated in more than one document**. T-2 and T-3 changed once and
   needed changing in four places; they were changed in two. Whenever an Active task's status moves,
   check `docs/ROADMAP.md`, `CLAUDE.md`, `docs/HANDOFF.md`'s next-steps list **and**
   `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`'s "Still to do" together, or delete the restatements and
   leave one authority. And re-audit after this batch is committed: everything above describes an
   uncommitted working tree on `docs/correct-the-production-commit`, a branch no other document names.

---

## Audit — 2026-09-17T20:05:00Z — re-audit after the pull request #3 merge

**Trigger:** the standing item the first entry left — "re-audit at the next session end, and **again
immediately after B-13 merges**." It merged.
**Scope:** deliberately narrow — only what the merge and the deployment changed: every description of
the branch, the pull request, the merge and production; the commit hashes behind those claims; the
blocked range; and the first entry's follow-up list. Nothing else was re-read; the first entry's
verified-clean list still stands.
**Repository state:** `main` = `origin/main` = **`bc6143c`**. HEAD is the new branch
`docs/record-the-merge`, sitting *at* `bc6143c` with **no commits of its own**, five documents modified
and one untracked file.
**This reconciler made no commit, stage, push or branch, and ran no test suite.** Findings continue the
first entry's numbering.

### Findings

| # | Severity | Document | Issue | Resolution |
|---|---|---|---|---|
| 15 | HIGH | `CLAUDE.md`, `docs/HANDOFF.md` | Both assert a clean working tree — "working tree clean apart from the untracked `.github/workflows/test-pipeline.yml`" and "Working tree is clean apart from the permanently untracked …". `git status` shows **five modified tracked documents** — the post-merge updates themselves — on a branch (`docs/record-the-merge`) that no document names. The same shape as finding 14, one level down: documents describing a tree state that stopped being true as they were written, this time hiding an uncommitted documentation batch rather than a security fix | **Fixed in both.** Each now names the branch, says the post-merge updates are uncommitted, and anchors the claim to this audit's timestamp rather than to a mutable `last-updated`, so a later metadata bump can't silently invalidate it |
| 16 | HIGH | `docs/CHANGELOG.md` | The **"Not yet merged"** section still reads "the BUG-027 fix … and this documentation batch are pull request #3, on branch `fix/refresh-token-clock-skew`. Until it merges they are not on `main` and the security fix is not in production". All three clauses are now false: it merged as `bc6143c`, it is on `main`, and the fix is deployed | **Left for `doc-versioner`,** which runs after this audit and owns the file. Reported, not edited |
| 17 | MEDIUM | `docs/CHANGELOG.md` | Its 1.1.0 entry describes the first audit as "12 issues found (0 critical, 2 high, 5 medium, 5 low), 8 fixed, 4 left to document owners". The entry below records **14 findings — 1 critical, 2 high, 6 medium, 5 low; 9 auto-fixed, 3 closed by their owners, 2 left open.** The figures are internally consistent but describe a different audit; "0 critical" erases finding 14 | **Left for `doc-versioner`** |
| 18 | LOW | `docs/CHANGELOG.md` | "`docs/ROADMAP.md`: gained B-13 (whether to commit the session-end batch)" — B-13 is no longer a question and no longer in Blocked; it is in ROADMAP's new **Decided** section, resolved | **Left for `doc-versioner`** — historical wording in a released entry, judgement call |

**Totals:** 4 findings — 0 critical, 2 high, 1 medium, 1 low.
**Auto-fixed by this reconciler: 1** (15). **Left for an owner: 3** (16, 17, 18 — all `docs/CHANGELOG.md`).

### Verified — the merge and deployment claims hold

- **`bc6143c` is genuinely the merge of pull request #3, and genuinely a merge commit.** Two parents,
  `f143f1c` (the old `main`) and `c486949` (the branch head); subject "Merge pull request #3 from
  Vybecode-LTD/fix/refresh-token-clock-skew". Not a squash, so `.gitleaksignore`'s three per-commit
  fingerprints — two on `d7752c3`, one on `4f433ee` — still resolve, as `ROADMAP.md` claims.
- **`35d24c5` is an ancestor of `bc6143c` and carries exactly the two files credited to it:**
  `backend/routers/auth.py` (+8/−2) and `backend/tests/test_sessions.py` (+21). The BUG-027 fix is
  therefore on `main` and, via the deployment, in production.
- **All six commits are in the merge and none other is:** `f143f1c..bc6143c` is exactly `35d24c5`,
  `584cff6`, `7c1f1cb`, `39ff28b`, `ee4932a`, `c486949`, plus the merge itself. Every hash quoted in
  every document resolves and carries the subject it is credited with.
- **The deployment timestamp corroborates.** `bc6143c` was committed 2026-09-17T19:47:05Z and Railway
  records the deployment at 19:47:08Z — three seconds later, consistent with a deploy triggered by the
  push rather than a figure typed from memory. The live HTTP responses are the session's own
  observations, recorded as reported; this audit makes no network calls.
- **The blocked range is right everywhere.** `ROADMAP.md` has a `## Decided` section holding B-13
  ("done 2026-09-17") and says "Twelve are open (B-1 to B-12)"; `CLAUDE.md` and `HANDOFF.md` both cite
  B-1…B-12 and mark B-13 resolved; `BUGS.md`'s pointer to "B-13 in `docs/ROADMAP.md`" still resolves,
  because B-13 was moved rather than deleted. T-1…T-8 unchanged and consistent.
- **Four owners' documents and the plan are accurate on the merge.** `CLAUDE.md`, `docs/BUGS.md`
  (BUG-027's field now reads "On `main` and in production"), `docs/HANDOFF.md`, `docs/ROADMAP.md` and
  `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` each describe the merge, the six commits, the deploy and
  the live checks correctly. A sweep of every `.md` in the repository for "uncommitted", "unpushed",
  "not merged", "not in production" and the branch name found **no stale claim outside
  `docs/CHANGELOG.md`**.
- **Version drift has not returned.** All seven managed documents still read `version: 1.1.0`. No
  version number was touched by this audit.

### The first entry's follow-ups — closed

| # | Item | State |
|---|---|---|
| 1 | Owner — push, open the pull request, merge B-13 with a merge commit | **Done.** Verified above |
| 2 | `roadmap-manager` — the "eighteen findings" count (finding 10) | **Done.** M0 now reads "Every finding from F-1 to F-18 closed — nineteen of them, the list carrying an F-7b as well as an F-7" |
| 3 | `handoff-builder` — disambiguate "18 bugs" against BUG-027 (finding 11) | **Done.** Now spelled out: "17 during that work … and, as the eighteenth, BUG-027" |
| 4 | Frontend owner — the wrong CSP claim in `frontend/src/main.tsx:11-12` | **Done** in `ee4932a`. The comment now reads "public/theme-init.js applies the saved theme before first paint; repeat it here for environments that don't run it (the desktop app serves its own document)" — matching `frontend/public/theme-init.js` and the corrected `DESIGN_SYSTEM.md` |
| 5 | **Standing:** re-audit after B-13 merges | **Discharged by this entry** |
| — | Finding 6 (not a follow-up): `docs/CHANGELOG.md` was missing | **Closed.** On disk, referenced correctly from `CLAUDE.md` |

### Left open

1. **`doc-versioner` — `docs/CHANGELOG.md` findings 16, 17 and 18.** 16 is the one that matters: the
   file still tells a reader the security fix is not in production.
2. **Standing, and the same trap one level down:** the documents corrected here — including this log —
   are themselves uncommitted on `docs/record-the-merge`. Every statement any of them makes about the
   working tree is true only until that batch is committed. Re-check with `git status` and `git log`
   before trusting it; the fixes in finding 15 are worded to survive the commit, but the next batch's
   will not be unless they are written the same way.

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
(`35d24c5`, `584cff6`, `7c1f1cb`, `39ff28b`), later pushed as pull request #3 with this audit's own fixes in `ee4932a`. Six documents are modified in the
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
   Six documents now describe pull request #3, unmerged; the moment it lands on `main`, every
   one of them is stale again. Finding 14 is what that looks like when it is missed by a minute.
