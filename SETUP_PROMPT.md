# SETUP_PROMPT.md — Starting a Claude Code Session on LaunchOps

> The original scaffold prompt (Supabase setup, wiring `App.jsx` to `api.js`) no longer applies: the
> interface was rebuilt in TypeScript in September 2026 and the backend runs on PostgreSQL via asyncpg.
> The old prompt is in git history at commit `97a0706`.

Paste the block below at the start of a session.

```
Read CLAUDE.md completely, then docs/HANDOFF.md if it exists, then SOURCE_MAP.md. HANDOFF.md opens
with what I want done first in this session.
Then read docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md, section "Progress", to see which phase is active.
docs/ROADMAP.md has the open tasks and the decisions waiting on me; docs/BUGS.md has every bug fixed
so far, each with the test that failed before the fix.

My environment:
- Windows 11. Always use `python -m pip` and `python -m uvicorn`, never bare `pip` or `uvicorn`.
- Port 8000 is already taken by another program on my machine. Run the backend on 8765 and point the frontend at it
  with `LAUNCHOPS_API_URL=http://localhost:8765` in `frontend/.env.local`.
- Backend tests need PostgreSQL 13 or newer (developed on 18). The local cluster lives in
  %LOCALAPPDATA%\LaunchOps-dev\postgres and serves port 56432, the test suite's default; it is stopped at session
  start, and docs/TESTING.md section 2 has the command to start it. The test database name must contain "test".
- Never write anything into OneDrive or the Documents/Desktop folders.

Before changing anything, run the quick check and tell me the result (docs/HANDOFF.md, "Start here"):
  frontend: npm run lint; npm run typecheck; npx vitest run --maxWorkers=2
  backend:  python -m pytest -q   (start the local cluster first, as above)
Not `npm run check`: at default concurrency the Vitest suite fails intermittently on this machine
(docs/TESTING.md, gap 14). Run one test suite at a time, never two at once.

Bug fixes need a failing test first. Keep ESLint at zero warnings. Update docs at the point of change,
and remind me to "perform handoff" before the session ends.
```
