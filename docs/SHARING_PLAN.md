# Sharing — plan for the next session

> **The owner's priority, set 2026-09-19: build all three features below, starting immediately in the
> next session.** Nothing here is built yet. This document is the brief: what the owner asked for,
> what exists today (mapped from the code at `199121c`), the decisions to settle with the owner before
> writing code, what each feature touches, and how to test it. When a decision is made, record it here
> (S-numbers) and in `docs/ROADMAP.md`; when a feature ships, move its record to the managed documents.

## What the owner asked for

Today a project can be shared only by inviting someone into the **whole organisation**. On 2026-09-19
the owner asked for the three things that don't exist:

| # | Feature | What it means | Why it matters |
|---|---|---|---|
| 1 | **Per-project access** | Invite someone to **one project** with a role, without giving them the organisation's other projects. | A corporate partner runs a portfolio of startups (D1: organisation = partner, project = venture). A founder should see only their own venture. |
| 2 | **View-only share links** | An Owner creates a link to a **project or a report** that expires and can be revoked; the recipient reads it **without an account**. | Sending a report to an investor, client or acquirer without creating accounts. Strong for demos. |
| 3 | **More than one organisation per account** | A signed-in user can **create another organisation**. Today one is created only with a new account, at registration or when an admin creates a user. | One organisation per client; lets an agency or partner separate work. |

## What exists today (verified at `199121c`, 2026-09-19)

- **Access is per organisation only.** `access.membership()` (`backend/services/access.py:59-93`)
  picks the request's organisation from `X-Org-Id` (else the user's first membership); `access.load()`
  (`:96-101`) answers 404 for a row in another organisation; `access.ensure()` answers 403 for too low
  a role. Roles live only on `memberships` (`0003_organisations.py:39-47`) — a single ladder, Viewer →
  Editor → Approver → Owner (D2). **There is no project-level grant table, no share-link table, and no
  visibility flag on `products`.**
- **Invitations are the template for tokens:** `secrets.token_urlsafe(32)`, stored as a SHA-256 hash,
  7-day lifetime, revocable, one pending invitation per address (`backend/routers/organisations.py:34,
  192-243`); a public `GET /api/invitations/{token}` and register-through-invitation, routed around the
  auth middleware by regex (`backend/main.py:73-75, 135-146`); the page is `/invite/:token`, outside the
  signed-in guard (`frontend/src/app/routes.tsx:19`).
- **Organisations are created only by `_create_account`** (`backend/routers/auth.py:92-111`) at
  registration or when an admin creates a user. No route creates or deletes one for an existing user.
  Code that assumes one organisation per account: the default organisation is the first membership;
  an admin project transfer targets the user's *first owner membership* (`auth.py:499-506`); the budget
  ceiling's reasoning (`usage.py:75-80`); the fake `/register`.
- **Lists that span projects** (organisation-filtered today, and needing project filtering for feature 1):
  `GET /api/products`, `GET /api/queue` without `product_id`, `GET /api/email-queue`, `GET /api/calendar`,
  `GET /api/captures`, `GET /api/templates`, `GET /api/brands`, usage and activity (Owner), and the live
  updates stream. The `?product_id=` filters don't check access to that project — they're safe today
  only because the organisation filter also applies. `database.select()` filters on equality only and
  stops at `LIMIT 100`, so filtering to a *set* of projects needs SQL of its own.
- **Live updates are per organisation** (`backend/services/events.py`): events carry `{id, status}` and
  no `product_id`, so a project-only member on the organisation's stream would learn about every
  project's results and emails.
- **Budgets are per organisation.** AI usage is recorded per organisation, user **and** project
  (`ai_usage`), but the budget that stops operations is the organisation's (`usage.ensure_within_budget`).
- **The frontend gates by organisation role only:** `useOrganisation().can(role)` on 38 lines in 25
  files; the rail and the command palette list every project; Portfolio, Review, the Outbox and the
  calendar aggregate across projects; some project pages filter organisation-wide lists in the browser.
- **Reports are columns on `products`** (latest version only; D16's result history isn't built), so a
  link to a report shows its current version. `_public_product` (`backend/routers/products.py:36-40`)
  returns the whole row except the SMTP password — including `email_settings` and `company_details` —
  so a public page needs an **allow-list** of fields, not that function.
