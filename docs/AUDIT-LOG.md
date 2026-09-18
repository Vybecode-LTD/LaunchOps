---
document: AUDIT-LOG
version: 1.1.3
last-updated: 2026-09-18T03:32:06Z
last-audit: 2026-09-18T02:45:00Z
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

## Audit — 2026-09-18T02:45:00Z — closing audit of pull request #5's documentation batch

**Trigger:** the closing pass over this session's final documentation batch, run straight before
`doc-versioner` stamps it and before it goes up as one commit — and a review finding against this
log itself: CodeRabbit, on pull request #5, on the 20:45Z entry below (finding 26). On the owner's
clock (UTC-4) it is 22:45 on 2026-09-17.
**Scope:** the seven managed documents and `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`, every claim
checked against the repository, not against another document: every current-state sentence about
the branch, the pull request, `main` and production; every hash, test name and source line the new
BUG-028 to BUG-031 entries cite; every figure against the test files; the playbook's status; and the
wording this batch must hold — merging pull request #5 **caps** the spending exposure, per
organisation; it does not **close** it. `docs/PHASE1_DESIGN.md`, `docs/DESIGN_SYSTEM.md`,
`SOURCE_MAP.md` and `SETUP_PROMPT.md` were swept only for that wording and for the playbook: none
says "closes", none mentions the playbook.
**Repository state, at open (02:43Z) and at close:** HEAD is `fix/spend-cap-and-mobile-overflow`,
**eleven commits** ahead of `main`, at `7dbc35d` — the branch's last code commit — which is also
`origin`'s copy. `main` = `origin/main` = `0ce65dd`, whose application code is `bc6143c`'s. **Eight
tracked files are modified** — `CLAUDE.md` and seven under `docs/` — and **this log is one of the
eight**: already modified at open by the 1.1.3 frontmatter bump, and further by this entry (the
lesson of finding 26). `.github/workflows/test-pipeline.yml` is untracked by design. The local
branch `feat/playbook-ui` holds one commit, `f6261a6`, on `a53b26e`, with no upstream and no copy on
`origin`. No document changed while the audit ran (Concurrency), and this log is the only file it
touched. **Everything below describes that uncommitted tree.**
**This reconciler made no commit, stage, push or branch, and ran no test suite.** One departure from
the previous entry's practice: four **read-only** queries to GitHub — `gh pr view 5`, `gh run view
35298972693`, the pull request's review comments and `git ls-remote --heads origin` — because the
documents make claims about pull request, CI and remote state, none of which is in the local
repository. Nothing was sent to the production site. Findings continue the numbering.

### Findings

| # | Severity | Document | Issue | Resolution |
|---|---|---|---|---|
| 26 | LOW | `docs/AUDIT-LOG.md` (the 20:45Z entry below) | Raised by CodeRabbit on pull request #5. That entry's Repository state gave three modified tracked documents as the state "**at open and at close**", then said everything below it was uncommitted, "**this log included**" — so at close the log was a fourth, or the count had to say it left the log out. Its Concurrency table's 21:10Z row has the same gap: "the tree returned to exactly its state at open", while the same section says the log had already recorded the two files before they went | **Fixed in place, with a dated note** — three at open, four at close, and the 21:10Z row names the log as the one exception; nothing else in that entry changed. In place because the entry is in `c7358fb`, on this branch and not yet on `main`, and this log's own history corrects unmerged entries that way: `ee4932a` and `c486949` both amended the 19:30Z entry before pull request #3 merged, while entries on `main` have only ever been appended to. Recorded here too, so the correction carries a finding like every other fix |
| 27 | HIGH | `docs/CHANGELOG.md` | **The 1.1.3 entry stops at 00:52Z**, as does the file (last written 00:52:45Z). It never mentions `6b97da3`, `43ab3e6`, `a53b26e`, `7dbc35d`, B-14, B-15 or T-9, records none of BUG-028 to BUG-031 (its one "BUG-028" is as the next free ID), and several statements in it are now false. **The code:** the Codex P1 gap is "verified and **not yet addressed**" and `summary()` "still returns the stored `NULL`" (lines 66–71) — `43ab3e6` fixed both; CodeRabbit's point that `stateFromQueue` checks `running` before `approved` is "accurate about the code" (140–143) — `6b97da3` reversed the order; "application code last changed in `8c9f2e2`" (176–177) — four commits since changed it. **Commit state:** "All three CI jobs passed on `908f46d`, **the pull request's head**", beside 554 and 618 (105–109) — the head is `7dbc35d`, run 35298972693, 564 and 628. **Sibling documents:** "Not brought current" (156–171) says `docs/BUGS.md` "records none of the three fixes and still gives BUG-028 as the next ID"; all four documents it names have since been brought current. **Audits:** "`last-audit` stays 2026-09-17T20:45:00Z … no audit was run for this version" (178–179) stops being true with this entry. Two documents send readers there: `docs/HANDOFF.md:92`, "**1.1.3** covers everything on pull request #5 and its review" — false today — and `CLAUDE.md:23`, "the top entry is where things stand" | **Left for `doc-versioner`,** which owns the file and runs next. 1.1.3 is not committed anywhere — at `HEAD` the frontmatter still reads 1.1.2 — so the entry can be extended rather than bumped. The summary row (line 21) and the "Reviewed" list need it too; the list still carries finding 26's item as open |
| 28 | HIGH | `CLAUDE.md`, `docs/BUGS.md` | **Merging pull request #5 is said to close the spending exposure; it caps it, per organisation.** Nothing caps the total, and every open sign-up adds another $25 a month (B-14). `CLAUDE.md:46`: "Merging pull request #5 is what **closes** the live spending exposure" — contradicted later in the same paragraph ("bounds each organisation, not the key as a whole"). `CLAUDE.md:364`, the footer, with no such qualification: "merging pull request #5 **closes** the spending exposure". `docs/BUGS.md:58–59`: "the exposure **closes** only with both, and pull request #5 carries both". `docs/BUGS.md:191`: "**Closes the exposure** only together with BUG-031's fix". Ambiguous, most likely meaning the two bugs: `docs/BUGS.md:281`, "**Both close** when pull request #5 merges". `docs/ROADMAP.md`, `docs/HANDOFF.md`, `docs/CHANGELOG.md` and the plan already say "caps" or its equivalent | **Left for `memory-updater` (`CLAUDE.md`) and `bug-fix-tracker` (`docs/BUGS.md`):** "caps", per organisation, with B-14 as the part still open |
| 29 | HIGH | `CLAUDE.md` | **Two sentences the commit itself will falsify** — true as written, false from the moment this batch is committed. Line 46, undated: "The documentation that records `a53b26e` and `7dbc35d` **is not yet committed**", with `7dbc35d` as "**the head**" of "**eleven commits**". The footer (364) repeats both, though its `Last-verified` stamp at least dates it. This is the shape of finding 14, the first audit's one CRITICAL — documents committed describing their own work as uncommitted — in the file every session reads first | **Left for `memory-updater`, before the commit.** Name `7dbc35d` the **last code commit** — which the frozen code keeps true — rather than the head, and drop the "not yet committed" clause or date it, as `docs/HANDOFF.md:18` does ("was uncommitted, to go up as one more commit") |
| 30 | MEDIUM | `docs/HANDOFF.md`, `docs/ROADMAP.md`, `docs/BUGS.md`, `docs/TESTING.md` | The same wording, milder, goes stale when the commit is pushed. `docs/HANDOFF.md:16`: the GitHub copy "**ends at `7dbc35d`**", "Eleven commits ahead of `main`"; `:89` "head `7dbc35d`". `docs/ROADMAP.md:150`: "the head is `7dbc35d`, the pull request's eleventh commit" — though its next sentence expects a documentation commit. `docs/BUGS.md:277`: "whose head **is now** `7dbc35d`". As an aside, "`7dbc35d`, the head of pull request #5", at `docs/BUGS.md:88` and `docs/TESTING.md:24` and `:520` — each describing a measurement or CI run at `7dbc35d`, which stays true. `docs/BUGS.md:187` is dated ("checked … at 2026-09-18T02:28Z") and survives | **Left for each file's owner.** Not wrong today; "last code commit" is the wording that outlives the push |
| 31 | MEDIUM | `docs/HANDOFF.md`, and `docs/CHANGELOG.md` → Reviewed | `docs/HANDOFF.md:21`: "CodeRabbit has reviewed nothing newer … 'Review in progress' at 02:31Z" and "**Seven of the eight threads are unresolved**". **Overtaken at 02:33:16Z:** CodeRabbit reviewed `7dbc35d` with one actionable comment (Minor, `backend/services/usage.py:83`) — a ninth thread. **It is right about the code:** `ensure_budget_allowed` compares the amount with the default alone, so where a platform admin has set, say, $500 against a $25 default, an owner who isn't a platform admin gets 403 trying to lower it to $400 — only $25 or less, or clearing it, is allowed. No document describes that case, and "Owners can set a budget up to the default, **lower it** or clear it" (`CLAUDE.md:186`; in similar words `:303`, `docs/HANDOFF.md:37`, `docs/BUGS.md:225–227`, `docs/ROADMAP.md:173`), while true of the rule, reads as if an owner can always lower a budget. The branch's code is frozen, so any change is another pull request's | **Left for `handoff-builder` and the owner.** Recorded, not judged. The 02:31Z stamp keeps `docs/HANDOFF.md:21` honest, and its next-steps item 1 already says to read the review "once it lands" — it has: nine threads, eight without a reply |
| 32 | LOW | all seven managed documents | Every `last-updated` reads `2026-09-18T00:52:00Z`, but five files were modified after it: `CLAUDE.md` 02:41Z, `docs/ROADMAP.md` 02:42Z, `docs/HANDOFF.md` 02:40Z, `docs/BUGS.md` and `docs/TESTING.md` 02:33Z. Every `last-audit` reads 20:45Z, before this entry | **Left for `doc-versioner`,** which reads this entry's heading for `last-audit` |
| 33 | LOW | `docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md` | Progress opens "All of this work is on `main`", and its "Quality gates today" gives 564, 628 and 96 — measured on the branch at `7dbc35d`; `main`'s code gives 550, 601 and 69. The usage row beside it is labelled "on pull request #5, not yet on `main`"; the gates are not. "Next → Decisions for the owner" names section 8, D15 and D8, not B-14 or B-15 | **Left for the plan's owner.** Label the gates with the branch, and point the decisions at `docs/ROADMAP.md` → Blocked, as "Still to do" already points at Active |
| 34 | LOW | `docs/BUGS.md` | Lines 61–63 put the next-session items in the plan's "Next" and the open owner decisions in `docs/PHASE1_DESIGN.md` (D8, D15). The plan itself names `docs/ROADMAP.md` → Active as the full list, and the open decisions are B-1 to B-12, B-14 and B-15 in `docs/ROADMAP.md` → Blocked, of which D8 and D15 account for four. On `main` before this session | **Left for `bug-fix-tracker`:** point both at `docs/ROADMAP.md` |
| 35 | LOW | `docs/TESTING.md` | Gap 11 (line 580): "**Bug IDs have no register yet** … no `docs/BUGS.md` maps the IDs to root causes and fixes". `docs/BUGS.md` has existed since `7c1f1cb`. What is still true is narrower: it numbers bugs BUG-001 to BUG-031 and never maps the `B1`–`B19` test section headers. And line 238's "There is no `B14` group" now sits beside `docs/ROADMAP.md`'s B-14, which means something else. On `main`; the first audit missed it | **Left for `test-doc-manager`** |
| 36 | LOW | `CLAUDE.md`, `docs/ROADMAP.md`; `docs/HANDOFF.md`, the plan | T-4's advice disagrees, and the repository cannot settle it. `CLAUDE.md:49`: issue the next token with "`railway login` in the owner's own shell"; `docs/ROADMAP.md:154` offers `railway login` or exporting the variable. `docs/HANDOFF.md:54` and the plan (line 169): "`railway login` will not authorise on this machine", so rotation waits for session end — as `docs/CHANGELOG.md`'s 1.1.2 entry also says. Standing since 1.1.2 | **Left for the owner** to say which is current, then for `memory-updater` and `roadmap-manager` |

**Totals:** 11 findings — 0 critical, 3 high, 2 medium, 6 low.
**Auto-fixed by this reconciler: 1** (26, in its own file). **Left for an owner: 10** (27 and 32
`doc-versioner` · 28 `memory-updater` and `bug-fix-tracker` · 29 `memory-updater` · 30 four owners ·
31 `handoff-builder` and the owner · 33 the plan's owner · 34 `bug-fix-tracker` · 35
`test-doc-manager` · 36 the owner).

### Before the batch is committed

- **Serious — each would commit a false statement about the code, the commit state or production:**
  27 (the changelog's top entry says three fixed defects are unaddressed, and names a superseded
  head), 28 ("closes" overstates what the merge gives production) and 29 (`CLAUDE.md` asserting,
  from inside the commit, that it is uncommitted).
- **Moderate — true today, stale on push (30) or already overtaken (31).**
- **Minor — stamps and cross-reference wording:** 32 to 36.
- **Clean — the playbook.** Every document describes it, on this branch, as a domain module no screen
  uses, and places its screen on `feat/playbook-ui`.

### Verified — what holds against the repository

- **The branch, the pull request and CI are as described, except where findings 27, 30 and 31 say
  otherwise.** `git rev-list --count main..HEAD` is 11, and `CLAUDE.md:46` lists them in order, each
  hash carrying the subject credited to it. GitHub reports pull request #5 **OPEN**, not merged,
  mergeable, head `7dbc35d`; run 35298972693 succeeded on `7dbc35d`, all three jobs, 02:20:45Z to
  02:26:54Z — the finish `docs/HANDOFF.md:18` gives, to the second.
- **The production claims are true of the code production runs.** `git diff --name-only bc6143c
  0ce65dd` names nothing outside `CLAUDE.md` and `docs/`. At `bc6143c`, `ensure_within_budget` returns
  at once on a `NULL` budget and `backend/config.py` has no default, so "production has open
  registration and no default cap" holds in every form the documents give it. Registration's switch
  is enabled when unset (`get_config("registration_enabled", True)`, `backend/routers/auth.py:141`).
- **Every budget claim matches the code, line numbers included:** `effective_budget` at
  `backend/services/usage.py:57`, the organisation's own budget first (65–66); `ensure_budget_allowed`
  at :71 and the 403's text word for word; the 429's choice of who can raise it at 110–115; the Owner
  check (`access.membership(request, "owner")`) and then the ceiling at
  `backend/routers/organisations.py:365–366`, under `/api/organisation`; `Field(default=Decimal(25),
  ge=0)` at `backend/config.py:73`; `BudgetUpdate`'s $9,999,999,999.99 limit at `backend/models.py:66`;
  the new organisation and its Owner at `backend/routers/auth.py:101–104`; ten sign-ups an hour per
  address (`NEW_ACCOUNTS_PER_ADDRESS`); the summary's four fields; `BudgetStatement` at
  `UsageSettings.tsx:117`, for the current month only (line 93), the administrator note (181–184)
  and the hint (256) word for word; the variable in `backend/.env.example`; no migration on the
  branch (still `0001`–`0007`). `7dbc35d`'s one backend change is a docstring.
- **Every regression test cited for BUG-028 to BUG-031 is at the line given** — the fourteen in
  `test_usage.py` (188, 289, 305, 316, 328, 337, and the `stranger` fixture at 278), six
  `app.usage.test.tsx` titles (136, 148, 336, 349, 361, 378) under their `describe` (335), and
  `results.test.tsx` 47, 67 and 84 — and both negatives are true: no test checks the hint's wording
  or asserts "Your organisation's budget". So are `PortfolioPage.module.css:98`,
  `WorkflowResult.tsx:117`, the 27 screens at 390×844 in `responsive.spec.ts`, and `.tabnav`
  scrolling with its scrollbar hidden.
- **Every test figure reconciles with the files, without running anything.** A static recount of
  every test file matches `docs/TESTING.md` section 4 file by file — 369, 541 and 17 defined, in 24,
  50 and 4 files, none missing, none unlisted, 31 parametrized backend tests. Counting at each commit
  reproduces every delta the documents give: `test_usage.py` 10 → 14 → 19 → 24, `app.usage.test.tsx`
  16 → 19 → 20 → 22, `playbook.test.ts` 14 → 18, `results.test.tsx` 29 → 32 — hence 550 → 564 and
  601 → 628. On `feat/playbook-ui`, `app.playbook.test.tsx` has 12 tests in a 51-file tree, so
  `docs/HANDOFF.md:41`'s 638 is 626 + 12. Pass counts and coverage are the session's own runs,
  recorded as reported.
- **The playbook is described correctly everywhere.** No non-test file imports `playbook.ts`; the
  five stage titles, `ALWAYS_AVAILABLE = ["repurpose"]` and the fields `purpose`,
  `startsAtDaysBefore` and `builtOn` match `CLAUDE.md:171`; `stateFromQueue` now ranks approved,
  pending, running, failed. The screen's files are named only at `docs/HANDOFF.md:41` and
  `docs/ROADMAP.md:226`, both labelled as the local branch; `f6261a6` shares no file with `7dbc35d`,
  so `docs/HANDOFF.md:52`'s clean dry-run merge is certain.
- **IDs and counts agree across `CLAUDE.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md` and
  `docs/BUGS.md`:** 27 bugs on `main` and 4 on the branch, 31 in all, 0 open, next BUG-032; T-9 heads
  Active; B-1 to B-12, B-14 and B-15 open, B-13 Decided. All seven documents read 1.1.3, and
  `CLAUDE.md`'s in-body literals (23, 55) match.
- **Nothing secret is in the batch.** No line the uncommitted diff adds carries a token, key prefix
  or UUID — only long test names matched the pattern. `.gitleaksignore` holds three fingerprints,
  two on `d7752c3` and one on `4f433ee`, unchanged since `b0beeaf`, and the gitleaks-sensitive note
  in `docs/TESTING.md` is untouched.
- **Outside this audit's scope, noted only:** `SOURCE_MAP.md` lists domain modules and e2e specs one
  by one but has neither `domain/playbook.ts` nor `e2e/responsive.spec.ts`, and its
  `services/usage.py` row predates the default budget.

### Concurrency

**None.** Apart from this log, every document's hash at close matches the snapshot taken at 02:52Z,
and each was last modified before this audit's first command at 02:43:17Z — between 02:27Z and
02:42Z, or at 00:52Z for `docs/CHANGELOG.md`; this log's last change before this entry was the
00:52Z frontmatter bump. The one outside change was on GitHub: CodeRabbit's
review of `7dbc35d` at 02:33:16Z, after the documents that mention it were written and ten minutes
before this audit opened (finding 31).

### The previous entry's follow-ups — closed

| # | Item | State |
|---|---|---|
| 1 | `handoff-builder` — finding 19 | **Done** in `c7358fb`. `docs/HANDOFF.md` has neither "still points at" nor `5rlc9k25`, and treats T-4 as a rotation owed, not an errand |
| 2 | The plan's owner — finding 20 and the absent T-4 | **Done.** The plan records T-3 done with the address check (157–159), T-2 done (172) and T-4 open (168–171) |
| 3 | `doc-versioner` — findings 21 and 22 | **Done.** `CLAUDE.md`'s in-body literals follow the frontmatter, and all seven `last-audit` stamps agree. Finding 32 is 22's next round |
| 4 | `memory-updater` — finding 23 | **Done.** `CLAUDE.md:265` quotes `DEFAULT_TEST_DSN` exactly as `backend/tests/conftest.py:23` has it |
| 5 | The owner — T-4 and T-1 | **Both still open** (`docs/ROADMAP.md`); T-4 now also carries finding 36 |
| — | Finding 24 (for the owner) | **Unchanged, and wider:** the admin's address now appears in three documents, not one — `CLAUDE.md:291`, `docs/ROADMAP.md:152` and the plan's line 172. Still not a secret; still the owner's call |
| 6 | **Standing:** check a moved task in all four places; re-audit once the batch is committed | **Done.** The batch was committed as `c7358fb`, the first commit on this branch — `docs/correct-the-production-commit` exists neither locally nor on `origin` — and this entry is the re-audit. T-9, B-14 and B-15 agree across `docs/ROADMAP.md`, `CLAUDE.md`, `docs/HANDOFF.md` and the plan, bar finding 33's omission. As that follow-up predicted, the drift that did survive is a restatement: the changelog (27) |

### Left open

1. **`doc-versioner` — finding 27 first, then 32.** `CLAUDE.md` and `docs/HANDOFF.md` both send
   readers to the changelog's top entry, and it says three fixed defects are unaddressed.
2. **`memory-updater` — findings 28 and 29, before the commit:** two sentences in the file every
   session reads first.
3. **`bug-fix-tracker` — findings 28 and 34.**
4. **`handoff-builder` and the owner — finding 31:** a ninth review thread, and eight without a
   reply, not seven.
5. **The owners of `docs/ROADMAP.md`, `docs/TESTING.md` and the plan — findings 30, 33 and 35;** the
   owner — 36, and T-4 and T-1 as before.
6. **Standing — three coming events will each falsify a known set of sentences; re-check that set as
   each lands.**
   - **This batch's commit and push:** findings 29 and 30, and this entry's own "uncommitted tree".
     The head stops being `7dbc35d`, and the new head needs its own green CI run before the merge,
     as T-9 already says.
   - **The merge of pull request #5:** every "open", "not on `main`" and "not in production" for
     BUG-028 to BUG-031, T-9, `CLAUDE.md`'s Active task and footer, `docs/HANDOFF.md`'s opening,
     `docs/ROADMAP.md`'s M4 note and the plan's usage row — and confirm in the dashboard that Railway
     deployed it, which `0ce65dd`'s deploy never was.
   - **The rebase of `feat/playbook-ui`:** `f6261a6` gets a new hash. Both files that name it,
     `docs/HANDOFF.md` and `docs/ROADMAP.md`, already warn that it will change; both will need the new
     one.

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
(`git rev-list --left-right --count main...HEAD` → `0 0`). **At open**, three tracked documents are
modified — `CLAUDE.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md` — and one file is untracked,
`.github/workflows/test-pipeline.yml`, by design. **At close** there are four: the same three and
this log, which this entry modifies; the untracked file is unchanged. In between, two more
untracked files existed for about four minutes — see Concurrency and finding 25. **Everything
recorded below is uncommitted working tree**, this log included.
*Corrected in place on 2026-09-18 — finding 26 of the 2026-09-18T02:45:00Z entry above, raised by
CodeRabbit on pull request #5. This paragraph first gave the three as the state "at open and at
close", leaving out this log although its last sentence counts it; the 21:10Z row under
Concurrency had the same gap. Nothing else in this entry was changed.*
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
| 21:10Z | Their author deleted both, and any `frontend/audit-shots/` output with them | **Closed finding 25.** The tree returned to its state at open, apart from this log, which had already recorded them |

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
