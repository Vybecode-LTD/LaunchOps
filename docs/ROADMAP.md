---
document: ROADMAP
version: 1.1.3
last-updated: 2026-09-18T03:32:06Z
last-audit: 2026-09-18T02:45:00Z
managed-by: session-orchestrator/roadmap-manager
---

# LaunchOps — Roadmap

What we are building and in what order. The deeper reasoning — findings, architecture,
the full phased plan and the decisions still owed — lives in
[`docs/ASSESSMENT_AND_DEVELOPMENT_PLAN.md`](ASSESSMENT_AND_DEVELOPMENT_PLAN.md); Phase 1's
decisions D1–D16 live in [`docs/PHASE1_DESIGN.md`](PHASE1_DESIGN.md). This file tracks
status only and links out rather than repeating them.

## Goals

- [x] Turn the single-operator prototype into a platform a corporate partner can be handed —
      multi-venture first, with organisations, roles and governance.
- [x] Keep AI governed, never autonomous: results land in Review, and nothing leaves the
      system without a person consenting to it.
- [x] Make output evidence-grade — every research claim carries the source its own search
      returned, so a report can go in a board deck.
- [x] Run live on `launchops.run` with migrations, durable jobs and cost showback per organisation.
- [x] Hold the quality gates: 95% coverage on both sides, zero-warning lint, WCAG 2.2 A/AA in
      both themes, secret and dependency scans in CI.
- [ ] Close the loop from insight to action: send, post, schedule and export for real (Phase 3).
- [ ] Ship the differentiators that make the multi-venture pitch land: readiness index,
      playbooks, living launch plan, portfolio digest (Phase 4).
- [ ] Reach enterprise-ready: SSO, MFA, retention and export, public API, pen-test (Phase 5).

## Milestones

| Milestone | Status | Progress | Date |
|---|---|---|---|
| M0 — Phase 0 · Stabilise | Complete | 100% | 2026-09-17 |
| M1 — Phase 1 · Foundation | Complete | 100% | 2026-09-17 |
| M2 — Phase 2 · Interface rebuild | Complete | 100% | 2026-09-17 |
| M3 — Phase 3 · Real actions | Not started | 0% | not scheduled |
| M4 — Phase 4 · Differentiators | Not started | 0% | not scheduled |
| M5 — Phase 5 · Enterprise hardening | Not started | 0% | ongoing after v2 |

### M0 — Phase 0 · Stabilise (complete 2026-09-17) — 100%

Ship a build a partner could touch. Every finding from F-1 to F-18 closed — nineteen of them,
the list carrying an F-7b as well as an F-7 — each with a test that failed first: tenancy and
settings isolation, SMTP password encryption, approval no longer sending email, the SSRF guard
on the scraper, startup guards against weak secrets, rate limits, Alembic migrations replacing
the startup SQL, and the duplicate deploy files deleted. Testing and CI were bootstrapped from
nothing.

- [x] Findings F-1 to F-18 closed with regression tests
- [x] Alembic migrations applied at startup; `SETUP_SQL` gone
- [x] Startup guards, security headers, rate limits, encrypted secrets at rest
- [x] Outbox: approval creates drafts only; sending is explicit and capped per day
- [x] pytest, Vitest and a CI workflow that actually runs them

### M1 — Phase 1 · Foundation (complete 2026-09-17) — 100%

The tenancy, session, job and AI groundwork the product sits on. Decisions recorded as D1–D16
in `docs/PHASE1_DESIGN.md`, with two reasoned departures from the plan: jobs run on PostgreSQL
rather than arq on Redis (D9), and only platform admins create reset links (D8).
All three exit criteria are evidenced by tests.

- [x] Organisations, memberships and the role ladder Viewer → Editor → Approver → Owner (D1–D6)
- [x] Invitations, member management, last-owner protection, activity log (D14)
- [x] Refresh-token sessions, password reset, admin one-time reset links (D7, D8)
- [x] Durable PostgreSQL jobs: leases, retries, cancel, time limits; worker in-process or standalone (D9)
- [x] Live updates over SSE and LISTEN/NOTIFY (D10)
- [x] Structured AI results with verified sources, and prompt caching (D11, D13)
- [x] Usage ledger, monthly budget per organisation, Settings → Usage (D12)
- [x] Deployed to Railway; `launchops.run` live over HTTPS; manual smoke test against the real API

