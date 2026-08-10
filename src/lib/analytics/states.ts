/**
 * The data-quality states, and the only shape a metric may be returned in.
 *
 * Import-free on purpose, like `lib/voyager/quota.ts` next door: this is the
 * rule the whole dashboard rests on, so it has to be checkable by the unit
 * harness without a database and without a browser.
 *
 * Three documents defined these states and none of them matched — the design
 * handoff had eight, the implementation brief nine, the execution overrides
 * ten, and they disagreed about whether a flagged-off feature is "not exposed"
 * or "feature disabled". They are reconciled here, once, and
 * `docs/admin-metrics/design-handoff-review.md` records the mapping to the
 * design's labels. A second vocabulary anywhere else is a bug.
 *
 * The point of the whole file is one sentence: **a number and the reason there
 * is no number are the same type**, so a card cannot render a missing source as
 * zero by forgetting to check. There is no `value: number | null` anywhere in
 * this codebase's metric layer, because that is exactly the shape that turns
 * "we cannot know" into "0%".
 */

/* --------------------------------------------------------------- The states */

export const METRIC_STATES = [
  /** Measured directly from the event stream. */
  'live',
  /** Computed from live events rather than counted from one. */
  'derived',
  /**
   * Instrumented and collecting, with no history before the sink was connected.
   *
   * Its own state rather than a small `live`, because production analytics was
   * a no-op until this section shipped: on day one there is nothing to compare
   * against, and calling that `insufficient_sample` would imply data was being
   * collected and there merely was not enough of it.
   */
  'instrumented_going_forward',
  /** Data exists, n is below the threshold. The count shows, the rate does not. */
  'insufficient_sample',
  /** An external source that nobody has connected. Excluded from roll-ups. */
  'source_not_connected',
  /** A feature flag is off, so the surface is unreachable and a zero would lie. */
  'feature_disabled',
  /** Announced but inert. A click on it is demand, not usage. */
  'coming_soon',
  /** Measured outside the portal — and actually measured, which is the test. */
  'external',
  /** A retired flow. Never merged into a current funnel, never into PMCR. */
  'legacy',
  /** Telemetry has not arrived inside the freshness budget. */
  'stale',
  /** No mechanism exists to know this, and none is being faked. */
  'not_measurable',
] as const;

export type MetricState = (typeof METRIC_STATES)[number];

/**
 * The states that carry a number. Everything else is a reason, and a caller that
 * wants to render a figure has to narrow to one of these first.
 */
export const NUMERIC_STATES = ['live', 'derived', 'instrumented_going_forward'] as const;

export type NumericState = (typeof NUMERIC_STATES)[number];

/* ---------------------------------------------------------- The metric value */

/** Where a number came from, so a reviewer can ask and get an answer. */
export type MetricProvenance = {
  /** `product_telemetry_event`, `purchase`, `academy_progress`, … */
  source: string;
  /** The id in the metric dictionary, so the formula is one lookup away. */
  metricId: string;
  /** Server clock at query time. */
  queriedAt: string;
  /** Newest `received_at` behind this number, when it came from telemetry. */
  freshestAt?: string;
};

export type MetricValue =
  | ({ state: NumericState; value: number; sample: number } & MetricProvenance)
  | ({ state: 'insufficient_sample'; sample: number; threshold: number } & MetricProvenance)
  | ({ state: 'source_not_connected'; missingSource: string } & MetricProvenance)
  | ({ state: 'feature_disabled'; feature: string } & MetricProvenance)
  | ({ state: 'coming_soon'; feature: string } & MetricProvenance)
  | ({ state: 'external'; destination: string } & MetricProvenance)
  | ({ state: 'legacy'; retiredWhat: string } & MetricProvenance)
  | ({ state: 'stale'; freshestAt: string; budgetSeconds: number } & MetricProvenance)
  | ({ state: 'not_measurable'; reason: string; wouldRequire: string } & MetricProvenance);

/* ------------------------------------------------------------- Constructors */

