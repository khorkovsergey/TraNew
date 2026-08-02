# Superchart — architecture audit

Written before any implementation, as §1 requires. It records what the
repository actually is, what the design needs, and the two places where those
disagree.

## Frontend stack

| | |
|---|---|
| Framework | Next.js 16.2.12, App Router, React 19 |
| Language | TypeScript, strict |
| Styling | CSS Modules + custom properties in `src/app/tokens.css` (54 tokens) |
| i18n | next-intl 4.13.4 — typed `pathnames`, `localePrefix: 'always'`, English only |
| Icons | `src/components/ui/Icon.tsx`, stroke-only 24-viewBox set |
| Fonts | Plus Jakarta Sans; `tn-num` utility for tabular figures |
| Dependency tree | **18 packages total** |

That last number is the important one. This is a deliberately lean tree, and
anything added to it should earn its place.

## Backend stack

- Next.js server components and route handlers; **no separate backend service**.
- `better-auth` 1.6.25 with a Drizzle adapter, argon2id, database sessions.
- `drizzle-orm` 0.45.2 over `postgres.js`; 34 tables; Postgres on Railway.
- Server actions in `src/app/actions/*` rather than a REST layer.
- Deployment: one Railway service, built from the repository on push.

## Charting engine

**There isn't one.**

`/supercharts` renders hand-written SVG: a `<polyline>` for the price, more for
overlays, a second `<svg>` for an oscillator pane. `src/lib/wave.ts` generates a
deterministic fallback series. No charting package is installed — a search of
the dependency tree for chart, canvas, or d3 returns nothing.

What exists that is worth keeping: `src/lib/studies/registry.ts`, which computes
SMA, RSI, Bollinger and MACD deterministically and emits Pine v6 for each, with
`clampSpec` as the single gate on anything a model proposes. That is the
calculation half of §18 already built and tested.

## Market data

- `src/lib/market/client.ts` — Twelve Data for quotes (`getQuote`, `getQuotes`)
  and daily bars (`getSeries`, 260 closes, cached an hour); FRED for macro.
- Free tier: roughly 8 requests a minute. Caching is not an optimisation here,
  it is the reason pages work.
- **Daily closes only.** No intraday, no OHLC, no volume, no corporate actions,
  no news events.
- Null is a first-class answer everywhere, and every screen labels delayed data.

## Voyager

Mature and directly reusable:

- `orchestrator.ts` — Anthropic SDK, a stable `RULES` prefix for prompt caching,
  a strict answer schema, `coerce()` dropping anything off-contract.
- Actions are chosen from an allowlist by id; the model never writes a link
  (`actionRoutes.ts`). The same pattern was extended to chart studies, where the
  model picks a registry id and `clampSpec` bounds the parameters.
- `scenarios.ts` — scripted answers, so the product demonstrates with no API key.
- `VoyagerProvider` carries page context and applied studies; `VoyagerWidget`
  is a layout-level panel with collapsed/intro/peek/panel states.
- Quota: three questions a day for an anonymous visitor, counted in
  `voyager_usage`, returned *before* the model runs.
- `src/lib/investment/**` — the assessment engine added last: deterministic
  calculations, evidence validation, a point-in-time guard.

## Storage of user data

`preference`, `savedObject`, `collection`, `alert`, `academyProgress`,
`voyagerMemory`, `activity`, plus the encrypted wealth tables. Browser-side
state uses versioned localStorage keys (`tn_*_v2`) and `src/lib/pendingWork.ts`
for work an anonymous person has started.

There is **no layout table**, and nothing that stores a chart's arrangement.

## Application state

React `useState` and one small context (`VoyagerProvider`). **No Redux, Zustand,
Jotai or equivalent.** No schema validation library either — no Zod. Runtime
validation is hand-written (`clampSpec`, `coerce`, `parseFilters`), which works
because each is small and local.

## WebSockets

**None.** No socket library, no streaming transport other than SSE, which the
investment engine uses for run progress.

## Testing

- Playwright scripts against a running app: `verify-header` (31),
  `verify-events` (40), `verify-ecosystem` (43), `verify-investment` (21),
  `verify-start-path` (18).
- `scripts/test-events.mjs` — 151 unit checks; compiles dependency-free modules
  with `tsc` and asserts against the output. **No Jest, no Vitest.**
- `npm run check` = typecheck + lint + test. ESLint 9 flat config.
- `scripts/check-tokens.mjs` fails the build on a `var(--tn-*)` that does not
  exist, because an undefined custom property fails silently.

## Feature flags

`src/lib/featureFlags.ts` exists and is used to keep unfinished surfaces off
rather than shipping an illusion — the alerts flag is off precisely because
nothing could make an alert fire.

