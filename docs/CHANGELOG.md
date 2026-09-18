---
document: CHANGELOG
version: 1.1.4
last-updated: 2026-09-18T06:39:21Z
last-audit: 2026-09-18T06:35:00Z
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
| **1.1.4** | Pull request #5 merged (`477eaa4`) and deployed, putting BUG-028 to BUG-031 in production, and BUG-032 with them; pull request #6, not merged when this was written, up to its last code commit `b607021`: the launch playbook on the Operations screen, `GET /api/queue/summary`, BUG-032 fixed, the budget's check and write under one row lock, and budget messages that promise only what the reader can do; the owner's decisions of 2026-09-18 — no cap on the total (B-14), no platform admin setting the budget of an organisation they don't belong to (B-15), and a playbook that advises and never blocks; both pull requests' reviews; LIM-004; and a fifth audit |
| **1.1.3** | Pull request #5, not merged when this was written, up to its last code commit `7dbc35d`: the default AI budget and the rule that only a platform admin may go above it (BUG-028, BUG-031), a cap per organisation rather than on the total (B-14); four screens fixed at phone width (BUG-029); empty competitor columns (BUG-030); the playbook domain module; the automated review's fixes, with BUG-032 left open; a fourth audit; and gap 14, the Vitest suite unreliable at default concurrency on this machine |
| **1.1.2** | Correction and reconciliation after the pull request #4 merge: six stale current-state claims put right, T-2 and T-3 settled and T-4 retitled, a third audit, and the test-cluster notes |
| **1.1.1** | The merge of pull request #3 and what followed: BUG-027 in production, six documents reconciled to the merged state, a second audit, and three corrections to the 1.1.0 entry |
| **1.1.0** | The second pass of the 2026-09-17 handoff: the BUG-027 security fix, one more regression test, and the first documentation audit |
| **1.0.0** | The documentation baseline written earlier in that same session, covering the Phase 0–2 rebuild through to production |

---

## [1.1.4] — 2026-09-18

_Pull request #5 merged and deployed, and pull request #6 up to its last code commit, `b607021`:
the launch playbook on the Operations screen, the owner's budget decisions of 2026-09-18 carried
out, and the fixes from its automated review. Also the owner's decisions of that day, the review
threads on pull request #5 answered on GitHub, a new known limitation (LIM-004), five documents
outside the managed set brought current, and a fifth documentation audit. The documentation that
records all of it goes onto pull request #6 as a documentation commit after `b607021`. **When this
was written, pull request #6 was open, not merged and not deployed** (Where it stands, at the
end)._

### Shipped — pull request #5, merged and deployed

- **Pull request #5 merged into `main` as `477eaa4` at 2026-09-18T04:43:03Z**, from branch
  `fix/spend-cap-and-mobile-overflow` — a **merge commit, not a squash**, so `.gitleaksignore`'s
  per-commit fingerprints still resolve. CI had passed on the pull request's last commit,
  `ce12024`, the 1.1.3 documentation: all three jobs green by 2026-09-18T03:38:11Z. `main` =
  `origin/main` = `477eaa4`.
- **Production serves `477eaa4`'s build — verified from the live site, not from Railway.** At
  **2026-09-18T04:43:44Z** the JavaScript bundle of https://launchops.run changed to
  `index-D1A5232b.js`, whose Settings → Usage chunk (`UsageSettings-ZBCrvSWu.js`) contains
  "default budget of", from `43ab3e6`'s "The platform's default budget of $X applies again." —
  text only pull request #5's code has. At **05:14:16Z** it was the same bundle, and
  `GET /health` answered 200 `{"status":"ok"}`. Re-checked at **06:09:38Z**: the same chunk
  contains `7dbc35d`'s sentence ("…applies: operations stop when a month's cost reaches it."),
  `43ab3e6`'s ("…applies again.") and still pull request #5's note naming a platform
  administrator ("…only a platform administrator can set a higher one."), so production runs all
  of pull request #5's code and none of pull request #6's; `GET /health` answered 200. The new
  bundle appeared about 41 seconds after the merge, fast for a Railway build; the observation
  stands either way. **The Railway dashboard's deployment record was not read.**
- **So BUG-028, BUG-029, BUG-030 and BUG-031 are fixed on `main` and in production.** Every
  organisation without a budget of its own is held to the $25 platform default; its owners can
  lower or clear their budget; only a platform admin can set one above the default. That caps each
  organisation, not the total, and the owner has decided to leave the total uncapped (B-14, Decided
  below).
- **BUG-032 reached production with the merge**, having come in with `a53b26e`. It fails safe: it
  can refuse an owner's decrease, never allow an increase. It is fixed on pull request #6's branch
  (`08705de`, Fixed below) and stays live until #6 merges and deploys.
- **T-9 is done, except its second half.** Checking Settings → Usage on the live site signed in as
  an Owner needs a person who can sign in, which the assistant cannot do, so it moves into T-10
  (Where it stands, at the end).

### Decided — by the owner, 2026-09-18

1. **Merge pull request #5 (T-9): yes.** Done, above.
2. **The playbook advises and never blocks a run.** No stage waits for the ones before it; every
   operation still runs from wherever it is. This was the open question in `docs/ROADMAP.md` → Next
   up, item 1.
3. **BUG-032: owners should be able to lower their budget.** Fixed in `08705de`, below.
4. **B-14, a cap on total AI spend across organisations: no total cap.** The owner's reason: AI
   usage is to be charged to customers at a markup, so more spending by customers means more
   revenue. Recorded with it, as fact rather than advice: that reasoning depends on billing, which
   is not built — B-12 is open, and billing settings are a Phase 2 follow-up. Until billing exists,
   each self-registered organisation can spend up to $25 a month on the deployment's one
   `ANTHROPIC_API_KEY` with nothing recovering it, and open registration (T-2; at most ten new
   accounts an hour from one network address) adds organisations with nothing capping the sum. That
   exposure is the consequence of the decision.