/**
 * The one place a count becomes a rate.
 *
 * Written as a function rather than left to each query because the mistake it
 * prevents is silent: `numerator / denominator` with a denominator of zero is
 * `NaN`, and `NaN` rendered through a percentage formatter is "0%" in most
 * implementations — a feature nobody could reach reported as a feature nobody
 * wanted. A denominator of zero is `insufficient_sample`, always.
 */
export function rate(
  numerator: number,
  denominator: number,
  provenance: MetricProvenance,
  options: { threshold: number; state?: NumericState }
): MetricValue {
  if (denominator < options.threshold) {
    return { state: 'insufficient_sample', sample: denominator, threshold: options.threshold, ...provenance };
  }

  return {
    state: options.state ?? 'derived',
    value: numerator / denominator,
    sample: denominator,
    ...provenance,
  };
}

/**
 * A count, which still has a floor: zero rows from a source that has only just
 * started collecting is not the same claim as zero rows from a source with a
 * year of history, and `instrumented_going_forward` is how the difference
 * reaches the card.
 */
export function count(
  n: number,
  provenance: MetricProvenance,
  state: NumericState = 'live'
): MetricValue {
  return { state, value: n, sample: n, ...provenance };
}

export function notMeasurable(
  reason: string,
  wouldRequire: string,
  provenance: MetricProvenance
): MetricValue {
  return { state: 'not_measurable', reason, wouldRequire, ...provenance };
}

export function sourceNotConnected(missingSource: string, provenance: MetricProvenance): MetricValue {
  return { state: 'source_not_connected', missingSource, ...provenance };
}

export function featureDisabled(feature: string, provenance: MetricProvenance): MetricValue {
  return { state: 'feature_disabled', feature, ...provenance };
}

/* ----------------------------------------------------------------- Freshness */

/**
 * Turns a live value stale when its newest event is older than the budget.
 *
 * Applied at the edge of every telemetry-backed query rather than in the UI,
 * because a card that renders a number cannot tell how old it is, and "real
 * time" is a claim this dashboard is not allowed to make loosely.
 */
export function withFreshness(
  metric: MetricValue,
  freshestAt: Date | null,
  budgetSeconds: number,
  now: Date
): MetricValue {
  if (!isNumeric(metric)) return metric;
  if (!freshestAt) return metric;

  const ageSeconds = (now.getTime() - freshestAt.getTime()) / 1000;
  if (ageSeconds <= budgetSeconds) return metric;

  return {
    state: 'stale',
    freshestAt: freshestAt.toISOString(),
    budgetSeconds,
    source: metric.source,
    metricId: metric.metricId,
    queriedAt: metric.queriedAt,
  };
}

/* ------------------------------------------------------------------ Guards */

export function isNumeric(
  metric: MetricValue
): metric is Extract<MetricValue, { state: NumericState }> {
  return (NUMERIC_STATES as readonly string[]).includes(metric.state);
}

/**
 * What a card should print when there is no number. Kept here so the phrasing
 * is one decision rather than fourteen, and so no component invents "—" for a
 * state that has a reason worth reading.
 */
export function explain(metric: MetricValue): string {
  switch (metric.state) {
    case 'live':
    case 'derived':
    case 'instrumented_going_forward':
      return '';
    case 'insufficient_sample':
      return `Insufficient sample — ${metric.sample} of ${metric.threshold} needed`;
    case 'source_not_connected':
      return `Source not connected — ${metric.missingSource}`;
    case 'feature_disabled':
      return `Not exposed — ${metric.feature} is switched off`;
    case 'coming_soon':
      return `Coming soon — ${metric.feature} is announced but inert`;
    case 'external':
      return `External — measured at ${metric.destination}`;
    case 'legacy':
      return `Legacy — ${metric.retiredWhat}`;
    case 'stale':
      return `Delayed analytics — nothing since ${metric.freshestAt}`;
    case 'not_measurable':
      return `Not measurable — ${metric.reason}`;
  }
}
