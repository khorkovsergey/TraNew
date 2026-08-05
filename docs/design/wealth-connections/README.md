# Handoff: TradingNew — Marketplace Subscriptions + Wealth Hub Connections

Target repository: **TraNew** (Next.js App Router, `next-intl`, CSS Modules, Drizzle).
Everything below was designed against that repo's real design system — do not invent new tokens.

---

## Overview

Three deliverables in this bundle:

1. **`TradingNew Subscriptions.dc.html`** — Task A. A new `/marketplace/subscriptions`
   page: five plans (Essential, Plus, Premium, Ultimate, Voyager Private), a monthly/annual
   billing toggle, a "Why Voyager Private is different" block, and a nine-group feature
   comparison table with a "Show differences only" filter. Desktop (1512px) and mobile (390px)
   frames side by side. → **Part 1**
2. **`TradingNew Wealth Connections.dc.html`** — Task B. Account connection inside the
   **existing** `Data & Connections` tab of the Wealth Hub: provider picker, consent screen,
   import review, connected-source management, disconnect-to-manual. Fully interactive.
   → **Part 2**
3. **`TradingNew Portal.dc.html`** — supporting analysis mocks from an earlier step: Home as-is
   vs. a task-based Home, a Market guided-discovery page, a Symbol page with quick wins, and a
   code-audit board. Reference only, not scoped work. → **Part 3**

The two tasks are independent — implement them in either order.

## About the Design Files

The three `.dc.html` files in this bundle are **design references written in HTML**. They are
prototypes that show intended look and behaviour — **not production code to copy**. They run in
a streaming component runtime (`support.js`, included so the files open in a browser) and use
inline styles, which the target repo does not.

Your task is to **recreate these designs inside TraNew's existing environment**: React Server /
Client Components under `src/app/[locale]/…`, CSS Modules under `src/components/…`, copy in
`src/messages/en.json`, and design values from `src/app/tokens.css`. Never port inline styles.

Open the files by double-clicking; `support.js` must stay in the same folder.

## Fidelity

**High-fidelity.** Every colour, radius, shadow, font size and weight in the mocks was lifted
from the repo's own files (`tokens.css`, `Header.module.css`, `Symbol.module.css`,
`Home.module.css`, `Marketplace.module.css`, `Markets.module.css`, `Ecosystem.module.css`,
`Icon.tsx`). Recreate pixel-for-pixel, but express the values as `var(--tn-*)` tokens and
existing module classes rather than literals wherever a token exists.

---

# PART 1 — Subscriptions page (the task)

## Route & scope

- Route: `/[locale]/marketplace/subscriptions`
- Frontend only. No checkout, no billing provider, no entitlements, no feature gating, no
  backend, no DB.
- **Voyager Private capabilities are plan copy only.** Do not build the Vault, Knowledge Graph,
  Digital Twin, persistent memory, proactive intelligence or Deep Research. Report them as
  presented, never as implemented.

## Navigation integration

There is **no category chip row** on Marketplace — the hub (`src/app/[locale]/marketplace/page.tsx`)
is a `.cardGrid` (2 columns, gap 16, `margin-top:36px`) of `.taskCard`s. So:

1. Add a fifth entry to the `CATEGORIES` array in `marketplace/page.tsx`:
   `{ key: 'subscriptions', href: '/marketplace/subscriptions', icon: 'star', color: 'var(--tn-purple)', tile: 'var(--tn-purple-tint)' }`
   (pick a different `IconName` if `star` is already used by Merch — `pie` or `shield` both fit.)
2. Add the same destination to the `marketplace` group in `src/components/shell/menu.ts`.
   The two lists are compared by a verification script — they must agree.
3. Add copy keys under `marketplace.hub.*`: `subscriptionsTitle`, `subscriptionsText`,
   `subscriptionsCta` ("Compare plans").
4. Breadcrumbs on the new page: Home / Marketplace / Subscriptions, using the existing
   `.crumbs` treatment from `Markets.module.css` (see tokens below). Reuse `MarketBreadcrumbs`
   if you want the JSON-LD, or copy its pattern.

Do not restyle anything else in Marketplace.

## Screens / Views

### Screen 1 — Subscriptions, desktop (design width 1512, content `max-width:1440`, padding `26px 36px 56px`)

Vertical order:

