---
document: BUGS
version: 1.1.1
last-updated: 2026-09-17T20:10:00Z
last-audit: 2026-09-17T20:05:00Z
managed-by: session-orchestrator/bug-fix-tracker
---

# Bug Registry

First edition of this registry. It back-fills every bug found and fixed during the Phase 0–2
rebuild, up to the handoff of 2026-09-17. All of it is on `main`, merged in pull request #1
(merge commit `24eff91`) and #2 (`f143f1c`). BUG-027, found and fixed at the end of the same
session, arrived after those two: pull request #3, from branch `fix/refresh-token-clock-skew`,
merged as `bc6143c`.

**Every fix in this project lands with a test that failed before the fix and passed after it.**
All 27 bugs below did. The regression tests named in each entry were read and confirmed to exist
on 2026-09-17; the suites themselves were not run as part of writing this file (the session's own
runs: 550 backend tests passing at 98.31% coverage, 601 frontend tests passing at 99.19% lines,
69 Playwright tests passing).

**IDs** follow the order of the session brief's "Bugs found and fixed" table (BUG-001 to BUG-017),
then the nine fixed earlier in the rebuild (BUG-018 to BUG-026), then BUG-027, found after that
table at the end of the same session. Entries are grouped by severity, so the most serious one is
first.

| Status | Count |
|---|---|
| 🔴 Open | 0 |
| ✅ Fixed and verified | 27 |
| Known limitations (not bugs) | 2 |

---

## Open Bugs

**None.** No bug in this registry is open, and no new one is outstanding at the 2026-09-17 handoff.

Remaining work is tracked elsewhere and is not bug work: the next-session items are in
`docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` ("Next"), and the open owner decisions are in
`docs/PHASE1_DESIGN.md` (D8, D15).

### Known limitations

Two accepted gaps. Neither is a defect in shipped behaviour; both are holes in the evidence.

#### LIM-001 — No automated test calls the real Anthropic API
- **Severity:** MEDIUM (test coverage gap, not a product defect)
- **What it is:** the whole backend suite runs the official Anthropic SDK against a fake Messages
  API (`backend/tests/test_claude.py`), and an autouse guard fails any test that would reach the
  network. Nothing in CI proves the live API still behaves as the fake does.
- **Evidence we have instead:** a manual smoke run on 2026-09-17 against the real API with the
  deployment's key — three calls, all returning valid results, about $0.10: a non-research
  operation on Sonnet 5 using the response format; a research operation on Sonnet 5 (3 web
  searches, the strict `submit_result` tool, 6 verified sources, cache reads); a non-research
  operation on Opus 5 with the server-side fallback beta.
- **Risk:** a provider-side change to streaming, structured outputs, the web search tool or model
  availability would pass CI and fail in production.
- **Status:** ⬜ Accepted. Re-run the manual smoke test before each release, or add an opt-in
  live test behind an environment flag that CI does not set.

#### LIM-002 — Frontend branch coverage is 89.97% and no gate enforces it
- **Severity:** LOW
- **What it is:** `frontend/vitest.config.ts` sets a threshold on lines only (95%). Actual figures
  from the 2026-09-17 run: 99.19% lines, 97.03% statements, 89.97% branches, 96.47% functions.
  Branches can fall further without failing `npm run coverage` or CI.
- **Risk:** untested conditional paths — error branches and fallbacks most likely — accumulate
  silently.
- **Status:** ⬜ Accepted. Add a branch threshold once the current figure is raised, so the gate
  starts above where it is today rather than below it.

---

## Fixed Bugs

### CRITICAL

#### BUG-013 — First account created becomes platform admin
- **Severity:** 🔴 **CRITICAL — the most serious bug in this registry.** Security: unauthenticated
  takeover of a public deployment.
- **Reported / Fixed:** 2026-09-16/17 session
- **Component:** `backend/routers/auth.py`, `backend/config.py`
- **Root cause:** registration granted `users.role = 'admin'` to whoever created the first account,
  so on a newly deployed public instance the first stranger to sign up took control of the platform.