- **Test support is weaker than the backend here.** The fake backend (`frontend/src/test/fakeApi.ts`)
  filters only `GET /api/products` by organisation and treats projects without `org_id` as visible
  everywhere; its queue, Outbox, templates, captures, calendar and brands aren't filtered by
  organisation at all, and its `GET /api/queue/summary` looks the project up by id only (CodeRabbit's
  open thread on pull request #6, `fakeApi.ts:709`). The Playwright bridge
  (`frontend/e2e/support/fakeBackend.ts`) drops `X-Org-Id`, so browser tests always act in the first
  organisation.

## Decisions to settle with the owner first

Proposed defaults are marked; none is decided until the owner says so.

**Feature 3 — more organisations**
- **S1. Who can create an organisation?** *Proposed:* any signed-in user, from the organisation switcher.
- **S2. The spending guard (must decide).** Every organisation without a budget of its own is held to
  the $25 default, and B-14 decided there is no cap on the total. Letting an account create
  organisations freely multiplies what one account can spend on the deployment's API key, with no new
  sign-up needed. **The guard must count what an account has created, not what it owns now:** an Owner
  can promote another member to Owner and then leave (`backend/routers/organisations.py:120-163`), so a
  cap on owned organisations resets whenever two accounts pass ownership back and forth (Codex's review
  of pull request #7). Options:
  - (a) a creation quota per account that ownership changes can't reset. *Proposed:*
    `MAX_ORGANISATIONS_CREATED_PER_USER`, default 3, counted from a `created_by` column on
    `organisations`, with platform admins exempt;
  - (b) one budget shared across the organisations an account has created;
  - (c) new organisations get no AI until a platform admin allows it.
- **S3. Deleting an organisation.** Nothing deletes one today except deleting the sole member's account.
  *Proposed:* include "delete organisation" (Owner, typed confirmation, like deleting a project).
- **S4. Admin project transfer** targets the user's first owned organisation. *Proposed:* let the admin
  choose the target organisation.

**Feature 2 — view-only share links**
- **S5. What can be shared?** *Proposed:* one report first (the report page with its Sources, read-only),
  then a project summary (overview and reports). Never Review, the Outbox, unapproved drafts, email
  settings or company details.
- **S6. Lifetime and revocation.** *Proposed:* the Owner picks 7, 30 or 90 days (default 30); links can
  be revoked at any time; a project's Settings lists its active links.
- **S7. Who can create links?** *Proposed:* Owners, like invitations.
- **S8. Live or snapshot?** Reports keep only their latest version, so a link shows the current one.
  *Proposed:* live, and the share dialog says so; snapshots wait for D16.
- **S9. Branding and tracking.** *Proposed:* the organisation's white-label settings apply; record views
  in the activity log (count and last viewed), nothing more.

**Feature 1 — per-project access**
- **S10. The model.** *Proposed:* project members who are not organisation members ("guests"), in a new
  `project_members` table (`product_id`, `user_id`, `role`); organisation members keep seeing every
  project. A guest still needs an organisation to act in: see "What each feature touches" → Feature 1,
  sign-in and organisation context.
- **S11. Roles for a guest.** *Proposed:* Viewer, Editor or Approver on that project; project settings
  and deletion stay with organisation Owners.
- **S12. What a guest sees.** *Proposed:* Portfolio, Review, the Outbox and the calendar filtered to
  their projects; no organisation Settings, Usage, Activity, Library or Team; the organisation's brand
  voice still feeds AI runs; their AI runs count against the project's organisation's budget.
- **S13. Inviting to a project.** *Proposed:* the invitation flow with an optional `product_id`;
  accepting adds a project membership.
- **S14. Live updates.** *Proposed:* add `product_id` to event payloads and filter per member.

**Across the features — where the permission rule lives**
- **S15. One permission function in the database.** The owner's colleague advised turning the
  permission check into a stored procedure that handles every case, and it fits this work. Today the
  rule is Python in `backend/services/access.py`: `membership()` finds the request's organisation and
  role, `load()` answers 404 for another organisation's record, and `ensure()` answers 403 for too low a
  role. It knows only organisations, and each list route adds its own `org_id` filter. Per-project
  access would otherwise spread "which projects may this user see" across every route and list, where
  one missed filter leaks another project's data.
  *Proposed:*
  - keep `services/access.py` as the app's single entry point;
  - move the rule itself into PostgreSQL, in a migration:
    - `effective_role(user_id, product_id)` returns the user's role on a project: their organisation
      role, their project grant, or none;
    - `accessible_products(user_id, org_id)` returns the projects they may see, and every list query
      joins against it. That also takes list filtering out of `database.select()` and its default
      `LIMIT 100`.
  - later, if wanted, add row-level security on the project tables as a second line of defence. It
    needs the user set on every connection, in the web process and in the job worker.

  Trade-off: rules in SQL are harder to read and to unit-test than Python. So they get tests of their
  own, against real Postgres, as the rest of the backend's tests already run.

**Order.** *Proposed:* 3, then 2, then 1 — smallest first, and feature 1 last because it touches every
permission check, list and screen. Each feature is its own branch and pull request; merge with a merge
commit, never a squash.

## What each feature touches

**Feature 3 — more organisations**
- Backend: a route to create an organisation (reuse the organisation-and-settings part of
  `_create_account`); the S2 guard; S3's delete route; the admin transfer (S4); a migration only if S2 or
  S3 need a column.
- Frontend: "Create organisation" in the switcher (`components/shell/OrganisationSwitcher.tsx`), a
  screen for an account with no organisation (today it gets 403 everywhere and the switcher renders
  nothing), and the fake `/register` and a fake create route.

**Feature 2 — share links**
- Backend: a migration for `share_links` (`id`, `org_id`, `product_id`, `report_key` or none, `token_hash`,
  `created_by`, `created_at`, `expires_at`, `revoked_at`, view counts); Owner routes to create, list and
  revoke; a public route (e.g. `GET /api/share/{token}`) added to the middleware's public regex,
  rate-limited per address, returning an **allow-listed** view; any unknown, expired or revoked token
  answers **404, never 401** — a 401 makes the frontend client renew the session and then sign the
  visitor out (`frontend/src/lib/api/client.ts:142-151`).
- Frontend: a `/share/:token` route beside `/invite/:token`, outside `RequireAuth` and the shell. The
  project pages can't be reused as they are (they need the shell's providers and `ProjectLayout`'s
  context), but `ReportBody` and the exporters can. A share dialog and link list in the project's
  Settings.
- Security: token entropy and hashing like invitations; `noindex`; no event stream; the allow-list;
  `frame-ancestors 'none'` already stops embedding.

**Feature 1 — per-project access**
- Backend: `project_members` and project invitations (migration); S15's permission functions behind
  `services/access.py`, used by every project route; every list above joined against
  `accessible_products` (SQL, not `database.select`); `product_id` in events; the usage summary's
  by-project view; the admin transfer carrying grants.
- Sign-in and organisation context (Codex's review of pull request #7): `/api/auth/me` returns only the
  user's memberships (`access.memberships_of()`, `backend/routers/auth.py:336-339`), and `AuthProvider`
  (`frontend/src/lib/auth/AuthProvider.tsx`) picks the organisation to send in `X-Org-Id` from that list.
  A project-only guest has no membership, so they would have no organisation to act in, and
  `access.membership()` would refuse them before any project check ran. The profile has to list project
  grants too, with each project's organisation, and both `access.membership()` and the frontend's
  organisation context have to represent guest access without granting membership.
- Frontend: a project-aware `can()`; the rail, command palette, Portfolio, Review, Outbox and calendar
  showing only accessible projects; hiding organisation-level pages from guests; a project's Settings →
  Members.

## How to test it

The project's rules apply: tests first (fail, then pass), the 95% coverage gates, zero-warning lint, and
the accessibility and phone-width suites for every new screen.

- **Backend:** tests of S15's functions themselves, covering every combination of organisation role,
  project grant and none, against real Postgres; extend `backend/tests/test_tenancy.py`'s `world` with a
  guest on one project and prove they get 404 on the others through every route; a role matrix for
  project roles like `test_organisations.py`'s; share-link tests for expired, revoked, wrong and
  malformed tokens (all 404), the allow-list (no `email_settings`, no `company_details`), the rate
  limit, and revocation taking effect at once; organisation-creation tests for S2's guard, including
  that promoting another Owner and leaving doesn't reset it, and for S4's transfer; a guest's sign-in
  profile lists their grant and nothing else in that organisation, and they reach their project.
- **Fake backend first.** Before relying on frontend tests, make `fakeApi.ts` scope the way the backend
  does: filter every list by organisation (and, for feature 1, by project), look projects up within the
  organisation — which closes CodeRabbit's open thread on pull request #6 (`fakeApi.ts:709`) — and make
  `e2e/support/fakeBackend.ts` forward `X-Org-Id`.
- **Browser:** add the share page and every new dialog or screen to `e2e/a11y.spec.ts` and
  `e2e/responsive.spec.ts`; a golden-path test per feature.
- **Local runs:** see `docs/TESTING.md` section 2 — one suite at a time, Vitest at `--maxWorkers=2`,
  Playwright at `--workers=4`.

## Risks

- **Spending:** feature 3 without S2's guard multiplies the $25 default per account (B-14 has no total cap),
  and a guard that an ownership transfer can reset is no guard.
- **Data exposure:** a public link is unauthenticated by design; the allow-list, 404s and revocation are
  the defence, and they need tests, not review alone.
- **Permission regressions:** feature 1 changes every access check. S15 puts the rule in one place, and
  the tenancy and role matrices are the safety net, extended before the change, not after.
- **Rate limits are per process** (`backend/services/ratelimit.py`), fine for one Railway instance.