1. **Breadcrumbs** — `.crumbs`
2. **Page header**, centred
   - Eyebrow: `TRADINGNEW SUBSCRIPTIONS` — 12.5px / 800 / letter-spacing 1px / `--tn-purple`
   - H1: "Plans for every level of market ambition" — 44px / 800 / ls −1.6px / line-height 1.12,
     `margin-top:12px`
   - Lead: "Start with the tools you need today. Upgrade as your research, strategy and financial
     context become more advanced." — 17.5px / `--tn-text-secondary` / lh 1.5 / max-width 660 /
     `margin-top:14px`
   - Sub-lead: "Every plan includes Voyager AI. Higher plans unlock deeper analysis, longer
     context and more advanced research capabilities." — 14.5px / `--tn-text-muted` / max-width 620
3. **Billing toggle** (`margin-top:30px`, centred, gap 14)
   - Segmented control: track `--tn-chip-bg`, radius 22, padding 4. Buttons radius 20,
     padding `9px 22px`, 13.5px / 700. Selected: `background:#fff`, `color:--tn-text`,
     `box-shadow:0 1px 4px rgba(19,23,34,0.10)`. Unselected: transparent, `--tn-text-secondary`.
   - `role="group" aria-label="Billing period"`, `aria-pressed` on each button.
   - Savings chip: "Save up to 20%" — `--tn-green-tint` bg, `--tn-green` text, radius 16,
     padding `7px 14px`, 12.5px / 800.
4. **Progression strip** (`margin-top:26px`, centred, 12.5px / 700 / ls 0.4px / `--tn-text-muted`)
   `EXPLAIN → ANALYZE → CREATE → AUTOMATE → DELEGATE`, arrows `#dfe3ec`, last word `--tn-purple`.
   Secondary by design — never louder than the cards.
5. **Pricing grid** — `grid-template-columns:repeat(5,1fr)`, gap 16, `align-items:stretch`,
   `margin-top:24px`. All five cards equal height (measured 1076px at 1512 width).
6. **"Why Voyager Private is different"** block, `margin-top:56px`
7. **Comparison section** (`id="compare"`), `margin-top:56px`
8. **Bottom CTA row** aligned to the table columns
9. **Legal note** — 12.5px / `--tn-text-muted`
10. **"How it enters the Marketplace hub"** block — documentation of item 1–3 above, plus the
    new hub card rendered in real `.taskCard` styling. **This block is documentation for you; do
    not ship it.**

#### Plan card anatomy

Base card: `--tn-surface`, `1px solid --tn-border-card`, radius `--tn-radius-card` (18),
padding `24px 22px`, `display:flex; flex-direction:column`.

Order inside: badge slot (fixed 24px tall so names align across cards) → plan name (19px / 800 /
ls −0.4) → tagline (13.5px / `--tn-text-secondary`) → price (31px / 800 / ls −1px, `.tn-num`) +
"/ month" (13px / `--tn-text-muted` / 600) → billing note (12.5px / `--tn-text-muted`) →
savings line (12.5px / 700 / `--tn-green`, `min-height:19px` so cards don't jump when it empties
on monthly) → CTA (radius 22, padding `11px 16px`, 13.5px / 700, full width) → divider
`1px solid #f0f2f7` → Voyager block → divider → `PLATFORM` block (11.5px / 800 / ls 0.6 /
`--tn-text-muted` label) → `See all features →` (12.5px / 700 / `--tn-blue`, `margin-top:auto`,
anchors to `#compare`).

Voyager block header: 15px orb (radial-gradient `circle at 34% 30%, #b79bff, #7c4dff 62%, #4a3a7a`
— same orb as `VoyagerOrb`) + tier name 13px / 800 / `--tn-purple-deep`. Then the Voyager
description 12.5px / `--tn-text-secondary` / lh 1.5, then the capability list.

Feature rows: `display:flex; gap:8px`, 12.5px / `--tn-text-nav` / lh 1.45, with a 14px
`Icon name="check" strokeWidth={2.5}` (`margin-top:3px`, `flex-shrink:0`) — **purple** for AI
capabilities, **blue** for platform capabilities. "Everything in X" rows are `font-weight:700`.

Per-plan differences:

| Plan | Badge | Card border | CTA | Notes |
|---|---|---|---|---|
| Essential | — | `1px --tn-border-card` | outline blue (`#fff` bg, `1px --tn-blue`, blue text) | |
| Plus | — | same | outline blue | |
| Premium | `Most popular` — `--tn-blue-tint` bg / `--tn-blue` text / radius 13 / `4px 11px` / 11.5px 800 | `2px solid --tn-blue`, padding `23px 21px`, `box-shadow: --tn-shadow-card-hover` | solid `--tn-blue` | recommended mainstream plan |
| Ultimate | `Professional` — `--tn-chip-bg` bg / `--tn-text-nav` text | `1px --tn-border-card` | solid `--tn-text` (`#131722`) | |
| Voyager Private | `Private AI` — solid `--tn-purple` bg / white text | `2px solid --tn-purple`, padding `23px 21px`, `background:linear-gradient(180deg,#f6f2fe 0%,#ffffff 240px)`, `box-shadow:0 14px 40px rgba(124,77,255,0.16)` | solid `--tn-purple` | plan name in `--tn-purple-deep`; secondary text link "Learn about Voyager Private" (12.5px / 700 / purple, anchors to `#why-private`); the AI capability list sits in its **own white sub-card**: `#fff`, `1px solid --tn-purple-border`, radius 14, padding 16 |