Descoped by decision, not dropped: the brand kernel (D15) and a versioned result history (D16)
moved to Phase 2 follow-up because they belong with the report surfaces and D15 needs owner
answers first. Both are tracked under **Next up**.

### M2 — Phase 2 · Interface rebuild (complete 2026-09-17) — 100%

The single-file `App.jsx` is gone. Every screen was rebuilt in TypeScript on a token-based
design system with light and dark themes, and every module reached parity or better.

- [x] Design system, app shell, routing, command palette
- [x] Portfolio, Project (overview, operations, reports, review, outbox, launch plan, settings)
- [x] Review queue, Outbox, Calendar, Library, Settings, sign-in and invitation flows
- [x] Organisation settings, activity and usage screens; live updates; role-aware controls everywhere
- [x] Golden-path and smoke browser tests, plus axe WCAG 2.2 A/AA scans of 27 screens in both themes

Two carry-overs, both owner-gated rather than engineering work: billing settings wait on a
billing decision, and the design canvas sign-off (plan decision 6) was replaced in practice by
reviewing the working build. Both appear under **Blocked**.

### M3 — Phase 3 · Real actions (not started) — 0%

Scope from the plan, §6 Phase 3. The point of the phase: a venture can go from market analysis
to a press release actually emailed and a LinkedIn post actually scheduled, with every step in
the audit log.

- [ ] Email: a transactional provider with per-organisation verified sending domains, or
      per-workspace SMTP kept but encrypted; open and reply tracking; templates
- [ ] Social: X and LinkedIn OAuth and posting via the official APIs, scheduled from the
      calendar through the Outbox (Instagram, TikTok and Threads stay copy-and-post, labelled honestly)
- [ ] Exports: server-side PDF and DOCX for reports and the launch plan, white-labelled per organisation
- [ ] Notifications: email and Slack webhook on job complete, approval needed, send failed

### M4 — Phase 4 · Differentiators (not started) — 0%

Scope from the plan, §6 Phase 4. Exit criterion: the partner demo script runs end to end in
under 15 minutes with no manual workarounds.

- [ ] Launch Readiness Index, weighted from plan completion, brand kernel completeness,
      assets and intelligence freshness
- [ ] Campaign Playbooks: a job graph with dependencies, dates and approval gates, plus three
      shipped playbooks (product, service, persona launch)
- [ ] Living Launch Plan: generated per venture type, module completion ticks items, calendar
      populated from approved content
- [ ] Weekly Portfolio Digest per organisation (PDF and email)
- [ ] Evidence layer polish: source freshness badges, a re-verify action, confidence display

**Part of this milestone is being pulled forward.** The guided launch playbook the owner chose
for the Operations screen on 2026-09-17 — a stepper through the whole launch with progress,
gates and dependencies — is close to **Campaign Playbooks** above. It is tracked under
**Next up** (item 1) rather than duplicated here. Its domain layer is in pull request #5 (T-9)
and its screen is built on branch `feat/playbook-ui`, but neither is on `main` yet. It is also
one fixed order that advises, not a job graph with approval gates and three shipped playbooks,
so the item stays unticked and M4 stays at 0%.

### M5 — Phase 5 · Enterprise hardening (not started) — 0%

Scope from the plan, §6 Phase 5. Ongoing after v2, driven by what the first paid partner requires.

- [ ] SSO (OIDC first, SAML second) and MFA
- [ ] Audit-log export; data retention, export and delete per organisation
- [ ] Public API with webhooks and API keys
- [ ] Staging environment; backups and a restore drill; status page
- [ ] Security review (bandit, pip-audit, npm audit, dependency pinning, secret scanning in CI)
- [ ] Pen-test before the first paid partner

## Active

**T-9 comes first: merging pull request #5 caps a spending exposure that is live in
production** — once it deploys, every self-registered organisation is held to the $25 monthly
default, which its owner can lower or clear but not raise. That caps each organisation, not the
total (B-14, under **Blocked**). The rest are operational follow-ups from the deployment session —
none of them code changes, but account, DNS and Railway housekeeping that only the owner can do.

