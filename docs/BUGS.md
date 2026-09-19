---
document: BUGS
version: 1.2.1
last-updated: 2026-09-19T17:18:24Z
last-audit: 2026-09-19T17:18:00Z
managed-by: session-orchestrator/bug-fix-tracker
---

# Bug Registry

First edition of this registry. It back-fills every bug found and fixed during the Phase 0–2
rebuild, up to the handoff of 2026-09-17. All of it is on `main`, merged in pull request #1
(merge commit `24eff91`) and #2 (`f143f1c`). BUG-027, found and fixed at the end of the same
session, arrived after those two: pull request #3, from branch `fix/refresh-token-clock-skew`,
merged as `bc6143c`.

BUG-028 to BUG-031 come from the next session, on the evening of 2026-09-17 (UTC-4). BUG-028 to
BUG-030 are defects that shipped to production and stayed there until pull request #5 deployed.
BUG-031 was found while BUG-028 was being recorded: any account could get round BUG-028's fix
with one request. All four were fixed on branch `fix/spend-cap-and-mobile-overflow`, in pull
request #5, which merged into `main` as `477eaa4` on 2026-09-18 and is in production. BUG-032,
from the same session, was found in review after pull request #5's code was frozen, so the merge
took it to production. It fails safe. The owner decided on 2026-09-18 that it is a defect, and it
was fixed on branch `feat/playbook-ui`, in pull request #6, which merged into `main` as `199121c`
at 2026-09-18T19:08:32Z and is in production: the defect was live there from pull request #5's
deployment until pull request #6's, both on 2026-09-18.

**Every fix in this project lands with a test that failed before the fix and passed after it.**
Every fixed bug below did, except BUG-023, a `.gitignore` change verified by a tracking check
instead. For BUG-028 to BUG-032 the commit messages record the tests failing first, and the
entries for BUG-029, BUG-031 and BUG-032 say what was seen failing. The regression tests named in
BUG-001 to BUG-027 were read and confirmed to exist on 2026-09-17, those named in BUG-028 to
BUG-031 were located on their branch the same evening, and those named in BUG-032 were located on
pull request #6's branch, at `b607021`, on 2026-09-18. **On 2026-09-19 every regression test this
registry names was located by name on `main`, at `199121c`,** and the line numbers pull request #6
moved were updated to `main`'s, except in passages that say they describe the code as it was
before pull request #6. The suites themselves were not run as part of writing this file (the
first session's own runs: 550 backend tests passing at 98.31% coverage, 601 frontend tests
passing at 99.19% lines, 69 Playwright tests passing; BUG-032's entry gives the runs at
`b607021` and on `main` at `199121c`).

**IDs** follow the order of the session brief's "Bugs found and fixed" table (BUG-001 to BUG-017),
then the nine fixed earlier in the rebuild (BUG-018 to BUG-026), then BUG-027, found after that
table at the end of the same session. BUG-028 to BUG-030 follow the order of the next session's
brief, BUG-031 was found after it, and BUG-032 in review after that. Entries are grouped by
severity, so the most serious one is first.

**32 bugs are registered, and all 32 are fixed, on `main` and in production. None is open
anywhere.**

| Status | Count |
|---|---|
| 🔴 Open (no fix yet) | 0 |
| ✅ Fixed and verified, on `main` and in production | 32 — BUG-001 to BUG-032 |
| Known limitations (not bugs) | 4 — LIM-001 to LIM-004 |

---

## Open Bugs

**None is open:** every registered bug is fixed on `main` and in production, and no bug is open
on any branch. The automated reviews of pull request #6 found three problems in its new playbook
screen: a stage that became current stayed closed, a launch date that had passed read as a
negative countdown, and completion was read from only the newest 500 results. All three were
fixed on its branch, in `4af499c`, before it merged, so they were never on `main` or in
production: `docs/CHANGELOG.md` records them and this registry does not. The race the same
reviews found in BUG-032's fix is recorded in BUG-032's entry, because it was a hole in that
bug's own fix.

**One review thread on pull request #6 is still open, and it is not a bug:** CodeRabbit's, from
its review of `705c834`, at `frontend/src/test/fakeApi.ts:709`. The test fake's
`GET /api/queue/summary` looks a project up by id alone, so it answers 200 for another
organisation's project, where production answers 404. Production is right, and tested
(`backend/tests/test_queue.py::test_summary_needs_a_project_in_the_organisation` and
`backend/tests/test_tenancy.py::test_queue_items_are_isolated`); the gap is the fake's fidelity,
which `docs/TESTING.md` records. Fixing the fake's scoping is planned as the sharing work's first
code change (`docs/ROADMAP.md` → Next up), and will close the thread.

**BUG-028 to BUG-032 are all fixed on `main` and in production.** Pull request #5 merged and
deployed on 2026-09-18 with the fixes for BUG-028 to BUG-031: every organisation without a
budget of its own is now held to the $25 platform default, which its owner can lower or clear
but not raise; only a platform admin can set a budget above it. That caps each organisation, not
the total, and by the owner's decision of 2026-09-18 nothing caps the total (B-14): see BUG-028.
Pull request #6 merged into `main` as `199121c` at 2026-09-18T19:08:32Z, and production has
served its build since 19:09:32Z, checked from the live site. It carries BUG-032's fix: an owner
can now lower any budget to any lower amount, one stored above the default included. Until then
the defect was live in production, failing safe: an owner whose budget was above the $25 default
could lower it only to $25 or below, or clear it. BUG-032's entry is under Fixed Bugs, LOW.

