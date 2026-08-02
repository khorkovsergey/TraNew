# Point-in-time correctness

## The problem

A financial year ends on 31 December. The report describing it is filed on 12
February. An analysis dated 20 January must not see it.

Getting this wrong is called lookahead bias, and its defining property is that
**nothing fails**. A backtest with a leak does not error, does not warn, and
does not look wrong. It reports a result better than any decision anyone could
actually have made, and it is believed.

## What the guard does

`src/lib/investment/data/pointInTime.ts` filters everything entering the engine
against a cutoff, using the earliest date at which each item was *knowable*:

1. the filing date, if there is one;
2. otherwise the publication date;
3. otherwise the period end — which leaks, so using it always leaves a warning
   on the run.

A source with **no date at all is excluded**, not admitted. It cannot be shown
to precede the cutoff, and a fact of unknown vintage is exactly the kind that
turns out to be from the future.

Facts are dropped when their evidence is dropped, rather than being filtered
separately, so there is one rule and no way for a figure to outlive its source.
Price series are truncated by the same cutoff.

## Tests

In `scripts/test-events.mjs`:

- the FY2025 filing is invisible to an analysis dated 20 January 2026;
- the figures that came from it are gone too;
- it becomes visible on 1 March 2026;
- news is filtered by publication date;
- an undated source is refused;
- prices after the cutoff are truncated;
- **and the same assertion through the whole pipeline**, which is where a leak
  would actually reach a person.

The pipeline-level test exists because a unit test can pass while the wiring
around it bypasses the guard entirely.

## The API surface

`as_of` in the request body sets the cutoff. A date in the future is clamped to
today: honouring it would be asking the engine to see filings that do not exist
yet, and there is no reading of that request which is safe to grant.
