# Request to the Markets section — provider health telemetry

**From:** the `metrics` worker.
**To:** the `markets` section owner.
**Scope:** one `trackServerEvent` call at the end of each of five functions in
`src/lib/market/client.ts`. **No product behaviour changes.**

The Observatory can already say whether a provider key is configured, because
`marketDataStatus()` tells it. What it cannot say is whether requests are
succeeding: every one of `getQuote`, `getQuotes`, `getSeries`, `getBars` and
`getMacroSeries` returns `null` on failure, and a `null` that means "no key" is
indistinguishable from one that means "the vendor is down" once it leaves the
function.

That distinction is the whole point. A dashboard reporting "0 failures" today
would be claiming nothing has ever gone wrong, when in fact nothing is
watching.

**Do not change caching, fallbacks, return types, error handling or copy.** Add
observation, nothing else.

---

## Sequencing — start only after Metrics Phase 5 is on `main`

This request depends on two things that exist only on the `feat/metrics`
branch today: the `market_data_request_completed` registry entry, and
`freshnessOf` in `src/lib/admin-metrics/freshness.ts`.

**Do not merge `feat/metrics` into your branch**, and do not copy the freshness
logic across — a second implementation of "is Friday's close stale on Sunday"
would drift from the first the week somebody fixed one of them.

The order is:

1. the orchestrator merges and deploys Metrics Phase 5;
2. you sync the new `main`;
3. this work and the Supercharts request proceed in parallel;
4. a second orchestrator cycle merges the two small branches.

## Before you start

```bash
cd ../worktrees/markets
git fetch origin && git merge origin/main
```

`market_data_request_completed` is already declared in
`src/lib/analytics/registry.ts` on `main`. Copy the property names exactly — an
undeclared property is refused by ingest and the row is dropped.

---

## The helper

```ts
import { trackServerEvent } from '@/lib/analytics/server';
```

Never awaited, never throws, validates against the registry before writing. A
telemetry failure must not affect a price.

---

## What the event means

`market_data_request_completed` records **one completed invocation of a
market-data client function, reporting the result the product saw.**

It is deliberately *not* a count of upstream network calls, and the name is
kept only because renaming a declared event costs more than it is worth. The
client fetches through `next: { revalidate }`, and cache resolution is
transparent at that layer — the function cannot tell whether a value came from
the vendor or from the cache, so neither can the telemetry. Claiming otherwise
would put a number on a dashboard that nobody could verify.

`durationMs` therefore means **client resolution latency at this call site**,
not upstream provider latency. A cached success will be fast, and that is a true
statement about what the product experienced.

## The event

`market_data_request_completed`

| Property | Type | Value |
| --- | --- | --- |
| `source` | enum | `twelve_data` for quotes/series/bars, `fred` for macro |
| `kind` | enum | `quote` \| `quotes_batch` \| `series` \| `bars` \| `macro` |
| `outcome` | enum | `success` \| `not_configured` \| `no_data` \| `provider_error` |
| `delayed` | boolean | the `delayed` flag the function already sets, or `false` for macro |
| `durationMs` | integer | monotonic elapsed, see below |
| `hasVolume` | boolean | `bars` only — whether any bar carried a volume; `false` elsewhere |
| `freshnessBucket` | enum | see below |

### Timing

```ts
const startedAt = performance.now();
```

at the top of each function, and `durationMs: Math.round(performance.now() - startedAt)`
at each emit. Monotonic, so a clock adjustment cannot produce a negative.

### Classifying the outcome — per function, from the branches that exist

Every branch below is one the code already takes. **Do not add a condition to
make a bucket fit**, and do not describe one that is not there.

| Function | `not_configured` | `provider_error` | `no_data` | `success` |
| --- | --- | --- | --- | --- |
| `getQuote` | `!quotesConfigured()` | `!response.ok`, or the `catch` | `data?.status === 'error' \|\| !data?.close` | returns the quote |
| `getSeries` | `!quotesConfigured()` | `!response.ok`, or the `catch` | `data?.status === 'error' \|\| !Array.isArray(data?.values)` | returns the series |
| `getBars` | `!quotesConfigured()` | `!response.ok`, or the `catch` | `data?.status === 'error' \|\| !Array.isArray(data?.values)` | returns the bars |
| `getQuotes` | `!quotesConfigured()` | `!response.ok`, or the `catch` | `data?.status === 'error'` | returns the map, even if partly empty |
| `getMacroSeries` | `!macroConfigured()` | `!observationsResponse.ok \|\| !metaResponse.ok`, or the `catch` | `rows.length === 0` | returns the series |

Two things a previous draft of this document got wrong, corrected here:

