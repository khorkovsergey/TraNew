# Marketplace → Subscriptions — design handoff

Source of truth: `Subscriptions.dc.html` (single file, all states). Revision **v2** — reworked against the TradingNew Voyager Monetization v2 brief.

---

## 1. Design rationale

**Product principle on screen:** TradingNew is the platform; Voyager is the intelligence you upgrade. The hero states this literally, and every plan is framed as *how much Voyager does for you* — depth of analysis, reach of research, amount of private context — never as "more pages unlocked".

**Progression:** Ask → Analyze → Research → Private Intelligence. Free is a genuinely useful entry tier (Q&A, page-aware help, quotes, basic charts), not a crippled demo.

**Recommended plan:** **Plus** carries "Most popular" (mass paid plan). **Pro** carries a secondary "Best for research" cue rather than competing for the same slot. Both badges are markup-level, so the product team can move the highlight later without restructuring the layout.

**Colour as intelligence, not as four brands:** Free = neutral slate; Plus = TradingNew green (#2ee6a8, analytical); Pro = cyan (#38bdf8, research/agentic); Private = violet (#a78bfa) on a darker card. Same card geometry, same type scale, same spacing throughout — only accent and elevation change.

**Plan progression strip** (Ask → Analyze → Research → Private intelligence) sits between the hero and the billing toggle: one row, four labelled steps with their plan names, no infographic.

**Two-dimension block** sits under the plans: Voyager plan → intelligence, TradingView plan → charting. This is what stops users reading TradingView as a plan tier. No TradingView feature detail lives on the Voyager cards — each card carries one quiet line, "Continue in TradingView — on every plan". The handoff itself is never described as included, activated or connected: it is a continuation path available on every plan, and a *paid* TradingView plan is a separate, not-yet-integrated commercial choice.

**Marketplace note** is a low-emphasis dashed strip, deliberately not a second pricing table.

**Trust:** "Voyager supports research and decision-making. It does not execute trades." sits under the hero. Private's card and modal both state that nothing is remembered until the user saves it, and that stored context can be reviewed or deleted. The Pine row in the matrix states outright that Voyager does not execute or backtest Pine locally.

---

## 2. Screens and states

| ID | State | How it opens |
|---|---|---|
| A | Main Subscriptions page (desktop) | default |
| B | Capability comparison matrix | "Show / Hide full comparison" (open by default) |
| C | TradingView add-on drawer (right, 520px) | "Add a TradingView plan" |
| D | Contextual upgrade (capability boundary) | rendered inline in the "Inside Voyager" section; in production it is a module inside the Voyager conversation |
| E | Usage-limit reached | rendered inline next to D, deliberately a different surface from D |
| F | Voyager Private explainer modal | "Explore Private" CTA |
| G | Mobile mockup (390px frame) | inline section at the bottom of the page |

D and E sit side by side on purpose: a capability boundary (plan does not include this) and a used-up allowance (plan includes it, capacity is spent) are different product states and must not share one screen.

Billing toggle (Monthly / Annual) is shared page state. With `placeholderPrices` on (default) every paid price renders as `€XX` and the toggle only changes the billing caption; the annual saving is labelled illustrative.

---

## 3. Component inventory

**PlanCard** — props: `tier` (free/plus/pro/private), `name`, `tagline`, `price`, `priceSub`, `badge?` (primary | secondary), `features[]`, `bestFor`, `ctaLabel`, `ctaVariant` (solid | outline | ghost), `tvStatus`, `note?` (Private consent line).
Accent map: free `#5b7389` / border `#16283a`; plus `#2ee6a8` / border `rgba(46,230,168,.42)` + soft glow; pro `#38bdf8` / border `rgba(56,189,248,.32)`; private `#a78bfa` / border `rgba(167,139,250,.34)`.

**BillingToggle** — segmented control + saving pill. `period: 'monthly' | 'annual'`, `savingPct`.

**PlanProgression** — four steps (Ask / Analyze / Research / Private intelligence) with plan names and accent dots; separators are arrows. Wraps on narrow viewports.

**MarketplaceSeparationNote / DimensionsPanel** — two-column explainer + `Add a TradingView plan` button.

**MarketplaceNote** — dashed strip, icon + two lines + link.

**ComparisonMatrix** — grouped rows; sticky header row (`top: 66px`, under the app header); groups: Core AI & page context, Market data, Charts & studies, Comparison & metrics, Research, Agent workflows, Investment analysis, Pine & TradingView, Private intelligence. Cell values: `true` → ✓ (#2ee6a8), `false` → — (#33465c), or a short string (#b7c6d6). Horizontal scroll below 1240px (min-width 940px).

**TradingViewAddonSelector** (drawer) — Voyager-plan context row ("stays exactly as it is"), five radio options (No TradingView plan, Essential, Plus, Premium, Ultimate) with `+€XX` provisional prices, independence explainer, footer `Not now` / dynamic CTA ("Continue with TradingView Plus" / "Continue without a TradingView plan"). Copy must never say included, activated, connected or provisioned. Default selection is *No TradingView plan*.

**VoyagerUpgradeCard** — a module *inside the answer*, not a wall. Order is fixed: user question → the part Voyager completed on the current plan (here: the 3-year metric table) → boundary block naming the missing capability, the minimum plan for it, and the promise that the question is kept and re-run → `Upgrade to Pro` / `Compare plans` / `Not now`. Data it needs: `requiredCapability`, `minimumPlan`, `currentPlan`, `partialResult`, `originalRequest`. If the whole request is gated, the partial-result block is omitted — everything else stays.

**VoyagerUsageLimitCard** — plan name, allowance bar at 100%, reset time (`resetsAt`, omitted entirely when unknown), what still works, and the next plan **only when it raises the specific capacity that was hit** (`nextPlanRaisesThisLimit: boolean` — when false, show `Compare plans` / `Wait for reset` and no upsell). Never styled as an error.

**PrivateDialog** — 4 capability tiles, consent/privacy block, `Set up Voyager Private` / `Back to plans`.

**MobileSubscriptions** — plan chips (horizontal), one full card, pager dots, "Compare all plans" row, Marketplace note. Not a shrunken four-column table.

---

## 4. Configurable values (already props on the DC)

- `viewerPlan` — free | plus | pro | private (drives the drawer's "Your Voyager plan" line; in production also drives CTA states like "Current plan")
- `placeholderPrices` — **default on**. All paid prices render as `€XX` and the sub-line reads "Final price not yet approved". Turn off only to preview a numeric scenario.
- `annualSavingPct` — default 20, shown as an illustrative saving
- `plusMonthly` / `proMonthly` / `privateMonthly` — 14 / 39 / 99, used only when `placeholderPrices` is off

Everything else that must come from configuration rather than code: plan names and taglines, feature bullets, badge assignment (which plan is "Most popular" / "Best for research"), the comparison matrix rows, TradingView option list and prices, allowance/reset copy, and the trust line.

---

## 5. Responsive

- ≥1240px — 4 plan columns
- 860–1240px — 2×2 plans, matrix scrolls horizontally
- <860px — single-column plans, drawer full-width, dimensions panel stacks
- Header collapses to a wrapping nav row below 1340px (same behaviour as Home)

---

## 6. Assumptions

1. **Prices are placeholders by default.** Paid tiers render `€XX`; the numeric props (14 / 39 / 99) exist only for internal scenario previews. A line under the plan grid says so explicitly.
2. **No commerce is implied anywhere.** There is no checkout, no TradingView provisioning and no entitlement language. The drawer states that selecting a TradingView plan here is a design state.
3. **Free-tier limits are described qualitatively** ("a daily allowance of Voyager questions"), matching the current product baseline. No numeric quota is invented.
4. **Wealth Hub is absent by design** — no portfolio, holdings or risk capability appears as a plan differentiator. Existing Wealth Hub surfaces elsewhere are untouched.
5. **Marketplace inventory is excluded** from every tier. No expert service, event or course is presented as included.
6. **"Assets per comparison" (2–3 Plus / 2–5 Pro)** is inferred from the brief's "more complex 2–5 asset analysis" on Pro. Confirm the real Plus limit.
7. **Rolling volatility** is listed under Plus with "where supported" removed from the card for brevity — it remains hedged in the brief. Confirm before shipping the card copy.
8. **Trusted sources** (Private) is stated as configurable "where supported".
9. The **capability-boundary state** uses Deep Research as the example gate; the same component covers Pine debugging and other Pro/Private gates — only the headline, the completed part and the boundary copy change. The metric figures in that panel are placeholder data.
10. The **header** here is a static version of the Home shell (no mega-menu panels) — production should mount the shared navigation component, with Marketplace as the active item.

---

## 7. Not done (out of scope, per brief)

Marketplace redesign, Voyager chat redesign, Wealth Hub, global navigation changes, TradingView pricing replication, checkout / payment flow, account & billing management screens.
