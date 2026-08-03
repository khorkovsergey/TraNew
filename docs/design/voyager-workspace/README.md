# Handoff: AI Voyager Workspace (TradingNew)

## Overview

AI Voyager becomes a first-level item in the portal navigation. Clicking it opens a **full-screen, AI-native financial workspace** — not a stretched chat. The user describes a goal in natural language; Voyager picks the tools, assembles a canvas of interactive financial modules, explains the result with its sources, and can take actions inside the platform (charts, indicators, screeners, watchlists, monitoring rules, scenarios) — always with confirmation and always undoable.

Product statement: **from a question to a chart, insight and action.**

Target repo: `khorkovsergey/TraNew` (Next.js App Router, `next-intl`, CSS Modules, tokens in `src/app/tokens.css`, existing embedded assistant in `src/components/voyager/**`).
Intended route: `src/app/[locale]/voyager/page.tsx` + `src/components/voyager/workspace/**`.

## About the design files

`Voyager Workspace.dc.html` is a **design reference written in HTML** — a live, clickable prototype of the intended look and behaviour, not production code. It runs on a small in-house runtime (`support.js`); do **not** port that runtime. Recreate the design with the repo's own patterns: React client components, CSS Modules, `next-intl` messages, `Icon.tsx`, the tokens already in `src/app/tokens.css`. Where this README gives a hex value or a size, it is final; where it describes behaviour, implement it idiomatically.

Open the prototype by opening the `.dc.html` file in a browser (keep `support.js` beside it).

## Fidelity

**High fidelity.** Palette, typography, spacing, module anatomy, copy and interaction are final and match the TradingNew portal (light theme, Plus Jakarta Sans). Deliberately schematic: chart rendering is hand-built SVG for demonstration — in production use the repo's charting layer; only the visual language transfers.

## How to review the prototype

Two controls in the top bar:

- **New / Returning** — the two landing states (first-time vs personalised).
- **D / T / M** — desktop, tablet (1024) and mobile (430) layouts.

Then click any example request on the landing page. Ten scenarios run end to end: market summary, technology sell-off, symbol comparison, chart construction, Pine Script (with a deliberate error → fix → valid), natural-language screener, portfolio with a permission gate, beginner journey, monitoring rule, and the carried-over context from the embedded assistant ("gold" example). The free-text input routes on keywords (chart, screen, portfolio, monitor, compare, pine, gold, market).

## Screens and layout

### Shell

Full-viewport flex column on `#ffffff`; the page behind the frame is `#f4f6fb`.

| Zone | Geometry |
|---|---|
| Top bar | h 56, bottom border 1px `#eceff4` |
| A · Conversation | w 348 (recommended range 300–460), right border `#eceff4`; collapses to a 46px rail |
| B · Canvas | flex, `#fbfcfe`, content column max 1100, padding 16 |
| C · Inspector | w 312, left border `#eceff4`; below 1180px becomes an overlay (`min(330px,86vw)`, scrim `rgba(19,23,34,.16)`, shadow `-18px 0 44px rgba(19,23,34,.12)`) |
| Mobile | one zone at a time via a 56px bottom tab bar: Chat · Canvas · Context · Sources |

Zone A never dominates: it is a fixed sidebar, collapsible to a rail, and the canvas takes the remaining width.

### Top bar

TN monogram 28×28 (radius 9, `linear-gradient(135deg,#2962ff,#8b5cf6)`), the Voyager orb (20px, `radial-gradient(circle at 35% 30%,#ffffff,#f2f3f8 55%,#dde1ec)` with inset shadows) and the wordmark "AI Voyager" 15.5px/800/-0.3. Then the workspace title 13.5px/700 with a **NAMED BY VOYAGER** badge (9.5px/800 on `#efe9fd`/`#7c4dff`) until the user saves or renames, and a meta line 11px `#9aa3b5` ("8 modules · 3 sources · autosaved"). Right side: **Workspaces**, **Save**, **Share** (below 1280px Save/Share become 34px icon buttons with `title`+`aria-label`), **Context** when the inspector is an overlay, and a close control back to the portal.