5. **B-15, whether a platform admin may set the budget of an organisation they don't belong to:
   no** ("Absolutely not"). Carried out in `08705de`, which stops every message promising an
   administrator, and extended in `b607021`, which promises a raise only to someone who can make
   one.
6. **Answer the review threads on pull request #5 on GitHub: yes.** Done the same day (Reviewed —
   pull request #5, below).

- **Still open for the owner — twelve, B-1 to B-12:** plan section 8 (B-1 to B-7), the brand kernel
  (B-8 to B-10, D15), whether organisation owners should also create reset links (B-11, D8), and
  billing (B-12). B-13, B-14 and B-15 are decided.

### Added — on pull request #6's branch only

_Nothing in this section or the next is on `main` or in production._

- **The Operations screen opens on the launch playbook** — `53456fc`, built on the domain module
  recorded under 1.1.3 (`frontend/src/components/operations/Playbook.tsx`, `OperationCard.tsx` and
  `Playbook.module.css`, in `frontend/src/pages/project/OperationsPage.tsx`):
  - **"Next up"**: the one operation to run now, its stage ("Next up · Stage 1 of 5 · Understand
    the market"), what it produces, and a primary "Run …" button for Editors and above. A stage
    behind its window says so: "Behind: this stage is normally underway 45 days before launch, and
    launch is 11 days away." When everything in the stage is running or waiting for review, it says
    "Waiting on …" with the stage's name and a link to Review; when every step is done, it says
    that.
  - **The five stages as an ordered list**, which a screen reader announces as "stage 1 of 5". Each
    has its window ("From T-45d"), "n of m" and a pill: Done, Now, Behind or Later. The current
    stage is open; the others collapse to one line.
  - **Each operation's progress**: Done, In review, Running or Failed.
  - **"Always available"**: the one tool, `repurpose`, which saves nothing and counts towards
    nothing.
  - **"All operations"** (`?view=all`) keeps the catalogue by category. Both views share
    `OperationCard`, so an operation reads the same in each.
  - **While results load** it says "Working out what's next…" rather than recommending from an
    empty list; if they fail to load, it shows a notice and still guides from the reports saved on
    the project.
  - **It advises and never blocks**, by the owner's decision above.
  - **Tests:** 12 Vitest tests in a new file, `frontend/src/test/app.playbook.test.tsx`, and 3
    Playwright tests: "All operations" in both accessibility themes and at phone width.
- **`GET /api/queue/summary?product_id=…`** — `4af499c`, in `backend/routers/queue.py`: how many of
  a project's results each operation (`workflow_id`) has in each status, counted over **every**
  result. 404 for a project outside the organisation or a malformed id, 422 without `product_id`;
  declared before `/{item_id}`, which would otherwise take "summary" for an id. The playbook reads
  it in place of a page of `GET /api/queue` (Fixed, below). On the frontend: `queueApi.summary`;
  `keys.queueSummary`, under `["queue"]`, so live updates, launches and cancels refresh it;
  `useQueueSummary`, which polls like the results while any is running; and `ResultRecord` in
  `frontend/src/lib/domain/playbook.ts`, which a full result and a summary row both fit.

### Fixed — on pull request #6's branch only

- **BUG-032 (LOW) — an owner could lower a budget stored above the default only to the default or
  below** — `08705de`, by the owner's decision above. An owner who isn't a platform admin may now
  set any budget up to the platform default, clear it, **or lower a budget already above the
  default to any lower amount**. Raising such a budget any further is refused with a 403 — for a
  budget of $500, "This organisation's budget can be lowered, but not raised above its current
  $500.00."
- **B-15, carried out: no message promises an administrator** — `08705de`, by the owner's decision
  above. The budget route is Owner-only and stays so, which means nobody can go above the default
  in a self-registered organisation, yet three messages said a platform administrator could. Any
  other request above the default now gets a 403 reading "The most an organisation can set is
  $25.00 a month." The 429 at the default, or at an organisation's own budget at or above it, ends
  "Operations can start again next month."; an owner below the default is still told "An owner can
  raise it in Settings → Usage." The note on Settings → Usage reads, to a platform admin, "This is
  the platform's default budget. As a platform administrator, you can set a higher one below."; to
  everyone else, "This is the platform's default budget, and the most an organisation can set. You
  can set a lower one below."
- **`08705de`'s tests:** two new backend tests,
  `test_an_owner_can_lower_a_budget_stored_above_the_default` and
  `test_an_owner_cannot_raise_a_budget_stored_above_the_default_any_further`, one renamed to
  `test_a_refusal_at_the_default_promises_no_one_can_raise_it`, and two new Vitest tests in
  `app.usage.test.tsx`. Five backend tests failed before the change, as its commit message records.
- **The budget's check and write, under one row lock** — `b607021`, answering CodeRabbit's
  **Major** on this pull request (`backend/services/usage.py:90`). With BUG-032's fix the check
  read the organisation's current budget, and the write came separately: two owners lowering $500
  at once, to $400 and to $450, could both pass against $500, and the later write would raise $400
  to $450. The check and the write now run in one transaction with the organisation's row locked —
  `SELECT … FOR UPDATE` in `usage.set_budget(org_id, amount, *, is_admin)` — and
  `ensure_budget_allowed(current, amount, *, is_admin)` is a plain function given the current
  budget. **Never on `main`:** the race came with BUG-032's fix, on this pull request.
  `test_usage.py::test_two_budget_changes_at_once_cannot_raise_what_the_first_set` holds a first
  change open on its own connection, polls `pg_locks` until the request is waiting on the row — not
  a sleep — then commits; before the fix the request answered 200 and wrote $450.
- **Settings → Usage promises a raise only to someone who can make one** — `b607021`, answering
  CodeRabbit's comment outside the diff (Minor, `UsageSettings.tsx:181-183`). `canRaiseBudget` in
  `frontend/src/lib/domain/usage.ts` mirrors the backend's rule: a platform admin; anyone while the
  platform default is off; or an owner whose own budget is below the default. For everyone else,
  stopped operations read "AI operations can't start again until next month." rather than "…,
  unless the budget is raised.", and the budget field's hint reads "When a month's estimated cost
  reaches it, operations and reports can't start until the next month." rather than "…or until the
  budget is raised." Four Vitest tests: two for `canRaiseBudget` in `lib/domain/usage.test.ts`, two
  in `app.usage.test.tsx`.
- **Codex's three findings on the playbook** — `4af499c`, all P2, each with a test written to fail
  first. The code was new on this pull request, so none of the three was ever on `main`.
  - **A stage that becomes current while the screen is open now opens** (`Playbook.tsx:229`, which
    CodeRabbit raised too). Radix reads `defaultOpen` only when a stage first renders, so the guide
    could point at a stage that stayed shut. The stage it leaves is not closed: that would pull its
    operations, and the focus on them, out from under someone using them.
  - **A passed launch date is put in words** (`Playbook.tsx:187`): "the launch date was 3 days
    ago", not "launch is -3 days away", and "the launch date was yesterday". Tomorrow and today,
    which read "1 days away" and "0 days away", now read "launch is tomorrow" and "launch is
    today".
  - **What's finished is counted over every result** (`OperationsPage.tsx:27`). The playbook read
    `GET /api/queue?product_id=…&limit=500`, which returns the newest 500 at most, so an operation
    whose only approved result was older looked unfinished and was recommended again; it also
    carried up to 500 results with their content, where the summary is a few counts. It now reads
    `GET /api/queue/summary` (Added, above).
  - **Tests:** three backend in `test_queue.py` —
    `test_summary_counts_a_projects_results_by_operation_and_status`,
    `test_summary_counts_results_older_than_the_newest_500`, with the 500 inserted in bulk by
    `generate_series`, and `test_summary_needs_a_project_in_the_organisation` — plus one assertion
    in `test_tenancy.py::test_queue_items_are_isolated`; six Vitest in `app.playbook.test.tsx`:
    four launch-date wordings through `it.each`, the stage opening mid-session and the summary
    replacing the page of results. The existing "results can't be loaded" test now fails the
    summary route.

### Changed

- **Test figures, measured 2026-09-18 on the branch's code at `b607021`, one suite at a time:**
  backend **570 passed** (was 564), 98.33% of 3,356 statements, 56 missed, against the scratch
  cluster on port 56433 through `TEST_DATABASE_URL`; `services/usage.py` at 98% (85 statements, 2
  missed) and `routers/queue.py` at 96% (209, 8 missed). Frontend Vitest **652 passed in 51 files**
  (was 628 in 50), from `npm run coverage -- --maxWorkers=2`, run twice with identical results:
  lines 99.19% (3,317 of 3,344), statements 97.13% (3,825 of 3,938), branches 90.24% (3,110 of
  3,446), functions 96.59% (1,502 of 1,555). Playwright **99 passed** (was 96), in Chromium through
  the temporary local-browser configuration in section 2 of `docs/TESTING.md`, at `--workers=4`: 3
  smoke, 12 golden path, 56 accessibility (28 screens × 2 themes; "All operations" is the new
  screen) and 28 at a 390px phone width. ESLint (zero warnings), `tsc -b` and ruff are clean. Both
  95% gates pass.
- **The increases reconcile commit by commit:** backend +2 (`08705de`), +3 (`4af499c`), +1
  (`b607021`); Vitest +12 (`53456fc`), +2 (`08705de`), +6 (`4af499c`), +4 (`b607021`), with
  `lib/domain/playbook.test.ts` unchanged at 18; Playwright +3 (`53456fc`).
- **Every change was written test-first.** Seen failing before their fix: backend 5 before
  `08705de`, as its commit message records, 3 before `4af499c` and 1 before `b607021`; Vitest 7
  before `4af499c` — the six new tests and the updated "can't be loaded" test — and 3 before
  `b607021`.
- **CI passed on `08705de`, and again on `b607021`**, the last code commit: all three jobs —
  backend, frontend with Playwright, and the secret scan (on `b607021`: the secret scan at
  05:52:16Z, the backend at 05:53:44Z, the frontend at 05:57:07Z). This documentation, committed
  on top, gets its own run; read it with `gh pr checks 6`. The merge waits until all three jobs
  are green on the pull request's latest commit (T-10).

### Checked outside the test suites

- **By eye, against the fake backend** (a temporary Playwright spec, deleted afterwards): the
  playbook on a project whose launch date passed two days ago, on the desktop and at 390px, reads
  "…and the launch date was 2 days ago."; Settings → Usage, for an owner who isn't a platform
  admin, on the default and with it used up, reads "AI operations can't start again until next
  month.", with no "raised" anywhere.
- **The new route's contract, by reading both sides.** No automated test runs the frontend against
  the real backend (`docs/TESTING.md` gap 3), so `/api/queue/summary?product_id=` and the fields
  `product_id`, `workflow_id`, `status` and `count` were checked against `QueueSummaryRow` by
  reading, and the route itself by the backend tests against real Postgres. A signed-in check
  against a local backend was not done: the assistant does not create accounts or enter passwords.

### Known, not fixed

- **LIM-004, new: the project tab bar on a phone.** `.tabnav` in
  `frontend/src/components/ui/Display.module.css` scrolls with its scrollbar hidden, so Outbox,
  Launch plan and Settings are reachable only by swiping, with no cue. 1.1.3 recorded it only in
  this file and in `docs/HANDOFF.md`; it now has a registry entry in `docs/BUGS.md`. Seen again on
  2026-09-18 in a 390px screenshot of the Operations screen, where the tabs end at "Review" and the
  next is cut off.
- **LIM-003, unchanged:** on a phone the Portfolio launch board shows only its project column. The
  owner's chosen fix is cards (`docs/ROADMAP.md` → Next up).
- **Gap 13, new evidence — a browser test timing out under CPU contention.** At Playwright's
  default 8 workers on this 16-core machine, two full runs each had one phone-width screen time out
  after 10 s waiting for it to render — "Run sheet", then "Calendar month" — a different screen
  each time, and each passed when run on its own: "Run sheet" 5 of 5 with `--repeat-each 5`, and
  the responsive spec by itself 28 of 28. The calendar is a screen pull request #6 does not touch.
  Locally, run Playwright with `--workers=4`; CI is unaffected.
- **Gap 14, unchanged:** the Vitest suite is not reliable at default concurrency on this machine;
  run it with `--maxWorkers=2`.
- **The fake backend is looser than the real one.** Its `GET /api/queue`
  (`frontend/src/test/fakeApi.ts`) ignores `limit` and returns results in insertion order, where
  the backend returns the newest first and at most `limit`, which is why no frontend test could see
  the 500-result problem; `test_summary_counts_results_older_than_the_newest_500` covers it in the
  backend. Making the fake sort newest first was rejected: tests that create results a millisecond
  apart would then order unpredictably.
- **Still untested:** `BudgetStatement`'s wording for an organisation's own budget, "Your
  organisation's budget of $X applies: operations stop when a month's cost reaches it." No test
  asserts it; the default-budget wording is tested.
- **Budgets stored above $25 before the ceiling existed are kept**, because the rule applies to
  changes. The owner can list any in production from Railway's Postgres console:
  `SELECT id, name, monthly_ai_budget_usd FROM organisations WHERE monthly_ai_budget_usd > 25;`

### Reviewed — pull request #5

- **Final tally: twelve review threads and two comments outside the diff.**
  - **Codex, two threads:** P1 on `backend/services/usage.py`, expose the effective budget, and P2
    on `backend/config.py`, reject a negative default — both fixed in `43ab3e6`.
  - **CodeRabbit, ten threads.** In its first reviews, five on documents — `CLAUDE.md` (the
    responsive suite's scope), the plan's line on rotating the Railway token, `docs/AUDIT-LOG.md`,
    `docs/CHANGELOG.md:290` and `docs/HANDOFF.md` — plus a Major on
    `frontend/src/lib/domain/playbook.ts`, fixed in `6b97da3`, and one on
    `backend/services/usage.py:83`, which is BUG-032. Then, in its review of `ce12024`, three more
    on documents (below).
- **A correction: the 1.1.3 entry's count of nine was right.** The token thread was one of
  CodeRabbit's five threads on documents — the one that entry lists as "Not actioned". The 1.1.3
  `docs/HANDOFF.md` listed it again after "five were on the documents", which reads as ten, and
  CodeRabbit's thread on `docs/CHANGELOG.md:198` asked for the two to agree. The 1.1.3 entry below
  is left as written; with the three threads on `ce12024`, the total is now twelve.
- **Answered on GitHub on 2026-09-18, with the owner's go-ahead:** replies on four threads, each
  then resolved — Codex's P1 and P2 (fixed in `43ab3e6`), the token thread (the owner's settled
  practice, T-4) and BUG-032 (fixed on pull request #6, in `08705de`) — and one comment on the pull
  request answering both comments outside the diff: the budget shown before any usage (CodeRabbit's
  review of `43ab3e6`), fixed by `7dbc35d`, and the plan's wording (its review of `a2124a9`),
  brought current in `ce12024`. With the five threads CodeRabbit had resolved itself, **9 of the 12
  are resolved.**
- **The last three — CodeRabbit's review of `ce12024`, all Minor — are answered by this
  documentation**, and get their replies once it is pushed:
  - **`CLAUDE.md:186`: "no ceiling" should say "no platform-default ceiling", and keep the request
    maximum**, there and in the `DEFAULT_MONTHLY_AI_BUDGET_USD` row. `BudgetUpdate` in
    `backend/models.py` is `Field(ge=0, max_digits=12, decimal_places=2)`, so **$9,999,999,999.99**
    is the most any request can set, even with `DEFAULT_MONTHLY_AI_BUDGET_USD=0`, which removes
    only the platform-default ceiling. 1.1.4's `CLAUDE.md` says so in "Usage and budgets" and in
    that row.
  - **`docs/ROADMAP.md:173`: reflect BUG-032 in the B-5 row**, which stated the owners' rule as
    enforced while BUG-032 held it back. 1.1.4's B-5 row includes BUG-032: in production, an owner
    who isn't a platform admin can take a budget stored above the default only to the default or
    below, and pull request #6's `08705de` lets them lower it to any lower amount.
  - **`docs/CHANGELOG.md:198`: reconcile the thread count.** Answered by the correction above, in
    this entry rather than by editing 1.1.3's.

### Reviewed — pull request #6

_Its automated review ran on `08705de`: five threads and one comment outside the diff, all fixed in
code._

- **Codex, three P2 threads**, all fixed in `4af499c` (Fixed, above): `Playbook.tsx:229`, a stage
  that becomes current stays collapsed; `Playbook.tsx:187`, "launch is -3 days away"; and
  `OperationsPage.tsx:27`, completion read from the newest 500 results.
- **CodeRabbit, two threads and one comment outside the diff:** a **Major** on
  `backend/services/usage.py:90`, the race, fixed in `b607021`; a Minor on `Playbook.tsx:229`, the
  same as Codex's, fixed in `4af499c`; and, outside the diff, a Minor on
  `UsageSettings.tsx:181-183`, to promise a raise only when the owner can make one, fixed in
  `b607021`.
- **None has been answered on GitHub.** The owner's go-ahead covered pull request #5's threads;
  posting on #6 waits for theirs.

### Documentation

- **1.1.4 is a new version rather than an extension of 1.1.3:** 1.1.3 was committed in `ce12024`
  and merged with pull request #5, so it stays as the record of that state. All seven managed
  documents are raised to 1.1.4 together.
- **The documentation commit after `b607021`** brings the seven managed documents up to the code at
  `b607021`, and to production at `477eaa4`:
  - **`docs/BUGS.md`**: BUG-028 to BUG-031 on `main` and in production; BUG-032 in production since
    the merge, and fixed on pull request #6's branch; LIM-004.
  - **`docs/ROADMAP.md`**: T-9 done but for the signed-in check, which moves into **T-10** — merge
    pull request #6, then check the live site signed in as an Owner — new, at P1 and first in
    Active; B-14 and B-15 decided; the playbook's gates settled; B-5 with BUG-032. Twelve questions
    stay open, B-1 to B-12.
  - **`docs/HANDOFF.md`**: rewritten for pull request #6 and the merge of #5, with pull request
    #5's thread count corrected.
  - **`docs/TESTING.md`**: the figures above, the new and changed test files, gap 13's new
    evidence, with `--workers=4` for local runs, and two new gaps (Known, not fixed): 15, the fake
    backend's `GET /api/queue`, and 16, `BudgetStatement`'s untested own-budget wording.
  - **`CLAUDE.md`**: Current State — the merge, pull request #6 as the active task, the open bugs
    and the tests table — the playbook screen and the summary route, and "no platform-default
    ceiling" with the request maximum.
  - **This entry.**
- **Outside the managed set, and so without versions of their own:**
  - **`docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`**: Progress — pull request #5 merged and live, pull
    request #6 open, the playbook screen, which pulls part of Phase 4's Campaign Playbooks forward,
    and the owner's decisions of 2026-09-18 — the quality gates, now measured at `b607021`, and the
    usage row.
  - **`SOURCE_MAP.md`**: the playbook's components (`Playbook.tsx` with `Playbook.module.css`, and
    `OperationCard.tsx`) and the summary route in the `routers/queue.py` row; also
    `domain/playbook.ts`, `e2e/responsive.spec.ts` and a `services/usage.py` row that covers the
    default budget, the three gaps 1.1.3 noted under "Still open in the documents".
  - **`docs/DESIGN_SYSTEM.md`**: two patterns — **recommend, never gate**, for the playbook, and
    **promise only what the viewer can do**, for the budget messages.
  - **`docs/PHASE1_DESIGN.md`**: D12's budget is no longer "optional". Later decisions, recorded
    beside it, hold an organisation without a budget of its own to the platform default and settle
    who may set what.
  - **`SETUP_PROMPT.md`**: its quick check no longer uses `npm run check` (gap 14 in
    `docs/TESTING.md`): it runs lint, the type check and Vitest at `--maxWorkers=2`, and notes
    that the scratch test cluster is stopped at session start.
- **`docs/AUDIT-LOG.md`: a fifth reconciliation audit**, the closing pass over this documentation.
  It runs after this entry is written, so its findings, and what was done about them, are recorded
  in the log, not here.

### Where it stands, when this was written (2026-09-18T06:10Z)

- **Pull request #6 was open, not merged and not deployed** —
  https://github.com/Vybecode-LTD/LaunchOps/pull/6, from branch `feat/playbook-ui`, based on `main`
  at `477eaa4`. Its code commits, oldest first: `53456fc` (the playbook screen), `08705de` (BUG-032
  and B-15), `4af499c` (Codex's review) and `b607021` (CodeRabbit's review). **The last code commit
  on pull request #6 is `b607021`**; this documentation goes on top of it, on the same pull
  request.
- **`main` = `origin/main` = `477eaa4`**, and production serves its build — confirmed from the live
  bundle, not from the Railway dashboard. Nothing on pull request #6, BUG-032's fix included, is on
  `main` or in production.
- **Next is T-10.** Once all three CI jobs are green on the pull request's latest commit
  (`gh pr checks 6`), merge with a **merge commit, never a squash** — `.gitleaksignore`'s
  fingerprints are per commit. Then, **signed in as an Owner and never with a probe account**
  (T-1), check that the Operations screen opens on the playbook with a "Next up" card, and that, in
  an organisation with no budget of its own, Settings → Usage shows the $25 platform default (T-9's
  check). The merge also takes BUG-032's fix to production.
- **Still open:** T-1, deleting `guard-check@example.com` and its organisation; and **T-4, rotating
  the Railway project token** — the owner's settled practice at the end of every session, owed at
  the end of this one. No token value is ever written anywhere. T-5 to T-8 are optional and
  unchanged; T-2 and T-3 were done on 2026-09-17.
- Pull request #6 adds no migration (still `0001`–`0007`) and no environment variable.
  `.github/workflows/test-pipeline.yml` stays untracked by design.
- **Re-check with `gh pr view 6`, `gh pr checks 6` and `git log --oneline -1 origin/main` rather
  than trusting this section.**

---

## [1.1.3] — 2026-09-18

_Everything on pull request #5 up to its last code commit, `7dbc35d`, where the pull request's
code is frozen: the eleven commits from `c7358fb` — 1.1.2 itself, recorded below — to `7dbc35d`
(`git rev-list --count 0ce65dd..7dbc35d` is 11). Also the pull request's automated review, a
fourth documentation audit, and the documentation that records all of it, which goes onto the
branch as one documentation commit after `7dbc35d`. **When this was written, pull request #5 was
open, not merged and not deployed** (Where it stands, at the end). Stamped past midnight UTC; on
the owner's clock (UTC-4) it is still the evening of 2026-09-17, the only reason this heading's
date differs from the entries below._

### Fixed — on the pull request's branch only

_None of these fixes was on `main` or in production when this was written. The regression tests
for BUG-028 to BUG-031 are named in `docs/BUGS.md`._

- **BUG-028 (CRITICAL) — organisations without a budget of their own could spend without limit on
  the deployment's `ANTHROPIC_API_KEY`.** Registration leaves an organisation's
  `monthly_ai_budget_usd` `NULL`, `ensure_within_budget` returned at once on `NULL`, and open
  registration stays on by the owner's decision (T-2), so any self-registered account could do it.
  Three commits:
  - `522e40d` adds **`DEFAULT_MONTHLY_AI_BUDGET_USD`** (default **25**), which caps every
    organisation without a budget of its own. Clearing a budget falls back to the default rather
    than meaning unlimited, `0` is the deliberate opt-out, and the 429 says which budget was
    reached. Four backend tests, each confirmed failing before the fix.
  - `43ab3e6` answers **Codex's P1 and P2**. Enforcement and the usage summary now go through one
    helper, `effective_budget` (`backend/services/usage.py:57`), so Settings → Usage shows the
    budget that actually applies and says when it is the default; before, an organisation on the
    default was told it had no monthly budget and that operations don't stop for cost. And a
    negative default now fails settings validation (`ge=0`, `backend/config.py:73`) instead of
    silently switching the cap off. Eight tests: five backend, three Vitest.
  - `7dbc35d` answers **CodeRabbit's comment outside the diff in its review of `43ab3e6`**. In a
    month with no AI usage, Settings → Usage showed only its empty state, and the month's summary
    was the only place the budget appeared, so a brand-new organisation saw no sign of its $25 cap
    until an operation had already cost something. The current month now says which budget
    applies: the platform's default, the organisation's own, or none (`BudgetStatement`,
    `UsageSettings.tsx:117`). It also rewords the budget field's hint from "until an owner raises
    it" to "until the budget is raised", and corrects a test docstring that still called the
    default "not a ceiling", its only backend change. Two Vitest tests, written to fail first.
- **BUG-031 (CRITICAL) — any account that registers could raise its own organisation's budget
  past the default** — `a53b26e`. Registration makes every new account the Owner of the
  organisation it creates, and an Owner could set any budget up to $9,999,999,999.99, which then
  won over the default: one request lifted BUG-028's cap, and the 429 said how. **The owner's
  decision of 2026-09-17:** an organisation's owners may set any budget up to the platform default
  — lower it, match it or clear it — and **only a platform admin may set one above it**.
  `usage.ensure_budget_allowed` enforces that on `PUT /api/organisation/budget` with a 403, and the
  429 now names whoever can actually raise the budget. Budgets already stored are kept: the rule
  applies to changes. Six tests, five backend and one Vitest; the two that prove the bypass fail
  without the fix.
- **Together, the two fixes _cap_ the spending exposure, per organisation; they do not close
  it.** Once pull request #5 is merged and deployed, every organisation is held to $25 a month
  unless it has a budget of its own, but nothing caps the total: every open sign-up creates another
  organisation with its own $25 a month on the same key. Whether the total needs a cap is **B-14**.
- **BUG-029 (MEDIUM) — four screens scrolled sideways on a phone** — `2d57b35`. At 390px,
  Portfolio overflowed by 136px, Review and the review result by 133px each, and the SEO report by
  58px: three unrelated causes, fixed in four CSS Modules files. The accessibility scans cover the
  same 27 screens, but at the default desktop viewport, so nothing had failed. New
  **`frontend/e2e/responsive.spec.ts`** checks the 27 screens at 390×844 and names the element
  whose removal would fix an overflow: **27 tests, taking Playwright from 69 to 96.** What the fix
  leaves in place — on a phone, the launch board shows only its project column — is **LIM-003** in
  `docs/BUGS.md`.
- **BUG-030 (LOW) — competitor results rendered empty columns and empty headings** — `597e94b`.
  A column no competitor fills is left out; a missing value in a column that is shown reads "Not
  found", matching the renderers' "Not rated" and "No contact found"; a profile heading with no
  items is omitted. Three Vitest tests, written to fail first.
- **A re-run no longer reopens a finished playbook stage** — `6b97da3`, answering **CodeRabbit's
  Major** finding. `stateFromQueue` checked `running` before `approved`, so re-running an approved
  operation showed it as running, and its stage as unfinished, until the run ended; it now ranks
  approved, pending, running, failed. Four Vitest tests, three written to fail first. It has no
  BUG ID: no screen on this branch imports the module.

### Found, not fixed

- **BUG-032 (LOW, open) — a budget stored above the default can be lowered only to the default or
  below, except by a platform admin.** From CodeRabbit's review of `7dbc35d` (Minor, on
  `backend/services/usage.py:83`): `ensure_budget_allowed` compares a new amount with the platform
  default, never with the organisation's current budget, so an owner who isn't a platform admin
  cannot take an admin-set $500 down to $400, only to $25 or below, or clear it. It fails safe: it
  can refuse a decrease, never allow an increase. **Whether it is a defect, or BUG-031's rule
  working as written, is the owner's decision**; `docs/BUGS.md` names the test to write first if it
  is to be fixed. Pull request #5's code is frozen, so merging it ships this behaviour unless it is
  fixed first.
