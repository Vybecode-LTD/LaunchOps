---
document: CHANGELOG
version: 1.1.2
last-updated: 2026-09-17T21:24:00Z
last-audit: 2026-09-17T20:45:00Z
managed-by: session-orchestrator/doc-versioner
---

# Changelog

**These numbers version the _documentation set_, not the application.** All seven managed documents —
`CLAUDE.md`, `docs/ROADMAP.md`, `docs/BUGS.md`, `docs/TESTING.md`, `docs/CHANGELOG.md`,
`docs/HANDOFF.md`, `docs/AUDIT-LOG.md` — carry one shared version and are bumped together. LaunchOps
itself has no release number; the repository carries no version tag. Code changes appear below only
because a documentation version records the state of the repository it describes.

Newest first. Format follows [Keep a Changelog](https://keepachangelog.com/).

| Version | What it covers |
|---|---|
| **1.1.2** | Correction and reconciliation after the pull request #4 merge: six stale current-state claims put right, T-2 and T-3 settled and T-4 retitled, a third audit, and the test-cluster notes |
| **1.1.1** | The merge of pull request #3 and what followed: BUG-027 in production, six documents reconciled to the merged state, a second audit, and three corrections to the 1.1.0 entry |
| **1.1.0** | The second pass of the 2026-09-17 handoff: the BUG-027 security fix, one more regression test, and the first documentation audit |
| **1.0.0** | The documentation baseline written earlier in that same session, covering the Phase 0–2 rebuild through to production |

---

## [1.1.2] — 2026-09-17

_Correction and reconciliation, in the same spirit as 1.1.1: the documentation merge falsified the
documents that recorded it. **No application code changed**, and `main` is where 1.1.1 left it._

### Fixed

- **Six stale current-state claims, corrected after pull request #4 merged as `0ce65dd`.** That
  merge was **documentation only** — `git diff --name-only bc6143c 0ce65dd` is exactly eight files,
  `CLAUDE.md` and seven under `docs/`, with no `backend/`, no `frontend/` and no CI config — and by
  landing it falsified every sentence still naming `bc6143c` as the head of `main`. Three were in
  `CLAUDE.md` (the **Active task** line, the **Deployment & CI** status, the `Last-verified` footer)
  and three in `docs/HANDOFF.md` (head of `main`, the working-tree state, the **Key locations** Repo
  row); five of the six named the hash, the sixth described the branch state. **Nineteen historical
  references to `bc6143c` were deliberately left intact** — that pull request #3 merged as it, that
  Railway deployed it at 2026-09-17T19:47:08Z, that BUG-027 shipped in it — because those stay true
  wherever `main` moves. **`bc6143c` remains the last commit that changed application code.**
- **`docs/HANDOFF.md`'s "Next steps — priority order"** — finding 19, the one high finding of the
  third audit, and the highest-value repair here: the list the next session reads first still told
  it to redo DNS work already finished, to decide a question already decided, and understated a live
  credential exposure as a pending errand ("issue a new one when needed"). Rewritten to the settled
  state, with T-4 named as the only open item carrying a security consequence.
- **`docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`** — finding 20. It is **not a managed document and
  carries no version of its own**, so it is recorded here rather than bumped. It still named the old
  `5rlc9k25.up.railway.app` as current, still listed T-2 among the work outstanding, and **never
  mentioned T-4 at all** — so the plan's own summary of what is left omitted the single open item
  with a security consequence. All three corrected.
- **`CLAUDE.md`'s quoted test DSN** — finding 23. It now matches `DEFAULT_TEST_DSN` in
  `backend/tests/conftest.py` **byte for byte**, `?sslmode=disable` included. The shortened form sent
  a reader copying it against a local Postgres to an SSL error whose cause was nowhere near the
  command.
- **Two in-body version strings in `CLAUDE.md`** — finding 21, raised *before* this bump rather than
  caught after it. The shared version was restated as a literal in two places outside the
  frontmatter, one of them self-referential ("this is the `version:` in this file's frontmatter, not
  a separate number"), so a versioner editing only the YAML block would have left both asserting a
  value they no longer equalled. Both now read **1.1.2**, raised together with the frontmatter.
- **`last-audit` drift across all seven managed documents** — finding 22. The stamps were split
  between `2026-09-17T19:30:00Z` and `2026-09-17T20:05:00Z` and every one of them predated the
  newest audit; this file's read `19:30:00Z` even though the 20:05Z audit raised three findings
  against it. All seven now read **2026-09-17T20:45:00Z**, the timestamp of the newest entry in
  `docs/AUDIT-LOG.md`, and all seven `last-updated` stamps were set together for this bump.

### Changed

- **T-2 — done (2026-09-17).** The platform admin (`users.role = 'admin'`, and the holder of
  `ADMIN_EMAIL`) is confirmed, and **open registration deliberately stays on**: the platform-wide
  switch in `app_config` is unchanged and enabled, an owner decision with the residual risk accepted.
  `ADMIN_EMAIL` guards only the *first* account — which is why the `guard-check@example.com` probe
  succeeded, and T-1 is still open.
- **T-3 — done (2026-09-17), and independently verified.** The Spaceship record now points at
  `xesm2hmr.up.railway.app`, the target that re-adding the domain produced. The apex is
  CNAME-flattened, so there is no CNAME to read and the check is **by address**: against public DNS
  (Google `8.8.8.8`), `launchops.run` answers **`69.46.46.46`**, identical to the new target and no
  longer the old `5rlc9k25.up.railway.app` at `69.46.46.62`. Stating the method rather than only the
  conclusion is what makes it re-checkable.
- **T-4 — still open at P1, and retitled** to "**Rotate the currently-exposed Railway project
  token**". The row originally asked for the exposed token to be deleted and a replacement issued;
  both were done, and the replacement was then exposed the same way, so the task is no longer "delete
  a stale token" but "rotate a token that is exposed right now". The owner does this **deliberately**
  — `railway login` will not authorise on this machine — and rotates at the end of every session,
  which bounds the exposure: **context, not fault.** **No token value is written into any document,
  and none may ever reach a commit**, because CI runs gitleaks over the full git history.
- **`docs/TESTING.md`** gained two bullets on the test cluster, because a session that assumes a
  database is there loses time before any other guidance applies: **nothing is usually listening on
  port 56432 at session start**, nor on 56433; where those scratch clusters' data directories live,
  and that **those paths are not durable** — they sit in a temp folder and can be cleaned up at any
  time; that the always-on server on **port 5432 is not a substitute**, because its `postgres` user
  needs a password recorded nowhere in this project; and how to start a stopped cluster with
  PostgreSQL 18's `pg_ctl`, or `initdb` a fresh one, keeping the data directory and the log file
  **out of the repository and out of OneDrive**.

### Audited

- **Third reconciliation audit** — `docs/AUDIT-LOG.md`, **2026-09-17T20:45:00Z**, triggered by the
  stale production commit and widened mid-way when three Active tasks were reported resolved.
  **7 findings (19–25): 0 critical, 1 high, 2 medium, 4 low.** **Auto-fixed by the reconciler: 0** —
  every finding lay in a document it does not own; **1 closed by its author while the audit ran**
  (25); **6 left for owners.** Findings 19, 20, 21, 22 and 23 are fixed above. **Finding 24 is
  recorded for the owner and no change is recommended without their view:** `docs/ROADMAP.md` T-2 now
  names the admin account's address directly beside the decision that open registration stays on —
  not a defect, an email address is not a secret and gitleaks does not flag one, but a pairing that
  deserves a deliberate choice rather than arriving as a side effect. Finding 25 was a throwaway
  `frontend/e2e/_audit-shots.spec.ts` that the main Playwright config would have collected, adding 63
  screenshot tests to the documented 69 and failing on a browser this machine cannot download; its
  author deleted it within four minutes, and the durable lesson is on file — `docs/TESTING.md`'s
  "Playwright only collects `*.spec.ts`" invariant is a **naming convention with nothing enforcing
  it**, and `.gitignore` covers neither a stray `e2e/*.spec.ts` nor an `audit-shots/` output
  directory.

### Unchanged

- **No figure was re-run for this version, and none is restated here as new.** Backend **550 passed /
  98.31%** (3,316 statements, 56 missed) and frontend **601 passed in 49 files / 99.19% lines** are
  this session's own earlier runs. **Playwright's 69 was not re-run at all** and is carried from the
  previous session — legitimate, because no application code has changed since `bc6143c`, the run it
  belongs to, but a carried figure standing beside two fresher ones.
- `main` = `origin/main` = **`0ce65dd`**. No commit, branch, push, tag or deploy was made for this
  version, and no test suite was run to produce it.
- `.github/workflows/test-pipeline.yml` remains **untracked by design**.

### Not yet committed

- As of **2026-09-17T21:24:00Z**, everything in this entry is **uncommitted working tree** on branch
  **`docs/correct-the-production-commit`**, which sits at `0ce65dd` with **no commits of its own**.
  Nothing described above is merged, and nothing is deployed. That was true when the sentence was
  written; the two versions before this one each recorded the same state and each went stale within
  minutes of it changing, and the audit that prompted this bump says plainly that a claim naming a
  hash or a working tree cannot be phrased to outlive the commit that changes it — only re-checked.
  **Re-check with `git status` and `git log --oneline -1` rather than trusting this line.**

---

## [1.1.1] — 2026-09-17

_Reconciliation, not new content: 1.1.0 reaching production, and the documents catching up._

### Changed

- **Pull request #3 merged into `main` as `bc6143c`** — a **merge commit, never a squash**, so
  `.gitleaksignore`'s per-commit fingerprints still resolve. All three CI jobs passed first:
  backend (550 tests against a `postgres:18` service, behind the 95% gate), frontend (lint,
  typecheck, Vitest, build, Playwright), and gitleaks over the full history. Railway deployed it
  at **2026-09-17T19:47:08Z**, three seconds after the merge commit. Verified live: `/health`
  → 200 `{"status":"ok"}`, cookieless `POST /api/auth/refresh` → 401 session-ended,
  `/api/auth/me` → 401, HSTS present. **The BUG-027 refresh-token fix is in production.**
- **Six documents updated for the merged state** by their owners: `CLAUDE.md`, `docs/BUGS.md`
  (BUG-027 now "On `main` and in production"), `docs/HANDOFF.md`, `docs/ROADMAP.md` (B-13 moved
  out of Blocked into a new **Decided** section; twelve blocked items remain, B-1 to B-12),
  `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`, and this changelog.

### Fixed

- **Three corrections to the 1.1.0 entry below** — findings 16, 17 and 18 of the second audit.
  Its "Not yet merged" section was false in all three clauses and now records how 1.1.0 shipped;
  its account of the first audit read "12 issues found (0 critical, 2 high, 5 medium, 5 low), 8
  fixed, 4 left" against the audit log's own **14 findings, 1 critical**, the "0 critical"
  erasing finding 14 entirely; and its B-13 line still called B-13 an open question.
- Two stale pieces of metadata in `CLAUDE.md`, both raised by CodeRabbit on the pull request: a
  changelog described as not yet created, and a body "Doc version" line left at 0.2.0.

### Reviewed

- Two automated reviewers commented on pull request #3 without blocking it: **CodeRabbit** and
  **Codex**. CodeRabbit's two substantive points were both the `CLAUDE.md` documentation
  metadata fixed above. Nothing was raised against the BUG-027 fix itself.

### Audited

- **Second reconciliation audit** — `docs/AUDIT-LOG.md`, 2026-09-17T20:05:00Z — scoped
  deliberately to only what the merge changed. **4 findings: 0 critical, 2 high, 1 medium,
  1 low**; 1 auto-fixed, 3 left to this file's owner and fixed here. The two high findings were
  `CLAUDE.md` and `docs/HANDOFF.md` asserting a clean working tree while five modified documents
  sat in it, and this file's "Not yet merged" section.

---

## [1.1.0] — 2026-09-17

_After the first handoff pass, same session._

### Fixed

- **BUG-027 (security) — refresh-token replay was decided by two different clocks.**
  `POST /api/auth/refresh` compared the application's clock against a `used_at` timestamp PostgreSQL
  had written. When the app's clock read behind the database's, an already-rotated (stolen) token was
  accepted instead of revoking its whole token family; the app and the database are separate services
  in production, so the skew is real. The comparison now happens in SQL —
  `r.used_at < NOW() - $2::interval AS reused` — so the database's own clock decides. Regression test
  written first: against the old code it returned 200 instead of 401.

### Added

- Regression test `test_claude.py::test_an_answer_split_across_text_blocks_is_joined_exactly` —
  citations can split an answer across text blocks, and joining the pieces with anything at all
  corrupts the JSON.
- `docs/AUDIT-LOG.md`, and this file.

### Changed

- Backend tests **548 → 550 passed**; coverage 98.31% (3,316 statements, 56 missed).
- `docs/BUGS.md`: 26 → 27 bugs, 0 open.
- `docs/ROADMAP.md`: gained B-13, how to land the session-end batch. The owner chose branch,
  pull request, merge after CI; it was carried out, and B-13 now sits in the roadmap's new
  **Decided** section rather than Blocked, leaving B-1 to B-12 open.
- First reconciliation audit: **14 findings — 1 critical, 2 high, 6 medium, 5 low**; 9 auto-fixed
  by the reconciler, 3 closed by their owners while it ran, 2 left open. Both high findings were in
  the assessment plan and are corrected — a "certificate still issuing" claim, and a superseded
  next-step list. The critical was finding 14: five documents were committed to the branch still
  describing the work as uncommitted, a state that had stopped being true a minute earlier.

### How it shipped

- The BUG-027 fix (`backend/routers/auth.py`, `backend/tests/test_sessions.py`) and this
  documentation batch went out as pull request #3, from branch `fix/refresh-token-clock-skew`,
  and **merged into `main` as `bc6143c`** once CI was green. Railway deployed it at
  2026-09-17T19:47:08Z, so the security fix **is on `main` and in production**. The merge and
  the live verification are recorded under 1.1.1 above; B-13 in `docs/ROADMAP.md` is Decided.

---

## [1.0.0] — 2026-09-17

_The session's documentation baseline._

### Added

- First versioned documentation set for the project: `docs/ROADMAP.md`, `docs/BUGS.md` and
  `docs/HANDOFF.md` created; `CLAUDE.md` and `docs/TESTING.md` brought current.

### Changed

- Records the session that took an uncommitted working tree — untouched since March, `97a0706` — to a
  deployed production service: Phases 0, 1 and 2 complete, decisions D1–D16, findings F-1 to F-18
  closed, 26 bugs fixed each with a test that failed first, merged as PR #1 (`24eff91`) and PR #2
  (`f143f1c`), and **launchops.run live over HTTPS** on Railway.

### Quality gates at that point

- Backend 548 passed, 98.31% coverage.
- Frontend Vitest 601 passed across 49 files, 99.19% lines.
- Playwright 69 passed.
- ruff and ESLint clean; pip-audit and npm advisories clear; gitleaks passing in CI.