Remaining work is tracked in `docs/ROADMAP.md`, not here, and is not bug work: the tasks under
**Active** and the owner decisions still open under **Blocked**, B-1 to B-12 and B-16. T-10's
check of the live site signed in as an Owner is done. The owner did it on 2026-09-19 and reported
that it looks good: the Operations screen opens on the playbook, and Settings → Usage is right.

### Known limitations

Four accepted gaps. LIM-001 and LIM-002 are holes in the evidence, not defects in shipped
behaviour. LIM-003 and LIM-004 are shortfalls in the phone layout: LIM-003 is what BUG-029's fix
leaves in place, and LIM-004 predates that fix and was not part of it.

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

#### LIM-002 — Frontend branch coverage is 90.24% and no gate enforces it
- **Severity:** LOW
- **What it is:** `frontend/vitest.config.ts` sets a threshold on lines only (95%). Branches are at
  90.24% (3,110 of 3,446) on `main` at `199121c`, measured on 2026-09-19, the same as at
  `b607021`, pull request #6's last code commit; they were 90.13% at `7dbc35d`, pull request #5's,
  and 89.97% when this entry was first recorded. The statement, function and line figures are in
  `docs/TESTING.md`, section 5. Branches can fall without failing `npm run coverage` or CI.
- **Risk:** untested conditional paths — error branches and fallbacks most likely — accumulate
  silently.
- **Status:** ⬜ Accepted. Add a branch threshold once the current figure is raised, so the gate
  starts above where it is today rather than below it.

#### LIM-003 — On a phone, the Portfolio launch board shows only its project column
- **Severity:** LOW (usability on phones; the data is reachable)
- **What it is:** at phone width the launch board is still a table. BUG-029's fix stopped the page
  itself scrolling sideways, but the board's other columns sit off to the side, reachable only by
  scrolling the table, with nothing to say that it scrolls.
- **Risk:** on a phone the board reads as a list of project names, and everything else it carries
  goes unseen. `frontend/e2e/responsive.spec.ts` cannot catch it: it checks that the page fits the
  viewport, not that the board's columns are in view.
- **Status:** ⬜ Accepted for now. The fix the owner chose, collapsing the board to cards at narrow
  widths, is `docs/ROADMAP.md` → Next up, item 3, and is not built.

#### LIM-004 — On a phone, the project tab bar hides the tabs after Review
- **Severity:** LOW (usability on phones; every tab is still reachable)
- **What it is:** at phone width the project's tab bar (`.tabnav` in
  `frontend/src/components/ui/Display.module.css`) scrolls sideways with its scrollbar hidden, so
  Outbox, Launch plan and Settings are reachable only by swiping the bar, with nothing to say that
  it scrolls. It dates from the v2 rebuild (`d7752c3`); BUG-029's fix did not touch it. First noted
  in documentation 1.1.3 (`docs/CHANGELOG.md`), and seen again on 2026-09-18 in a 390px screenshot
  of the Operations screen, where the tabs end at "Review" with the next one cut off.
- **Risk:** on a phone a project's tabs read as ending at Review, and its Outbox, launch plan and
  settings can go unfound. `frontend/e2e/responsive.spec.ts` cannot catch it: it checks the page's
  width, not whether the tabs are in view.
- **Status:** ⬜ Accepted for now. It is tracked in `docs/ROADMAP.md` → Next up, item 3, and is not
  fixed.

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
  (`backend/routers/auth.py:153-154`, `backend/config.py:43`). It is set on the Railway deployment.
- **Regression test:** `backend/tests/test_auth.py::test_with_an_admin_email_only_that_address_can_create_the_first_account`
- **Status:** ✅ Fixed and verified
- **Follow-up (not a bug), done 2026-09-19:** the account `guard-check@example.com` and "Guard
  check's organisation" were created by a verification probe against the live site after the first
  admin account existed. The owner deleted both on 2026-09-19 (T-1 in `docs/ROADMAP.md`).

#### BUG-028 — Organisations without a budget could spend without limit on the deployment's API key
- **Severity:** 🔴 **CRITICAL.** Security and cost: unbounded spending on the deployment's single
  `ANTHROPIC_API_KEY` by anyone who can register, and registration stays open by the owner's
  decision (T-2 in `docs/ROADMAP.md`). Less serious than BUG-013 (no takeover, no data exposed), but
  it needs nothing beyond an account.
- **Reported / Fixed:** 2026-09-17, found and fixed in the same session
- **Component:** `backend/services/usage.py`, `backend/config.py`, `backend/routers/auth.py`
  (registration), `frontend/src/pages/settings/UsageSettings.tsx`
- **Root cause:** `POST /api/auth/register` creates the new organisation with a name only
  (`backend/routers/auth.py:102`), so its `monthly_ai_budget_usd` is `NULL`, and
  `ensure_within_budget` (`backend/services/usage.py`) returned immediately on `NULL`. Every
  deployment bills AI to one `ANTHROPIC_API_KEY`, so any account created through open registration
  could spend on it without limit, bounded only by 60 AI operations per hour per account and 10 new
  accounts per address per hour. Both are in-process counters (`backend/services/ratelimit.py`) that
  reset on every deploy.
