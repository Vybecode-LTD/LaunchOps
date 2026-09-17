---
document: ROADMAP
version: 1.1.1
last-updated: 2026-09-17T20:10:00Z
last-audit: 2026-09-17T20:05:00Z
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

### M5 — Phase 5 · Enterprise hardening (not started) — 0%

Scope from the plan, §6 Phase 5. Ongoing after v2, driven by what the first paid partner requires.

- [ ] SSO (OIDC first, SAML second) and MFA
- [ ] Audit-log export; data retention, export and delete per organisation
- [ ] Public API with webhooks and API keys
- [ ] Staging environment; backups and a restore drill; status page
- [ ] Security review (bandit, pip-audit, npm audit, dependency pinning, secret scanning in CI)
- [ ] Pen-test before the first paid partner

## Active

Operational follow-ups from the deployment session. None of them are code changes; they are
account, DNS and Railway housekeeping that only the owner can do.

| # | Task | Priority | Status | Notes |
|---|---|---|---|---|
| T-1 | Delete the account `guard-check@example.com` and "Guard check's organisation" | P1 | Next | A verification probe created it after the admin account existed. Platform admin removes it in Settings → Team & access. Never probe registration against the live site again. |
| T-2 | Confirm who holds the first (admin) account, and decide whether open registration stays on | P1 | Next | `ADMIN_EMAIL` now restricts who can create the first account; the registration switch is platform-wide. |
| T-3 | Update the Spaceship CNAME for `launchops.run` to `xesm2hmr.up.railway.app` | P1 | Next | Re-adding the domain to fix a stalled certificate produced a new target. Traffic and the certificate work today, but the record still points at the old `5rlc9k25.up.railway.app`. |
| T-4 | Delete the Railway project token that was pasted into chat, and issue a new one when needed | P1 | Next | Treat it as exposed. |
| T-5 | Turn on Wait for CI in the `launchops` service source settings | P3 | Next | Optional. Only commits that pass CI would deploy; the service deploys on every push to `main` today. |
| T-6 | Turn on Postgres backups | P3 | Next | Optional today because there is no real data yet; required before a partner uses the app. |
| T-7 | Delete the detached empty volume `postgres-volume-qVKY` | P3 | Next | Optional tidy-up. |
| T-8 | Set the `MAIL_*` variables (and confirm `APP_URL`) | P3 | Next | Optional. Without them nothing is emailed: owners share invitation links and admins create reset links by hand. |

## Blocked / needs the owner

Nothing here can move without a decision. Each links to where the question is written up.
Twelve are open (B-1 to B-12); once a decision is made and carried out the item moves to
**Decided** below, so this table is only ever the outstanding list.

| # | Question | Source | Working default until answered |
|---|---|---|---|
| B-1 | Frontend rebuild confirmation — TypeScript, CSS-variable design system, Radix, `App.jsx` retired | Plan §8.1 | Built and shipped; needs formal confirmation only. |
| B-2 | Organisation model semantics — one organisation per corporate partner with many ventures, or one organisation per startup under an umbrella | Plan §8.2 | Organisation = partner, workspace = venture; no parent organisations (D1). |
| B-3 | Email posture — per-workspace SMTP or a platform sender with verified domains | Plan §8.3 | Both exist: per-organisation SMTP for the Outbox, a platform mailer for resets and invitations (D8). |
| B-4 | Social scope for v2 — X and LinkedIn only via official APIs, everything else copy-and-post | Plan §8.4 | Not built; gates Phase 3 social work. |
| B-5 | Models and budgets — Sonnet 5 default, Opus 5 for market analysis and pricing, budget per organisation | Plan §8.5 | In place and configurable (D12); needs confirmation of the defaults. |
| B-6 | Design sign-off — who signs off the interface, given the four-screen canvas was skipped | Plan §8.6 | The working build and screenshots are the review surface; sign-off still outstanding. |
| B-7 | Domain and deploy shape — services and whether a staging environment is wanted | Plan §8.7 | Live on Railway as one web service plus Postgres, worker in-process; no staging. |
| B-8 | Brand kernel: does a project's brand override the organisation's voice field by field, or as a whole? | D15 | Not built; blocks the brand kernel. |
| B-9 | Brand kernel: which role may edit it? | D15 | Not built; blocks the brand kernel. |
| B-10 | Brand kernel: should each result record the brand version it used? | D15 | Not built; ties D15 to the result history in D16. |
| B-11 | Should organisation owners also be able to create password reset links? | D8 | Platform admins only, because a person can belong to several organisations and an owner who could reset a password could reach that member's other organisations. |
| B-12 | Billing: what is metered and charged, so billing settings can be designed | Plan §6 Phase 2, Progress | Usage and budgets are visible per organisation; no billing surface. |

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

In order, once the owner decisions above land.

1. **Phase 2 follow-up — brand kernel (D15).** One versioned brand and company object per
   workspace, merging `brands`, `products.company_details` and the organisation's brand voice,
   so brand facts stop drifting across three editing surfaces. Blocked by B-8, B-9 and B-10.
2. **Phase 2 follow-up — result history (D16).** A versioned results table and a report
   history, so a report's earlier versions survive a re-run. Belongs with the brand kernel
   because both live on the report surfaces, and B-10 decides whether a result records its
   brand version.
3. **Phase 2 follow-up — billing settings.** Blocked by B-12.
4. **Phase 3 — real actions (M3).** The first phase that sends anything for real; it is what
   turns governed drafts into a completed launch.

## Backlog

Not scheduled, recorded so they are not lost.

- An automated test that exercises the real Anthropic API. Today every test uses a fake
  transport and an autouse guard fails any test that reaches the network; the live check on
  2026-09-17 was manual and one-off.
- Parent organisations, for a venture that needs to leave a partner umbrella (deferred in D1).
- Revisit the job queue on Redis or arq if job volume outgrows PostgreSQL (deferred in D9).
- Separate permissions in place of the single role ladder, if a partner needs finer control
  than Viewer → Editor → Approver → Owner (deferred in D2).
