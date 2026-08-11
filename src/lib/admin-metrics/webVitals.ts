/**
 * Core Web Vitals, aggregated.
 *
 * Import-free, so the scaling and the percentiles can be checked with fixtures.
 *
 * ## The unit problem, solved in exactly one place
 *
 * Five metrics share one integer column and they do not share a unit. Four are
 * durations in milliseconds; CLS is a unitless ratio that lives around 0.1, and
 * storing it as an integer would round every real score to zero. So **CLS is
 * multiplied by 1000 on the way in and divided by 1000 on the way out, here.**
 *
 * This file is the only place that knows. A component that formatted the raw
 * column would print a layout shift of 0.08 as "80", and the first person to
 * notice would be somebody quoting it in a meeting.
 */

export const WEB_VITALS = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'] as const;
export type WebVitalName = (typeof WEB_VITALS)[number];

export const CLS_SCALE = 1000;

/** Google's own boundaries, so the ratings mean what a reader expects. */
export const VITAL_THRESHOLDS: Record<WebVitalName, { good: number; poor: number; unit: 'ms' | 'score' }> = {
  lcp: { good: 2500, poor: 4000, unit: 'ms' },
  inp: { good: 200, poor: 500, unit: 'ms' },
  cls: { good: 0.1, poor: 0.25, unit: 'score' },
  fcp: { good: 1800, poor: 3000, unit: 'ms' },
  ttfb: { good: 800, poor: 1800, unit: 'ms' },
};

export function isWebVital(value: string): value is WebVitalName {
  return (WEB_VITALS as readonly string[]).includes(value);
}

/** The integer that goes into the column. CLS scaled, everything else rounded. */
export function toStoredValue(metric: WebVitalName, raw: number): number {
  const scaled = metric === 'cls' ? raw * CLS_SCALE : raw;
  return Math.max(0, Math.round(scaled));
}

/** The number a human reads. The inverse, and the only inverse. */
export function fromStoredValue(metric: WebVitalName, stored: number): number {
  return metric === 'cls' ? stored / CLS_SCALE : stored;
}

export function rate(metric: WebVitalName, raw: number): 'good' | 'needs_improvement' | 'poor' {
  const { good, poor } = VITAL_THRESHOLDS[metric];
  if (raw <= good) return 'good';
  if (raw <= poor) return 'needs_improvement';
  return 'poor';
}

export function formatVital(metric: WebVitalName, stored: number): string {
  const value = fromStoredValue(metric, stored);
  if (VITAL_THRESHOLDS[metric].unit === 'score') return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

/* ------------------------------------------------------------- Aggregation */

export type VitalSample = { metric: string; value: number; rating: string; area: string };

export type VitalSummary = {
  metric: WebVitalName;
  unit: 'ms' | 'score';
  sample: number;
  /** Stored units. Render with `formatVital`, never raw. */
  p50: number | null;
  p75: number | null;
  p90: number | null;
  poorShare: number | null;
  needsImprovementShare: number | null;
};

/**
 * Percentiles per metric, nearest-rank.
 *
 * **p75 is the headline**, not the mean. An average hides the tail that people
 * actually experience — one fast machine cancels one slow one in the mean and
 * nobody's page got faster. Below the minimum sample every figure is `null`
 * rather than a number, because a p75 over six page loads describes six page
 * loads.
 */
export function summariseVitals(samples: readonly VitalSample[], minimum: number): VitalSummary[] {
  return WEB_VITALS.map((metric) => {
    const own = samples.filter((sample) => sample.metric === metric);
    const values = own.map((sample) => sample.value).sort((a, b) => a - b);
    const enough = values.length >= minimum;

    const at = (fraction: number): number | null => {
      if (!enough) return null;
      const rank = Math.ceil(fraction * values.length);
      return values[Math.min(values.length - 1, Math.max(0, rank - 1))];
    };

    const shareOf = (rating: string): number | null =>
      enough ? own.filter((sample) => sample.rating === rating).length / own.length : null;

    return {
      metric,
      unit: VITAL_THRESHOLDS[metric].unit,
      sample: values.length,
      p50: at(0.5),
      p75: at(0.75),
      p90: at(0.9),
      poorShare: shareOf('poor'),
      needsImprovementShare: shareOf('needs_improvement'),
    };
  });
}

/** Where the slow experiences are, so a fix has somewhere to go. */
export function worstSurfaces(
  samples: readonly VitalSample[],
  metric: WebVitalName,
  minimum: number
): Array<{ area: string; sample: number; p75: number | null }> {
  const byArea = new Map<string, number[]>();

  for (const sample of samples) {
    if (sample.metric !== metric) continue;
    const bucket = byArea.get(sample.area) ?? [];
    bucket.push(sample.value);
    byArea.set(sample.area, bucket);
  }

  return [...byArea.entries()]
    .map(([area, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        area,
        sample: sorted.length,
        p75: sorted.length >= minimum ? sorted[Math.ceil(0.75 * sorted.length) - 1] : null,
      };
    })
    .sort((a, b) => (b.p75 ?? -1) - (a.p75 ?? -1));
}