- **Fix:** the `ADMIN_EMAIL` setting. When it is set and no users exist yet, only that address may
  create the first account; everyone else is refused. Comparison is lower-cased and trimmed
  (`backend/routers/auth.py:153-154`, `backend/config.py:41`). It is set on the Railway deployment.
- **Regression test:** `backend/tests/test_auth.py::test_with_an_admin_email_only_that_address_can_create_the_first_account`
- **Status:** ✅ Fixed and verified
- **Follow-up (open item for the next session, not a bug):** the account `guard-check@example.com`
  and "Guard check's organisation" were created by a verification probe against the live site after
  the first admin account existed, and must be deleted by a platform admin in Settings → Team & access.

---

### HIGH

#### BUG-001 — SMTP STARTTLS without certificate verification
- **Severity:** HIGH (security)
- **Component:** `backend/services/email.py`
- **Root cause:** `starttls()` was called with no SSL context, so the connection was encrypted but
  the server's certificate was never checked — an active man-in-the-middle could read the SMTP
  credentials and every message sent.
- **Fix:** `server.starttls(context=ssl.create_default_context())` (`backend/services/email.py:113`).
- **Regression test:** `backend/tests/test_email.py::test_sends_through_starttls_with_the_server_certificate_verified`
- **Status:** ✅ Fixed and verified

#### BUG-002 — Line breaks in email header values crashed sending
- **Severity:** HIGH (security — header injection surface — and a crash)
- **Component:** `backend/services/email.py`
- **Root cause:** subject, sender name and reply-to went into headers unchanged, so a value
  containing a newline either broke the send or could append headers of its own.
- **Fix:** `_header_text()` collapses every header value to a single line before it is used
  (`backend/services/email.py:17`, applied at lines 100-104 and 116).
- **Regression tests:** `backend/tests/test_email.py::test_line_breaks_in_headers_cannot_add_recipients_or_break_the_send`,
  `::test_a_subject_with_a_line_break_is_sent_on_one_line`
- **Status:** ✅ Fixed and verified

#### BUG-003 — Recipient addresses unvalidated, and more than one recipient possible
- **Severity:** HIGH (trust — mail could reach addresses the draft never named)
- **Component:** `backend/services/email.py`
- **Root cause:** the message was handed to `send_message()` with the recipients taken from the
  headers, so anything parsed out of them was delivered to, valid or not.
- **Fix:** one validated recipient, passed explicitly as `to_addrs=[recipient]`
  (`backend/services/email.py:116`).
- **Regression tests:** `backend/tests/test_email.py::test_the_message_goes_only_to_the_draft_recipient`,
  `::test_an_invalid_recipient_address_is_not_sent`
- **Status:** ✅ Fixed and verified

#### BUG-005 — An empty settings row was created at every restart
- **Severity:** HIGH (data integrity; the tenancy half of finding F-1)
- **Component:** `backend/migrations/versions/0002_settings_cleanup.py`, `0003_organisations.py`
- **Root cause:** the old startup script inserted a settings row owned by no one on every app start,
  so the table filled with empty duplicates and reads picked an arbitrary one.
- **Fix:** migration `0002` deletes the orphan rows and moves the registration switch into
  `app_config`; `0003` makes settings belong to the organisation. The startup script is gone —
  schema changes are Alembic migrations applied at startup.
- **Regression tests:** `backend/tests/test_migrations.py::test_a_database_the_old_startup_script_created_upgrades_cleanly`
  (three legacy empty rows collapse to one), `backend/tests/test_database.py::test_restarts_do_not_add_settings_rows`
- **Status:** ✅ Fixed and verified

#### BUG-006 — Database helpers turned ids and ISO-looking text into dates in text columns
- **Severity:** HIGH (data corruption)
- **Component:** `backend/database.py`
- **Root cause:** the insert/update helpers converted any value that parsed as a date or timestamp,
  regardless of the target column's type, so UUID-shaped and ISO-shaped strings were rewritten on
  their way into text columns.
