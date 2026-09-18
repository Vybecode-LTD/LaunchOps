---
document: BUGS
version: 1.1.3
last-updated: 2026-09-18T03:32:06Z
last-audit: 2026-09-18T02:45:00Z
managed-by: session-orchestrator/bug-fix-tracker
---

# Bug Registry

First edition of this registry. It back-fills every bug found and fixed during the Phase 0–2
rebuild, up to the handoff of 2026-09-17. All of it is on `main`, merged in pull request #1
(merge commit `24eff91`) and #2 (`f143f1c`). BUG-027, found and fixed at the end of the same
session, arrived after those two: pull request #3, from branch `fix/refresh-token-clock-skew`,
merged as `bc6143c`.

BUG-028 to BUG-031 come from the next session, on the evening of 2026-09-17 (UTC-4). BUG-028 to
BUG-030 are defects that shipped and are live in production. BUG-031 was found while BUG-028 was
being recorded: any account could get round BUG-028's fix with one request. All four are fixed on
branch `fix/spend-cap-and-mobile-overflow`, in pull request #5, which is **open and not merged**,
so the fixes are neither on `main` nor in production. BUG-032, from the same session, is **open**:
CodeRabbit found it reviewing `7dbc35d`, the last code commit on pull request #5. It fails safe,
and it may be BUG-031's rule working as written rather than a defect; the owner decides. Pull
request #5 does not change it.

**Every fix in this project lands with a test that failed before the fix and passed after it.**
Every fixed bug below did, except BUG-023, a `.gitignore` change verified by a tracking check
instead. For BUG-028 to BUG-031 the commit messages record the tests failing first, and the entries
for BUG-029 and BUG-031 say exactly what was seen failing. The regression tests named in BUG-001 to
BUG-027 were read and confirmed to exist on 2026-09-17, and those named in BUG-028 to BUG-031 were
located on the branch the same evening; the suites themselves were not run as part of writing this
file (the first session's own runs: 550 backend tests passing at 98.31% coverage, 601 frontend tests
passing at 99.19% lines, 69 Playwright tests passing). BUG-032 is open; its entry names the test
to write first if the owner wants it fixed.

**IDs** follow the order of the session brief's "Bugs found and fixed" table (BUG-001 to BUG-017),
then the nine fixed earlier in the rebuild (BUG-018 to BUG-026), then BUG-027, found after that
table at the end of the same session. BUG-028 to BUG-030 follow the order of the next session's
brief, BUG-031 was found after it, and BUG-032 in review after that. Entries are grouped by
severity, so the most serious one is first.

| Status | Count |
|---|---|
| 🔴 Open | 1 — BUG-032 (LOW; the owner decides whether it is a defect) |
| ✅ Fixed and verified, on `main` | 27 |
| ✅ Fixed and verified on branch `fix/spend-cap-and-mobile-overflow` only — pull request #5, open: **not on `main`, not in production** | 4 — BUG-028 to BUG-031 |
| Known limitations (not bugs) | 3 |

---

## Open Bugs

**One is open: BUG-032, LOW**, below. It fails safe, it is in pull request #5's code and not in
production's, and it may be the budget rule working as written: the owner decides.

**Four more are fixed but not in production.** BUG-028 to BUG-031 are fixed on branch
`fix/spend-cap-and-mobile-overflow`, in pull request #5, which is open and not merged. None of
their commits is on `main`, so all four are **still unfixed in production** until the pull request
merges and Railway deploys it (T-9 in `docs/ROADMAP.md`). The one that matters is the spending
exposure, BUG-028 with BUG-031. Production runs `bc6143c`'s application code, which has no default
budget at all, so any organisation without a budget of its own, which includes every organisation
registration creates, can spend without limit on the deployment's `ANTHROPIC_API_KEY`. BUG-028's
fix caps those organisations at a default and BUG-031's stops their owners lifting it. The cap holds
only with both fixes, and pull request #5 carries both.

**Merging pull request #5 caps the exposure; it does not close it.** The cap is **per
organisation**: $25 a month by default, which only a platform admin can raise. Nothing caps the
total. Open registration stays on, and every sign-up creates another organisation with its own $25
a month on the same key. Whether the total needs a cap is B-14 in `docs/ROADMAP.md`, open. Budgets
that owners have already stored above $25 in production are kept (BUG-031, BUG-032).

