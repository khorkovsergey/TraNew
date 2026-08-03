# AI Voyager Workspace — audit and plan

## What this is

A full-screen, AI-native workspace at `/[locale]/voyager`, reached from a new
first-level navigation item. Ten acceptance items, sixteen module types, a five-
stage execution lifecycle, a workspace library, a permission system and a
billing surface. In scope it is comparable to the whole Superchart effort, which
took nine phases — so this is planned the same way and built the same way, in
phases with a gate at the end of each.

## What the repo already has, and what this reuses

| Need | Already exists | Reused how |
|---|---|---|
| Orb, wordmark | `components/voyager/VoyagerOrb.tsx` | Directly — it is the only AI imagery either surface is allowed |
| Structured answers | `lib/voyager/answerSchema.ts` | The workspace contract is a superset; the schema pattern and its "additionalProperties: false" lesson carry over |
| Scripted answers without a key | `lib/voyager/*`, `superchart/context/answers.ts` | Same approach: the product demonstrates with no `ANTHROPIC_API_KEY` |
| Chart rendering | `lib/superchart/chart-engine/canvas.ts` | The plan asks us to propose a layer rather than add a dependency; this is that layer, behind `ChartEngineAdapter` |
| Pine editor, diagnostics, fixes | `lib/superchart/scripts/*`, `lib/superchart/pine/*` | The Pine module is the Script Lab, re-skinned — not a second implementation |
| Command confirmation, preview, undo | `lib/superchart/commands/*` | "No mutation without confirmation, every change undoable" is already built and tested; the workspace routes through the same bus |
| Layout persistence, versioned schema | `lib/superchart/layouts/schema.ts`, `chart_layout` | Workspace CRUD follows the same shape: untrusted stored input, version refused rather than guessed |
| Sanitising outside data | `lib/events/sanitize.ts`, `lib/market/newsShape.ts` | Sources and news modules |
| Analytics with an orphan check | `lib/events/analytics.ts`, `scripts/check-analytics.mjs` | New events go in the same union |

The important consequence: **six of the sixteen module types are already built**
behind the Superchart work. This is not a green field.

## Conflicts with the handoff, and how they are resolved

**Locales.** The handoff asks for `en` and `ru`, and the acceptance list says
"both locales complete". The project dropped Russian entirely on 2026-07-30 —
`routing.ts` declares `locales = ['en']` and `src/messages/` holds only
`en.json`. A new `ru.json` would be the only Russian in the repo and would rot
from the day it landed. **Built English-only**, with every string in a
`voyager.workspace.*` namespace so adding a locale later is a file, not a
refactor. Flagged to the product owner rather than decided silently.

**The review switchers.** The prototype's top bar carries New/Returning and
D/T/M. Those are review controls, not product: the persona comes from the
session and the breakpoint from the viewport.

**`support.js`.** Not ported, per the handoff.

## Phases

Ordered as the prompt requires: empty state first, complexity after.

### Phase 1 — navigation entry and the empty state *(small)*
The pill in the portal header, the route, and the screen the handoff calls the
most important one: centred column, headline, supporting line, hero composer,
five starters, two quiet links, the five prompt categories behind "More things
I can do". Both personas. Nothing else rendered — no zones, no toolbar, no CTA.

**Done when:** the empty state renders exactly the listed elements at all three
breakpoints, and a starter click is wired to a stage change that is otherwise
inert.

### Phase 2 — shell, zones, persistence *(medium)*
Three zones with the stated geometry, the conversation rail, the inspector
overlay below 1180px, the mobile tab bar, and per-user persistence of the zone
state. "New" returns to the bare screen.

### Phase 3 — module family and execution lifecycle *(large)*
One card family with per-card actions, progressive appearance, provenance
labels, and the five stages including Stop-and-keep and three named failure
states with recovery actions.

### Phase 4 — the ten scenarios *(large)*
Behind the structured contract, scripted first, so the orchestrator boundary is
real before a model is on the other side of it.

### Phase 5 — actions into the platform *(medium)*
Charts and scripts to Supercharts, watchlists and reports to the workspace, and
monitoring rules — each confirmed, listed in history, undoable, through the
command bus that already does this.

### Phase 6 — workspace library and persistence *(medium)*
CRUD with pin, duplicate, rename, delete, share, export; reopening restores
conversation, canvas and sources.

### Phase 7 — privacy and permissions *(medium)*
Wealth Hub behind a scope-level request, scopes visible and revocable in one
click, nothing read before consent.

### Phase 8 — sign-up, tokens, plans *(small)*
The quiet landing link, the floating CTA with its reserved bottom allowance, the
meter, the soft-limit state and the plans modal. The first request is never
blocked.

### Phase 9 — tablet, mobile, errors, accessibility *(medium)*
The breakpoints in full, the error states, and the accessibility list — the
canvas as a labelled region, text summaries beside charts, real table headers,
the keyboard path, reduced motion.

## Decisions taken

| Decision | Why | Reversible? |
|---|---|---|
| English only | The project dropped Russian; a lone `ru.json` would rot | Yes — the namespace is ready |
| Reuse the Superchart command bus for every mutation | "Confirmation + undo" is built and tested; a second one would drift | No — architectural |
| Reuse the canvas engine for chart modules | The prompt asks for a shared layer rather than a dependency | Yes — the adapter is the seam |
| Scripted scenarios behind the structured contract | Demonstrates with no API key, and proves the boundary before a model is behind it | Yes — that is the point of the boundary |
| Prototype's review switchers dropped | Persona is session state; breakpoint is the viewport | — |

## Not in this plan

A real model behind the orchestrator, realtime streaming, and a strategy
runtime. Each is its own piece of work and none is in the acceptance list.
