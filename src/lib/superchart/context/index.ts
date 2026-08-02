import type { Bar, ChartInterval } from '../chart-engine/types';

/**
 * What Voyager is told about the chart.
 *
 * The naive version sends the bars. At 5,000 candles that is roughly half a
 * megabyte of JSON per question, most of it indistinguishable from the rest,
 * and a model reading it will still miss the one bar that mattered — because
 * finding an outlier in a wall of numbers is exactly what language models are
 * worst at and arithmetic is best at.
 *
 * So the compression here is not a cost saving. The statistics, the extremes
 * and the anomalies are **computed** and handed over as findings, and only a
 * sample of the bars travels. The model is asked to interpret, not to count.
 *
 * Import-free beyond the engine's types, so the harness compiles it alone.
 */

export type BarReference = {
  index: number;
  time: number;
  close: number;
  /** Why this bar is in the payload at all. */
  reason: string;
};

export type VisibleSummary = {
  barCount: number;
  firstClose: number;
  lastClose: number;
  absoluteChange: number;
  percentageChange: number;
  highestHigh: number;
  lowestLow: number;
  averageVolume: number | null;
  /** Annualised, from the visible window only. */
  volatility: number | null;
  largestUpBars: BarReference[];
  largestDownBars: BarReference[];
  volumeAnomalies: BarReference[];
};

export type ContextChipId =
  | 'symbol'
  | 'visibleRange'
  | 'statistics'
  | 'extremes'
  | 'anomalies'
  | 'studies'
  | 'drawings'
  | 'selection';

export type ContextChip = {
  id: ContextChipId;
  label: string;
  /** Relevant chips are the ones the question is likely to need. */
  relevant: boolean;
};

export type ChartContext = {
  symbol: { id: string; ticker: string; name: string; exchange: string; currency: string };
  interval: ChartInterval;
  visibleRange: { from: number; to: number; fromIndex: number; toIndex: number };
  latestBar: Bar | null;
  marketStatus: { dataStatus: string; updatedAt: string };
  visibleBarsSummary: VisibleSummary | null;
  /** A thinned series, never the whole window. */
  sampledBars: Bar[];
  studies: Array<{ id: string; label: string; params: Record<string, number> }>;
  drawings: Array<{ id: string; tool: string; from: number; to: number }>;
  selection: { fromIndex: number; toIndex: number; barCount: number } | null;
};

/** How many bars ever travel, whatever the window holds. */
export const SAMPLE_LIMIT = 60;

/** Bars this far above the window's own mean move are worth naming. */
const OUTLIER_SIGMA = 2;

function mean(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1)
  );
}

/**
 * Everything worth saying about the visible window, computed.
 *
 * Outliers are measured against the window's own distribution rather than a
 * fixed percentage, because a 3% day is unremarkable for one instrument and the
 * largest move of the year for another. A threshold that does not know which it
 * is looking at will report either nothing or everything.
 */
export function summariseVisible(bars: Bar[]): VisibleSummary | null {
  if (bars.length < 2) return null;

  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume ?? 0);
  const hasVolume = volumes.some((volume) => volume > 0);

  const moves = bars.slice(1).map((bar, index) => ({
    index: index + 1,
    change: bar.close / bars[index].close - 1,
  }));

  const changeSigma = standardDeviation(moves.map((move) => move.change));
  const changeMean = mean(moves.map((move) => move.change));

  const outliers = (direction: 1 | -1) =>
    moves
      .filter((move) =>
        direction > 0
          ? move.change > changeMean + changeSigma * OUTLIER_SIGMA
          : move.change < changeMean - changeSigma * OUTLIER_SIGMA
      )
      .sort((a, b) => (direction > 0 ? b.change - a.change : a.change - b.change))
      .slice(0, 3)
      .map((move) => ({
        index: move.index,
        time: bars[move.index].time,
        close: bars[move.index].close,
        reason: `${(move.change * 100).toFixed(1)}% — more than ${OUTLIER_SIGMA} standard deviations from the average move in this window`,
      }));

  const volumeMean = mean(volumes);
  const volumeSigma = standardDeviation(volumes);

  const volumeAnomalies = hasVolume
    ? bars
        .map((bar, index) => ({ bar, index }))
        .filter(({ bar }) => (bar.volume ?? 0) > volumeMean + volumeSigma * OUTLIER_SIGMA)
        .sort((a, b) => (b.bar.volume ?? 0) - (a.bar.volume ?? 0))
        .slice(0, 3)
        .map(({ bar, index }) => ({
          index,
          time: bar.time,
          close: bar.close,
          reason: `volume ${((bar.volume ?? 0) / (volumeMean || 1)).toFixed(1)}× the average of this window`,
        }))
    : [];

  const returns = moves.map((move) => move.change);

  return {
    barCount: bars.length,
    firstClose: closes[0],
    lastClose: closes[closes.length - 1],
    absoluteChange: closes[closes.length - 1] - closes[0],
    percentageChange: (closes[closes.length - 1] / closes[0] - 1) * 100,
    highestHigh: Math.max(...bars.map((bar) => bar.high)),
    lowestLow: Math.min(...bars.map((bar) => bar.low)),
    averageVolume: hasVolume ? volumeMean : null,
    volatility: returns.length >= 20 ? standardDeviation(returns) * Math.sqrt(252) * 100 : null,
    largestUpBars: outliers(1),
    largestDownBars: outliers(-1),
    volumeAnomalies,
  };
}