### Navigation entry (portal side)

In the portal header the Voyager entry is a pill: `#f6f2fe` fill, 1px `#e6dcfb` border, radius 20, 12.5px/700 `#4a3a7a`, the 19px orb on the left, hover border `#7c4dff`. Below 1080px the label drops and only the orb remains (keep `aria-label`/`title`). It is differentiated but quiet — no glow, no animation, no "AI" sticker.

### Zone A — conversation

Header "CONVERSATION" (10.5px/800/0.9 `#9aa3b5`) + **New** + collapse.
Empty state: orb, one-line greeting (13px/800) and an intro (12.5px `#5a6376`), then SHORTCUTS as `/chart /screen /compare /script /portfolio /monitor` pills.
A turn: the user bubble right-aligned on `#f2f4f9` (radius 14/14/4/14), then a mode chip (per-mode tint) with a spinner and a live status line, then the **plan card** (`#fbfcfe`, border `#eceff4`, radius 14) whose steps tick green as work completes, with **Stop and keep what is ready** while running; then the summary paragraph and a SUGGESTED NEXT list.
Composer: textarea in a 18px-radius container, plus voice and attach icon buttons and a violet 34px send button. Under it: the credit meter (`37 / 100 AI messages`, bar `#7c4dff`, amber `#b07708` past 85%) and the plan label opening the plans modal.

### Zone B — canvas

Canvas bar (only once a request exists): mode chip, workspace name, state ("Building…" / "Complete"), and view switch **Canvas · Split · Full chart**.

### Empty state — the product's most important screen

**Simple by default; complexity only after a request.** With no request in flight the canvas is the ONLY zone rendered: a centred column, max-width 720 (900 once examples are expanded), top padding 9vh (28px mobile), containing

1. headline 32px/800/-1 "What would you like to understand, build or monitor?" (returning user: 42px orb + "Good morning, Alex." 26px/800 + a one-sentence briefing + four personalised cards that each state **why** they are shown),
2. one supporting line 15px `#5a6376`,
3. the hero composer — white, 1px `#e2e6ee`, radius 20, padding 12/12/12/20, shadow `0 8px 26px rgba(19,23,34,.07)`, an auto-growing single-row textarea at 15px plus voice / attach / send (38px, send violet),
4. five one-line starters — plain rows, radius 12, 15px muted leading icon, 13.5px/600 text, chevron on the right, hover `#f2f4f9`,
5. one row with two quiet links: **More things I can do** (`#7c4dff`, toggles the five prompt categories below a hairline) and **Sign up and get 3 000 free tokens**.

Zone A, zone C, the canvas toolbar and the floating sign-up CTA are **not rendered at all** in this state. They mount when the first request exists, which is what makes the transition from simple to powerful legible. "New" returns to the bare screen. Do not add widgets, stats, tips or recommendation rails here.

Behind **More things I can do**: five editorial categories — Understand the market · Find an opportunity · Analyse and compare · Build and test · Manage my wealth and watch the market — each a titled group of prompt cards (24px tinted icon tile, 12.5px/600 question, `PRO` badge where the plan gates it). Not a wall of identical chips.

Modules: white cards, 1px `#e6eaf2`, radius 18, padding 16/18, appearing one at a time (`vwIn` 280ms). Every card has a title, optional sub-line, an optional tag, and its own action buttons (Open in Supercharts, Save, Create alert, Create watchlist, Add a company, Apply to chart, Edit assumptions…). Implemented module types:

`text insight` · `metric row` · `chart` (line, multi-line rebased, candles with RSI pane and detected zones, allocation bar, scenario fan, monitor threshold, scatter) · `sector heatmap` (sign + label, never colour alone) · `ranked rows` (movers, screener results, risks, groupings) · `comparison table` · `news timeline` · `interpreted filters` (editable and removable, with "This is not what I meant") · `Pine editor` (line numbers, syntax colours, error line tint, diagnostics card, parameter steppers, version chips) · `permission request` (scope checkboxes + privacy rows) · `monitoring rule` (rule grid + threshold chart + enable) · `guided questions` (beginner) · `next actions` · `error/partial`.