Remaining work is tracked in `docs/ROADMAP.md`, not here, and is not bug work: the tasks under
**Active**, and the open owner decisions under **Blocked**, B-14 and B-15 from the budget work
among them.

### LOW

#### BUG-032 — A budget stored above the default can be lowered only to the default or below, except by a platform admin
- **Severity:** LOW. It fails safe: it can only refuse a decrease, never allow an increase, so it
  has no cost or security consequence. The budget stays where it was, or the owner sets a lower one
  than they wanted.
- **Defect, or the rule as written? The owner decides.** The decision of 2026-09-17 (BUG-031) does
  not settle this case. It lets an owner set any budget up to the default ("lower it, match it or
  clear it") and lets only a platform admin set one above the default. Lowering $500 to $400 is
  both a decrease and a budget above the default, and the code follows the second half. If the
  owner meant that lowering is always allowed, this is a defect, and the fix and the test below are
  the way to it. If not, it is the rule working as written, and the entry closes as ⬜ Won't fix.
- **Reported:** 2026-09-17 (UTC-4), in the session that fixed BUG-028 to BUG-031. CodeRabbit found
  it reviewing `7dbc35d`, the last code commit on pull request #5, in a comment graded Minor on
  `backend/services/usage.py` line 83 (2026-09-18T02:33Z). Confirmed by reading the code; nothing
  was run.
- **Component:** `backend/services/usage.py`: `ensure_budget_allowed` (line 71) and its comparison
  at line 83. `PUT /api/organisation/budget` calls it (`backend/routers/organisations.py:366`), and
  nothing else checks or rewrites a stored budget. The fake backend copies the comparison
  (`frontend/src/test/fakeApi.ts:1048-1050`). Settings → Usage adds no limit of its own: it sends
  the amount and shows the 403 as the field's error
  (`frontend/src/pages/settings/UsageSettings.tsx:238`).
- **Affected case: a budget stored above the default,** which an Owner who isn't a platform admin
  lowers to an amount still above the default. In the code, a budget gets above the default in
  three ways:
  - **An owner set it before the ceiling existed.** Production runs `bc6143c`'s application code,
    whose budget route has no ceiling at all, so any owner may already have stored more than $25.
    Pull request #5 keeps stored budgets: the ceiling applies only to changes, and an
    organisation's own budget still wins at enforcement (BUG-031). Once it deploys, those owners get
    the 403 trying to lower such a budget to any amount still above $25. Whether any such budget
    exists is not known: no check of the production database is recorded.
  - **A platform admin set it.** The budget route is Owner-only, so that is an organisation where
    the admin holds the Owner role (B-15 in `docs/ROADMAP.md`), and the case needs a second Owner
    there who isn't a platform admin. Invitations and role changes both accept the Owner role
    (`Role`, `backend/models.py:49`).
  - **The platform default was lowered, or switched on from 0,** after the budget was set.
- **Reproduction** on branch `fix/spend-cap-and-mobile-overflow`, in the test suite or on a local
  instance, **never against the live site** (T-1 in `docs/ROADMAP.md`), with
  `DEFAULT_MONTHLY_AI_BUDGET_USD` at its default of 25:
  1. Give an organisation a budget of $500: as a platform admin who holds the Owner role there,
     send `PUT /api/organisation/budget` with `{"monthly_ai_budget_usd": 500}` (it answers 200),
     or store it directly, as an owner in production could have before the ceiling existed.
  2. As an Owner of that organisation who isn't a platform admin, send
     `{"monthly_ai_budget_usd": 400}`, or enter 400 in Settings → Usage.
- **Expected, if decreases are meant to be allowed:** 200, and a $400 budget. A decrease can only
  reduce what the deployment's key can spend.
- **Actual:** **403**, "An organisation can set a monthly AI budget of up to $25.00. A platform
  administrator can set a higher one." The budget stays at $500. That owner can only set $25 or
  less, or clear it, which falls back to the $25 default.
- **Root cause:** `usage.ensure_budget_allowed(amount, is_admin=...)` compares the requested amount
  with the **platform default**, `if ceiling > 0 and amount > ceiling`, and never with the
  organisation's **current** budget, which it is not given. So for anyone but a platform admin
  every amount above the default is refused, a decrease included. No test covers a decrease that
  stays above the default:
  `backend/tests/test_usage.py::test_an_owner_can_set_a_budget_up_to_the_platform_default`
  (line 305) starts from an organisation with no budget of its own.
- **Fix, if the owner wants decreases allowed:** also allow any amount at or below the
  organisation's current own budget. For anyone but a platform admin the ceiling becomes the larger
  of the default and the current budget, as CodeRabbit's comment suggests. That needs the current
  budget, so `ensure_budget_allowed` would need the organisation or its current budget passed in.
  The 403's "up to $25.00" would then understate what such an owner may set, so its wording should
  name the higher limit. The fake backend's copy needs the same change.
- **Regression test to write first, on the same condition,** in `backend/tests/test_usage.py`: a
  platform admin sets an organisation's budget above the default; a non-admin Owner of that
  organisation lowers it to an amount still above the default; expect 200. Against the current code
  it gets 403. Add a guard that the same owner still gets 403 raising it above its current budget,
  so the fix can't become a way round BUG-031.
- **Status:** 🔴 Open, waiting on the owner's reading of the rule. Pull request #5 does **not**
  change it: its code is frozen, and this was found after the fix it qualifies. It is not in
  production, whose code has no ceiling at all, and it arrives there when pull request #5 merges,
  unless it is fixed first.

### Known limitations

Three accepted gaps. LIM-001 and LIM-002 are holes in the evidence, not defects in shipped
behaviour. LIM-003 is a shortfall in the phone layout that BUG-029's fix leaves in place.

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

#### LIM-002 — Frontend branch coverage is 90.13% and no gate enforces it
- **Severity:** LOW
- **What it is:** `frontend/vitest.config.ts` sets a threshold on lines only (95%). Branches are at
  90.13% (3,032 of 3,364) at `7dbc35d`, the last code commit on pull request #5, up from the 89.97%
  this entry first recorded. The statement, function and line figures are in `docs/TESTING.md`,
  section 5. Branches can fall without failing `npm run coverage` or CI.
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
- **Follow-up (open item for the next session, not a bug):** the account `guard-check@example.com`
  and "Guard check's organisation" were created by a verification probe against the live site after
  the first admin account existed, and must be deleted by a platform admin in Settings → Team & access.

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
    organisation's own, or none (`BudgetStatement`, `frontend/src/pages/settings/UsageSettings.tsx:117`).
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
    organisation removes its own budget" (line 349) and "stops an organisation at the default and
    says which budget it reached" (line 378).
  - "Usage", for `7dbc35d`: "tells a new organisation which budget applies before anything has run"
    (line 136) and "says there is no cap before anything has run, when there really is none"
    (line 148). Before `7dbc35d`, a month with no usage held only the empty state in its panel, so
    neither sentence these two look for could appear there (checked in the code, not by running
    them).
- **Status:** ✅ Fixed and verified on the branch — **not yet on `main` or in production**
- **Not on `main` yet:** all three commits are on branch `fix/spend-cap-and-mobile-overflow`, in
  pull request #5, **open and not merged** (checked with `gh pr view 5` at 2026-09-18T02:28Z; its
  last code commit is `7dbc35d`). `main` is at `0ce65dd`, whose application code is still
  `bc6143c`'s (pull request #4 changed documents only), so **the defect is live in production**
  until pull request #5 merges and Railway deploys it: T-9 in `docs/ROADMAP.md`.
