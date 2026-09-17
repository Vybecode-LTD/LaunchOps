---
document: CHANGELOG
version: 1.1.0
last-updated: 2026-09-17T19:40:00Z
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
| **1.1.0** | The second pass of the 2026-09-17 handoff: the BUG-027 security fix, one more regression test, and the first documentation audit |
| **1.0.0** | The documentation baseline written earlier in that same session, covering the Phase 0–2 rebuild through to production |

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
- `docs/ROADMAP.md`: gained B-13 (whether to commit the session-end batch).
- First reconciliation audit: 12 issues found (0 critical, 2 high, 5 medium, 5 low), 8 fixed, 4 left
  to document owners. Both high findings were in the assessment plan and are corrected — a
  "certificate still issuing" claim, and a superseded next-step list.

### Not yet committed

- The BUG-027 fix (`backend/routers/auth.py`, `backend/tests/test_sessions.py`) and this
  documentation batch are working-tree changes, not on `main` — see B-13 in `docs/ROADMAP.md`.

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