- **The Vitest suite is not reliable at default concurrency on this development machine, and that
  is pre-existing on `main`** — `docs/TESTING.md` gap 14. Measured on a quiet machine, with every
  `node` process checked by command line first: `main`'s frontend source failed **4 of 4** full
  runs, and this branch 2 of 3, when it had 618 tests; `app.review.test.tsx` → "opens the first
  result and explains what approving an outreach result does" failed in 6 of those 7. Green at
  `--maxWorkers=2` and in CI. The likely mechanism — fifteen workers, each file building its own
  jsdom, until a lookup outruns the 10 s `asyncUtilTimeout` — is **not confirmed**, and **no fix
  is applied**: capping `maxWorkers`, raising `asyncUtilTimeout` or `pool: 'vmThreads'` is the
  owner's choice. Until then a red frontend run on this machine is not by itself a regression, and
  `docs/HANDOFF.md` takes the baseline with `npx vitest run --maxWorkers=2`.
- **On a phone, the project tab bar runs off the right edge:** Outbox, Launch plan and Settings
  are reachable only by swiping, with no cue, because `.tabnav` in
  `frontend/src/components/ui/Display.module.css` scrolls with its scrollbar hidden. Pre-existing,
  newly seen, not fixed; recorded in `docs/HANDOFF.md`.