None of the four cheaper cards may look disabled. Voyager Private must not be larger than the others.

**Fair-use tooltip** — an `i` button (15px circle, `--tn-purple-tint` bg, `--tn-purple` text,
10px / 800, `aria-label="Fair-use policy details"`) next to "Unlimited Voyager AI". On activation
reveal `role="tooltip"`: `#131722` bg, white, radius 10, padding `10px 12px`, 11.5px / lh 1.5 —
"Unlimited for normal individual usage. Automated abuse and excessive machine-generated traffic
may be restricted under the fair-use policy." Presentation copy only; no usage monitoring.

#### "Why Voyager Private is different"

`id="why-private"`. Card: `#fff`, `1px solid --tn-purple-border`, radius 18, padding 32.
H2 26px / 800 / ls −0.8 / `--tn-purple-deep`. Body 15.5px / `--tn-text-nav` / max-width 840.
Then a 4-column grid (gap 16) of eight tiles: seven capabilities on `--tn-purple-tint-soft`
(`#f6f2fe`), radius 14, padding 18 — title 14px / 800 / `--tn-purple-deep`, body 12.5px /
`--tn-text-secondary` / lh 1.5 — plus a final `--tn-chip-bg` tile carrying the disclaimer
"These capabilities are presented as plan contents. Availability is announced separately as each
one ships."

The seven, with exact copy, in this order: Unlimited Voyager AI · Persistent private context ·
Autonomous Deep Research · Private Financial Vault · Personal Knowledge Graph · Portfolio
Digital Twin · Proactive Private Intelligence. (Full descriptions are in the HTML — copy them
verbatim into `en.json`.)

#### Comparison table

Header row above the table: H2 "Compare all plans" (30px / 800 / ls −0.9) + sub 15.5px /
`--tn-text-secondary`; on the right, the **Show differences only** toggle button — radius 22,
padding `10px 18px`, 13px / 700; off: `#fff` + `1px --tn-border-control`; on: `--tn-blue-tint` bg,
`1px --tn-blue`, `--tn-blue` text; `aria-pressed`.

Table container: `#fff`, `1px --tn-border-card`, radius 18, `overflow:hidden`, `margin-top:20px`.

- **Sticky header** — `position:sticky; top:0; z-index:5`, `grid-template-columns:2fr repeat(5,1fr)`,
  `--tn-chip-bg` bg, `1px --tn-border-control` bottom. Feature cell: padding `16px 22px`,
  11.5px / 800 / ls 0.5 / `--tn-text-secondary`, text "FEATURE". Plan cells: padding `16px 12px`,
  13px / 800, centred; Premium in `--tn-blue`; Voyager Private in `--tn-purple-deep` on a
  `#f6f2fe` background.
- **Group header** (one per category) — full-width button, `padding:14px 22px`, 12.5px / 800 /
  ls 0.5 / uppercase, `border-top:1px --tn-border-control`, background `#f8f9fc`
  (`--tn-purple-tint` `#efe9fd` with `--tn-purple-deep` text for the *Private intelligence*
  group). Caret `▾` rotates −90° when collapsed, `transition: transform 0.18s ease`.
  `aria-expanded` on the button.
- **Feature row** — `grid-template-columns:2fr repeat(5,1fr)`, `border-top:1px solid #f0f2f7`,
  `align-items:center`. Name cell padding `13px 22px`, 13.5px / 600; optional description
  12px / `--tn-text-muted` / lh 1.45 / `margin-top:3px`.
- **Value cell** — padding `13px 12px`, centred, 12.5px, flex-centred so the cell tint fills the
  row height. Voyager Private column always `background:#f6f2fe`, values 800 weight in
  `--tn-purple-deep`; other columns 700 in `--tn-text`.
  - `true` → `✓`, 15px / 800, `--tn-green` (`--tn-purple` in the Private column)
  - `null` → `—`, `--tn-text-faint`. A dash, never a lock.
  - string → the literal value.
  - Every cell carries a screen-reader label: `Included in Premium` / `Not included in Essential`
    / `Up to 7 days in Plus`.