| # | Task | Priority | Status | Notes |
|---|---|---|---|---|
| T-9 | Merge pull request #5 (branch `fix/spend-cap-and-mobile-overflow`) once CI passes, then verify on the live site that Settings → Usage shows the $25 default | P1 | Next | **Heads the list because it caps a spending exposure that is live in production.** The pull request is **open, not merged, not deployed**: `main` is at `0ce65dd`, and production runs `bc6143c`'s application code. It fixes three **shipped** defects, BUG-028 to BUG-030 in `docs/BUGS.md`: an organisation without a budget of its own could spend without limit on the deployment's `ANTHROPIC_API_KEY` — any self-registered account included, since open registration stays on (T-2) — and that is **live in production until this merges**; four screens scrolled sideways on a phone; competitor results rendered empty columns and headings. **Since `a53b26e`, the $25 cap holds for self-registered organisations too.** Before it, the $25 default held only organisations that never touched their budget: registration makes each new account the Owner of the organisation it creates, and an Owner could set any budget, which then won over the default (BUG-031, moot in production only because production has no default to lift). The owner decided on 2026-09-17 that an organisation's owners may set any budget up to the platform default, lower it or clear it, and only a platform admin may set one above it; `a53b26e` enforces that on `PUT /api/organisation/budget` with a 403. CodeRabbit's review of `7dbc35d` found one change that check refuses although it would only lower the cap: an owner who isn't a platform admin cutting a budget that is above the default to an amount still above it. It fails safe and does not block the merge; it is BUG-032 (open, LOW), and its fix a follow-up under **Backlog**. The pull request leaves two owner questions in **Blocked**, neither of which holds up the merge: the total across organisations (B-14) and a platform admin's reach into organisations they don't belong to (B-15). Budgets already stored are left as they are — the rule applies to changes — but production has had no default to escape, so no stranger has had a reason to set a high one. It also adds the launch playbook's domain module (**Next up**, item 1). **The code is all pushed:** the last code commit on pull request #5 is `7dbc35d`, its eleventh commit. Before merging, read CI with `gh pr checks 5` and merge only once the three jobs (backend, frontend and the secret scan) are green on whatever the head is by then — any commit pushed after `7dbc35d`, a documentation batch included, needs its own green run. Merge with a **merge commit, not a squash**, so `.gitleaksignore`'s per-commit fingerprints keep resolving and `feat/playbook-ui` — stacked on `a53b26e`, which the merge brings into `main` — can be rebased onto `main` as its one commit (**Next up**, item 1). Then verify, signed in as an Owner and **never by registering a probe account** (T-1), in an organisation with no budget of its own. Since `7dbc35d` the check no longer needs a month with usage, but what Settings → Usage shows depends on whether the current month has any. **With none yet**, as in a brand-new organisation: the empty state and the sentence "The platform's default budget of $25.00 applies: operations stop when a month's cost reaches it." — and **no** note about platform administrators. **Once the month has usage**: the summary's $25.00 budget with its meter, and the note "This is the platform's default budget. You can set a lower one below; only a platform administrator can set a higher one." Either one passes. The ceiling itself is covered by tests, not checked live: the owner is the platform admin, who may exceed it, and a live check would need a second account. `DEFAULT_MONTHLY_AI_BUDGET_USD` defaults to 25, so Railway needs no new variable. |
| T-1 | Delete the account `guard-check@example.com` and "Guard check's organisation" | P1 | Next | A verification probe created it after the admin account existed. Platform admin removes it in Settings → Team & access. Never probe registration against the live site again. |
| T-2 | Confirm who holds the first (admin) account, and decide whether open registration stays on | P1 | Done 2026-09-17 | Both halves confirmed by the owner. The platform admin (`users.role = 'admin'`, and the `ADMIN_EMAIL` holder) is **`color8studios@gmail.com`**. **Open registration stays on** — a deliberate decision, not an oversight: the platform-wide switch in `app_config` is unchanged and remains enabled. `ADMIN_EMAIL` already protects the first (admin) account, so the accepted residual risk is that anyone who reaches `launchops.run` can self-register and create their own organisation. |
| T-3 | Update the Spaceship CNAME for `launchops.run` to `xesm2hmr.up.railway.app` | P1 | Done 2026-09-17 | Re-adding the domain to fix a stalled certificate had produced a new target; the Spaceship record now points at `xesm2hmr.up.railway.app`, and the change was verified independently against public DNS (Google `8.8.8.8`) the same day. Verification was by **address comparison**, because the flattened apex exposes no CNAME to read directly: `launchops.run` answers with an A record of `69.46.46.46`, **identical to** `xesm2hmr.up.railway.app` (`69.46.46.46`) and **different from** the old `5rlc9k25.up.railway.app` (`69.46.46.62`). |
| T-4 | Rotate the currently-exposed Railway project token | P1 | Next | **Still open: the current token is owed its end-of-session rotation.** This is the owner's settled practice, not a lapse: `railway login` will not authorise on this machine, so the owner pastes a Railway project token into the session instead, and rotates it at the end of every session, which bounds the exposure. Rotation is the remedy because a pasted secret lands in the conversation transcript and in the session log under `.claude/projects/`, and deleting the message does not undo that. The row first asked for an exposed token to be deleted and a replacement issued; both were done, and the replacement has since been pasted in its turn. **No token value is written into any document, and none may ever reach a commit:** CI runs **gitleaks over the full git history**, so a token in any commit fails the build and stays in the history permanently. |
| T-5 | Turn on Wait for CI in the `launchops` service source settings | P3 | Next | Optional. Only commits that pass CI would deploy; the service deploys on every push to `main` today. |
| T-6 | Turn on Postgres backups | P3 | Next | Optional today because there is no real data yet; required before a partner uses the app. |
| T-7 | Delete the detached empty volume `postgres-volume-qVKY` | P3 | Next | Optional tidy-up. |
| T-8 | Set the `MAIL_*` variables (and confirm `APP_URL`) | P3 | Next | Optional. Without them nothing is emailed: owners share invitation links and admins create reset links by hand. |