### Added

- **The launch playbook's domain module, `frontend/src/lib/domain/playbook.ts`** — `8c9f2e2`,
  with `6b97da3`'s fix above. Seventeen of the eighteen operations in **five ordered stages** —
  understand the market, fix the positioning, write the story, line up distribution, prepare the
  push — from which it derives each operation's state, each stage's progress, the current stage
  and the single operation to run next. The one tool, `repurpose`, is held aside in
  `ALWAYS_AVAILABLE`: it stores nothing, so its use cannot be observed. **A domain module only: no
  screen on pull request #5 imports it, so nothing a user sees has changed.** 18 tests, 14 of them
  from `8c9f2e2`.

### Changed

- **The launch plan checklist test** — `908f46d`. `e2e/golden.spec.ts` → "launch plan: ticking an
  item saves the checklist" now asserts with `click()` then `expect(item).toBeChecked()`, which
  retries, instead of `check()`, which threw at once when the controlled checkbox had not yet
  settled under load, as it did once in CI on `a2124a9` (run 35281944055). The `PATCH` assertion
  is unchanged, so the test still proves the tick was saved. **Test-only: no user-facing defect was
  demonstrated**; `docs/TESTING.md` gap 13 records what was ruled out.
- **Test figures, measured this session one suite at a time, on the branch's code at `7dbc35d`:**
  backend **564 passed** (was 550), 98.32% of 3,340 statements, 56 missed; frontend Vitest **628
  passed in 50 files** (was 601 in 49): lines 99.21%, statements 97.08%, branches 90.13%, functions
  96.53%; Playwright **96 passed** (was 69): 3 smoke, 12 golden path, 54 accessibility, 27
  responsive. Both 95% gates pass. The increases reconcile commit by commit: backend +4
  (`522e40d`), +5 (`43ab3e6`), +5 (`a53b26e`); Vitest +3 (`597e94b`), +14 (`8c9f2e2`),
  +4 (`6b97da3`), +3 (`43ab3e6`), +1 (`a53b26e`), +2 (`7dbc35d`); Playwright +27 (`2d57b35`).