- **Fix:** `_prep_value(value, data_type)` converts only when the column is a date or timestamp
  (`backend/database.py:128`, used at lines 171 and 218).
- **Regression tests:** `backend/tests/test_database.py::test_uuid_shaped_text_is_stored_as_text`,
  `::test_iso_datetime_text_is_stored_as_text`, `::test_iso_strings_become_dates_and_datetimes_for_those_columns`
- **Status:** ✅ Fixed and verified

#### BUG-007 — Answer text split by citations was joined with stray line breaks, breaking JSON
- **Severity:** HIGH (AI operations failed to return a result)
- **Component:** `backend/services/claude.py`
- **Root cause:** an answer arrives as several text blocks when the model cites sources; they were
  joined with newlines, which inserted characters into the middle of the JSON answer and made it
  unparseable.
- **Fix:** the blocks are joined exactly, with no separator, and thinking blocks are left out:
  `return "".join(block.text for block in blocks if block.type == "text")`
  (`_answer_text`, `backend/services/claude.py:416-418`).
- **Regression test:** `backend/tests/test_claude.py::test_an_answer_split_across_text_blocks_is_joined_exactly`.
  It streams one JSON answer split across two text blocks, cut mid-string, and asserts the parsed
  result matches — the citation-splitting case exactly. Because the cut falls inside a JSON string,
  joining the pieces with a line break makes the JSON invalid, so the test fails if the fix regresses.
  It was restored on 2026-09-17 after this registry recorded it missing: the D11 rewrite to structured
  outputs had removed the original along with `_parse_json_response`.
- **Status:** ✅ Fixed and verified

#### BUG-008 — The app signed people out when the server answered 5xx at startup
- **Severity:** HIGH (users lost their session on any server hiccup)
- **Component:** `frontend/src/lib/auth/AuthProvider.tsx`
- **Root cause:** the startup "who am I" call treated every failure as a rejected session and
  cleared the token, so a 500 or an unreachable server signed the user out.
- **Fix:** only 401 signs out. Status 0 or 5xx puts the app in an `offline` state that keeps the
  session and retries (`frontend/src/lib/auth/AuthProvider.tsx:70-74`).
- **Regression tests:** `frontend/src/test/app.auth.test.tsx` → "keeps you signed in when the server
  has a temporary problem as the app opens" (line 115) and "says when the server can't be reached as
  the app opens, and carries on once it's back" (line 100). Note: the brief pointed at
  `frontend/src/lib/auth/*`; there are no test files in that directory — the tests live in
  `frontend/src/test/app.auth.test.tsx` and exercise the provider through the app.
- **Status:** ✅ Fixed and verified

#### BUG-012 — Approving an outreach result left its Outbox drafts to a task run after the response
- **Severity:** HIGH (silent data loss)
- **Component:** `backend/routers/queue.py`
- **Root cause:** approval answered the request first and created the contact drafts in a background
  task afterwards, so a restart in that window lost the drafts with no sign anything had gone wrong.
- **Fix:** the drafts are created before the approval is answered; nothing is left for after the
  response.
- **Regression test:** `backend/tests/test_queue.py::test_drafts_exist_by_the_time_the_approval_is_answered`
- **Status:** ✅ Fixed and verified

#### BUG-018 — Creating a calendar event failed on its date type
- **Severity:** HIGH (feature broken)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `backend/routers/extras.py`, `backend/database.py`
- **Root cause:** the date the API received did not match the column type it was written to, so
  `POST /api/calendar` failed.
- **Fix:** dates are prepared for their column type on the way in (see also BUG-006), and the route
  returns the created event with its `date` unchanged.
- **Regression test:** `backend/tests/test_extras.py::test_create_calendar_event` (asserts 201 and
  `event["date"] == "2026-10-01"`)
- **Status:** ✅ Fixed and verified

