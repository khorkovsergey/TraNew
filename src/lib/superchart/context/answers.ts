import type { ChartContext } from './index';

/**
 * Answers about the chart, built from the computed context.
 *
 * Scripted rather than generated, for the same reason the rest of Voyager has a
 * scripted layer: the product has to demonstrate with no API key, and a chart
 * explanation whose numbers came from a model is a chart explanation whose
 * numbers nobody checked.
 *
 * Every number in every answer here is read out of `ChartContext`, which was
 * computed in `summariseVisible`. The prose is the only part that was written,
 * and the references point at bar indices the arithmetic found.
 *
 * When the model layer lands it replaces the prose and keeps the references —
 * the contract is that a reference names a range the code identified, not one
 * the model chose.
 */

export type ChartReference = {
  id: string;
  /** `window` spans the whole view, and the chart brackets it instead of filling it. */
  kind?: 'zone' | 'window';
  /** Shown as a numbered badge on the chart and beside the sentence. */
  number: number;
  type: 'bar' | 'range' | 'price-level';
  fromIndex: number;
  toIndex: number;
  title: string;
  detail: string;
};

export type ChartAnswer = {
  summary: string;
  references: ChartReference[];
  followUps: string[];
  /** Never absent: an answer without its data date is an undated claim. */
  sources: string;
};

export type AnswerMode = 'ask' | 'analyze' | 'build' | 'edit' | 'learn';

export type ModeChoice = {
  mode: AnswerMode;
  /** Shown to the person: which mode, and why that one. */
  because: string;
};

/**
 * Which mode this question is in, and why.
 *
 * The design requires the reason to be visible. A mode chosen invisibly is a
 * behaviour change nobody can predict or correct.
 */
export function chooseMode(question: string, context: ChartContext): ModeChoice {
  const q = question.toLowerCase();

  if (/\badd\b|\bcreate\b|\bbuild\b|\bmark\b|\bshow me .* (ema|sma|rsi)/.test(q)) {
    return { mode: 'build', because: 'you asked for something to be added to the chart' };
  }

  if (/\bchange\b|\binstead\b|\bedit\b|\bset .* to\b/.test(q)) {
    return { mode: 'edit', because: 'you asked to change something already on the chart' };
  }

  if (/\bwhat is\b|\bhow does\b|\bexplain .* (mean|work)\b|\bteach\b/.test(q)) {
    return { mode: 'learn', because: 'you asked what something means rather than what it did' };
  }

  if (context.selection) {
    return { mode: 'analyze', because: 'you have a range selected, so the answer is scoped to it' };
  }

  if (/\bwhy\b|\banalys|\banalyz|\bwhat happened\b|\bexplain\b/.test(q)) {
    return { mode: 'analyze', because: 'you asked about what the visible bars did' };
  }

  return { mode: 'ask', because: 'a direct question about the chart' };
}