Groups, in order, with default state: **Voyager AI (expanded)** · Charts and analysis ·
Alerts and monitoring · Data and exports · Pine Script and strategies · Portfolio and Wealth ·
Memory and personalization · **Private intelligence (expanded)** · Support.

**Show differences only** hides any row whose five values are all equal (with the shipped data
that is exactly two rows: "Contextual chart explanation" and "Symbol and market-page questions").

**Bottom CTA row** — same 6-column grid so buttons sit under their columns. Left cell:
"Ready to choose?" 13.5px / 700 / `--tn-text-secondary`. Buttons radius 22, padding `10px 12px`,
12.5px / 700, full width, same per-plan colours as the cards.

### Screen 2 — Subscriptions, mobile (390px)

The five-column table does **not** shrink. Instead:

- Header: 28px H1, 14.5px lead. Breadcrumbs unchanged.
- Billing toggle fills the row (`flex:1` buttons, padding `9px 8px`, 13px); savings chip "Save 20%".
- **One plan card per view** — Premium shown as the default; horizontal snap carousel with
  pagination dots below (active dot is a 22×6 rounded bar; the Voyager Private dot is
  `--tn-purple` so the premium plan stays identifiable when off-screen). Card padding 20,
  price 32px, body text 13px — nothing shrinks below 12px.
- **Comparison = two columns, always.** A horizontally scrollable plan-selector chip row above
  it (Essential · Plus · Premium · Ultimate · Private; selected chips filled — blue for a normal
  plan, `--tn-purple` for Private). The table then renders `1.4fr 1fr 1fr`: feature name plus the
  two selected plans, with the same group headers and the same tint on the Private column.
- Rows shown in the mock are a representative subset; ship all groups, two columns at a time.

## Interactions & Behavior

| Interaction | Behaviour |
|---|---|
| Billing toggle | Switches all five displayed prices, the billing note and the savings lines. Default **Annually**. Local component state only. |
| Price change | Restrained transition only — no counters, no bouncing. Respect `prefers-reduced-motion`. |
| Group header click | Expands/collapses that group; caret rotates 180ms ease. |
| Show differences only | Filters rows client-side. |
| Fair-use `i` | Toggles the tooltip. Keyboard-reachable, dismissible with Escape. |
| Any "Choose …" CTA (10 of them) | If a signup/subscription destination already exists in the repo, link to it. Otherwise show a toast: **"Subscription checkout is coming soon."** — `#131722`, white, radius 24, padding `12px 22px`, 13.5px / 600, `--tn-shadow-dropdown`-scale shadow, auto-dismiss ~2.6s, `role="status"`. Use `position:fixed` bottom-centred in production so it is visible from any scroll position. |
| "See all features →" / "Learn about Voyager Private" | In-page anchor scroll to `#compare` / `#why-private`. |

Nothing else. No checkout page, no billing modal.

## State Management

Local client state on the page component only:

```ts
billingPeriod: 'monthly' | 'annual'          // default 'annual'
openGroups: Record<string, boolean>          // voyager + private true by default
differencesOnly: boolean                     // default false
fairUseTooltipOpen: boolean
toast: string | null
mobileComparePlans: [SubscriptionPlanId, SubscriptionPlanId]   // default ['premium', 'voyager_private']
```

No data fetching. No persistence.

## Pricing data structure

One typed config, prices in a single place:

```ts
type SubscriptionPlanId = 'essential' | 'plus' | 'premium' | 'ultimate' | 'voyager_private';

interface SubscriptionPrice {
  monthly: number;
  annualMonthlyEquivalent: number;
  currency: 'EUR';
}
```

| Plan | Monthly | Annual (monthly equivalent) | Annual saving (derived) |
|---|---|---|---|
| Essential | €15.95 | €12.95 | €36 / year |
| Plus | €35.95 | €29.95 | €72 / year |
| Premium | €71.95 | €59.95 | €144 / year |
| Ultimate | €239.95 | €199.95 | €480 / year |
| Voyager Private | €399.95 | €299.95 | €1200 / year |

Savings are **computed**: `Math.round((monthly − annualMonthlyEquivalent) * 12)`, rendered as
`Save €{n} per year`. Never hardcode a savings value. Billing note: `Billed annually` /
`Billed monthly`; the savings line is empty on monthly.

Suggested files, following repo conventions:

- `src/content/subscriptions.ts` — `SUBSCRIPTION_PLANS` (id, name, badge, tagline, voyagerTier,
  voyagerDescription, pricing, aiHighlights[], platformHighlights[], featured, privateTier)