- **Caps the exposure only together with BUG-031's fix, and caps it rather than closing it.** The
  default caps organisations that never set a budget. But every account that registers is the Owner
  of the organisation registration creates, and until `a53b26e` an Owner could set any budget up to
  $9,999,999,999.99, which then won over the default. BUG-031's fix holds an Owner to the default
  and leaves anything above it to a platform admin; that is what makes the cap hold against someone
  determined to lift it. Both fixes are in pull request #5, so they reach production together. What
  they give production is a cap on **each organisation**, not on the total: open registration stays
  on, every sign-up creates an organisation with its own $25 a month on the same key, and whether
  the total needs a cap is B-14 in `docs/ROADMAP.md`, open.

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
  field's hint and a test's docstring.
  - `usage.ensure_budget_allowed(amount, is_admin=...)` (`backend/services/usage.py:71`) runs in
    `PUT /api/organisation/budget` before the budget is stored
    (`backend/routers/organisations.py:366`). When anyone but a platform admin
    (`users.role = 'admin'`) sets a budget above the default, it answers **403**: "An organisation
    can set a monthly AI budget of up to $25.00. A platform administrator can set a higher one."
    Clearing is always allowed and falls back to the default (BUG-028). With the default switched
    off (`0`) there is no ceiling. It compares the amount with the default alone, never with the
    organisation's current budget, so it also refuses a decrease that stays above the default.
    Whether the decision meant that is open, for the owner: **BUG-032**, under Open Bugs.
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
    changes, and an organisation's own budget still wins at enforcement. Production has no default
    today, so no stranger has had a reason to set a high budget. That is reasoning: no check of the
    production database for such budgets is recorded. An owner who isn't a platform admin can lower
    such a budget only to the default or below: BUG-032.