function formatDate(time: number): string {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

/**
 * The explanation of the visible range.
 *
 * Describes what happened and declines to say why. The chart knows the price
 * moved; it does not know the reason, and a plausible cause attached to a real
 * move is the most convincing kind of thing to be wrong about.
 */
export function explainVisibleRange(context: ChartContext): ChartAnswer {
  const summary = context.visibleBarsSummary;

  if (!summary) {
    return {
      summary: 'There are not enough bars in view to describe. Zoom out and ask again.',
      references: [],
      followUps: ['Zoom to the last year'],
      sources: `${context.symbol.ticker} · ${context.marketStatus.dataStatus} data`,
    };
  }

  const references: ChartReference[] = [];
  let number = 0;

  const direction = summary.percentageChange >= 0 ? 'rose' : 'fell';

  references.push({
    id: 'ref_window',
    number: (number += 1),
    type: 'range',
    kind: 'window',
    fromIndex: context.visibleRange.fromIndex,
    toIndex: context.visibleRange.toIndex,
    title: `The window as a whole`,
    detail: `${summary.barCount} bars from ${formatDate(context.visibleRange.from)} to ${formatDate(context.visibleRange.to)}, ${direction} ${Math.abs(summary.percentageChange).toFixed(1)}% between the first and last close.`,
  });

  for (const bar of summary.largestUpBars.slice(0, 2)) {
    references.push({
      id: `ref_up_${bar.index}`,
      number: (number += 1),
      type: 'bar',
      fromIndex: context.visibleRange.fromIndex + bar.index,
      toIndex: context.visibleRange.fromIndex + bar.index,
      title: `Largest single-bar rise`,
      detail: `${formatDate(bar.time)}: ${bar.reason}. What the chart cannot say is why.`,
    });
  }

  for (const bar of summary.largestDownBars.slice(0, 2)) {
    references.push({
      id: `ref_down_${bar.index}`,
      number: (number += 1),
      type: 'bar',
      fromIndex: context.visibleRange.fromIndex + bar.index,
      toIndex: context.visibleRange.fromIndex + bar.index,
      title: `Largest single-bar fall`,
      detail: `${formatDate(bar.time)}: ${bar.reason}. What the chart cannot say is why.`,
    });
  }

  for (const bar of summary.volumeAnomalies.slice(0, 2)) {
    references.push({
      id: `ref_vol_${bar.index}`,
      number: (number += 1),
      type: 'bar',
      fromIndex: context.visibleRange.fromIndex + bar.index,
      toIndex: context.visibleRange.fromIndex + bar.index,
      title: 'Unusual volume',
      detail: `${formatDate(bar.time)}: ${bar.reason}.`,
    });
  }

  /*
   * Renumbered left to right.
   *
   * They were built by category — rises, then falls, then volume — which puts
   * 4, 5, 7, 1, 3, 2, 6 across the chart. Nobody reads a chart by category, and
   * a numbered badge that does not count in the direction the eye travels is
   * harder to follow than no number at all.
   */
  references.sort((a, b) => a.fromIndex - b.fromIndex);
  references.forEach((reference, index) => {
    reference.number = index + 1;
  });

  const range = `The high in view is ${summary.highestHigh.toFixed(2)} and the low ${summary.lowestLow.toFixed(2)}`;
  const vol = summary.volatility
    ? `, and annualised volatility over this window is ${summary.volatility.toFixed(0)}%`
    : '';

  return {
    summary:
      `Over the ${summary.barCount} bars in view, ${context.symbol.ticker} ${direction} ` +
      `${Math.abs(summary.percentageChange).toFixed(1)}%, from ${summary.firstClose.toFixed(2)} to ${summary.lastClose.toFixed(2)}. ` +
      `${range}${vol}. ` +
      `${references.length - 1} bar${references.length - 1 === 1 ? '' : 's'} stood out enough from the rest of this window to name below. ` +
      `This describes what the prices did; it does not explain why they did it.`,
    references,
    followUps: [
      'Which of these had unusual volume?',
      'Add a 20 and 50 moving average',
      'What would invalidate the recent trend?',
    ],
    sources: `${context.symbol.ticker} ${context.interval} · ${context.marketStatus.dataStatus} data · ${summary.barCount} bars to ${formatDate(context.visibleRange.to)}`,
  };
}

/** The volume question, answered from the anomalies the summary found. */
export function explainVolume(context: ChartContext): ChartAnswer {
  const summary = context.visibleBarsSummary;
  const anomalies = summary?.volumeAnomalies ?? [];

  if (!summary || !anomalies.length) {
    return {
      summary: summary
        ? 'No bar in this window traded far enough above its own average to call unusual. That is an answer, not a gap — most windows do not contain one.'
        : 'There are not enough bars in view to look at volume.',
      references: [],
      followUps: ['Explain what happened in the visible range'],
      sources: `${context.symbol.ticker} ${context.interval} · ${context.marketStatus.dataStatus} data`,
    };
  }

  const references: ChartReference[] = anomalies.map((bar, position) => ({
    id: `ref_vol_${bar.index}`,
    number: position + 1,
    type: 'bar' as const,
    fromIndex: context.visibleRange.fromIndex + bar.index,
    toIndex: context.visibleRange.fromIndex + bar.index,
    title: formatDate(bar.time),
    detail: `Closed at ${bar.close.toFixed(2)} on ${bar.reason}.`,
  }));

  return {
    summary:
      `${anomalies.length} bar${anomalies.length === 1 ? '' : 's'} in this window traded on volume more than two standard deviations above the window's own average` +
      `${summary.averageVolume ? `, which here is ${Math.round(summary.averageVolume).toLocaleString('en-US')}` : ''}. ` +
      `Unusual volume says a lot of people acted at once. It does not say which way they were positioned, and it is not a direction.`,
    references,
    followUps: ['Explain what happened in the visible range', 'Add a volume moving average'],
    sources: `${context.symbol.ticker} ${context.interval} · ${context.marketStatus.dataStatus} data · ${summary.barCount} bars`,
  };
}

/** The quick commands offered before anyone has typed anything. */
export const QUICK_COMMANDS: Array<{ mode: AnswerMode; text: string }> = [
  { mode: 'analyze', text: 'Explain what happened in the visible range' },
  { mode: 'build', text: 'Add EMA 20 and EMA 50 and mark the crossovers' },
  { mode: 'analyze', text: 'Find the bars with unusual volume' },
  { mode: 'learn', text: 'What does this chart type show?' },
];

/** Routes a question to an answer. One entry point, so nothing bypasses it. */
export function answerFor(question: string, context: ChartContext): ChartAnswer {
  if (/\bvolume\b|\bturnover\b/i.test(question)) return explainVolume(context);
  return explainVisibleRange(context);
}