- **Fix:** three commits, which cap organisations that never set a budget and show them the cap.
  The cap holds against an Owner determined to lift it only with `a53b26e`, BUG-031's fix.
  - `522e40d` adds `DEFAULT_MONTHLY_AI_BUDGET_USD` (default 25), applied to any organisation without
    a budget of its own. Clearing an organisation's budget falls back to the default rather than
    meaning unlimited, `0` is the deliberate opt-out, and the 429 names the budget that was reached.
  - `43ab3e6` routes enforcement and the usage summary through one helper, `effective_budget`
    (`backend/services/usage.py:57`), so the month's summary in Settings → Usage shows the budget
    that actually applies and says when it is the default. It also refuses a negative default at
    settings validation (`ge=0`, `backend/config.py:73`): `effective_budget` treats a default at or
    below zero as no cap, so a mistyped negative would otherwise have silently disabled it.
  - `7dbc35d` shows the budget before anything has run. CodeRabbit's review of `43ab3e6` found, in a
    comment outside the diff, that in a month with no AI usage Settings → Usage showed an empty state
    instead of the month's summary, and the summary was the only place the budget appeared. So a new
    organisation, the one most likely to be on the default, saw no sign of its $25 cap until an
    operation had already cost something, and T-9's post-merge check in `docs/ROADMAP.md`, that
    Settings → Usage shows the $25 default, would have failed on it. The current month now says,
    under the empty state, which budget applies and whose it is: the platform's default, the
    organisation's own, or none (`BudgetStatement`, `frontend/src/pages/settings/UsageSettings.tsx:130`).
    BUG-031's note on who can set a higher budget is not part of that sentence.
- **Regression tests** (each written to fail first, as `522e40d`, `43ab3e6` and `7dbc35d` record):
  `backend/tests/test_usage.py::test_an_organisation_without_its_own_budget_is_capped_by_the_platform_default`,
  `::test_an_organisations_own_budget_wins_over_the_platform_default` (still passing, but since
  BUG-031's fix only because the test's `owner` is the platform admin, as its docstring has said
  since `7dbc35d`),
  `::test_a_zero_platform_default_leaves_an_organisation_uncapped`,
  `::test_clearing_a_budget_falls_back_to_the_platform_default`,
  `::test_a_negative_platform_default_is_refused_at_startup` (with
  `::test_zero_and_positive_platform_defaults_are_accepted` as its positive control), and the three
  summary tests `::test_the_usage_summary_reports_the_default_budget_an_organisation_is_actually_under`,
  `::test_the_usage_summary_reports_an_organisations_own_budget_as_its_own` and
  `::test_the_usage_summary_reports_no_budget_only_when_there_really_is_none`; plus, in
  `frontend/src/test/app.usage.test.tsx`:
  - "The platform's default budget" (line 335): "shows the default an organisation without its own
    budget is held to, not 'no budget'" (line 336), "says the default applies again when an
    organisation removes its own budget" (line 400) and "stops an organisation at the default and
    says which budget it reached" (line 429).
  - "Usage", for `7dbc35d`: "tells a new organisation which budget applies before anything has run"
    (line 136) and "says there is no cap before anything has run, when there really is none"
    (line 148). Before `7dbc35d`, a month with no usage held only the empty state in its panel, so
    neither sentence these two look for could appear there (checked in the code, not by running
    them).
- **Status:** ✅ Fixed and verified — on `main` and in production
- **On `main` and in production:** all three commits are in pull request #5 (branch
  `fix/spend-cap-and-mobile-overflow`), merged into `main` as `477eaa4` at 2026-09-18T04:43:03Z,
  with a merge commit, not a squash, after all three CI jobs had passed on the pull request's last
  commit, `ce12024` (the 1.1.3 documentation), by 03:38:11Z. Production served `477eaa4`'s build
  until pull request #6 deployed: at 04:43:44Z the live site's JavaScript bundle changed to
  `index-D1A5232b.js`, whose Settings → Usage chunk contains "default budget of", text from
  `43ab3e6` that only pull request #5's code has; at 05:14:16Z the same bundle was served and
  `GET /health` answered 200 `{"status":"ok"}`; and at 06:09:38Z the same chunk also held the
  sentence `7dbc35d` added and still the note from pull request #5 naming a platform
  administrator: all of pull request #5's code, none of pull request #6's. Since 19:09:32Z the
  same day, production has served `199121c`'s build, pull request #6's merge, which keeps all
  three commits (see BUG-032). The Railway dashboard's deployment records were not read. On
  2026-09-19 the owner checked Settings → Usage on the live site, signed in as an Owner, as T-10
  in `docs/ROADMAP.md` asked, and reported that it looks good. Until pull request #5's merge,
  production ran `bc6143c`'s application code, with no default budget, and the defect was live
  there.
- **Caps the exposure only together with BUG-031's fix, and caps it rather than closing it.** The
  default caps organisations that never set a budget. But every account that registers is the Owner
  of the organisation registration creates, and until `a53b26e` an Owner could set any budget up to
  $9,999,999,999.99, which then won over the default. BUG-031's fix holds an Owner to the default
  and leaves anything above it to a platform admin; that is what makes the cap hold against someone
  determined to lift it. Both fixes were in pull request #5, so they reached production together.
  What they give production is a cap on **each organisation**, not on the total: open registration
  stays on, and every sign-up creates an organisation with its own $25 a month on the same key.
  **The owner decided on 2026-09-18 that nothing should cap the total** (B-14 in
  `docs/ROADMAP.md`): AI usage is to be charged to customers at a markup, so more spend by
  customers means more revenue. That reasoning depends on billing, which is not built (B-12,
  open). Until it is, each self-registered organisation can spend up to $25 a month on the
  deployment's one `ANTHROPIC_API_KEY` with nothing recovering it, and open registration (T-2; at
  most 10 new accounts an hour per network address) adds organisations with nothing capping the
  sum.

