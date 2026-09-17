---
document: CHANGELOG
version: 1.1.1
last-updated: 2026-09-17T20:10:00Z
last-audit: 2026-09-17T19:30:00Z
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
| **1.1.1** | The merge of pull request #3 and what followed: BUG-027 in production, six documents reconciled to the merged state, a second audit, and three corrections to the 1.1.0 entry |
| **1.1.0** | The second pass of the 2026-09-17 handoff: the BUG-027 security fix, one more regression test, and the first documentation audit |
| **1.0.0** | The documentation baseline written earlier in that same session, covering the Phase 0–2 rebuild through to production |

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
