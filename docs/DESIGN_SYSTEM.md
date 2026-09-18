# LaunchOps Design System

The interface is built for people who run several launches at once and screenshot the result into board
decks. It favours information design over decoration: state is carried by form (pills, lamps, meters,
T-minus clocks), one accent marks what is live or selected, and primary actions are monochrome.

Source of truth: `frontend/src/styles/tokens.css` (tokens), `base.css` (element defaults and shared
roles), and `frontend/src/components/ui/` (primitives). CSS Modules, no CSS framework.

## Themes

Light is the base palette. Dark redefines **tokens only, never components**, in two places so all
three theme states resolve to a complete set:

1. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` — the "System" setting.
2. `:root[data-theme="dark"] { … }` — an explicit Dark choice.

The account menu and the command palette switch between System, Light and Dark. The choice is stored in
`localStorage` under `launchops_theme` and applied before first paint by `frontend/public/theme-init.js`,
loaded from `index.html` as `<script src="/theme-init.js">`. It is a file rather than an inline script so
the Content Security Policy can forbid inline scripts outright. `main.tsx` repeats the same few lines for
environments that don't run it.

**Rule:** a component never sets a colour inside a `[data-theme]` or media block. If a component needs
a different value in dark mode, add or reuse a token.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#f3f3f6` | `#0c0c10` | Page background behind panels. |
| `--surface` | `#ffffff` | `#141419` | Panels, tables, dialogs. |
| `--surface-sunken` / `--surface-hover` | `#f7f7fa` / `#f1f1f5` | `#1a1a21` / `#1e1e26` | Table heads, wells; hover. |
| `--line` / `--line-strong` | `#e3e3ea` / `#cdcdd8` | `#25252e` / `#363642` | Hairlines; control borders. Panels use hairlines, not shadows. |
| `--ink` | `#121218` | `#ececf1` | Primary text. |
| `--ink-2` | `#4b4b59` | `#a8a8b7` | Secondary text, ghost buttons. |
| `--ink-3` | `#686875` | `#8e8ea0` | Meta text, placards, placeholders. At least 4.6:1 on every surface and tint in both themes. |
| `--ink-disabled` | `#a9a9b6` | `#52525f` | Disabled controls only (exempt from contrast rules). Never for readable content. |
| `--signal` | `#2f3dda` | `#8d97ff` | The one accent: live, selected, focused, today. |
| `--signal-soft` / `--signal-ink` | `#ebedfd` / `#2330b0` | `#1c1f4b` / `#bac0ff` | Selected backgrounds; links and signal text. |
| `--signal-fg` | `#ffffff` | `#0c0c10` | Text or icons on a solid `--signal` fill (count badges, today's date). |
| `--primary-bg` / `--primary-fg` | `#16161d` / `#ffffff` | `#ececf1` / `#0c0c10` | Primary buttons (monochrome, inverted in dark). |
| `--ok`, `--warn`, `--crit` (+ `-soft`) | `#1b7a47`, `#975a00`, `#bb2f27` | `#55c78d`, `#eda84c`, `#f27d73` | Semantic state only, always with a label or icon. Never decoration, never a data series. |
| `--crit-fg` | `#ffffff` | `#0c0c10` | Text on a solid `--crit` fill (danger buttons). |
| `--viz-1..3` | `#98a0f0`, `#5f6ce4`, `#2f3dda` | `#39409a`, `#5b66e0`, `#8d97ff` | One-hue ordinal ramp for charts (conservative → aggressive). Validated for colour-vision deficiency. |

Project swatches (8 fixed colours, `lib/domain/projects.ts`) identify projects in lists and on the
calendar. They are identity, not status.

Contrast is enforced by `e2e/a11y.spec.ts` (axe-core, WCAG 2.2 AA) on every screen in both themes.

## Type

| Role | Face | Setting |
|---|---|---|
| Body and UI | Mona Sans (variable, bundled) | 14px base, `--text-11` … `--text-40` scale. |
| Display (page titles, key numbers) | Mona Sans, `font-stretch: 112%` (`.display`, `--stretch-display`) | Weight 620–640, slight negative tracking. |
| Placard (labels, table heads, eyebrows) | Mona Sans condensed, `font-stretch: 82%` (`.placard`) | 11px uppercase, 0.07em tracking, `--ink-3`. |
| Numbers, dates, code | JetBrains Mono (variable, bundled) (`.num`, `.mono`) | Tabular figures wherever digits line up. |

Fonts are bundled with `@fontsource-variable`; nothing loads from a third-party host.

## Space, shape, motion

- Spacing on a 4px base: `--space-1` (4) … `--space-14` (56). Lay out siblings with flex/grid `gap`.
- Radius: `--radius-sm` 4, `--radius-md` 6 (controls), `--radius-lg` 10 (panels), `--radius-pill`.
- Elevation: only overlays and toasts cast shadows (`--shadow-overlay`, `--shadow-toast`).
- Shell: left rail `--rail-width` 244px, top bar `--topbar-height` 56px; the rail becomes a slide-in menu
  below 900px.
- Motion: `--duration-fast` 120ms, `--duration-base` 180ms, `--ease-out`. `prefers-reduced-motion`
  removes animation globally. Content is never parked invisible waiting for an animation.

## Primitives (`src/components/ui`)

| Component | Notes |
|---|---|
| `Button`, `IconButton` | Variants `primary` (monochrome), `secondary`, `ghost`, `danger`, `dangerGhost`; sizes `sm`/`md`/`lg`; `loading`; `asChild` to style a router `Link`. `IconButton` requires a `label` (becomes `aria-label` and tooltip). |
| `Field` and controls | `Field` wires label, hint and error ids to its control (render prop). `Input`, `Textarea`, `Select`, `Checkbox`, `TagInput`, `Switch`, `SwitchField` (description via `aria-describedby`). |
| `Pill`, `Count` | Tones `neutral`, `ok`, `warn`, `crit`, `signal`, `outline`; `live` adds a pulsing dot. |
| `Modal`, `Sheet`, `ConfirmDialog` | Radix Dialog / AlertDialog. Destructive confirmations name the object; the most destructive require typing the name. When "Cancel" would be ambiguous (cancelling an operation), `cancelLabel` names what not acting does: "Keep running". |
| `Menu`, `Tooltip`, `Popover` | Radix. Explanations of computed values (readiness, launch state) live in popovers opened by buttons. |
| Toasts (`useToast`) | Result of every action. Reversible actions carry **Undo** for 6 seconds (deletes are deferred; moves are reverted). |
| `Panel`, `PageHeader`, `EmptyState`, `Notice`, `Skeleton`, `Meter`, `Segmented`, `Definitions`, `CopyButton`, `Kbd` | Layout and display. Empty states always name the next action. `Meter` fills with ink; a `tone` (`ok`, `warn`, `crit`) shows state, such as budget use (warn from 80%, crit from 100%), always beside a pill or text that names the state, with `valueText` for assistive tech. |
| `TabNav`, `Markdown` | Route tabs with counts; safe Markdown (http/https links only). |

## Patterns

- **Say what an action does, then do exactly that.** Every operation's run sheet shows its contract:
  what it produces, what it reads, where the result goes, and what approval does. Labels are verbs
  ("Send 2 emails"); toasts confirm in the same words ("2 emails sent").
- **Nothing irreversible without a clear step.** Approval never sends email; sending lists recipients and
  sender first. Deletes are undoable; project deletion requires typing its name.
- **Time is a first-class unit.** Launch dates show as T-minus (`T–12d`, `T–0`, `T+3d`) with a plain
  sentence for assistive tech. Calendar days are local date keys, never converted through UTC.
- **State in form, not colour alone.** Launch state pills carry a label and explain their rule; report
  lamps pair with text; charts have legends and a table of the same numbers.
- **Keyboard complete.** Ctrl/⌘K opens the command palette; J/K move through Review; calendar entries
  can be moved by dragging or from the day's agenda (Edit / Change launch date) without a mouse.
- **Accessible names match what's visible.** Repeated links ("Open", "Generate") carry the object's name
  for screen readers; badges are separated from labels so names read as words.
- **Background work says where it is.** Running operations show their latest update, such as a retry that's waiting.
  An operation running over an hour is flagged as possibly stuck, with advice the viewer's role can act on (an Editor
  can cancel it and run it again; others are told cancelling needs the Editor role). Cancelling asks first, then says
  whether it stopped at once or stops within about 20 seconds. Lists refresh as soon as the live updates stream says
  something changed; without it they poll.