/**
 * A thinned series that keeps the shape and the ends.
 *
 * Evenly spaced sampling alone loses the last bar whenever the count does not
 * divide cleanly, and the last bar is the one every question is about. So the
 * first and the last are pinned and the sampling fills the middle.
 */
export function sampleBars(bars: Bar[], limit = SAMPLE_LIMIT): Bar[] {
  if (bars.length <= limit) return bars;

  const step = (bars.length - 1) / (limit - 1);
  const out: Bar[] = [];

  for (let i = 0; i < limit; i += 1) {
    out.push(bars[Math.round(i * step)]);
  }

  // Rounding can repeat the final index; the pin is what guarantees it is there.
  out[out.length - 1] = bars[bars.length - 1];
  return out;
}

export type BuildContextInput = {
  symbol: { id: string; ticker: string; name: string; exchange: string; currency: string };
  interval: ChartInterval;
  bars: Bar[];
  fromIndex: number;
  toIndex: number;
  dataStatus: string;
  studies: Array<{ id: string; label: string; params: Record<string, number> }>;
  drawings: Array<{ id: string; tool: string; from: number; to: number }>;
  selection: { fromIndex: number; toIndex: number } | null;
  /** Chips the person switched off; those sections are left out entirely. */
  excluded?: ContextChipId[];
};

export function buildChartContext(input: BuildContextInput): ChartContext {
  const excluded = new Set(input.excluded ?? []);

  const from = Math.max(0, Math.floor(input.fromIndex));
  const to = Math.min(input.bars.length, Math.ceil(input.toIndex));
  const visible = input.bars.slice(from, to);

  // A selection narrows the scope: asking about a range means asking about that
  // range, not about the window it sits in.
  const scoped =
    input.selection && !excluded.has('selection')
      ? input.bars.slice(
          Math.max(0, input.selection.fromIndex),
          Math.min(input.bars.length, input.selection.toIndex + 1)
        )
      : visible;

  const summary = excluded.has('statistics') ? null : summariseVisible(scoped);

  return {
    symbol: input.symbol,
    interval: input.interval,
    visibleRange: {
      from: visible[0]?.time ?? 0,
      to: visible[visible.length - 1]?.time ?? 0,
      fromIndex: from,
      toIndex: to,
    },
    latestBar: input.bars[input.bars.length - 1] ?? null,
    marketStatus: { dataStatus: input.dataStatus, updatedAt: new Date().toISOString() },
    visibleBarsSummary: summary
      ? {
          ...summary,
          largestUpBars: excluded.has('extremes') ? [] : summary.largestUpBars,
          largestDownBars: excluded.has('extremes') ? [] : summary.largestDownBars,
          volumeAnomalies: excluded.has('anomalies') ? [] : summary.volumeAnomalies,
        }
      : null,
    sampledBars: sampleBars(scoped),
    studies: excluded.has('studies') ? [] : input.studies,
    drawings: excluded.has('drawings') ? [] : input.drawings,
    selection: input.selection
      ? {
          fromIndex: input.selection.fromIndex,
          toIndex: input.selection.toIndex,
          barCount: input.selection.toIndex - input.selection.fromIndex + 1,
        }
      : null,
  };
}

/** The chips shown under "Voyager sees", from the context that was built. */
export function chipsFor(context: ChartContext, excluded: ContextChipId[] = []): ContextChip[] {
  const off = new Set(excluded);
  const summary = context.visibleBarsSummary;

  const chips: ContextChip[] = [
    {
      id: 'symbol',
      label: `${context.symbol.ticker} · ${context.interval}`,
      relevant: true,
    },
    {
      id: 'visibleRange',
      label: `${summary?.barCount ?? context.sampledBars.length} bars in view`,
      relevant: true,
    },
    {
      id: 'statistics',
      label: summary
        ? `Change ${summary.percentageChange >= 0 ? '+' : ''}${summary.percentageChange.toFixed(1)}%`
        : 'Statistics',
      relevant: true,
    },
  ];

  if (summary?.largestUpBars.length || summary?.largestDownBars.length) {
    chips.push({
      id: 'extremes',
      label: `${summary.largestUpBars.length + summary.largestDownBars.length} outlier bars`,
      relevant: true,
    });
  }

  if (summary?.volumeAnomalies.length) {
    chips.push({
      id: 'anomalies',
      label: `${summary.volumeAnomalies.length} volume spikes`,
      relevant: true,
    });
  }

  if (context.studies.length) {
    chips.push({
      id: 'studies',
      label: context.studies.map((study) => study.label).join(', '),
      relevant: true,
    });
  }

  if (context.drawings.length) {
    chips.push({ id: 'drawings', label: `${context.drawings.length} drawings`, relevant: false });
  }

  if (context.selection) {
    chips.push({
      id: 'selection',
      label: `Selected: ${context.selection.barCount} bars`,
      relevant: true,
    });
  }

  return chips.filter((chip) => !off.has(chip.id));
}

/** Roughly how much of a payload this context is, for the cost of a question. */
export function contextSize(context: ChartContext): number {
  return JSON.stringify(context).length;
}