- `src/content/subscriptionComparison.ts` — `CATEGORIES` with rows whose `values` are
  `string | true | null` in plan order
- `src/components/marketplace/Subscriptions.module.css`
- `src/components/marketplace/SubscriptionCard.tsx`, `BillingPeriodToggle.tsx`,
  `SubscriptionComparisonTable.tsx`, `ComparisonCategory.tsx`
- `src/app/[locale]/marketplace/subscriptions/page.tsx`

All user-facing strings go through `next-intl` (`en.json`) — the mock hardcodes English because
it is a mock. Localisation copy is English-only for now, matching the repo.

The complete plan copy, all AI/platform highlight lists and the full comparison matrix (52 rows
across nine groups) are in the logic block of `TradingNew Subscriptions.dc.html` — take them
verbatim rather than retyping.

## Accessibility

- Semantic headings h1 → h2 → h3; the comparison table uses a real `<table>` (or `role="table"`
  with row/cell roles) in production — the mock uses CSS grid for layout convenience only.
- Segmented control: `role="group"` + `aria-pressed`. Group headers: `aria-expanded`.
- Every `✓` / `—` needs a screen-reader label ("Included in Premium", "Not included in Essential").
- Plans are never distinguished by colour alone — badges and text carry the meaning.
- Visible focus: the repo's global `:focus-visible { outline: 2px solid var(--tn-blue); outline-offset: 2px }`.
- Honour the global `prefers-reduced-motion` block in `globals.css`.
- Tooltip reachable and dismissible by keyboard.

## Responsive behavior

| Breakpoint | Cards | Comparison |
|---|---|---|
| ≥1440 | 5 in one row | full 6-column table, sticky header |
| 1100–1439 | 3 + 2, or a snap-scrolling row | full table, horizontal scroll with the feature column sticky |
| tablet ~768–1099 | 2 per row | 2–3 plan columns at a time via the plan selector |
| ≤767 | 1 per row / swipe carousel | feature column + exactly 2 selected plans |

Never compress five cards into an insufficient viewport; never shrink text below 12px.

---

# PART 2 — Wealth Hub: account connections (Task B)

## Scope and where it goes

**Do not create a new module or a new tab.** `WEALTH_TABS` in `src/content/wealth.ts` already
has `{ id: 'data', label: 'Data & Connections' }`, and `WealthScreen.tsx` renders it as a flat
list of four `DATA_SOURCES` cards plus a Privacy block. This work **deepens that existing tab**:

- source cards become expandable (permissions, consent expiry, assets created by the source)
- the existing `Bank accounts · Not connected` placeholder row becomes the entry point to a real
  connect flow
- a `Connect an account` + `Sync all` action row is added above the list
- the Privacy block below stays exactly as it is

Frontend only. **No real aggregator integration** (Plaid / TrueLayer / SnapTrade / GoCardless),
no OAuth, no credential handling, no money movement, no order placement. The provider list and
account data are demo fixtures.

## Screen — Data & Connections (design width 1232, content `--tn-page-max` 1160, padding `26px 36px 56px`)

Order: breadcrumbs → page header (H1 34px / 800 / ls −1.1 + `Net Wealth €1.21M · Liquid €172K ·
1 valuation needs updating`, the last clause in `--tn-amber-text` 700) → the existing
`.tabs` row with `Data & Connections` active → **section header row** → **source list** →
`SOURCE_NOTE` → `Privacy`.

**Section header row:** left, H2 "Connected sources" (`.sectionTitle`, 17px / 800 / ls −0.3) with
a computed sub-line ("4 sources connected · 7 assets kept up to date automatically"). Right,
`Sync all` (outline pill) and `Connect an account` (solid `--tn-blue` pill, radius 22,
padding `10px 18px`, 13.5px / 700).

### Source card

`.card` (`--tn-surface`, `1px --tn-border-card`, radius 18, padding `24px 26px`); a
just-connected card gets a `--tn-green` border until the next interaction.

Header row: 40×40 provider mark (radius 12, solid brand colour, white initials 13.5px / 800) →
name (16px / 800) + status chip + optional `Just connected` chip → sub-line (13.5px
`--tn-text-secondary`) → `Sync now` / `Reconnect` outline pill → `Details` text button
(13px / 700 / `--tn-blue`, `aria-expanded`).

Status chips reuse the tab's existing tone map: `Connected` → `--tn-green-tint` / `--tn-green`;
`Active` → `--tn-blue-tint` / `--tn-blue`; `Not connected` / `Disconnected` → `--tn-chip-bg` /
`--tn-text-muted`.

