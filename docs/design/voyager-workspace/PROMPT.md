# Prompt for Claude Code

Paste this into Claude Code with this folder available in the repo (e.g. copied to `docs/design/voyager-workspace/`).

---

You are implementing a new flagship section of the TradingNew web app: the **AI Voyager Workspace** — a full-screen, AI-native financial workspace reached from a new first-level navigation item.

## Context

Repo: this one (Next.js App Router, TypeScript, `next-intl` with `en`/`ru`, CSS Modules, tokens in `src/app/tokens.css`, icons in `src/components/ui/Icon.tsx`, embedded assistant already in `src/components/voyager/**` and `src/lib/voyager/**`).

Design input in `docs/design/voyager-workspace/`:
- `README.md` — the handoff: zones and geometry, module inventory, tokens, typography, copy, execution lifecycle, state model.
- `Voyager Workspace.dc.html` + `support.js` — the interactive design reference. **Do not port this file or its runtime.** Open it in a browser: the top bar has a New/Returning landing switcher and D/T/M breakpoints; the landing runs ten scenarios end to end.

Related handoff already in the repo: `docs/design/superchart/` (Supercharts + embedded Voyager). This workspace hands charts and scripts to it via "Open in Supercharts" and receives context from it via "Continue in Voyager Workspace".

## The single most important product rule

**The first screen is simple. Complexity only appears after the user asks for something.**

Empty state (desktop and mobile): a centred column and nothing else — headline, one supporting line, one wide prompt input, five one-line starter suggestions, a quiet "More things I can do" link that reveals the five prompt categories, and a quiet "Sign up and get 3 000 free tokens" link. There is **no conversation panel, no inspector, no canvas toolbar, no floating CTA, no dashboard** in this state — those components are not rendered at all.

The moment a request exists, the workspace assembles: conversation panel on the left with the plan, canvas in the middle with progressively appearing modules, inspector on the right with context and sources, the canvas toolbar, and the sign-up CTA. Reviewers must be able to see this transition by clicking a starter, and "New" must return to the bare screen.

Do not "improve" this by adding widgets, tips, stats or recommendation rails to the empty state.

## What to build

1. **Navigation entry.** AI Voyager as a first-level header item, styled as the quiet violet orb pill in the README (label collapses to the orb below 1080px, `aria-label`/`title` kept). Route `/[locale]/voyager`.
2. **Landing (both personas).** New user: headline "What would you like to understand, build or monitor?", supporting line, hero composer (voice + attach + send), five starters, More/Sign-up links. Returning user: orb + "Good morning, Alex." + a one-sentence briefing + four personalised cards that each state *why* they are shown, then the same composer and starters.
3. **Three-zone workspace** (only once a request exists): conversation 348px collapsible to a 46px rail · canvas as the primary surface · inspector 312px, an overlay below 1180px. Mobile: one zone at a time behind Chat / Canvas / Context / Sources tabs.
4. **Module system.** The module types listed in the README as one card family with per-card actions; modules appear one at a time.
5. **Execution lifecycle.** understanding → planning → working (named steps ticking off) → partial → complete, with Stop-and-keep, explicit failure states and recovery actions. User-facing steps only — never chain-of-thought.
6. **Actions inside the platform.** Charts and scripts to Supercharts; watchlists, screens, scenarios and reports to My Workspace; monitoring rules — each confirmed, listed in workspace history, undoable.
7. **Workspace persistence.** Autosaved workspaces with a Voyager-suggested name; library modal with search, filters, pin, duplicate, rename, delete, share, export.
8. **Privacy.** Wealth Hub only after a scope-level permission request; scopes visible and revocable in one click from the inspector; property values optional; nothing read before consent.
9. **Sign-up and tokens.** 3 000 free tokens on sign-up: a quiet inline link on the landing, a compact floating CTA in workspace mode (the canvas must reserve bottom space for it — 74px desktop, 130px mobile where the tab bar stacks), and a modal with the perks. After sign-up the CTA disappears and the meter switches from "37 / 100 free messages" to "3 000 tokens left".
10. **Plans and limits.** Credit meter with an amber soft-limit state and a plans modal (Free / Pro / Private AI) that explains why a feature needs a plan. Never paywall the first request.