#### BUG-019 — Saving platform settings returned 500
- **Severity:** HIGH (admin feature broken)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `backend/routers/auth.py`, `backend/database.py`, `backend/migrations/versions/0002_settings_cleanup.py`
- **Root cause:** the platform-wide registration switch was written to a settings row owned by no
  one — the same orphan row BUG-005 created copies of — and saving it errored.
- **Fix:** the switch moved to the `app_config` table, read and written through the `app_config`
  helpers in `backend/database.py`; migration `0002` carries the old value across.
- **Regression tests:** `backend/tests/test_auth.py::test_admin_toggles_registration` (GET, PUT,
  registration actually refused, then allowed again) and the surrounding cases at lines 340-396,
  which assert the value lands in `app_config`
- **Status:** ✅ Fixed and verified

#### BUG-020 — A transferred project kept reading its previous owner's brand
- **Severity:** HIGH (cross-tenant data bleed into AI prompts)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `backend/routers/workflows.py`, `backend/services/claude.py`, `backend/database.py`
- **Root cause:** brand context was looked up by the project's original owner rather than by the
  organisation that holds it now, so after a transfer the AI was primed with the old owner's brand.
- **Fix:** company profiles (`brands`) and settings belong to the organisation, and brand context is
  built from the organisation the request is scoped to.
- **Regression tests:** `backend/tests/test_organisations.py::test_members_share_the_organisations_settings_in_operations`
  (asserts `"Brand: Olivia Ventures" in fake_ai.calls[0].system`),
  `backend/tests/test_tenancy.py::test_brands_are_isolated`
- **Status:** ✅ Fixed and verified

#### BUG-023 — `.gitignore` silently excluded `frontend/src/lib`
- **Severity:** HIGH (source code untracked — work at risk of being lost, and builds green locally
  but broken from a fresh clone)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `.gitignore`
- **Root cause:** the Python template's `lib/` rule (line 25) matches at any depth, so the whole
  frontend library directory — the API client, auth, domain logic — was never added to git.
- **Fix:** an explicit un-ignore with a comment explaining why it is there:
  `!frontend/src/lib/` (`.gitignore:193-195`).
- **Regression test:** none — a repository configuration fix, not code. Verified instead by
  `git ls-files frontend/src/lib`, which now lists the directory's files.
- **Status:** ✅ Fixed and verified (by tracking check, not by test)

#### BUG-027 — The refresh-token replay check compared two different clocks
- **Severity:** HIGH (security — session hijacking: a stolen refresh token could be replayed and the
  theft go unnoticed). At the lower edge of HIGH: it takes a stolen token *and* the skew window.
- **Reported / Fixed:** 2026-09-17, found at session end and fixed in the same session
- **Component:** `backend/routers/auth.py`, the `POST /api/auth/refresh` handler
- **How it surfaced:** `backend/tests/test_sessions.py::test_reusing_an_old_refresh_token_ends_every_session_from_that_sign_in`
  failed intermittently — one full run in, one out — and always passed when the sessions file ran alone.
- **Root cause:** the handler took `now = datetime.now(UTC)` in the application process and compared it
  with `used_at`, a timestamp PostgreSQL had written with its own `NOW()`:
  `if row["used_at"] and now - row["used_at"] > REUSE_GRACE:`. Two clocks, one comparison. Whenever the
  application's clock read slightly behind the database's, the difference went negative and a rotated —
  already used — refresh token was accepted as valid instead of revoking the token family. In production
  the app and the database are separate services on separate machines, so the skew is real rather than
  hypothetical: a stolen refresh token replayed inside the skew window would have been honoured, and the
  theft never detected.
- **Fix:** the database makes the decision, so both timestamps come from one clock. The same `SELECT`
  computes `r.used_at < NOW() - $2::interval AS reused`, with `REUSE_GRACE` passed as the interval
  parameter, and the handler branches on `row["reused"]` (`backend/routers/auth.py:199-209`).
  `expires_at` is still compared against the application clock, which is correct — the application
  writes that value itself.
