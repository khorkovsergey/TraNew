import 'server-only';
import type { ComparisonResult } from '../tools/comparison';
import type { HistoryResult } from '../tools/marketData';
import { normalise } from '../tools/metrics';
import { clampChartSpec, type ChartKind, type VoyagerChartSpec } from './spec';
import type { Bar } from '../tools/range';

/**
 * A chart, built from what a tool returned.
 *
 * The series, the dates and the provenance come from the fetch; the model
 * contributes a shape and a study list, and both go through `clampChartSpec`
 * before anything is drawn or described. So the worst a model can do to a
 * chart is choose a view of data that already exists — it cannot name an
 * instrument that was not fetched, a period that was not covered, or a study
 * that will not appear.
 *
 * That asymmetry is the whole point. The old path let a scripted module
 * describe RSI and detected levels while the renderer drew plain candles,
 * because the description and the drawing came from different places.
 */

export type ChartPayload = {
  spec: VoyagerChartSpec;
  series: { assetId: string; bars: Bar[]; normalized?: (number | null)[] }[];
};

/** The default view for one instrument, before the model says otherwise. */
function defaultKind(bars: Bar[]): ChartKind {
  /*
   * A line for a long period, candles for a short one. Two hundred candles in
   * the width of an answer is a texture rather than a chart, and somebody
   * asking for five years wanted the shape, not the wicks.
   */
  return bars.length <= 90 ? 'candles' : 'line';
}

export function chartFromHistory(
  history: HistoryResult,
  requested?: { kind?: unknown; studies?: unknown }
): ChartPayload | null {
  if (!history.bars.length) return null;

  const spec = clampChartSpec({
    kind: requested?.kind ?? defaultKind(history.bars),
    series: [
      {
        assetId: history.asset.canonicalId,
        symbol: history.asset.symbol,
        label: history.asset.displayName,
        field: 'close',
      },
    ],
    range: history.meta.requested,
    interval: history.meta.interval,
    studies: Array.isArray(requested?.studies) ? requested.studies : [],
    sourceMeta: {
      provider: history.meta.provider,
      firstObservation: history.meta.coverage.firstObservation,
      lastObservation: history.meta.coverage.lastObservation,
      delayed: history.meta.delayed,
      derivedFromDaily: history.meta.coverage.derivedFromDaily,
    },
  });

  if (!spec) return null;

  return {
    spec,
    series: [{ assetId: history.asset.canonicalId, bars: history.bars }],
  };
}

export function chartFromComparison(comparison: ComparisonResult): ChartPayload | null {
  if (comparison.entries.length < 2) return null;

  const spec = clampChartSpec({
    // Always normalised. A comparison of raw prices on different scales is a
    // chart of whichever instrument is most expensive, and that is not the
    // question anybody asked.
    kind: 'performance',
    series: comparison.entries.map((entry) => ({
      assetId: entry.asset.canonicalId,
      symbol: entry.asset.symbol,
      label: entry.asset.displayName,
      field: 'normalized',
    })),
    range: comparison.requested,
    interval: comparison.interval,
    studies: [],
    sourceMeta: {
      provider: comparison.provider,
      firstObservation: comparison.dates[0] ?? null,
      lastObservation: comparison.dates[comparison.dates.length - 1] ?? null,
      delayed: comparison.delayed,
      derivedFromDaily: comparison.interval !== '1D',
    },
  });

  if (!spec) return null;

  return {
    spec,
    series: comparison.entries.map((entry) => ({
      assetId: entry.asset.canonicalId,
      bars: entry.bars,
      // Recomputed from the aligned bars rather than carried, so the values the
      // chart plots are the values the metrics were measured from.
      normalized: normalise(entry.bars),
    })),
  };
}
