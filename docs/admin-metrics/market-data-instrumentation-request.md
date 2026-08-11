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

That distinction is the whole point. A dashboard reporting "0 provider errors"
today would be claiming the provider has never failed, when in fact nothing is
watching.

**Do not change caching, fallbacks, return types, error handling or copy.** Add
observation, nothing else.

---

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

### Classifying the outcome

The three branches already exist in the code; they just are not distinguished
after the return.

- **`not_configured`** — the `if (!quotesConfigured()) return null` / `if
  (!macroConfigured())` guard at the top. This is a deployment fact, not a
  failure.
- **`provider_error`** — the `catch`, and any non-OK HTTP response.
- **`no_data`** — the request succeeded and the payload had nothing usable: an
  empty `values` array, a missing `datetime`, a response the parser rejects.
- **`success`** — anything that returns a non-null result.

**Do not invent `rate_limited`.** Twelve Data signals throttling in ways this
code does not currently parse, and a bucket that is sometimes right is worse
than one honest `provider_error`. If you later add real rate-limit detection,
tell me and I will extend the enum.

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
    // … existing code, unchanged …
    if (!data?.close) {
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

For `getQuotes`, emit **once per batch**, not once per symbol — the batch is the
provider request, and per-symbol rows would multiply the count by whatever the
page happened to ask for.

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

If a cached value is returned without a provider call, **do not emit**. The
event is about provider requests, and counting cache hits would make the success
rate a measure of cache warmth. If it is easier to emit with an added
`outcome: 'success'` for cache hits, do not — tell me and I will add a `cached`
boolean to the contract.

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
