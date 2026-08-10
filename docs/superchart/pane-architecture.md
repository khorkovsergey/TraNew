# Superchart — the pane manager

What the chart engine gained, why it is shaped this way, and what it costs to
add the next study.

## The problem it solves

The canvas engine drew the price and the studies that shared its scale. Anything
else it skipped:

```ts
if (indicator.hidden || indicator.pane !== 'main') continue;
```

So `volume-anomaly` and `volume-ma` had been in the registry, selectable in the
object tree, and invisible on the chart since they were added. Voyager recorded
the same fact from the other side — `ENGINE_DRAWS_SEPARATE_PANES = false`, and
RSI and MACD handed off to TradingView rather than promised here.

The reason the skip was there is real: an RSI runs 0–100 and a volume runs to
forty million, and either of them on a $150 price scale is a flat line against
the top or the bottom of the chart. What was missing was not a special case for
RSI. It was a second vertical scale.

## The shape

Three files, and the split between them is the point.

| | |
|---|---|
| `chart-engine/panes.ts` | Pure geometry and scales. No canvas, no DOM, no idea what an indicator is. |
| `chart-engine/paneRenderer.ts` | Draws a line, a histogram or a set of marks in a rectangle, against a domain somebody else computed. |
| `indicators/index.ts` | Which pane each study wants and how that pane scales. |

`canvas.ts` joins them and holds no pane logic of its own.

A chart is **one horizontal coordinate system and several vertical ones**. That
sentence is the whole design:

- One `TimeAxis`, built once a frame, handed to every pane. `xForIndex(axis, i)`
  is the only way anything resolves a bar to an x, so a volume column cannot
  drift half a candle from the bar it belongs to — the two callers are the same
  function.
- Each `Pane` owns a rectangle, a domain and a scale policy. `valueToY` and
  `yToValue` are per pane, and no pane can read another's domain.

The price pane's domain comes from the bars and from nothing else, which is what
makes the failure that started this impossible rather than merely avoided.

## Scale policies

A study does not say "draw me from 0 to 100". It says what kind of thing it is,
and the policy decides:

| Policy | Domain | Used by |
|---|---|---|
| `price` | The bars. | The main pane |
| `fixed` | The bounds given. | RSI, 0–100 |
| `symmetric` | ±max abs value, so zero is the middle. | MACD |
| `zeroBased` | 0 to the peak, whatever the floor of the data is. | Volume |
| `auto` | Fit the values with 8% of air. | Anything else |

Every branch returns a range with a non-zero span. An empty series, an all-null
series and a flat series all arrive here, and each of them divides by
`max - min` a moment later.

## Layout

`buildPaneLayout` is a pure function of width, height and the pane requests.
Same inputs, same rectangles — which is why a resize can be tested without
resizing anything.

- A secondary pane asks for **74 pixels**, which is the volume strip that
  shipped. Volume alone therefore reproduces the old layout to the pixel.
- The secondaries may take at most **60%** of the plot between them, and the
  price pane keeps a floor of 80. Past that they are scaled down *together*
  rather than one being dropped: a study somebody switched on and cannot see is
  worse than a short one.
- Boundaries are rounded once and shared, so panes tile exactly. No gap for the
  background to show through, no overlap for one pane to paint into.

## The contract a study fills in

```ts
const RSI_PANE: IndicatorPaneSpec = {
  id: 'rsi',
  title: 'RSI',
  scale: { kind: 'fixed', min: 0, max: 100 },
  guides: [30, 70],
};
```

`paneRequestFor(instance)` is the single place that answers "does this study
want a pane of its own, and scaled how". The renderer asks that question and
never asks "is this RSI" — a test in `verify-superchart-panes.mjs` greps the
three engine files for study names and fails if one appears.

Studies naming the same pane id **share** it: volume, its moving average and the
anomaly flags land in one rectangle with one domain computed over all three
series. A threshold line drawn anywhere other than over the bars it is a
threshold for says nothing.

Adding an oscillator is a row in the registry. The suite proves it with a study
that exists nowhere in the codebase — an invented Stochastic, described entirely
by its instance — and it gets a correct pane.

## What changed for existing behaviour

- **Volume is a study now**, `INDICATORS.volume`, on by default in the
  workspace. It used to be a strip the engine always reserved and always
  painted, which is why it could not be turned off, reordered, or given an axis.
  A chart nobody has configured looks as it did.
- **RSI, MACD and Bollinger joined the chart registry**, built from
  `lib/studies/registry.ts` rather than reimplemented. The registry owns the
  calculation, the parameter ranges and the Pine; the chart adds only the pane
  and the plot style. The line drawn and the code Script Lab exports cannot
  drift apart.
- **The price pane clips its own painting**, as every pane does. Every `save` has
  its `restore` inside `withinPane`, because a `clip()` that outlives its
  `restore()` silently blanks every pane drawn after it.
- **The crosshair reads the pane it is in.** The vertical line crosses
  everything, because a moment in time is the same moment in every pane; the
  horizontal one belongs to the pane under the pointer and stops at its edges.
  `CrosshairContext` gained `paneId` and `paneValue`; `price` still means the
  price, because every existing reader means that by it.
- **One time axis**, still at the bottom. `layout.axisPaneId` names the pane it
  belongs to. All panes share the mapping; only the last one prints the numbers.

## Testing

`scripts/verify-superchart-panes.mjs` — 62 checks, no browser. Compiles the
modules with the TypeScript already in devDependencies and asserts against them.
Two kinds of claim, and the difference matters:

1. **Geometry** — rectangles tile, domains are bounded, the price scale does not
   move when a study running to nine billion is switched on.
2. **Paint** — the renderer is handed a context that records what it was asked
   to do, and the tests check that the RSI line is stroked inside the RSI
   rectangle and that every MACD bar touches the zero line.

The second kind is the one that was missing. The metadata was always right; the
drawing was what never happened.

`scripts/verify-superchart-panes-visual.mjs` — 25 checks in a real browser, with
the six states of the brief. It predicts the pane bands from the layout rules
and then asks the pixels whether that is what was painted. It needs the flag:

```
SUPERCHART_ENABLED=true npm run dev -- -p 3413
BASE_URL=http://localhost:3413 node scripts/verify-superchart-panes-visual.mjs
```

## Not in this iteration

Dragging a pane boundary to resize it, reordering panes, collapsing one, and
studies choosing a pane at runtime rather than by definition. The layout is a
pure function of the requests, so each of those is a change to what is passed in
rather than to how it is computed.

`ENGINE_DRAWS_SEPARATE_PANES` in `lib/voyager/chart/engine.ts` is deliberately
**not** flipped here. It belongs to Voyager, and flipping it before this reaches
`main` would have Voyager promising a chart the deployed engine cannot draw.