---

## Risks and constraints

### 1. There is no rendering engine capable of this design, and the project has ruled out adding one

The design asks for candles, multiple panes, a crosshair driving a data window,
twenty-one drawing tools, replay, and §24's target of smooth pan and zoom over
**5,000 bars with five studies open**.

The current renderer is SVG. Five thousand candles is five thousand DOM nodes
before wicks, and a crosshair that moves through React state re-renders the tree
on every pointer move. SVG will not reach that target; this is a property of the
DOM, not of how the code is written.

**And the previous specification for this same screen said, in as many words: do
not add charting libraries — the hand-written SVG is a deliberate project
style.** That instruction and this design's performance targets cannot both be
satisfied by SVG.

**Recommendation: keep the rendering hand-written, and move it to `<canvas>`.**

- It honours the standing instruction — no charting dependency, the drawing code
  stays ours.
- It is what a chart at this scale actually needs: one element, one paint per
  frame, crosshair and pan handled outside React entirely.
- The `ChartEngineAdapter` from §2 means this is reversible. If canvas proves
  insufficient, `lightweight-charts` (Apache-2.0, published by TradingView on
  npm — a different product from the proprietary Charting Library, and the kind
  of library §2C describes) drops in behind the same interface without touching
  anything above it.

The cost, stated plainly: hit-testing, text layout and accessibility are free in
SVG and are work in canvas. Drawing tools need their own hit-testing, and the
chart needs a parallel accessible representation because a canvas is opaque to a
screen reader. Both are budgeted in the plan.

### 2. The market data behind the design does not exist

The design shows candles, volume, intraday timeframes down to one minute,
earnings and dividend markers, and a live connection pill. The provider returns
**daily closes with no volume**, capped at eight requests a minute.

Nothing in the plan pretends otherwise. Phase 2 builds the `MarketDataAdapter`
with a demo adapter that produces OHLCV deterministically and is **labelled
demo** everywhere it appears — §5 of the task and §"Honest data" of the design
both require that, and the portal already has the habit.

### 3. Runtime command validation has no library to lean on

§7 requires every chart command validated at runtime, across roughly seventeen
command types with nested payloads. The existing hand-written validators work
because each is small; seventeen of them is a different proposition.

§7 permits Zod when the project has none. **Recommendation: add Zod** at the
command-bus boundary only, and nowhere else. It is the nineteenth dependency in
a tree of eighteen, so it should be visible in review rather than slipped in.

### 4. Scope

The design is a professional terminal: a workspace shell, a chart engine,
twenty-one tools, four right-panel tabs, six dock tabs, a Pine tokenizer,
parser, validator and interpreter in a worker, Script Lab with versioning, a
strategy tester, and a Voyager command bus with plan → preview → apply → undo.

This is weeks of work, not a session. The plan splits it into nine phases that
each end in something demonstrable, and each is verified before the next starts.

### 5. Two smaller ones

- **The quota returns before the engine runs.** Three questions a day means a
  demo of the Voyager flow runs out mid-demonstration. Superchart should either
  raise the allowance behind a flag or make the quota answer name what was about
  to happen.
- **The design targets the existing `/supercharts` route** and replaces what is
  there. The studies + Pine feature currently on that page is not lost: its
  registry becomes Superchart's built-in indicator set, and its Pine templates
  become the export half of Script Lab.

---

## Recommended architecture

```
src/components/superchart/         UI, CSS Modules, one component per design zone
src/lib/superchart/
  chart-engine/                    ChartEngineAdapter + the canvas implementation
  datafeed/                        MarketDataAdapter + demo and Twelve Data adapters
  state/                           reducer + context; bars live outside it
  commands/                        ChartCommand union, validation, the bus
  transactions/                    undo/redo, one transaction per Voyager request
  context/                         VoyagerContextService and compression
  drawings/                        geometry, hit-testing, serialisation
  indicators/                      wraps the existing studies registry
  script-lab/                      documents, versions, diagnostics
  script-runtime/                  tokenizer, parser, validator, worker interpreter
  layouts/                         versioned schema, migration, persistence
```

Rules that follow from the audit:

- **Bars never enter React state.** The engine owns them; the store holds the
  symbol, the interval and what is visible. §6 asks for this and the crosshair
  makes it non-negotiable.
- **Voyager never touches the chart.** It emits commands; the bus validates
  them; preview draws into a separate layer; apply commits one transaction.
- **Draft objects live in their own layer** and are never written to a saved
  layout, so discarding is dropping a layer rather than undoing edits.
- **Every colour goes through a token.** `check-tokens.mjs` already fails the
  build otherwise, and the design's palette is the portal's own.