## Blocked / needs the owner

Nothing here can move without a decision. Each links to where the question is written up.
Fourteen are open: B-1 to B-12, and B-14 and B-15, which came out of the budget work in pull
request #5 (B-13 is decided). Once a decision is made and carried out the item moves to
**Decided** below, so this table is only ever the outstanding list.

| # | Question | Source | Working default until answered |
|---|---|---|---|
| B-1 | Frontend rebuild confirmation — TypeScript, CSS-variable design system, Radix, `App.jsx` retired | Plan §8.1 | Built and shipped; needs formal confirmation only. |
| B-2 | Organisation model semantics — one organisation per corporate partner with many ventures, or one organisation per startup under an umbrella | Plan §8.2 | Organisation = partner, workspace = venture; no parent organisations (D1). |
| B-3 | Email posture — per-workspace SMTP or a platform sender with verified domains | Plan §8.3 | Both exist: per-organisation SMTP for the Outbox, a platform mailer for resets and invitations (D8). |
| B-4 | Social scope for v2 — X and LinkedIn only via official APIs, everything else copy-and-post | Plan §8.4 | Not built; gates Phase 3 social work. |
| B-5 | Models and budgets — Sonnet 5 default, Opus 5 for market analysis and pricing, budget per organisation | Plan §8.5 | In place and configurable (D12). **Decided 2026-09-17 — who may exceed the platform default:** an organisation's owners may set any budget up to it, lower it or clear it; only a platform admin may set one above it. `a53b26e` enforces that (BUG-031), in pull request #5 (T-9). Two related questions are open as B-14 and B-15. **Still needs confirmation:** the model defaults, and the $25 amount itself — the monthly platform default for an organisation without a budget of its own (`DEFAULT_MONTHLY_AI_BUDGET_USD`), which arrives with the same pull request. |
| B-6 | Design sign-off — who signs off the interface, given the four-screen canvas was skipped | Plan §8.6 | The working build and screenshots are the review surface; sign-off still outstanding. |
| B-7 | Domain and deploy shape — services and whether a staging environment is wanted | Plan §8.7 | Live on Railway as one web service plus Postgres, worker in-process; no staging. |
| B-8 | Brand kernel: does a project's brand override the organisation's voice field by field, or as a whole? | D15 | Not built; blocks the brand kernel. |
| B-9 | Brand kernel: which role may edit it? | D15 | Not built; blocks the brand kernel. |
| B-10 | Brand kernel: should each result record the brand version it used? | D15 | Not built; ties D15 to the result history in D16. |
| B-11 | Should organisation owners also be able to create password reset links? | D8 | Platform admins only, because a person can belong to several organisations and an owner who could reset a password could reach that member's other organisations. |
| B-12 | Billing: what is metered and charged, so billing settings can be designed | Plan §6 Phase 2, Progress | Usage and budgets are visible per organisation; no billing surface. |
| B-14 | Total AI spend across organisations: the monthly budget caps each organisation, and nothing caps the total. Is a platform-wide monthly cap wanted, or a tighter limit on sign-ups, or is a cap per organisation enough? | T-2, T-9 | Once pull request #5 merges (T-9), every organisation is capped each month — at the $25 platform default unless it has a budget of its own — but nothing caps the sum. Open registration stays on (T-2) and each open sign-up creates an organisation of its own, so every new account adds its own $25 a month on the deployment's single `ANTHROPIC_API_KEY`; the only brake on how many is the sign-up rate limit of 10 new accounts an hour per address. |
| B-15 | Should a platform admin be able to set the budget of an organisation they don't belong to? The decision of 2026-09-17 (B-5) lets only a platform admin set one above the platform default, but the budget route is Owner-only, so as built they can do it only in an organisation where they are an Owner. | B-5, T-9 | As built in pull request #5: a platform admin sets budgets only where they are an Owner, so for anyone else's organisation its owners would first have to invite the admin in as one. Yet the 403 for a budget above the default, the 429 when an organisation on the default runs out and the note on Settings → Usage all name a platform administrator as the one who can go higher, and none mentions that requirement. A yes means a budget control for platform admins across organisations; a no means rewording those three messages. Either way it is a follow-up to pull request #5, not part of it. |