- **CI passed on `7dbc35d`**: run 35298972693, all three jobs (backend, frontend and the secret
  scan), 2026-09-18T02:20:45Z to 02:26:54Z. Any commit after `7dbc35d` — the documentation commit
  that carries this entry among them — needs a green run of its own before the merge (T-9).

### Documentation

- **`a2124a9`, committed without raising the version** (Versioning, below): `CLAUDE.md` gained the
  `DEFAULT_MONTHLY_AI_BUDGET_USD` row, the platform default in "Usage and budgets", the backend and
  Playwright figures and the responsive specs; `docs/TESTING.md` gained `e2e/responsive.spec.ts`
  across its design, inventory and coverage sections, and **gap 12**: nothing stops a stray
  `*.spec.ts` from joining the Playwright suite.
- **The documentation commit after `7dbc35d`** brings the seven managed documents and
  `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` up to the code at `7dbc35d`:
  - **`docs/BUGS.md`**: BUG-028 to BUG-031, fixed on the branch only; BUG-032, open; LIM-003. 32
    bugs in all, 31 fixed; the next ID is BUG-033.
  - **`docs/ROADMAP.md`**: **T-9**, merging pull request #5 and then checking Settings → Usage on
    the live site, heads Active; **B-14** and **B-15** opened; B-5 records the owner's budget
    decision; T-4 is the owner's end-of-session rotation; the playbook screen is Next up, item 1,
    with a note under M4.
  - **`docs/HANDOFF.md`**: rewritten for pull request #5 — its commits, the review, BUG-032, the
    local branch below, and a baseline that allows for gap 14.
  - **`docs/TESTING.md`**: the figures above and their run history, the inventory with the new and
    changed test files, the controlled-input guidance ("click and assert, never `check()`"), **gap
    13** and **gap 14**.
  - **`CLAUDE.md`**: Current State (the active task, open bugs, the tests table), the budget rule
    in "Usage and budgets" and in the `DEFAULT_MONTHLY_AI_BUDGET_USD` row, the playbook in the
    project structure and under Operations, T-4, and the footer.
  - **`docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`**, not managed and so without a version of its
    own: Progress brought current, with the default and the ceiling in the usage row, the quality
    gates labelled as the branch's, and B-14 and B-15 among the owner's decisions. This answers
    CodeRabbit's comment outside the diff in its review of `a2124a9`.
  - **`docs/AUDIT-LOG.md`**: the fourth audit (Audited, below), and finding 26's correction to the
    20:45Z entry.
  - **This entry**, rewritten from its 00:52Z draft, which finding 27 found out of date.