#### BUG-031 — Any account that registers could raise its own organisation's AI budget past the default cap
- **Severity:** 🔴 **CRITICAL.** The same unbounded spending on the deployment's `ANTHROPIC_API_KEY`
  as BUG-028, one request further on: any account could get round BUG-028's fix. The 429 an
  organisation got at the default budget even told its owner how: "An owner can set a higher budget
  in Settings → Usage."
- **Reported / Fixed:** 2026-09-17, found and fixed in the same session. It was found by reading the
  code while BUG-028 was being recorded, and stayed open until the owner decided how to close it.
- **Component:** `backend/services/usage.py`, `backend/routers/organisations.py`
  (`PUT /api/organisation/budget`), `frontend/src/pages/settings/UsageSettings.tsx`, and the fake
  backend, `frontend/src/test/fakeApi.ts`
- **Reproduction** (before the fix): against `43ab3e6`, in the test suite or on a local instance,
  **never against the live site** (T-1 in `docs/ROADMAP.md`), with `DEFAULT_MONTHLY_AI_BUDGET_USD`
  at its default of 25:
  1. Register an account. Registration creates a new organisation with no budget of its own and
     makes the account its Owner (`backend/routers/auth.py:102-104`), so the $25 default applies.
  2. As that Owner, send `PUT /api/organisation/budget` with
     `{"monthly_ai_budget_usd": 9999999999.99}`, or enter the amount in Settings → Usage.
  3. Spend past $25 in the month, then start an operation. It runs.
- **Root cause:** three rules, each reasonable alone. Registration makes every new account the Owner
  of its own organisation. `PUT /api/organisation/budget` checked only that the caller was an Owner,
  and `BudgetUpdate` accepts any amount from 0 to $9,999,999,999.99
  (`Field(ge=0, max_digits=12, decimal_places=2)`, `backend/models.py:66`). And `effective_budget`
  returns an organisation's own budget whenever it has one (`backend/services/usage.py:65-66`). So
  the default held only organisations that never touched their budget. That was deliberate, and a
  test said so: the docstring of `test_an_organisations_own_budget_wins_over_the_platform_default`
  read "The default is a floor for organisations that never set one, not a ceiling on those that
  did." until `7dbc35d` rewrote it.
- **Owner's decision (2026-09-17):** an organisation's Owner may set any budget **up to the platform
  default**: lower it, match it or clear it. **Only a platform admin may set one above the
  default.** The owner chose this over a separate platform-wide maximum, over accepting the risk,
  and over closing open registration, which stays on (T-2 in `docs/ROADMAP.md`).
- **Fix:** `a53b26e`. `7dbc35d` later brought two pieces of wording into line with it: the budget
  field's hint and a test's docstring. The bullets below describe the fix as pull request #5 took
  it to `main`, with `7dbc35d`'s line numbers. Pull request #6 has since changed it: an owner can
  lower a budget stored above the default (BUG-032), the check and the write run under a row
  lock, and no message promises an administrator (B-15). BUG-032's entry describes that code,
  with `main`'s line numbers.
  - `usage.ensure_budget_allowed(amount, is_admin=...)` (`backend/services/usage.py:71`) runs in
    `PUT /api/organisation/budget` before the budget is stored
    (`backend/routers/organisations.py:366`). When anyone but a platform admin
    (`users.role = 'admin'`) sets a budget above the default, it answers **403**: "An organisation
    can set a monthly AI budget of up to $25.00. A platform administrator can set a higher one."
    Clearing is always allowed and falls back to the default (BUG-028). With the default switched
    off (`0`) there is no platform-default ceiling, only `BudgetUpdate`'s $9,999,999,999.99. It
    compares the amount with the default alone, never with the organisation's current budget, so
    it also refuses a decrease that stays above the default: **BUG-032**, which the owner decided
    on 2026-09-18 is a defect. Pull request #6 fixed it, and the fix is on `main` and in
    production.
  - The 429 when a budget is reached names whoever can actually help
    (`backend/services/usage.py:110-115`): "An owner can raise it in Settings → Usage." only while
    the organisation's own budget is under the default, or there is no default; otherwise "A
    platform administrator can raise it." The old wording pointed straight at the bypass.
  - Settings → Usage, for an organisation on the default, now says "This is the platform's default
    budget. You can set a lower one below; only a platform administrator can set a higher one."
    (`frontend/src/pages/settings/UsageSettings.tsx:181-184`). The note is part of the month's
    summary, so a month with no usage does not show it (see BUG-028). The fake backend enforces the
    same ceiling, with the same wording.
  - `7dbc35d` rewords the budget field's hint, which said operations and reports can't start "until
    an owner raises it". Who may raise a budget now depends on the amount, so it says "until the
    budget is raised" (`UsageSettings.tsx:256`). No test checks the hint's wording.
  - **Budgets already stored above the default are left as they are.** The rule applies to
    changes, and an organisation's own budget still wins at enforcement. Production had no default
    until pull request #5 deployed on 2026-09-18, so until then no stranger had a reason to set a
    high budget. That is reasoning: no check of the production database for such budgets is
    recorded, and BUG-032 gives the query that lists them. Until pull request #6 deployed, later
    the same day, an owner who isn't a platform admin could lower such a budget only to the
    default or below: BUG-032.