Expanded body (`border-top:1px #f0f2f7`, `margin-top:18px; padding-top:16px`): a 3-column grid
of `PERMISSIONS` / `LAST SYNC` / `CONSENT EXPIRES` (labels 10.5px / 700 / ls 0.6 /
`--tn-text-faint` — the existing `.snapKey` treatment; values 13.5px `--tn-text-nav`), then
`ASSETS CREATED BY THIS SOURCE` — rows on `--tn-chip-bg`, radius 14, padding `12px 16px`, name
13.5px / 700 + `Connected` chip on the left, value 13.5px / 800 `.tn-num` right — then three
actions: `Edit permissions`, `Sync now`, and `Disconnect` (outline `--tn-red`, `1px #f5cdbd`).

Row order in the list: TradingNew Portfolios · NorthBridge Securities · *(newly connected sources
appear here)* · **More banks and brokers** (the placeholder, mark `+` on `#c9cfdb`, opacity .85,
`Browse` CTA) · Manual sources.

## The connect flow — modal, 3 steps

Overlay `--tn-overlay` (`rgba(19,23,34,0.4)`); dialog 600px wide, `--tn-surface`, radius 20,
`--tn-shadow-modal`, `role="dialog" aria-modal="true"`, scrollable body. Header: title 18px / 800
+ step line ("Step 2 of 3 · review permissions") 12.5px `--tn-text-muted`, and a 32px circular
close button on `--tn-chip-bg`.

### Step 1 — provider picker

Non-functional search affordance (`--tn-chip-bg` pill, radius 24, `search` icon,
"Search for your bank, broker or exchange"). Filter chips **All · Banks · Brokers · Crypto**
(selected: solid `--tn-text`). Provider rows: `#fff`, `1px --tn-border-control`, radius 14,
padding `12px 16px`, 38px mark + name 14.5px / 700 + sub 12.5px muted + category chip.
An already-connected provider renders at opacity .6 with a `Connected` chip and is not selectable.

Footer note: "Connections are read-only and handled by a regulated open-banking provider.
TradingNew never sees your login details and cannot move money."

### Step 2 — consent

Provider identity block on `--tn-chip-bg` (46px mark, radius 16). Then two lists, both required:

- `TRADINGNEW WILL BE ABLE TO` — per-provider scopes, green `check` icons (15px, stroke 2.5)
- `IT WILL NEVER BE ABLE TO` — **fixed for every provider**: move/transfer/withdraw money ·
  place, modify or cancel orders · see your login credentials. Red `✕` glyphs.

This negative list is the point of the screen — it is what makes a brokerage connection
acceptable. Never collapse it, never move it below the fold, never shrink it below 13.5px.

Then a **separate** Voyager consent checkbox on `--tn-purple-tint-soft` / `1px --tn-purple-border`,
radius 14, accent `--tn-purple`: "Let Voyager use these balances as private context. You can
withdraw this separately, without disconnecting the account." Connecting an account and feeding
it to the AI are two decisions; revoking the second must not break the first. Mirrors the
existing permissions model at `/account/voyager`.

Footer: "Consent lasts 90 days, as required by PSD2, and can be revoked at any time from this
page." Buttons: `Back` (flex 1, outline) + `Authorise with {provider}` (flex 2, solid blue).

### Step 3a — syncing

44px spinner (3px ring, `--tn-blue-tint` track, `--tn-blue` head, 0.9s linear — must respect
`prefers-reduced-motion`), heading "Importing from {provider}", and a four-item checklist that
fills in sequentially (~620ms each): Authorising with the provider · Reading account list ·
Reading balances and positions · Checking for duplicates. Then auto-advance to review.

### Step 3b — import review

Green confirmation strip ("{provider} connected · N accounts found"), then **"Choose what enters
your Wealth Record. Nothing is added until you confirm."** Every discovered account is a checkbox
row (checked rows get `1px #c9d4f5`; unchecked sit on `--tn-bg`) with name, sub-line and value.

An amber `--tn-amber-tint` note carries the provider-specific caveat (duplicate detection,
leverage, crypto volatility — see the fixtures). Footer: live "Adds to Net Wealth" total
(22px / 800 / `.tn-num`, signed) and the primary `Import N accounts` button, disabled-looking
when nothing is selected.

On confirm: close the modal, insert the source into the list expanded and green-bordered, and
toast `✓ {provider} connected — N assets added to your Wealth Record.`

## Rules that must survive implementation