Provenance labels sit at the bottom of a card: **Market data** `#e8edfd`/`#2962ff` · **Your data** `#f6f2fe`/`#7c4dff` · **Voyager inference** `#fdf3e3`/`#b07708` · **Educational** `#e3f6ec`/`#1aa966`.

Working card: spinner + current step, the work checklist ticking green, and a violet progress bar.

### Zone C — inspector

CONTEXT IN USE (key/value rows, editable ones carry a pencil that re-computes the workspace) · WEALTH HUB (status badge NOT CONNECTED / CONNECTED, what is shared, connect or revoke) · SOURCES & TIMESTAMPS (typed cards: MARKET DATA, FILINGS, ESTIMATES, YOUR DATA, EDUCATIONAL, DETECTION, CARRIED CONTEXT — each with provider and time) · ASSUMPTIONS (amber, editable — editing re-runs the result) · MONITORING RULES · WORKSPACE HISTORY · a standing note that this is educational analysis, not personalised advice.

### Workspaces library

Modal (max 760, radius 20, shadow `0 26px 70px rgba(19,23,34,.2)`): search, filter pills (All / Pinned / Charts / Screeners / Scripts / Wealth), and rows with name, PINNED badge, contents summary and per-row Open / Duplicate / Pin / Delete. Example names come from real work: *AI Infrastructure Research*, *Gold Macro Analysis*, *US Dividend Opportunities*, *Family Wealth Plan*, *Tesla Trend Reversal Indicator*.

### Sign-up and free tokens

Guests get 100 free messages; signing up grants **3 000 tokens**. Two surfaces, both quiet:

- Landing: a text link "Sign up and get **3 000** free tokens →" beside the More link.
- Workspace mode: a horizontal floating card bottom-right (right 16, bottom 16; mobile left/right 12, bottom 64) — 30px orange gradient tile with a bolt, "3 000 free tokens" 12.5px/800, "≈ 40 questions · no card required" 11px `#8a93a6`, an orange gradient **Sign up free** pill (radius 20) and a dismiss ×. The canvas scroll container reserves matching space: **74px** desktop, **130px** mobile (CTA + tab bar). Nothing floats over content without a reserved allowance.

The modal lists four perks (tokens, saved workspaces, monitoring that keeps running, data only with permission) and offers Create a free account / I already have an account. After sign-up the CTA disappears and the composer meter switches from "37 / 100 free messages · Guest" to "3 000 tokens left · Free account".

## Plans and limits

Modal with Free / Pro / Private AI, the current plan marked, and one sentence explaining *why* a feature needs a plan. The first request is never paywalled; limits apply to deep research, screeners, Pine Script and Wealth Hub analysis. The credit meter turns amber before it runs out.

## Execution lifecycle (must be implemented as designed)

`understanding` (≈500ms, "Understanding your request…") → `planning` (the plan card appears, 3–4 user-facing steps — never chain-of-thought) → `working` (named work items tick off: "Screening 4 218 companies", "Validating Pine Script") → `partial` (modules appear progressively, useful ones first) → `complete` (summary, sources, assumptions, suggested next actions). Any point: **Stop** keeps everything already built. Failure states are explicit, name the cause, and offer a recovery action.

## Interaction rules

- Nothing that changes the user's charts, workspace or data happens without confirmation; every applied change is recorded in workspace history and undoable.
- AI-created objects are labelled and stay editable and persistent.
- The user can correct interpretation: filters, assumptions, context rows and script parameters are all editable in place, and the result re-computes.
- Wealth Hub data is read only after a scope-level permission request, for that analysis, revocable in one click from the inspector.
- Direction is never colour-only: ▲/▼ glyphs, signs and words accompany every green/red.
- Motion communicates state: module assembly 280ms, spinner 800ms, panels 180ms, overlays 300ms; `prefers-reduced-motion` disables all of it.