### Reviewed — pull request #5

_Checked with read-only GitHub queries, last at 2026-09-18T03:32Z. Nothing was posted._

- **Nine review threads and two comments outside the diff.** Codex reviewed `a2124a9`; CodeRabbit
  reviewed `a2124a9`, `908f46d`, `43ab3e6` and `7dbc35d`.
  - **Fixed in code:** Codex's **P1** and **P2** (`43ab3e6`); CodeRabbit's **Major** on the
    playbook (`6b97da3`), the one thread resolved, by CodeRabbit itself; and CodeRabbit's comment
    outside the diff in its review of `43ab3e6` (`7dbc35d`).
  - **Recorded as BUG-032, open:** CodeRabbit's thread on `backend/services/usage.py:83`, from its
    review of `7dbc35d`.
  - **Fixed in this documentation:** three of CodeRabbit's five threads on documents — the
    responsive suite's scope in `CLAUDE.md`, now "27 enumerated screens"; the open and close counts
    in `docs/AUDIT-LOG.md`'s 20:45Z entry (finding 26); the working-tree claim in
    `docs/HANDOFF.md` — and its comment outside the diff on the plan's budget wording and test
    totals, in its review of `a2124a9`.
  - **Left as written:** the thread asking for the 1.1.2 entry to record `522e40d` and `2d57b35`
    and to drop "No application code changed". Both of that entry's statements were true of
    `c7358fb`, the commit it describes, and "`bc6143c` remains the last commit that changed
    application code" still holds for `main`; the code that followed is recorded here instead.
  - **Not actioned:** the thread asking for the exposed Railway token to be revoked at once rather
    than at the end of each session. Rotation at session end is the owner's settled practice
    (T-4).