## Rules that are not negotiable

1. **Structured output only.** The model returns `{mode, steps[], work[], modules[], sources[], assumptions[]}`; the UI renders only declared modules and never parses prose into UI or actions.
2. **No mutation without confirmation**, and every applied change is undoable from workspace history.
3. **Every answer carries sources with provider and timestamp.** No sources → not rendered. Delayed data says so.
4. **Provenance is always labelled**: market data / your data / Voyager inference / educational. Assumptions are visible and editable, and editing re-runs the result.
5. **No guaranteed-return language.** Projections are illustrations with named assumptions; portfolio output is educational analysis, not personalised advice.
6. **The user can correct the AI**: interpreted filters, context rows, script parameters and assumptions are editable in place.
7. **Direction never by colour alone** — ▲/▼ and wording everywhere.
8. **Visual restraint.** Portal light palette, Plus Jakarta Sans, the orb as the only AI imagery. No glassmorphism, neon, robots, space imagery or decorative animation.
9. **Nothing floats over content without reserved space.** Any fixed element (tab bar, CTA, toast) gets a matching bottom allowance on the scroll container.
10. **Accessibility**: AA contrast, visible focus, keyboard path through all zones, real table headers, a text summary beside every chart, `title` + `aria-label` on every icon-only control, ≥44×44 touch targets, `prefers-reduced-motion`.

## How to work

1. Read `README.md` in full, then open the prototype and run all ten scenarios and both personas before writing code.
2. Reuse what exists: tokens, `Icon.tsx`, the Voyager orb and provider, `next-intl` messages (add a `voyager.workspace.*` namespace — every user-facing string from the prototype translated for `en` and `ru`, nothing hardcoded).
3. Propose the chart rendering layer before adding a dependency; share it with the Supercharts implementation.
4. Build in this order, checking against the reference at each step: **empty state first** → shell and zones with persistence → module card family + execution lifecycle → the ten scenarios wired to real endpoints → workspace library → privacy and permissions → sign-up/tokens and plans → tablet → mobile → error states.
5. Voyager responses may start from the templated scenarios in the prototype; keep the orchestrator boundary so a real model swaps in behind the same structured contract.
6. Finish by walking the acceptance list and reporting each item pass/fail.

## Acceptance list

- [ ] Empty state renders **only** headline, supporting line, composer, five starters and the two quiet links — no panels, no toolbar, no CTA, on every breakpoint.
- [ ] Clicking a starter or sending a prompt assembles the workspace; "New" returns to the bare screen.
- [ ] Voyager is a first-level nav item; the pill degrades to the orb without losing its accessible name; no other nav item is clipped.
- [ ] Three zones with the specified widths; conversation collapses to a rail; inspector becomes an overlay below 1180px; state persists per user.
- [ ] Both personas render, and every personalised card states why it is shown.
- [ ] All ten scenarios produce a canvas of declared modules with progressive appearance.
- [ ] Lifecycle states all present, including Stop-and-keep and at least three distinct failure states with recovery actions.
- [ ] Sources with timestamps on every answer; provenance labels on every card mixing data and inference.
- [ ] Filters, assumptions, context rows and script parameters editable, and editing re-computes.
- [ ] No AI action reaches charts, watchlists or workspaces without confirmation; history lists it; undo restores.
- [ ] Pine flow: generated → error with line reference → fix shown before applying → valid → parameters tunable → applied; unsupported functions named honestly.
- [ ] Wealth Hub: not-connected, permission request with scopes, granted, revoked — no data read before consent.
- [ ] Sign-up CTA never overlaps content (reserved bottom space verified on desktop and mobile); after sign-up the meter shows tokens.
- [ ] Credit meter, soft-limit state and plans modal behave as designed; the first request is never blocked.
- [ ] Workspace library: search, filters, pin, duplicate, rename, delete, share, export; reopening restores conversation, canvas and sources.
- [ ] Mobile: one zone at a time, four tabs, charts usable in landscape, Pine reviewable and tunable.
- [ ] Accessibility checks pass; both locales complete.

Ask before inventing product behaviour that is not in the handoff — the design is specific on purpose. Where the handoff gives a hex value or a size, match it.