- **Regression tests** in `backend/tests/test_usage.py`. They use a new `stranger` fixture
  (line 278): a second registrant, an ordinary user who owns only the organisation registration made
  for them. The file's `owner` fixture registers first, so it is the platform admin, whom the new
  rule exempts.
  - **Written to fail first** (as `a53b26e` records):
    `::test_an_owner_cannot_raise_their_budget_above_the_platform_default` (line 289) and
    `::test_a_refusal_at_the_default_says_only_an_admin_can_raise_it` (line 337). **Seen failing:**
    against the old code, the first showed a stranger's $1,000,000 budget request succeeding.
  - **Guards on legitimate use, which pass with or without the fix:**
    `::test_an_owner_can_set_a_budget_up_to_the_platform_default` (line 305: lower, match and
    clear), `::test_a_platform_admin_can_set_a_budget_above_the_platform_default` (line 316) and
    `::test_with_the_default_switched_off_an_owner_sets_any_budget` (line 328).
  - Frontend: `frontend/src/test/app.usage.test.tsx` → "tells an owner who isn't a platform admin
    that they can't go above the default" (line 361).
  - `a53b26e` also changes the wording three of BUG-028's tests expect, to the new 429 and the new
    Settings → Usage text.
- **The test that encoded the bypass,**
  `::test_an_organisations_own_budget_wins_over_the_platform_default` (line 188), still passes: its
  `owner` is the platform admin, which is now the only way above the default. Its docstring, which
  still stated the old rule at `a53b26e`, was corrected in `7dbc35d`: it now says the test passes
  because its owner is the platform admin, and that for an ordinary owner the default is a ceiling
  as well as the fallback.
- **Status:** ✅ Fixed and verified on the branch — **not yet on `main` or in production**
- **Not on `main` yet:** `a53b26e` is in pull request #5, **open and not merged** (checked with
  `gh pr view 5` at 2026-09-18T02:28Z; its last code commit is `7dbc35d`). `main` is at `0ce65dd`,
  and production runs `bc6143c`'s application code. There an Owner can still set any budget, but
  there is no default for it to lift: the exposure is open there without this request (BUG-028).
  Both bugs are fixed in production once pull request #5 merges and Railway deploys it (T-9 in
  `docs/ROADMAP.md`). That caps the exposure, per organisation; it does not close it (B-14).
- **Left in place:** the budget route reaches only organisations the caller belongs to
  (`access.membership` resolves the caller's own memberships, `backend/services/access.py:78-93`),
  and nothing else writes a budget. So a platform admin can go above the default only in an
  organisation where they hold the Owner role. For any other organisation, the 403 and the 429 point
  to a platform administrator who has no control over its budget until they are given that role
  there. Not recorded as a bug: whether that is enough is for the owner to decide.

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
  the fix (`2d57b35`'s message). The spec takes Playwright from 69 tests to 96.
- **Status:** ✅ Fixed and verified on the branch — **not yet on `main` or in production**
- **Not on `main` yet:** `2d57b35` is in pull request #5, open and not merged (see BUG-028), so in
  production these four screens still scroll sideways until it merges and deploys.
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
- **Status:** ✅ Fixed and verified on the branch — **not yet on `main` or in production**
- **Not on `main` yet:** `597e94b` is in pull request #5, open and not merged (see BUG-028), so in
  production competitor results still show the empty columns and headings until it merges and
  deploys.

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
  production; once it merges and deploys, the entry records that, as BUG-027's does.
- **Verification means the regression test was located**, by name, in the suite it claims to be in.
  Where it cannot be found, the entry says so rather than naming a test that does not exist, and the
  test is written before the entry can read "Fixed and verified" (this is what happened to BUG-007).
- IDs are never reused and never renumbered. The next new bug is BUG-033.