## Decided

Items that were blocked on an owner decision, now decided and carried out. They are kept for the
record: none of them is waiting on anyone, and none counts towards the open decisions above.

### B-13 — Merge the session-end batch (the BUG-027 refresh-token fix and the handoff documents) — done 2026-09-17

- **Decision:** the owner was asked and chose **branch, pull request, merge after CI**. All of it
  is done.
- **Merged:** pull request #3, branch `fix/refresh-token-clock-skew`, into `main` as merge commit
  **`bc6143c`** — a merge commit, never a squash, so `.gitleaksignore`'s three per-commit
  fingerprints still resolve.
- **CI was green first:** backend (550 tests against a `postgres:18` service, behind the 95%
  coverage gate), frontend (lint, typecheck, Vitest, build, Playwright) and the gitleaks secret
  scan over the full history.
- **Six commits landed:** `35d24c5` the BUG-027 fix, `584cff6` a regression test, `7c1f1cb` the
  session-end documents, `39ff28b` the design-system correction, `ee4932a` the reconciliation
  fixes, `c486949` the branch-state notes.
- **Deployed and verified:** Railway deployed `bc6143c` successfully at 2026-09-17T19:47:08Z.
  `/health` answers 200 `{"status":"ok"}`, and `POST /api/auth/refresh` with no cookie answers 401
  session-ended. **The BUG-027 security fix is live in production.**

## Next up

In order. Items 1 to 3 are the owner's product choices of 2026-09-17 and wait on nothing in
**Blocked**; items 4 to 7 follow once the owner decisions above land.

The choices came out of an audit aimed at presenting LaunchOps to a potential acquirer. For the
Operations screen the owner chose a **full guided launch playbook** — a stepper through the
whole launch with progress, gates and dependencies — over two simpler options: recommendations
derived only from the launch phase, or a static category order. Alongside it they chose **cost
and duration per operation** and **the launch board as cards on a phone**.