## State model

```
persona, device                       // review-only in the prototype
zoneA, zoneC (+ narrow overlay flag)
scenario / request, stage, revealedModules, workStep, stopped
turns[], modules[], sources[], assumptions[], rules[], history[]
workspaceName + autoNamed, view (canvas|split|full)
wealthHub {status, scopes{}}
codeState, codeParams, monitorEnabled, filters{}, beginnerAnswers{}
credits, plan, library/plan modals, toast, mobileTab
```

Server side: intent + plan endpoint returning a **structured plan** `{mode, steps[], work[], modules[], sources[], assumptions[]}` — the UI renders only declared modules, never parsed prose; module data endpoints (market, symbol, fundamentals, screener, portfolio, script validation); workspace CRUD with pin/duplicate/share/export; monitoring rule CRUD; permission grants scoped and revocable.

## Design tokens (portal light set)

```
surface        #ffffff   canvas #fbfcfe   page #f4f6fb   raised #f7f9fc   hover #f0f3f8   chip #f2f4f9
border         #eceff4 structure · #e6eaf2 cards · #e2e6ee controls · #c9d4f5 focus/active
text           #131722 · #3a4254 · #5a6376 · #8a93a6 · #9aa3b5
blue           #2962ff (tint #e8edfd)          violet/AI #7c4dff (hover #6a3de8, tints #efe9fd/#f6f2fe, border #e6dcfb, deep #4a3a7a)
green/up       #1aa966 (tint #e3f6ec, border #c8ecd8, deep #127a4b)
red/down       #e0492f (tint #fdecea, border #f5cdbd, deep #8c2f1c)
amber          #f4a71f (tint #fdf3e3, border #f0dcb0, text #b07708)
heatmap        up #f2fbf6/#cdeddd/#127a4b · down #fdf1ee/#f6d5cb/#c33c22
chart          grid #f2f4f9 · series #2962ff #7c4dff #1aa966 #e0492f #f4a71f · muted #c9d4f5
radius         5–7 chips · 10–20 controls · 13–18 cards · 20 modals
shadow         modal 0 26px 70px rgba(19,23,34,.2) · overlay panel -18px 0 44px rgba(19,23,34,.12)
spacing        4px base · card padding 16/18 · zone padding 14 · gaps 6–12
```

## Typography

Plus Jakarta Sans 400–800. 9.5–10.5 uppercase labels (+0.4–0.9 tracking) · 11–11.5 meta · 12.5–13.5 body and tables · 14 card titles · 15–18 metric values · 26–32 landing headlines. All figures `font-variant-numeric: tabular-nums`. Code: JetBrains Mono 11.5/1.75. Hierarchy must keep question, interpretation, data, conclusion, source, assumption, action and editable control visually distinct — the prototype does this with weight and label chips, not with many font sizes.

## Icons

Stroke 1.9–2.2, 24 viewBox, rendered 13–19px, `currentColor`, round caps, no fills. Use the repo's `Icon.tsx`. AI is the orb mark only — no robots, no sparkles, no space imagery. Every icon-only control needs `title` + `aria-label`.

## Accessibility

AA contrast throughout; direction carried by glyph and wording as well as colour; visible focus rings; the canvas is a landmark-labelled region; module cards are headings + content, not decorative divs; tables keep real header cells; charts carry a text summary in the adjacent insight card; mobile targets ≥44×44; reduced motion honoured; keyboard path top bar → conversation → composer → canvas → inspector.

## Files in this bundle

- `Voyager Workspace.dc.html` — the interactive design (New/Returning + D/T/M switchers in the top bar; ten scenarios from the landing page).
- `support.js` — runtime the prototype needs; not for production.
- `PROMPT.md` — ready prompt for Claude Code.

Related, already handed off separately: `design_handoff_superchart_voyager/` (Supercharts + embedded Voyager) — this workspace links into it via "Open in Supercharts".