**`asOf` is never missing.** `getQuote` writes
`asOf: data.datetime ?? new Date().toISOString().slice(0, 10)` — there is a
fallback, so "a missing datetime" is not a `no_data` condition and never was.
Use the branches in the table.

**`status === 'error'` is not only "no data".** The code's own comment says the
vendor reports rate limits *and* unknown symbols as HTTP 200 with a status
field, so this branch bundles the two. Classify it `no_data`, and read that
bucket as *nothing usable came back* rather than as *the symbol does not exist*.

**Do not invent `rate_limited`.** Telling it apart would mean parsing
`data.message`, which is a provider body and must not be read or sent. A bucket
that is sometimes right is worse than one honest classification.

For `getQuotes`, note the return type is `Record<string, Quote>` and the
failure paths return `{}` rather than `null`.

### Deriving `freshnessBucket`

Do not compute this yourself — the rules are source-aware and they live in
`src/lib/admin-metrics/freshness.ts`, which is import-free:

```ts
import { freshnessOf } from '@/lib/admin-metrics/freshness';

freshnessBucket: freshnessOf('quote', new Date(quote.asOf), new Date()),
```

It already knows that a quote is delayed by policy on the free tier, that a
Friday close is not stale on a Saturday, and that a monthly macro series has no
meaningful staleness at all (`not_applicable`). A local `now - asOf > X` would
have reported the product broken every weekend.

Pass `'unknown'` if `asOf` is absent.

### `hasVolume`

`getBars` only: `bars.some((bar) => typeof bar.volume === 'number')`. Elsewhere
`false`. It answers whether the chart could draw a volume pane, which is a real
product question and needs no symbol to answer.

---

## Example — `getQuote`

```ts
export async function getQuote(symbol: string): Promise<Quote | null> {
  const startedAt = performance.now();

  const emit = (outcome: 'success' | 'not_configured' | 'no_data' | 'provider_error', quote?: Quote) =>
    trackServerEvent({
      name: 'market_data_request_completed',
      properties: {
        source: 'twelve_data',
        kind: 'quote',
        outcome,
        delayed: quote?.delayed ?? false,
        durationMs: Math.round(performance.now() - startedAt),
        hasVolume: false,
        freshnessBucket: quote ? freshnessOf('quote', new Date(quote.asOf), new Date()) : 'unknown',
      },
      surface: 'markets',
    });

  if (!quotesConfigured()) {
    emit('not_configured');
    return null;
  }

  try {
    const response = await fetch(url, { next: { revalidate: QUOTE_TTL } });
    if (!response.ok) {
      emit('provider_error');
      return null;
    }

    const data = await response.json();
    if (data?.status === 'error' || !data?.close) {
      emit('no_data');
      return null;
    }

    const quote = { /* … as today … */ };
    emit('success', quote);
    return quote;
  } catch {
    emit('provider_error');
    return null;
  }
}
```

The same shape for `getQuotes` (`kind: 'quotes_batch'`), `getSeries`
(`'series'`), `getBars` (`'bars'`, with `hasVolume`) and `getMacroSeries`
(`source: 'fred'`, `kind: 'macro'`).

For `getQuotes`, emit **once per invocation**, not once per symbol — the call is
the unit being observed, and per-symbol rows would multiply the count by whatever
the page happened to ask for.

---

## What must never travel

The symbol. The series id. The query. The request URL. The provider's response
body or error message. Any part of the payload.

The **source** is a product fact and is safe. The **instrument** is a position
somebody may hold, and this product's telemetry rules exclude it — the registry
has no property that could hold one, so an attempt fails rather than leaks.

There is one thing to watch: `getMacroSeries(seriesId)` takes an identifier that
looks harmless. It is still a subject, and it is still not sent.

---

## Cache

**Emit once per invocation, always.** An earlier draft of this document asked
you to skip cached values; that was wrong and is withdrawn — the client has no
way to know. Next resolves the cache inside `fetch`, and nothing at this layer
distinguishes a served-from-cache success from a fresh one.

Do not add a `cached` flag either. It would have to be a guess, and a guessed
dimension is worse than an absent one.

---

## Tests

Three, no more:

1. A missing key emits `not_configured` and still returns `null`.
2. A thrown request emits `provider_error` and still returns `null`.
3. A successful quote emits `success` with a `freshnessBucket` from
   `freshnessOf`, and the answer is unchanged.

---

## Handoff

```bash
npx tsc --noEmit && node scripts/test-events.mjs
git push -u origin feat/markets
```

The Observatory needs no change when this lands: every provider card currently
reads *not measurable — the emitter has not landed*, and becomes a real number
on the first row.