1. **The guided launch playbook, on the Operations screen.** **Built, and awaiting its own pull
   request once #5 merges.** It is one commit on branch `feat/playbook-ui`, **not yet pushed or
   opened as a pull request** — kept apart so the security fix in #5 isn't held up. Today that
   commit is `f6261a6`, stacked on `a53b26e`. Once #5 merges, the branch is rebased onto `main`,
   so **its hash changes**: the pull request will carry a new one, not `f6261a6`. The screen
   opens on a **"Next up"** card: the one operation to run now,
   its stage, why it is next, and whether the stage is behind. Below it are the **five stages as
   an ordered list** — understand the market, fix the positioning, write the story, line up
   distribution, prepare the push — each with its progress, and each operation with its own
   (Done, In review, Running, Failed). **"All operations"** (`?view=all`) keeps the category
   catalogue. It builds on `frontend/src/lib/domain/playbook.ts` (18 tests, part of T-9), which
   places seventeen of the eighteen operations in those stages and works out each one's state
   and what to run next; the screen adds 12 tests, and the accessibility and phone-width suites
   cover both views. The one tool, `repurpose`, sits apart under "Always available": it stores
   nothing, so its use cannot be observed. **Still open for the owner: whether a gate should
   ever block a run.** Today the playbook only advises — it names unfinished groundwork, but
   every operation still runs from wherever it is. **This pulls part of M4 forward:** it is
   close to Phase 4's **Campaign Playbooks**; see the note under M4.
2. **Cost and duration per operation.** **Only estimate bands are honest until a migration
   lands.** The `ai_usage` ledger keeps a row per API response and has no run identifier, so
   it cannot tell one operation run from one API call, and one run can make several calls.
   Adding `result_id` to `ai_usage` would fix that, and would also let each result show what
   it cost.
3. **The launch board as cards on a phone.** At phone width the Portfolio launch board shows
   only its project column; the rest is reachable only by scrolling the table sideways, with
   nothing to say so. `2d57b35` (part of T-9) stopped the page itself overflowing but left the
   board a table; collapsing it to cards at narrow widths is the fix the owner chose.
4. **Phase 2 follow-up — brand kernel (D15).** One versioned brand and company object per
   workspace, merging `brands`, `products.company_details` and the organisation's brand voice,
   so brand facts stop drifting across three editing surfaces. Blocked by B-8, B-9 and B-10.
5. **Phase 2 follow-up — result history (D16).** A versioned results table and a report
   history, so a report's earlier versions survive a re-run. Belongs with the brand kernel
   because both live on the report surfaces, and B-10 decides whether a result records its
   brand version.
6. **Phase 2 follow-up — billing settings.** Blocked by B-12.
7. **Phase 3 — real actions (M3).** The first phase that sends anything for real; it is what
   turns governed drafts into a completed launch.

## Backlog

Not scheduled, recorded so they are not lost.

- **BUG-032** (open, LOW; `docs/BUGS.md`), a follow-up to pull request #5 from CodeRabbit's
  review of `7dbc35d`. An owner who isn't a platform admin can't lower a budget that is above
  the platform default to an amount still above it — from $500, set by a platform admin, to
  $400, say — only to the default ($25) or less, or by clearing it: `ensure_budget_allowed`
  compares the new amount with the platform default, not with the organisation's current
  budget. It fails safe, since every change it wrongly refuses would have lowered the cap, and
  the fix belongs in a later pull request.
- An automated test that exercises the real Anthropic API. Today every test uses a fake
  transport and an autouse guard fails any test that reaches the network; the live check on
  2026-09-17 was manual and one-off.
- **Risk:** the frontend Vitest suite fails intermittently at default concurrency on the
  development machine, pre-existing on `main` (`docs/TESTING.md` gap 14). No fix is applied;
  the candidates are listed there for the owner.
- Parent organisations, for a venture that needs to leave a partner umbrella (deferred in D1).
- Revisit the job queue on Redis or arq if job volume outgrows PostgreSQL (deferred in D9).
- Separate permissions in place of the single role ladder, if a partner needs finer control
  than Viewer → Editor → Approver → Owner (deferred in D2).