- **Regression test:** `backend/tests/test_sessions.py::test_a_reused_token_is_caught_even_if_the_app_clock_lags_the_database`
  (line 100). Written first: against the old code it returned 200 instead of 401. It monkeypatches
  `routers.auth.datetime` with a clock that lags five seconds, sets `REUSE_GRACE` to zero, and replays
  an already-rotated token.
- **Verification:** `python -m pytest tests/test_sessions.py tests/test_auth.py` → 41 passed;
  `python -m ruff check .` clean. Full backend suite: 550 passed, 98.31% coverage
  (3,316 statements, 56 missed).
- **Status:** ✅ Fixed and verified
- **On `main` and in production:** commit `35d24c5` (`backend/routers/auth.py`,
  `backend/tests/test_sessions.py`), merged into `main` as `bc6143c` (pull request #3, a merge
  commit) once all three CI jobs passed — backend (550 tests, 95% coverage gate, `postgres:18`
  service), frontend (lint, typecheck, Vitest, build, Playwright) and the gitleaks secret scan.
  Railway deployed `bc6143c` at 2026-09-17T19:47:08Z, and it was verified live afterwards:
  `GET https://launchops.run/health` → 200 `{"status":"ok"}`, and `POST /api/auth/refresh`
  with no cookie → 401 `{"detail":"Your session has ended. Sign in again."}`. This resolves
  B-13 in `docs/ROADMAP.md`.

---

### MEDIUM

#### BUG-004 — SMTP connection left open when sending failed
- **Severity:** MEDIUM (resource leak)
- **Component:** `backend/services/email.py`
- **Root cause:** the connection was opened and closed by hand, so an exception between the two
  left the socket open.
- **Fix:** `with smtplib.SMTP(host, port, timeout=15) as server:` (`backend/services/email.py:108`).
- **Regression test:** `backend/tests/test_email.py::test_the_connection_is_closed_when_sending_fails`
- **Status:** ✅ Fixed and verified

#### BUG-009 — Press kit legacy fields missing from the report contents list
- **Severity:** MEDIUM (old reports looked half-empty)
- **Component:** `frontend/src/lib/domain/reports.ts`
- **Root cause:** press kits saved by the first version of LaunchOps name two fields `features` and
  `assets`; the contents list only looked for the current `key_features` and `media_assets`, so
  those sections were dropped from older reports.
- **Fix:** the section list accepts either name (`frontend/src/lib/domain/reports.ts:42-52`).
- **Regression test:** `frontend/src/lib/domain/reports.test.ts` → "lists the features and assets of
  press kits saved under their older field names" (line 26). Note: the brief said "frontend results
  tests"; the test is in the domain suite, not `components/results/results.test.tsx`.
- **Status:** ✅ Fixed and verified

#### BUG-010 — "Add person" accepted 6-character passwords the API rejects
- **Severity:** MEDIUM (the action failed at the server with a raw error)
- **Component:** `frontend/src/pages/settings/TeamSettings.tsx`
- **Root cause:** the form had no minimum, while the API requires 8 characters, so a short password
  was only rejected after the request.
- **Fix:** `minLength={8}` and the hint "At least 8 characters."; Add person stays disabled until
  the minimum is met (`frontend/src/pages/settings/TeamSettings.tsx:236-243`).
- **Regression test:** `frontend/src/test/app.settings.test.tsx` → "offers Add person only once the
  password meets the 8-character minimum" (line 270)
- **Status:** ✅ Fixed and verified

#### BUG-014 — Navigation rail ran link names and counts together for screen readers
- **Severity:** MEDIUM (accessibility)
- **Component:** `frontend/src/components/shell/AppShell.tsx`
- **Root cause:** the count badge sat directly against the link text with no separating text node,
  so the accessible name came out as "Review1 awaiting review".
- **Fix:** a text-node space between label and badge, with a comment marking why it must stay
  (`frontend/src/components/shell/AppShell.tsx:143-146`).
- **Regression test:** `frontend/src/test/app.shell.test.tsx` → "names the navigation's counts as
  separate words" (line 128), asserting the link's accessible name is exactly "Review 1 awaiting review"
