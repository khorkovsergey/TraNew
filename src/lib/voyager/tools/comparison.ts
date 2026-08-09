import 'server-only';
import { getHistoryFor, MAX_COMPARE_ASSETS, type HistoryResult } from './marketData';
import { alignTo, commonDates, correlation, normalise, seriesMetrics } from './metrics';
import { isValidInterval, type Bar, type Interval } from './range';
import { toolFailure, type VoyagerToolResult } from './types';
import type { AssetCandidate } from './assets';

/**
 * Comparing instruments, computed rather than written down.
 *
 * There was a comparison in this product already: a scripted module about
 * NVDA, AMD and AVGO with prices in its prose, attached to any question a
 * keyword matched. Asked to compare Apple, Microsoft and Nvidia, it produced
 * the other three companies' figures under the right question. Those numbers
 * were real once, about companies nobody had asked about.
 *
 * This resolves what was actually named, fetches each one, and computes.
 *
 * Two decisions are made here rather than asked about:
 *
 * **The series are aligned by date, never by index.** Instruments do not share
 * a holiday calendar, so pairing the nth bar of one with the nth of another
 * drifts a day at a time and every figure downstream inherits the drift. The
 * comparison runs over the dates they all have.
 *
 * **Normalised to 100 is the default.** A $400 share and a $40 share plotted
 * together are a chart of the first one, and nobody asking "which grew more"
 * wanted that. Raw prices remain available for the questions where the level
 * itself is the point; they are not the default because they answer a
 * different question than the one people usually ask.
 */

export type ComparisonEntry = {
  asset: AssetCandidate;
  /** Rebased to 100 at the first shared date. */
  normalised: (number | null)[];
  bars: Bar[];
  changePercent: number;
  annualisedVolatility: number | null;
  maxDrawdown: number;
  periodHigh: number;
  periodLow: number;
};

export type ComparisonResult = {
  interval: Interval;
  /** The dates every instrument in the comparison has a bar for. */
  dates: string[];
  entries: ComparisonEntry[];
  /** Pairwise correlation of returns, where the period was long enough. */
  correlations: { a: string; b: string; value: number | null }[];
  requested: { start: string; end: string };
  notes: string[];
  delayed: boolean;
  provider: string;
};

export async function compareAssets(input: {
  queries?: unknown;
  start?: unknown;
  end?: unknown;
  interval?: unknown;
}): Promise<VoyagerToolResult<ComparisonResult>> {
  const queries = Array.isArray(input.queries)
    ? input.queries.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];

  if (queries.length < 2) {
    return toolFailure('bad_arguments', 'A comparison needs at least two instruments.', true);
  }
  if (queries.length > MAX_COMPARE_ASSETS) {
    return toolFailure(
      'unsupported',
      `I can compare up to ${MAX_COMPARE_ASSETS} instruments at once. Beyond that the chart stops being readable and the provider's allowance runs out.`,
      true
    );
  }

  const interval: Interval = isValidInterval(input.interval) ? input.interval : '1D';

  /*
   * Sequential rather than concurrent, and this one is deliberate: the free
   * provider tier counts about eight requests a minute for the whole portal,
   * and five parallel history fetches is most of a minute's allowance spent at
   * once. The cache makes the repeat cost nothing; the first run is worth the
   * politeness.
   */
  const histories: HistoryResult[] = [];
  const failures: string[] = [];

  for (const query of queries) {
    const history = await getHistoryFor({
      query,
      start: input.start,
      end: input.end,
      interval,
    });

    if (history.ok) histories.push(history.data);
    else failures.push(`${query}: ${history.message}`);
  }

  if (histories.length < 2) {
    return toolFailure(
      failures.length ? 'no_data' : 'not_found',
      `I could not get enough data to compare. ${failures.join(' ')}`,
      true
    );
  }

  const dates = commonDates(histories.map((history) => history.bars));
  if (dates.length < 2) {
    /*
     * Non-overlapping series, which is a real answer rather than a bug: an
     * instrument listed last month cannot be compared over five years, and
     * saying so beats a chart of one line and a stub.
     */
    return toolFailure(
      'no_data',
      'These instruments have almost no trading days in common over that period, so there is nothing to compare them across.',
      true
    );
  }

  const aligned = histories.map((history) => ({
    history,
    bars: alignTo(history.bars, dates),
  }));

  const entries: ComparisonEntry[] = aligned.map(({ history, bars }) => {
    const metrics = seriesMetrics(bars, interval);
    return {
      asset: history.asset,
      normalised: normalise(bars),
      bars,
      changePercent: metrics?.changePercent ?? 0,
      annualisedVolatility: metrics?.annualisedVolatility ?? null,
      maxDrawdown: metrics?.maxDrawdown ?? 0,
      periodHigh: metrics?.periodHigh.value ?? 0,
      periodLow: metrics?.periodLow.value ?? 0,
    };
  });

  const correlations: ComparisonResult['correlations'] = [];
  for (let i = 0; i < aligned.length; i += 1) {
    for (let j = i + 1; j < aligned.length; j += 1) {
      correlations.push({
        a: aligned[i].history.asset.symbol,
        b: aligned[j].history.asset.symbol,
        value: correlation(aligned[i].bars, aligned[j].bars),
      });
    }
  }

  const notes = [
    ...failures.map((failure) => `left out — ${failure}`),
    ...(interval === '1D' ? [] : ['weekly and monthly bars are folded from daily data']),
  ];

  const ranked = [...entries].sort((a, b) => b.changePercent - a.changePercent);
  const mostVolatile = entries
    .filter((entry) => entry.annualisedVolatility !== null)
    .sort((a, b) => (b.annualisedVolatility ?? 0) - (a.annualisedVolatility ?? 0))[0];

  return {
    ok: true,
    data: {
      interval,
      dates,
      entries,
      correlations,
      requested: {
        start: histories[0].meta.requested.start,
        end: histories[0].meta.requested.end,
      },
      notes,
      delayed: true,
      provider: histories[0].meta.provider,
    },
    summary:
      `Over ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} shared ${interval} bars, normalised to 100): ` +
      ranked
        .map(
          (entry) =>
            `${entry.asset.symbol} ${entry.changePercent >= 0 ? '+' : ''}${entry.changePercent}%` +
            (entry.annualisedVolatility === null
              ? ''
              : ` (vol ${entry.annualisedVolatility}%, drawdown ${entry.maxDrawdown}%)`)
        )
        .join(', ') +
      '. ' +
      (mostVolatile
        ? `Most volatile: ${mostVolatile.asset.symbol}. `
        : 'Volatility not measurable over this period. ') +
      correlations
        .filter((pair) => pair.value !== null)
        .map((pair) => `corr ${pair.a}/${pair.b} ${pair.value}`)
        .join(', ') +
      `. Delayed data from ${histories[0].meta.provider}.` +
      (notes.length ? ` Notes: ${notes.join('; ')}.` : ''),
  };
}
