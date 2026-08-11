# Marketplace → Subscriptions — design index

**Current handoff: [`v2/HANDOFF.md`](v2/HANDOFF.md), rendered by [`v2/Subscriptions.dc.html`](v2/Subscriptions.dc.html).**

Everything else in this folder is the superseded v1 bundle. It is kept because
it is the record of what the screen used to argue, and deleted nothing that a
later question might need — but nothing in it is true of the shipped page any
more. Read the v2 files, and read this page before trusting a sentence in the
v1 ones.

---

## What changed between v1 and v2

| | v1 (superseded) | v2 (shipped) |
| --- | --- | --- |
| Lineup | five plans — Essential, Plus, Premium, Ultimate, Voyager Private | **four** — Free, Plus, Pro, Private |
| What a plan sells | platform limits: charts per tab, indicators, alerts, historical bars | **depth of Voyager intelligence**: analysis, research reach, private context |
| Entry tier | paid (Essential, €15.95) | **Free, and genuinely useful** — Q&A, page-aware help, quotes, basic charts |
| Prices | numeric demo values | **placeholders (`€XX`)**, labelled as not approved |
| Recommended | Premium, "Most popular" | **Plus**, "Most popular"; Pro carries a quieter "Best for research" |
| Comparison | 52 rows of quotas across nine groups | nine groups of **capabilities**, no quota table |
| TradingView | absent | a **separate dimension** with its own drawer, never an inclusion |
| Palette | light theme (`#fbfcfe` surfaces, blue/purple accents) | the portal's dark tokens; accents mint / blue / violet |

The v1 README's token table is light-theme and predates the dark `tokens.css`.
Do not lift values from it.

---

## What shipped, and what did not

Implemented from v2: hero and trust line, plan progression strip, billing
toggle, the four plan cards, the two-dimensions panel, the Marketplace
separation note, the capability matrix, the TradingView add-on drawer, the
Voyager Private explainer modal, and the two "Inside Voyager" states.

Deliberately not implemented:

- **The 390px phone mockup (state G).** It is a concept sketch of a future
  mobile surface — a chip-selected card carousel inside a drawn phone frame,
  status bar and all. The real page follows the handoff's own responsive rules
  (§5): four columns, then 2×2, then a single column. Shipping a fake phone
  frame into a production page would be shipping a picture of a product.
- **`viewerPlan`.** The drawer's "Your Voyager plan" row needs a real
  entitlement, and this page deliberately does not read one — UI offer
  vocabulary and server entitlement truth stay separate until something
  reconciles them through an owned contract. The row states that the Voyager
  plan is unaffected without naming a tier.

## Open questions for the product owner

Carried over from the handoff's own assumptions, and still open:

1. **Assets per comparison** — the matrix says 2–3 on Plus and 2–5 on Pro. The
   Pro figure is the brief's; the Plus figure was inferred. Confirm it.
2. **Rolling volatility** on Plus is hedged as "where supported" in the brief
   and appears unhedged on the card. Confirm before the copy is treated as a
   commitment.
3. **Prices.** 14 / 39 / 99 exist in `content/subscriptions.ts` only so a
   scenario can be previewed; `PLACEHOLDER_PRICES` is on and every paid card
   renders `€XX`. Turning it off is a commercial decision, not a code change.

## Where the code is

- `src/content/subscriptions.ts` — plans, copy, pricing switch, drawer and
  modal content
- `src/content/subscriptionComparison.ts` — the capability matrix
- `src/components/marketplace/Subscriptions.tsx` / `.module.css`
- `src/app/[locale]/marketplace/subscriptions/page.tsx`

## Files

| File | What it is |
| --- | --- |
| `v2/HANDOFF.md` | **Current.** The approved v2 design rationale and component inventory |
| `v2/Subscriptions.dc.html` | **Current.** The v2 design, all states, interactive |
| `v2/support.js`, `v2/assets/` | Runtime and image so the v2 file opens in a browser. Not for production |
| `TradingNew Subscriptions.dc.html` | Superseded v1 — the five-plan screen |
| `TradingNew Portal.dc.html` | Superseded v1 — unrelated portal analysis mocks |
| `support.js` | Runtime for the two v1 files. A different version from `v2/support.js`; they are not interchangeable |