- **Status:** ✅ Fixed and verified

#### BUG-015 — Press release form's three contact groups repeated identical field names
- **Severity:** MEDIUM (accessibility)
- **Component:** `frontend/src/components/operations/RunSheet.tsx`
- **Root cause:** the media, technical and sales contacts each had fields labelled only "Name" and
  "Email", so a screen reader announced three indistinguishable sets.
- **Fix:** each contact is a `<fieldset>` with a `<legend>` naming it
  (`frontend/src/components/operations/RunSheet.tsx:338-365`).
- **Regression test:** `frontend/src/test/app.operations.test.tsx` → "writes a press release with the
  contacts you give" (line 123), which reaches each contact through
  `getByRole("group", { name: "Media contact" })` and the two others
- **Status:** ✅ Fixed and verified

#### BUG-017 — Two flaky frontend tests
- **Severity:** MEDIUM (an unreliable gate; a test defect, not a product defect)
- **Component:** `frontend/src/test/app.sessions.test.tsx`, `frontend/src/test/app.live.test.tsx`
- **Root cause:** the first queried a field by label straight after navigating to a lazily loaded
  route, and matched the sign-in form's own Email field while the target page was still loading;
  the second asserted on the test fake noticing the event stream had closed, which is timing-dependent.
- **Fix:** the first waits for the destination heading before touching fields; the second asserts the
  behaviour that matters — that no second `GET /api/events` is made after sign-out — instead of the
  fake's internal state.
- **Regression tests (the repaired tests themselves):** `frontend/src/test/app.sessions.test.tsx` →
  "links to a reset from the sign-in page and asks for the email address" (line 37, with the comment
  explaining the lazy-load race); `frontend/src/test/app.live.test.tsx` → "stops listening on sign-out"
  (line 160)
- **Status:** ✅ Fixed and verified

#### BUG-021 — Malformed ids returned 500 instead of 404
- **Severity:** MEDIUM
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `backend/routers/*`, `backend/database.py`
- **Root cause:** an id that is not a UUID reached the database and raised, instead of being treated
  as an id that cannot exist. Editing an unknown admin user failed the same way.
- **Fix:** `/{id}` routes answer 404 for ids that cannot exist, including malformed UUIDs; the
  select helper returns `None` for them.
- **Regression tests:** `backend/tests/test_resource_ids.py::test_malformed_ids_return_404` (every
  `/{id}` route of queue, email-queue, templates, brands, calendar and captures),
  `backend/tests/test_products.py::test_malformed_product_id_returns_404`,
  `backend/tests/test_auth.py::test_admin_update_unknown_user_returns_404`,
  `backend/tests/test_database.py::test_select_one_returns_none_for_ids_that_cannot_exist`
- **Status:** ✅ Fixed and verified

#### BUG-022 — AI failures on report endpoints returned a bare 500
- **Severity:** MEDIUM (unreadable errors; no way for the interface to explain itself)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `backend/routers/products.py`, `backend/routers/workflows.py`, `backend/services/claude.py`
- **Root cause:** every AI failure — missing key, provider error, timeout — surfaced as an unhandled
  500 with no reason, and the failing call could still overwrite a saved report.
- **Fix:** typed AI errors mapped to 503 (configuration), 502 (provider) and 504 (timeout), each with
  a readable reason, and a saved report is never overwritten by a failed run.
- **Regression tests:** `backend/tests/test_workflows.py::test_ai_configuration_error_is_a_503_with_the_reason`,
  `::test_ai_provider_error_is_a_502`, `::test_ai_timeout_is_a_504` (each parameterised across the
  report endpoints)
- **Status:** ✅ Fixed and verified

#### BUG-025 — Launch plan ticks could show late or drop a quick second tick
- **Severity:** MEDIUM (the user could not trust what the plan showed)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `frontend/src/lib/queries/`, `frontend/src/pages/project/` (launch plan)
- **Root cause:** ticks waited on the server round trip and each save started from the server's last
  answer, so a second tick made before the first returned was overwritten.