- **Regression tests** in `backend/tests/test_usage.py`, with `main`'s line numbers. They use a
  new `stranger` fixture (line 280): a second registrant, an ordinary user who owns only the
  organisation registration made for them. The file's `owner` fixture registers first, so it is
  the platform admin, whom the new rule exempts.
  - **Written to fail first** (as `a53b26e` records):
    `::test_an_owner_cannot_raise_their_budget_above_the_platform_default` (line 291) and
    `::test_a_refusal_at_the_default_says_only_an_admin_can_raise_it`, which `08705de`, in pull
    request #6, renamed `::test_a_refusal_at_the_default_promises_no_one_can_raise_it` (line 339)
    for B-15's wording. **Seen failing:** against the old code, the first showed a stranger's
    $1,000,000 budget request succeeding.
  - **Guards on legitimate use, which pass with or without the fix:**
    `::test_an_owner_can_set_a_budget_up_to_the_platform_default` (line 307: lower, match and
    clear), `::test_a_platform_admin_can_set_a_budget_above_the_platform_default` (line 318) and
    `::test_with_the_default_switched_off_an_owner_sets_any_budget` (line 330).
  - Frontend: `frontend/src/test/app.usage.test.tsx` → "tells an owner who isn't a platform admin
    that they can't go above the default" (line 412).
  - `a53b26e` also changes the wording three of BUG-028's tests expect, to the new 429 and the new
    Settings → Usage text.
- **The test that encoded the bypass,**
  `::test_an_organisations_own_budget_wins_over_the_platform_default` (line 190), still passes: its
  `owner` is the platform admin, which is now the only way above the default. Its docstring, which
  still stated the old rule at `a53b26e`, was corrected in `7dbc35d`: it now says the test passes
  because its owner is the platform admin, and that for an ordinary owner the default is a ceiling
  as well as the fallback.
- **Status:** ✅ Fixed and verified — on `main` and in production
- **On `main` and in production:** `a53b26e` and `7dbc35d` are in pull request #5, merged into
  `main` as `477eaa4` on 2026-09-18 and served in production since (see BUG-028 for how that was
  confirmed). Until then production ran `bc6143c`'s application code, where an Owner could set any
  budget but there was no default for it to lift: the exposure was open there without this request
  (BUG-028). The fix caps the exposure per organisation and does not close it; by the owner's
  decision nothing caps the total (B-14, in BUG-028). One flaw in the rule reached production with
  it, failing safe: an owner who isn't a platform admin could not lower a budget stored above the
  default to an amount still above it. That is BUG-032, fixed by pull request #6, which merged and
  deployed later the same day.
- **Left in place:** the budget route reaches only organisations the caller belongs to
  (`access.membership` resolves the caller's own memberships, `backend/services/access.py:78-93`),
  and nothing else writes a budget. So a platform admin can go above the default only in an
  organisation where they hold the Owner role. For any other organisation, the 403 and the 429
  pointed to a platform administrator who has no control over its budget until they are given that
  role there. Not recorded as a bug. The owner decided on 2026-09-18 that it stays so (B-15 in
  `docs/ROADMAP.md`: a platform admin does not set the budget of an organisation they don't belong
  to), and `08705de`, in pull request #6, reworded the 403, the 429 and the note on Settings →
  Usage so that none promises an administrator (see BUG-032). Production's messages have not
  named one since pull request #6 deployed on 2026-09-18.

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
  contacts you give" (line 126), which reaches each contact through
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

#### BUG-029 — Four screens scrolled sideways on a phone
- **Severity:** MEDIUM (four screens broken at phone width, and on Portfolio the launch board lost
  every data column; desktop unaffected)
- **Reported / Fixed:** 2026-09-17, found and fixed in the same session
- **Component:** `frontend/src/pages/portfolio/PortfolioPage.module.css`,
  `frontend/src/components/ui/Display.module.css`, `frontend/src/pages/review/ReviewPage.module.css`,
  `frontend/src/components/results/Results.module.css`
- **Root cause:** at a 390px viewport, Portfolio overflowed by 136px, Review and the review result by
  133px each, and the SEO report by 58px. Three unrelated causes, each measured in Chromium:
  - Portfolio: the launch board's auto-layout table computed an 806px intrinsic width that leaked
    into the document's `scrollWidth` past `.tableWrap`, which was clipping it (client width 356,
    scroll width 806).
  - Review and the review result: the status filter, an inline-flex segmented control whose segments
    could not shrink.
  - SEO report: a report section header held its title and both copy buttons in one row that did
    not wrap.
- **Why nothing caught it:** the accessibility suite scans the same 27 screens in both themes, but
  at the default desktop viewport.
- **Fix:** `2d57b35`, CSS only. `contain: content` on `.tableWrap`
  (`frontend/src/pages/portfolio/PortfolioPage.module.css:98`) stops the leak and leaves the desktop
  column widths as they were; `table-layout: fixed` would also have stopped it, but would have
  flattened the desktop columns to seven equal widths. The segmented control scrolls within itself,
  with `flex: none` on its segments so their labels stay readable (`Display.module.css`), and the
  Review filter bar can shrink (`ReviewPage.module.css`). The section header wraps
  (`Results.module.css`).