- **Say where research came from.** A result or report built from web research ends with a numbered Sources
  section (`Sources` in `components/results/primitives.tsx`): each page's title links to it (plain text when the
  address isn't a safe web address), with its site and "Updated …" in muted text when the search said. Only pages the
  searches returned are listed, most important first. Exports end with the same list, addresses included, and
  printing shows each address under its title. Results without sources show nothing.
- **Name groups of repeated fields.** When fields repeat their labels (a press release's media, technical and sales
  contacts), each set is a `fieldset` whose placard is its `legend`, so each field is announced with its group.
- **Say why an action isn't available.** A control that's disabled for a reason outside the user's role (the daily
  sending limit, sending switched off on the server) is described by the notice that explains it.
- **Promise only what the viewer can do.** A message about getting past a limit offers a step this viewer can take.
  Settings → Usage says operations can start again "unless the budget is raised" only to someone who can raise it
  (`canRaiseBudget`); anyone else reads that they start again next month, and no message names an administrator the
  reader can't reach.
- **Recommend, never gate.** Where there's a best order, show it as advice. The Operations screen opens on the launch
  playbook (`components/operations/Playbook.tsx`): one "Next up" card with the operation to run now and the reason —
  including when its stage is behind its window, in words ("the launch date was 3 days ago") — then the five stages as
  an ordered list, the current one open and the rest one line each. Unfinished groundwork is named, but every operation
  still runs from wherever it is. When progress moves the current stage, the new one opens and the one it leaves stays
  as it is, so nothing is pulled out from under the user. "All operations" keeps the catalogue by category.
- **Offer only what the role allows.** A control the user's organisation role can't use isn't rendered.
  Where leaving it out would leave a confusing gap (a result's review actions, the run sheet, a project's
  delete panel), a `RoleNote` says what needs which role: "Sending or deleting email needs the Approver role
  in Northstar Ventures." A form the role can't save stays readable, with its controls disabled
  (`ViewOnlyFieldset`) and one `ViewOnlyNotice` at the top. The backend refuses the same changes.

## Charts

Follow the dataviz method: pick the form first, then colour by job. Revenue projections use grouped
columns on one axis with the ordinal `--viz` ramp, direct labels only on the peak, a legend, a hover and
focus tooltip, and an `aria-label` summary; the scenario table beside it carries the exact values.