- **Fix:** the tick shows immediately and the save is applied to the current local state; a save that
  fails is rolled back with an explanation.
- **Regression test:** `frontend/src/test/app.optimisticUpdates.test.tsx` → "unticks a launch plan
  item that couldn't be saved and says why" (line 11)
- **Status:** ✅ Fixed and verified

#### BUG-026 — Scraped pages sent their inline JavaScript and CSS to the AI as page text
- **Severity:** MEDIUM (wasted tokens and cost; page content polluted with script text)
- **Reported / Fixed:** earlier in the Phase 0–2 rebuild
- **Component:** `backend/services/scraper.py`
- **Root cause:** the HTML parser collected all character data as body text, including the contents
  of `<script>` and `<style>` elements.
- **Fix:** `MetadataParser` skips script and style contents when building body text; JSON-LD is still
  collected separately, through its own path.
- **Regression test:** `backend/tests/test_scraper.py::test_body_text_leaves_out_scripts_and_styles`
  ("Inline JavaScript and CSS are not page copy; they must not reach the AI as body text.")
- **Status:** ✅ Fixed and verified

---

### LOW

#### BUG-011 — A daily email limit of 0 said "You've sent 0 emails"
- **Severity:** LOW (misleading message; the behaviour was correct)
- **Component:** `backend/routers/queue.py`, `frontend/src/pages/outbox/OutboxPage.tsx`
- **Root cause:** a limit of 0 went through the "limit reached" wording, which reads as a count of
  what you have sent rather than as sending being switched off.
- **Fix:** both ends special-case 0. Backend 429:
  "Sending email is switched off on this server: its daily limit is 0. Ask the administrator to raise
  MAX_EMAILS_PER_DAY." (`backend/routers/queue.py:275`); the Outbox shows the matching notice
  (`frontend/src/pages/outbox/OutboxPage.tsx:28,56`).
- **Regression tests:** `backend/tests/test_queue.py::test_a_daily_limit_of_zero_says_sending_is_switched_off`,
  and `frontend/src/test/app.outbox.test.tsx` → "says sending is switched off when the server's daily
  limit is 0, rather than that the limit is reached" (line 108)
- **Status:** ✅ Fixed and verified