- **Regression test:** `frontend/e2e/responsive.spec.ts`: 27 screens at 390×844, one test each,
  asserting that the page is no wider than the viewport and, when it is, naming the element whose
  removal would fix it. The four screens' tests are "Portfolio fits a 390px viewport", "Review fits
  a 390px viewport", "Research result with sources fits a 390px viewport" (the review result) and
  "SEO report fits a 390px viewport". **Seen failing:** the spec's first run failed on the SEO
  report, which is how that overflow was found; the other three were measured in Chromium before
  the fix (`2d57b35`'s message). The spec takes Playwright from 69 tests to 96; pull request #6
  added a 28th screen, "All operations".
- **Status:** ✅ Fixed and verified — on `main` and in production
- **On `main` and in production:** `2d57b35` is in pull request #5, merged into `main` as `477eaa4`
  on 2026-09-18 and served in production since (see BUG-028). No check of the four screens on the
  live site at phone width is recorded: the evidence is `frontend/e2e/responsive.spec.ts`, which
  passed in CI on the pull request's last commit. Until the merge, these four screens scrolled
  sideways in production.
- **Left in place:** the launch board still shows only its project column on a phone; see LIM-003.

---

### LOW

#### BUG-011 — A daily email limit of 0 said "You've sent 0 emails"
- **Severity:** LOW (misleading message; the behaviour was correct)
- **Component:** `backend/routers/queue.py`, `frontend/src/pages/outbox/OutboxPage.tsx`
- **Root cause:** a limit of 0 went through the "limit reached" wording, which reads as a count of
  what you have sent rather than as sending being switched off.
- **Fix:** both ends special-case 0. Backend 429:
  "Sending email is switched off on this server: its daily limit is 0. Ask the administrator to raise
  MAX_EMAILS_PER_DAY." (`backend/routers/queue.py:299`); the Outbox shows the matching notice
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
  limit self-promotion, with a warning pill" (line 96, which also asserts the lowercase "limited" is
  gone) and "names launch platform priorities as people say them" (line 116, covering six shapes of
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

#### BUG-030 — Competitor results rendered empty columns and empty headings
- **Severity:** LOW (presentation: nothing was lost, but the result read as unfinished)
- **Reported / Fixed:** 2026-09-17, found and fixed in the same session
- **Component:** `frontend/src/components/results/WorkflowResult.tsx` (`Competitors`)
- **Root cause:** the competitor renderer drew the Pricing and Audience cells unconditionally, and
  the Strengths and Weaknesses placards whether or not they had items. Web research often cannot
  find those values, so a result could show a column header over blank cells, and profile headings
  with nothing beneath them.
- **Fix:** `597e94b`. A column no competitor fills is left out; a competitor missing a value in a
  column that is shown gets "Not found" (`WorkflowResult.tsx:117`), matching the "Not rated" and
  "No contact found" the result renderers already use; a profile heading with no items is omitted.
- **Regression tests** (written to fail first, as `597e94b` records):
  `frontend/src/components/results/results.test.tsx` → "leaves out a competitor column no
  competitor has a value for" (line 47), "marks a competitor that is missing a value the column does
  carry" (line 67) and "leaves out a profile heading with nothing under it" (line 84)
- **Status:** ✅ Fixed and verified — on `main` and in production
- **On `main` and in production:** `597e94b` is in pull request #5, merged into `main` as `477eaa4`
  on 2026-09-18 and served in production since (see BUG-028). Until the merge, competitor results in
  production showed the empty columns and headings.

#### BUG-032 — A budget stored above the default can be lowered only to the default or below, except by a platform admin
- **Severity:** LOW. It fails safe: it can only refuse a decrease, never allow an increase, so it
  has no cost or security consequence. The budget stays where it was, or the owner sets a lower one
  than they wanted.
- **Defect, or the rule as written? A defect: the owner decided on 2026-09-18 that owners should
  be able to lower their budget.** Until then it was open, because the decision of 2026-09-17
  (BUG-031) did not settle this case. That decision lets an owner set any budget up to the default
  ("lower it, match it or clear it") and lets only a platform admin set one above the default.
  Lowering $500 to $400 is both a decrease and a budget above the default, and the code followed
  the second half.
- **Reported:** 2026-09-17 (UTC-4), in the session that fixed BUG-028 to BUG-031. CodeRabbit found
  it reviewing `7dbc35d`, the last code commit on pull request #5, in a comment graded Minor on
  `backend/services/usage.py` line 83 (2026-09-18T02:33Z). Confirmed by reading the code; nothing
  was run.
- **Fixed:** 2026-09-18, in `08705de`, on branch `feat/playbook-ui` (pull request #6, merged into
  `main` as `199121c` the same day). The fix as first written had a race, which CodeRabbit's
  review of pull request #6 found and `b607021` closed the same day (below).
- **Component:** `backend/services/usage.py`: before the fix, `ensure_budget_allowed` (line 71)
  and its comparison at line 83. `PUT /api/organisation/budget` called it
  (`backend/routers/organisations.py:366`), and nothing else checks or rewrites a stored budget.
  The fake backend copied the comparison (`frontend/src/test/fakeApi.ts:1048-1050`). Settings →
  Usage adds no limit of its own: it sends the amount and shows the 403 as the field's error
  (`frontend/src/pages/settings/UsageSettings.tsx:238`). These line numbers describe the code as
  it was before the fix, at `7dbc35d`, which was `main`'s from pull request #5's merge until pull
  request #6's; the fix's, which are `main`'s now, are given under Fix.
- **Affected case: a budget stored above the default,** which an Owner who isn't a platform admin
  lowers to an amount still above the default. In the code, a budget gets above the default in
  three ways:
  - **An owner set it before the ceiling existed.** Until pull request #5 deployed on 2026-09-18,
    production ran `bc6143c`'s application code, whose budget route had no ceiling below
    `BudgetUpdate`'s $9,999,999,999.99, so any owner may have stored more than $25. Pull request #5
    kept stored budgets: the ceiling applies only to changes, and an organisation's own budget
    still wins at enforcement (BUG-031). From then until pull request #6 deployed, later the same
    day, those owners got the 403 trying to lower such a budget to any amount still above $25.
    Whether any such budget exists is not known: no check of the production database is recorded.
    The owner can list any from Railway's Postgres console:
    `SELECT id, name, monthly_ai_budget_usd FROM organisations WHERE monthly_ai_budget_usd > 25;`
  - **A platform admin set it.** The budget route is Owner-only, so that is an organisation where
    the admin holds the Owner role, and the case needs a second Owner there who isn't a platform
    admin. Invitations and role changes both accept the Owner role (`Role`, `backend/models.py:49`).
    By the owner's decision on B-15 (2026-09-18), a platform admin does not set the budget of an
    organisation they don't belong to.
  - **The platform default was lowered, or switched on from 0,** after the budget was set.
- **Reproduction** (before the fix): against `477eaa4`, pull request #5's merge, in the test suite
  or on a local instance, **never against the live site** (T-1 in `docs/ROADMAP.md`), with
  `DEFAULT_MONTHLY_AI_BUDGET_USD` at its default of 25:
  1. Give an organisation a budget of $500: as a platform admin who holds the Owner role there,
     send `PUT /api/organisation/budget` with `{"monthly_ai_budget_usd": 500}` (it answers 200),
     or store it directly, as an owner in production could have before the ceiling existed.
  2. As an Owner of that organisation who isn't a platform admin, send
     `{"monthly_ai_budget_usd": 400}`, or enter 400 in Settings → Usage.
- **Expected:** 200, and a $400 budget. A decrease can only reduce what the deployment's key can
  spend.
- **Actual,** before the fix, on `main` and in production from pull request #5's merge and
  deployment until pull request #6's: **403**, "An organisation can set a monthly AI budget of up
  to $25.00. A platform administrator can set a higher one." The budget stays at $500. That owner
  can only set $25 or less, or clear it, which falls back to the $25 default.
- **Root cause:** `usage.ensure_budget_allowed(amount, is_admin=...)` compared the requested amount
  with the **platform default**, `if ceiling > 0 and amount > ceiling`, and never with the
  organisation's **current** budget, which it was not given. So for anyone but a platform admin
  every amount above the default was refused, a decrease included. No test covered a decrease
  that stays above the default:
  `backend/tests/test_usage.py::test_an_owner_can_set_a_budget_up_to_the_platform_default`
  (line 307) starts from an organisation with no budget of its own.
- **Fix:** `08705de` carries out the owner's decision, and `b607021` closes a race in it. Both are
  in pull request #6, merged into `main` as `199121c`; the line numbers below are `main`'s.
  - **`08705de`:** an owner who isn't a platform admin may set any budget up to the platform
    default, clear it, **or lower a budget already above the default** to any lower amount.
    Raising such a budget further is still refused, and the 403 says why: "This organisation's
    budget can be lowered, but not raised above its current $500.00." Any other amount above the
    default gets 403 "The most an organisation can set is $25.00 a month." To check,
    `ensure_budget_allowed` was given the organisation and read its current budget in the one case
    that needs it: a request above the default from someone who isn't a platform admin. The fake
    backend enforces the same rule and wording (`frontend/src/test/fakeApi.ts:1063`).
  - **The same commit carries out the owner's decision on B-15**, that a platform admin does not
    set the budget of an organisation they don't belong to, so no message promises an
    administrator any more. The second 403 above replaces "An organisation can set a monthly AI
    budget of up to $25.00. A platform administrator can set a higher one." The 429 at the
    default, or at an own budget at or above it, ends "Operations can start again next month."
    instead of "A platform administrator can raise it."; an owner below the default is still told
    "An owner can raise it in Settings → Usage." The note on Settings → Usage reads, to a platform
    admin, "This is the platform's default budget. As a platform administrator, you can set a
    higher one below." and, to everyone else, "This is the platform's default budget, and the most
    an organisation can set. You can set a lower one below."
  - **The fix as first written had a race.** `08705de` read the current budget in
    `ensure_budget_allowed` and wrote the new one separately, in `set_budget`. CodeRabbit's review
    of pull request #6 found it, in a comment graded Major on `backend/services/usage.py` line 90:
    two owners lowering $500 at once, to $400 and to $450, could both pass against $500, and the
    later write would raise $400 to $450, a raise the rule forbids. **`b607021` closes it.** The
    check and the write run in one transaction with the organisation's row locked:
    `SELECT … FOR UPDATE` in `usage.set_budget(org_id, amount, *, is_admin)`
    (`backend/services/usage.py:126`, the lock at line 136), which `PUT /api/organisation/budget`
    now calls on its own (`backend/routers/organisations.py:367`). So the second change is checked
    against what the first one left. `ensure_budget_allowed(current, amount, *, is_admin)`
    (line 71) is now a plain function, given the current budget. The race came in with `08705de`
    and was closed on the same branch, so it was never on `main` or in production.
  - `b607021` also answers CodeRabbit's other comment, graded Minor, outside the diff: Settings →
    Usage promises a raise only to someone who can make one (`canRaiseBudget`,
    `frontend/src/lib/domain/usage.ts:71`: a platform admin; anyone while the platform default is
    off; or an owner whose own budget is below the default). For everyone else, stopped operations
    read "AI operations can't start again until next month." and the budget field's hint reads
    "When a month's estimated cost reaches it, operations and reports can't start until the next
    month."
  - Unchanged: `BudgetUpdate` (`backend/models.py:66`) still holds any request to
    $9,999,999,999.99, even with `DEFAULT_MONTHLY_AI_BUDGET_USD=0`, which removes only the
    platform-default ceiling.
- **Regression tests,** each written to fail first, as `08705de` and `b607021` record:
  - `backend/tests/test_usage.py::test_an_owner_can_lower_a_budget_stored_above_the_default`
    (line 357): an owner who isn't a platform admin stores $500 while the default is switched off,
    the default is switched on at $25, and lowering to $400 must answer 200. It is the test this
    entry asked for, reaching a budget above the default the third way above rather than through a
    platform admin.
  - `::test_an_owner_cannot_raise_a_budget_stored_above_the_default_any_further` (line 373): the
    guard that the fix is no way round BUG-031. Raising the same $500 to $600 answers 403, "This
    organisation's budget can be lowered, but not raised above its current $500.00."
  - `::test_two_budget_changes_at_once_cannot_raise_what_the_first_set` (line 387), for the race.
    It holds a first change, to $400, open on its own connection, polls `pg_locks` until the
    request for $450 is waiting on the row (it does not sleep), then commits. The request must
    answer 403, naming the $400 the first change left, and the budget must stay at $400.
  - Frontend: `frontend/src/test/app.usage.test.tsx` → "lets an owner lower a budget that is above
    the default" (line 383).
  - **Seen failing,** as the commit messages record: the first two are among the five backend
    tests that failed before `08705de` (the other three check B-15's wording); against `08705de`'s
    code, the race test's request answered 200 and wrote $450.
  - The same commits' other tests cover B-15's wording and who may raise a budget:
    `::test_a_refusal_at_the_default_promises_no_one_can_raise_it` (line 339, renamed from
    `::test_a_refusal_at_the_default_says_only_an_admin_can_raise_it`); in `app.usage.test.tsx`,
    "tells an owner who isn't a platform admin that the default is the most they can set"
    (line 348), "doesn't tell an owner on the default that raising the budget would restart
    operations" (line 362) and "still tells an owner whose own budget is below the default that
    raising it would" (line 374); and the two `canRaiseBudget` tests in
    `frontend/src/lib/domain/usage.test.ts` (line 72).
- **Verification:** at `b607021`, measured on 2026-09-18 one suite at a time: backend pytest 570
  passed, 98.33% of application code (3,356 statements, 56 missed; `services/usage.py` 98%, 85
  statements, 2 missed); frontend Vitest 652 passed in 51 files, 99.19% lines
  (`npm run coverage -- --maxWorkers=2`, run twice, identical; `docs/TESTING.md`, gap 14); ruff,
  ESLint and `tsc -b` clean. CI's three jobs passed on `08705de`, again on `b607021`, on the pull
  request's last commit, `705c834` (the 1.1.4 documentation; all three green by
  2026-09-18T06:43:43Z), and on the push of the merge, `199121c`, to `main` (run 35384260825).
  **On `main` at `199121c`**, whose tree is identical to `705c834`'s, the suites were run again on
  2026-09-19, one at a time, with the same results: ruff clean and 570 backend tests passed at
  98.33%; ESLint and `tsc -b` clean and 652 frontend tests passed in 51 files at 99.19% lines; 99
  Playwright tests passed in Chromium at `--workers=4`.
- **Status:** ✅ Fixed and verified — on `main` and in production
- **On `main` and in production:** `08705de` and `b607021` are in pull request #6 (branch
  `feat/playbook-ui`), merged into `main` as `199121c` at 2026-09-18T19:08:32Z, with a merge
  commit, not a squash, and the owner's go-ahead, after all three CI jobs had passed on the pull
  request's last commit, `705c834`. `199121c`'s tree is identical to `705c834`'s, so the code on
  `main` is exactly the code measured at `b607021`. Production serves `199121c`'s build, checked
  from the live site: at 19:09:32Z, about a minute after the merge, its JavaScript bundle was
  `index-P8sStBDZ.js`, whose Settings → Usage chunk (`UsageSettings-J658VHHI.js`) contains
  `08705de`'s and `b607021`'s wording ("and the most an organisation can set", "As a platform
  administrator, you can set a higher one" and "…can't start again until next month.") and no
  longer pull request #5's note naming a platform administrator ("only a platform administrator
  can"), and `GET /health` answered 200. On 2026-09-19 the site served the same bundle, and
  `/health` answered 200 again. The Railway dashboard's deployment record was not read. Also on
  2026-09-19, the owner checked Settings → Usage on the live site, signed in as an Owner, as T-10
  in `docs/ROADMAP.md` asked, and reported that it looks good. That check does not include this
  bug's case, lowering a budget stored above the default, which the regression tests above cover.
  The defect came in with `a53b26e`, BUG-031's fix, so pull request #5's merge (`477eaa4`) took
  it to production, where it was live, failing safe, until pull request #6 deployed the same day.

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
  with 🔄 Reopened and ⬜ Won't fix / Accepted. A fix that is only on an unmerged branch reads
  "✅ Fixed and verified on the branch", names its pull request and says it is not on `main` or in
  production; where the defect itself is already live in production, as BUG-032's was until pull
  request #6 deployed, the entry says so. Once the fix merges and deploys, the entry records
  that, as BUG-027's and BUG-028 to BUG-032's do.
- **Verification means the regression test was located**, by name, in the suite it claims to be in.
  Where it cannot be found, the entry says so rather than naming a test that does not exist, and the
  test is written before the entry can read "Fixed and verified" (this is what happened to BUG-007).
- IDs are never reused and never renumbered. The next new bug is BUG-033.