- **No thread or comment has been answered on GitHub**, and eight threads are unresolved: posting
  on the owner's account has not been authorised (`docs/HANDOFF.md`, Next steps, item 1).

### Audited

- **Fourth reconciliation audit** — `docs/AUDIT-LOG.md`, **2026-09-18T02:45:00Z**, the closing
  pass over this documentation. **11 findings (26–36): 0 critical, 3 high, 2 medium, 6 low.**
  Auto-fixed by the reconciler: 1 (26, in the log itself); 10 left for their owners. The third
  audit, findings 19–25, came in `c7358fb` and is recorded under 1.1.2.
- **Closed since, each re-checked in its file:** 27 (this entry); 28 — `CLAUDE.md` and
  `docs/BUGS.md` now say the merge caps the exposure, per organisation; 29 and most of 30 —
  `CLAUDE.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md` and `docs/BUGS.md` call `7dbc35d` the last
  code commit rather than the head, and make no claim the documentation commit would falsify;
  31 — `docs/HANDOFF.md` counts nine threads, eight unresolved; 32 — the stamps (Versioning,
  below); 33 — the plan; 34 — `docs/BUGS.md` points at `docs/ROADMAP.md`; 36 — `CLAUDE.md` and
  `docs/ROADMAP.md` now agree with `docs/HANDOFF.md` and the plan on rotating the token at session
  end.