| Rule | Behaviour |
|---|---|
| **Source ≠ asset** | `Disconnect` switches that source's assets to `manual` with their last known value, source and date — never deletes them. Toast: "{provider} disconnected — N assets kept in manual mode." This is `SOURCE_NOTE` in `wealth.ts`, now enforced by the UI. |
| **Import is opt-in** | Nothing enters the Wealth Record without an explicit confirm. |
| **Duplicates flagged before import** | IBKR's VOO already arrives via NorthBridge — it is pre-unticked and explained, not silently double-counted. |
| **Leverage is not net worth** | FxPro is imported at account equity; the note says so. A demo account defaults to unticked and contributes €0. |
| **Liabilities import as liabilities** | Bank of Cyprus' mortgage enters as `−€430,000`, so the "Adds to Net Wealth" total can be negative. |
| **Status vocabulary is the existing one** | Imported assets get `DataStatus.connected`; disconnected ones become `manual`. Do not invent new statuses. |
| **Read-only, always** | No write scope appears anywhere in the UI, including future copy. |

## State

Local client state on the tab component:

```ts
step: null | 'picker' | 'consent' | 'syncing' | 'review'
filter: 'all' | 'bank' | 'broker' | 'exchange'
activeProviderId: string | null
selection: Record<string, boolean>      // discovered account id → import?
voyagerConsent: boolean                 // default true
syncProgress: number                    // 0…4
connected: Array<{ id, syncedAt, assets, disconnected? }>
openSources: Record<string, boolean>
toast: string | null
```

No fetching, no persistence. Timers must be cleared on unmount and when the modal closes.

## Suggested files

- `src/content/wealthConnections.ts` — `CONNECTION_PROVIDERS` (id, name, sub, category, mark,
  brandColor, scopes[], accounts[], caveat) and `CONNECTION_SYNC_STEPS`
- `src/components/wealth/ConnectAccountModal.tsx` (client)
- `src/components/wealth/ConnectedSourceCard.tsx`
- extend `src/components/wealth/Wealth.module.css` — reuse `.card`, `.cardTitle`, `.sectionTitle`,
  `.note`, `.stack`, `.statusChip`, `.chips`, `.danger`, `.snapKey` before adding anything new
- extend the `tab === 'data'` branch of `WealthScreen.tsx`

Six demo providers with full scope lists, account fixtures and caveat copy are in the logic block
of `TradingNew Wealth Connections.dc.html`: **Revolut · FxPro · Interactive Brokers ·
Bank of Cyprus · Binance · ING**. Take them verbatim. All user-facing strings go through
`next-intl`.

## Accessibility

Modal: focus trap, Escape closes, focus returns to `Connect an account`. Provider rows and
account rows are real `<button>` / `<label>` + `<input type="checkbox">`. `aria-expanded` on
`Details`. Toast `role="status"`. The spinner needs a text alternative and must not animate
under `prefers-reduced-motion`. Status is never colour-only — every chip carries its word.

## Limitations

- No aggregator, no OAuth, no credentials, no live data. Provider names are used to make the
  demo legible; nothing implies an existing partnership.
- Error states (provider down, expired consent, partial sync, re-auth at 90 days), multi-currency
  reconciliation and manual↔connected asset merging are **not designed**. Validate that users
  reach the consent screen before building them.

---

# PART 3 — Portal analysis mocks (reference only)

`TradingNew Portal.dc.html` is a canvas with two turns:

- **2a** — Home exactly as the repo renders it today (hero, goal cards, ecosystem carousel,
  login banner) with a critique strip underneath.
- **2b** — a proposed task-based Home: six intent cards, a live "Market now" panel with reasons
  and the next event, and a guest "continue where you left off" row.
- **1a** — Market guided discovery, replacing the `LinkHub` stub at `/market`.
- **1b** — Symbol page quick wins: event chip, contextual action bar, adaptive tabs, "why it
  moves today" factor breakdown, an explained Technical Rating, value-first CTA. Includes a
  working Beginner / Trader toggle.
- **1c** — a code-audit board. The headline finding worth acting on: `AnalyticsEvent` in
  `src/lib/events/analytics.ts` covers only Events and Superchart, so the portal's North Star
  (continuation rate, second meaningful action, D7 return) is not instrumented at all.

Treat these as design direction, not as scoped work.

---

## Design Tokens (all from `src/app/tokens.css` — use the variables, not the literals)

Text `--tn-text #131722` · `--tn-text-secondary #5a6376` · `--tn-text-muted #8a93a6` ·
`--tn-text-faint #9aa3b5` · `--tn-text-nav #3a4254`

Surfaces `--tn-bg #fbfcfe` · `--tn-surface #ffffff` · `--tn-chip-bg #f2f4f9` ·
`--tn-hero-bg linear-gradient(180deg,#eef1fb 0%,#fbfcfe 640px)`

