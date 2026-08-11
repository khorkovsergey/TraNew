# Request to the Superchart section — capability outcomes

**From:** the `metrics` worker.
**To:** the `superchart` section owner.
**Scope:** two `track()` calls inside the chart workspace. **No product
behaviour changes.**

## What is already measurable, and what is not

An audit of the current section found more than expected. These already work and
need nothing:

- `superchart_opened`, `superchart_drawing_created`, `superchart_layout_saved`,
  `superchart_script_generated`, `superchart_script_exported`,
  `superchart_preview_run` — all emitted and all useful;
- **overlay versus pane placement is already derivable.** The Observatory
  classifies a study from `superchart_study_toggled`'s `studyId` against the
  canonical indicator registry, which says `sma`/`ema` are `main` and
  `rsi`/`macd`/`volume`/`volume-ma`/`volume-anomaly` are `separate`. No new
  event is needed for that, and none is being asked for.

Two things are genuinely missing.

**1. `superchart_study_toggled` is intent, not outcome.** It fires at the top of
`toggleIndicator`, before the engine has done anything. So the dashboard can say
how often somebody *asked* for RSI and cannot say whether RSI rendered. A
fulfilment rate built on it would be a rate of clicks.

**2. Nothing records why a capability did not happen** — data absent, interval
unsupported, engine failure. The datafeed adapter already refuses intervals it
cannot honour; that refusal is invisible from outside.

## What is deliberately *not* being asked for

**A TradingView handoff metric.** The old Observatory brief describes one for
Supercharts; the current section contains none — the handoff that exists belongs
to Voyager. So the capability enum has no `handoff` value, because declaring an
outcome nothing can emit would put a permanent zero on the dashboard that reads
as a product decision rather than as an absence. If a handoff is ever added
here, tell me and I will extend the enum first.

---

## Sequencing — start only after Metrics Phase 5 is on `main`

Both events exist only on the `feat/metrics` branch today, in two places:

- `src/lib/analytics/registry.ts` — the validation contract;
- `src/lib/events/analytics.ts` — the typed `AnalyticsEvent` union, so your
  `track()` calls compile.

**Do not merge `feat/metrics` into your branch**, and **do not edit either
file** — the union member and the registry entry are already written to match.
Adding your own would create two definitions of the same event.

The order is:

1. the orchestrator merges and deploys Metrics Phase 5;
2. you sync the new `main`;
3. this work and the Markets request proceed in parallel;
4. a second orchestrator cycle merges the two small branches.

Until step 1 lands, `npm run check:analytics` reports both events as declared
with no caller. That is this sequencing, not a regression — and it is the
reason the events were declared ahead of their emitters, since a `track()` call
cannot be written type-safely against a union member that does not exist.

## Before you start

```bash
cd ../worktrees/superchart
git fetch origin && git merge origin/main
```

Copy the property names exactly. An undeclared property is refused by ingest and
the row is dropped.

---

## Event 1 — `superchart_study_applied`

The outcome, as opposed to the toggle.

**Where:** in `SuperchartWorkspace`, after the engine has actually applied the
indicator and the pane layout is known — not in `toggleIndicator` beside the
existing `track()` call, which is the intent event and stays exactly as it is.

```ts
track({
  name: 'superchart_study_applied',
  study: definition.id,
  placement: definition.pane === 'separate' ? 'pane' : 'overlay',
  paneCount: layout.panes.length,
});
```

| Property | Type | Value |
| --- | --- | --- |
| `study` | token ≤32 | the indicator id from the registry |
| `placement` | enum | `overlay` \| `pane` — **the engine's**, not the catalogue's |
| `paneCount` | integer 1–12 | panes on the chart after applying |

`placement` comes from what the engine did rather than what the registry
predicted. They should agree; if they ever diverge, the dashboard would rather
show the truth and let somebody notice.

Only emit on **successful application**. A study that failed belongs in event 2.

---

## Event 2 — `superchart_capability_completed`

Why a capability did or did not happen.

**Where:** wherever the workspace or the chart engine decides it cannot honour a
request — the datafeed adapter's interval refusal, a study that needs volume on
a series that has none, an engine failure — and once on success if that is
cheap.

```ts
track({
  name: 'superchart_capability_completed',
  capability: 'study:rsi',           // or 'interval:1m', 'volume_pane', …
  outcome: 'no_data',                // fulfilled | no_data | unsupported | failure
  hasVolume: bars.some((bar) => typeof bar.volume === 'number'),
  paneCount: layout.panes.length,
});
```

| Property | Type | Value |
| --- | --- | --- |
| `capability` | token ≤48 | what was attempted — a study id, an interval, a feature name |
| `outcome` | enum | `fulfilled` \| `no_data` \| `unsupported` \| `failure` |
| `hasVolume` | boolean | whether the series carried volume at all |
| `paneCount` | integer 1–12 | panes at the time |

### The distinction that matters

- **`no_data`** — the capability exists and the data does not. A volume pane on
  a series with no volume. This is a provider limitation.
- **`unsupported`** — the product does not do this. An interval the adapter
  declines. This is a product boundary.

Collapsing them would make a provider gap look like a missing feature, and
somebody would go and build a thing that already exists.

---

## What must never travel

The symbol. The ticker. The interval's underlying instrument. The series. Any
part of the data.

`capability: 'study:rsi'` is a product capability and is safe.
`capability: 'study:rsi:TSLA'` is a position somebody may hold. The registry
bounds the token but cannot tell the difference — please do not put one there.

---

## Tests

Two:

1. Applying RSI emits `superchart_study_applied` with `placement: 'pane'` and a
   `paneCount` greater than one.
2. A capability refused for missing data emits `outcome: 'no_data'`, not
   `unsupported`.

---

## Handoff

```bash
npx tsc --noEmit && node scripts/test-events.mjs
git push -u origin feat/superchart
```

The Observatory needs no change. Until these land it reports study activations
as *what people asked for* rather than what rendered, and says so on the panel.