### Still open in the documents

_As found when this entry was written._

- **Finding 30, in part:** `docs/TESTING.md` lines 24 and 520 still call `7dbc35d` "the head of
  pull request #5". The measurements they date stay true; the label stops being true once the
  documentation commit is pushed.
- **Finding 35:** `docs/TESTING.md` gap 11 still says no `docs/BUGS.md` maps the bug IDs to root
  causes and fixes, though it has existed since `7c1f1cb` (what stays true is that it doesn't map
  the `B1`–`B19` test section headers), and line 238's "There is no `B14` group" now sits beside
  `docs/ROADMAP.md`'s unrelated B-14. The body of `docs/TESTING.md` has not changed since 02:33Z,
  before the audit opened.
- **Outside the managed set, noted by the audit:** `SOURCE_MAP.md` lists neither
  `domain/playbook.ts` nor `e2e/responsive.spec.ts`, and its `services/usage.py` row predates the
  default budget.
- **For the owner:** finding 24 — the platform admin's address beside the decision that open
  registration stays on, now in three documents — and T-1 and T-4 in `docs/ROADMAP.md`.

### Versioning

- **`a2124a9` changed `CLAUDE.md` and `docs/TESTING.md` without raising the version.** It left
  both at **1.1.2**, with a `last-updated` an hour older than the change, over content 1.1.2 never
  described — the budget variable, the responsive suite, the 554 and 96 figures, gap 12 — and was
  pushed that way. 1.1.3 is the first version to cover it, which is why this entry spans
  everything since `c7358fb`.
- **1.1.3 was extended here, not bumped to 1.1.4**, as the fourth audit recommended: at `7dbc35d`
  all seven documents read 1.1.2, and until the documentation commit that carries this entry no
  commit on any branch carried 1.1.3. All seven managed documents read `version: 1.1.3`,
  `last-updated: 2026-09-18T03:32:06Z` and `last-audit: 2026-09-18T02:45:00Z`, the newest
  `## Audit —` heading in `docs/AUDIT-LOG.md`.

### Not part of pull request #5

- **The playbook screen, on the local branch `feat/playbook-ui`:** one commit, `f6261a6`, stacked
  on `a53b26e` rather than `7dbc35d`, with no upstream and no copy on `origin` when this was
  written. It opens the Operations screen on the playbook — a "Next up" card, the five stages in
  order, and "All operations" (`?view=all`) for the category catalogue — and advises without
  blocking. It is to become its own pull request once #5 merges, rebased onto `main`, which gives
  it a new hash (`docs/ROADMAP.md` → Next up, item 1). Nothing recorded in this entry depends on
  it.

### Where it stands, when this was written (2026-09-18T03:32Z)

- **Pull request #5 was open, mergeable, not merged and not deployed**, from branch
  `fix/spend-cap-and-mobile-overflow`, with CI green on its last code commit, `7dbc35d`.
- **Production was unchanged by anything in this entry, the spending exposure included:** `main` =
  `origin/main` = `0ce65dd`, the documentation-only merge of pull request #4, and `bc6143c` was
  still the last commit on `main` that changed application code.
- **Next is T-9.** Once CI is green on the pull request's latest commit, merge with a **merge
  commit, never a squash** — `.gitleaksignore`'s fingerprints are per commit — then, signed in as
  an Owner and never with a probe account, check that Settings → Usage shows the $25 default.
- No migration (still `0001`–`0007`) and no new Railway variable: `DEFAULT_MONTHLY_AI_BUDGET_USD`
  defaults to 25 in code. `.github/workflows/test-pipeline.yml` stays untracked by design. No test
  suite was run to produce this version.
- **Re-check with `gh pr view 5`, `gh pr checks 5` and `git log --oneline -1 origin/main` rather
  than trusting this section.**

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