Borders `--tn-border-card #eceff4` · `--tn-border-control #e6eaf2` · `--tn-border-input #e2e6ee`

Accents `--tn-blue #2962ff` / hover `#1848d6` / tint `#e8edfd` · `--tn-purple #7c4dff` /
hover `#6a3de8` / tint `#efe9fd` / tint-soft `#f6f2fe` / border `#e6dcfb` / deep `#4a3a7a` ·
`--tn-green #1aa966` / tint `#e3f6ec` · `--tn-orange #f4741f` / tint `#fdeee3` ·
`--tn-amber-tint #fdf3e3` / `--tn-amber-text #b07708` · `--tn-red #e0492f` / tint `#fce8e4` ·
heatmap borders `#c8ecd8` / `#f5cdbd`

Gradients `--tn-gradient-logo linear-gradient(135deg,#2962ff,#8b5cf6)` ·
`--tn-gradient-headline linear-gradient(90deg,#8b5cf6,#2962ff)`

Radii card 18 · showcase 26 · pill 24 · pill-sm 20 · chip 16 · chip-sm 13 · option 14 · logo 9 ·
search 36

Shadows `--tn-shadow-card-hover 0 10px 30px rgba(19,23,34,0.09)` ·
`--tn-shadow-dropdown 0 18px 50px rgba(19,23,34,0.14)` ·
`--tn-shadow-modal 0 24px 70px rgba(19,23,34,0.25)` ·
`--tn-shadow-search 0 6px 24px rgba(41,98,255,0.09)` · `--tn-overlay rgba(19,23,34,0.4)`

Motion hover `0.18s ease` · fast `0.15s ease` · slow `0.3s ease`

Layout `--tn-page-max 1160px` · `--tn-page-pad clamp(12px,2.5vw,36px)` · `--tn-header-h 69px`.
The Subscriptions page is the one screen that needs more than `--tn-page-max`: five columns
require ~1440. Introduce a page-scoped `--tn-page-max-wide: 1440px` rather than changing the token.

Typography: `--font-jakarta` (Plus Jakarta Sans) with `--font-manrope` as the Cyrillic carrier,
per `[locale]/layout.tsx`. Body 15px / lh 1.6. Prices and all figures get the existing
`.tn-num` (`font-variant-numeric: tabular-nums`).

## Assets

None. Every glyph is an inline path from `src/components/ui/Icon.tsx` — `check` (stroke 2.5),
`arrowRight`, `search`, `users`, `grad`, `target`, `user`, `star`. The Voyager orb is
`VoyagerOrb` (a radial gradient, no image). No external images, no icon library, no illustrations.
Do not introduce a new icon set.

## Files in this bundle

| File | What it is |
|---|---|
| `TradingNew Subscriptions.dc.html` | Task A — Subscriptions, desktop + mobile, interactive |
| `TradingNew Wealth Connections.dc.html` | Task B — Wealth Hub connect flow, fully interactive |
| `TradingNew Portal.dc.html` | Portal analysis mocks (Home, Market, Symbol, audit board) |
| `support.js` | Runtime so the HTML files open in a browser. Not for production. |
| `README.md` | This document |

## Repo files to read before writing code

`src/app/tokens.css` · `src/app/globals.css` · `src/components/ui/Icon.tsx` ·
`src/components/marketplace/Marketplace.module.css` · `src/app/[locale]/marketplace/page.tsx` ·
`src/components/shell/menu.ts` · `src/components/markets/Markets.module.css` (`.crumbs`) ·
`src/components/markets/MarketShell.tsx` (`MarketBreadcrumbs`) · `src/components/voyager/VoyagerOrb.tsx` ·
`src/messages/en.json`

For Task B additionally: `src/content/wealth.ts` (`DataStatus`, `DATA_STATUS_LABEL`,
`WEALTH_TABS`, `DATA_SOURCES`, `SOURCE_NOTE`, `ADD_HOW`) · `src/components/wealth/WealthScreen.tsx`
(the `tab === 'data'` branch) · `src/components/wealth/Wealth.module.css`

## Limitations (Task A)

- Voyager Private's seven capabilities are **subscription copy only** — nothing behind them is
  designed or implemented, and the page says so in its own disclaimer. Do not report them as
  shipped features.
- Prices are demo values.
- The comparison table in the mock is CSS grid; production should use real table semantics.
- The mobile frame shows one plan card and a subset of comparison rows; the full sets are in
  the desktop frame and the data config.
- The "How it enters the Marketplace hub" block at the bottom of the desktop frame is handoff
  documentation, not part of the page.