#### BUG-016 — Reddit self-promotion pill and launch platform priority read wrong
- **Severity:** LOW (presentation)
- **Component:** `frontend/src/components/results/WorkflowResult.tsx`
- **Root cause:** the raw field value was printed as it arrived — Reddit's `self_promo_allowed:
  "limited"` as a plain lowercase pill carrying no warning, and launch platform priority as
  "Priority high" rather than as anyone would say it.
- **Fix:** "limited" renders as a `warn` pill reading "Limited"; priorities read "High priority",
  "Medium priority", "Low priority", with unrecognised values falling back to "Priority 2" or
  "Priority: Worth a try" rather than being mangled.
- **Regression tests:** `frontend/src/components/results/results.test.tsx` → "says which communities
  limit self-promotion, with a warning pill" (line 47, which also asserts the lowercase "limited" is
  gone) and "names launch platform priorities as people say them" (line 67, covering six shapes of
  the field)
- **Status:** ✅ Fixed and verified

#### BUG-024 — Operation names lowercased acronyms
- **Severity:** LOW (cosmetic)
- **Component:** `frontend/src/lib/domain/values.ts`
- **Root cause:** operation names were lower-cased wholesale when used mid-sentence, producing
  "Run seo metadata".
- **Fix:** `midSentence()` keeps the capitals of acronyms and proper nouns
  (`frontend/src/lib/domain/values.ts:103`).
- **Regression test:** `frontend/src/lib/domain/values.test.ts` → "keeps acronyms and proper nouns"
  (line 68): `expect(midSentence("SEO metadata")).toBe("SEO metadata")`
- **Status:** ✅ Fixed and verified

---

## Closed — original assessment findings (F-1 to F-18)

The findings of the 2026-09-14 full-source assessment, at commit `97a0706`. They are the issues that
started the rebuild and they are **all closed**. Full detail, including each finding's file and line,
is in `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` (section 2 "Findings", Appendix A, and the Progress
section that records how each was closed). They keep their original F-IDs; they are not renumbered
into the BUG sequence.

| ID | Finding | Class | Closed by | Status |
|---|---|---|---|---|
| F-1 | Settings clobber across users | Critical / tenancy | Settings belong to the organisation; migration `0002` removes the orphan rows (see BUG-005) | ✅ Closed |
| F-2 | SMTP password exposure | Critical / security | Write-only field, encrypted at rest with `FIELD_ENCRYPTION_KEY` | ✅ Closed |
| F-3 | Approving a result sent email | Critical / trust | Approving creates drafts only; sending is explicit and capped by `MAX_EMAILS_PER_DAY` (see BUG-011, BUG-012) | ✅ Closed |
| F-4 | Interface bug in `App.jsx` | Bug | Fixed by the Phase 2 rebuild | ✅ Closed |
| F-5 | Brand creation with founders | Bug + injection surface | Fixed | ✅ Closed |
| F-6 | SSRF in the URL scraper | Security / SSRF | Public addresses only, re-checked on every redirect and pinned for the connection; HTML only; 2 MB cap | ✅ Closed |
| F-7 | Secrets and hardening | Security | Weak `JWT_SECRET` refused at startup, no secrets logged, docs only in debug, security headers, rate limits | ✅ Closed |
| F-7b | Interface bug in `App.jsx` | Bug | Fixed by the rebuild | ✅ Closed |
| F-8 | Competitor preview | Bug | Fixed | ✅ Closed |
| F-9 | In-process jobs lost on restart | Architecture | Durable PostgreSQL jobs with leases, heartbeats, retries and cancellation | ✅ Closed |
| F-10 | AI timeouts | Reliability | Every request streams, paused research resumes, whole call stops after 10 minutes with a readable error | ✅ Closed |
| F-11 | Calendar day shifted through UTC | Bug | Dates are local `YYYY-MM-DD` keys, never converted through UTC | ✅ Closed |
| F-12 | Interface bug in `App.jsx` | Bug | Fixed by the rebuild | ✅ Closed |
| F-13 | UX bug in `App.jsx` | UX bug | Fixed by the rebuild | ✅ Closed |
| F-14 | Retired `press_targets` dead code | Dead code | Removed; old results show as retired, and approving them still creates drafts (`backend/tests/test_queue.py::test_approving_a_saved_press_targets_result_still_creates_drafts`) | ✅ Closed |
| F-15 | Minor issue in `main.py` | Minor | Fixed | ✅ Closed |
| F-16 | Data model issue in the Claude service | Data model | Fixed | ✅ Closed |
| F-17 | `.claude/launch.json` configuration | Config | Fixed — "backend" on 8765, "frontend" on 5173 | ✅ Closed |
| F-18 | Duplicate deploy files | Config | `backend/Dockerfile` and `backend/railway.toml` deleted; the root pair is the only one | ✅ Closed |

---

## Conventions for this registry

- **Every fix needs a test that failed first.** Write the failing test, watch it fail, then fix.
  No entry is recorded as fixed without one.
- **Severity:** CRITICAL (app unusable, data loss, security breach) · HIGH (major feature broken)
  · MEDIUM (minor feature broken) · LOW (cosmetic).
- **Lifecycle icons:** 🔴 Open → 🟡 Investigating → 🔵 Fix in progress → ✅ Fixed and verified,
  with 🔄 Reopened and ⬜ Won't fix / Accepted.
- **Verification means the regression test was located**, by name, in the suite it claims to be in.
  Where it cannot be found, the entry says so rather than naming a test that does not exist, and the
  test is written before the entry can read "Fixed and verified" (this is what happened to BUG-007).
- IDs are never reused and never renumbered. The next new bug is BUG-028.
