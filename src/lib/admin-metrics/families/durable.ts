import 'server-only';
import {
  count as countMetric,
  rate,
  type MetricProvenance,
  type MetricValue,
} from '@/lib/analytics/states';

/**
 * The shared shape of a durable-fact adapter.
 *
 * Every family answers the same way, so the UI and the tests do not have to
 * learn seven payloads. The parts that matter beyond the numbers:
 *
 * - **`source` names the table**, not "the database". A reviewer asking where a
 *   figure came from should get `event_registration`, because that is a thing
 *   they can go and query.
 * - **`sourceType: 'durable_fact'`** so a current-state count can never be read
 *   as behavioural evidence, or the reverse. Telemetry and tables are different
 *   evidence about the same flow.
 * - **`limitations` is not optional.** Most of these tables hold current state
 *   rather than history, and a status distribution presented as a conversion
 *   funnel is the single easiest mistake to make here.
 *
 * ## Narrow projections, always
 *
 * No adapter selects a row. They select counts, and the columns they group by
 * are named one at a time. Several of these tables hold names, emails,
 * encrypted notes, briefs and financial values a metre away from the fields we
 * want, and `select *` is how one ends up in a JSON response. A test asserts
 * that no adapter file contains one.
 */

export type FamilyKey =
  | 'start'
  | 'events'
  | 'academy'
  | 'experts'
  | 'saves'
  | 'wealth'
  | 'commerce'
  | 'accounts';

export type Distribution = Array<{ key: string; count: number }>;

export type FamilyFacts = {
  family: FamilyKey;
  /** The exact tables read. Empty when the family is telemetry-only. */
  sources: string[];
  generatedAt: string;
  /** Newest durable record, so "quiet" and "broken" can be told apart. */
  freshestAt: string | null;
  metrics: Record<string, MetricValue>;
  distributions: Record<string, Distribution>;
  limitations: string[];
};

/** Provenance for a durable metric. The source is a table name, every time. */
export function durableAt(
  source: string,
  generatedAt: string
): (metricId: string) => MetricProvenance {
  return (metricId) => ({ metricId, source, sourceType: 'durable_fact', queriedAt: generatedAt });
}

export function telemetryAt(generatedAt: string): (metricId: string) => MetricProvenance {
  return (metricId) => ({
    metricId,
    source: 'product_telemetry_event',
    sourceType: 'telemetry',
    queriedAt: generatedAt,
  });
}

/**
 * A durable count.
 *
 * `live` rather than `instrumented_going_forward`, and the difference is real:
 * these tables were being written long before telemetry existed, so their
 * history is genuine. That is the whole reason the two source types are kept
 * apart.
 */
export function durableCount(
  n: number,
  provenance: (metricId: string) => MetricProvenance,
  metricId: string
): MetricValue {
  return countMetric(n, provenance(metricId), 'live');
}

/**
 * A durable rate, with the denominator stated by the caller.
 *
 * Thresholded like every other rate. A conversion over six rows is not a
 * conversion, and the marketplace families are small by nature.
 */
export function durableRate(
  numerator: number,
  denominator: number,
  provenance: (metricId: string) => MetricProvenance,
  metricId: string,
  threshold: number
): MetricValue {
  return rate(numerator, denominator, provenance(metricId), { threshold, state: 'derived' });
}

/** Turns `[{status, n}]` rows into a stable, sorted distribution. */
export function distribution(rows: Array<{ key: string | null; count: number }>): Distribution {
  return rows
    .map((row) => ({ key: row.key ?? 'unknown', count: Number(row.count) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export function pick(rows: Distribution, key: string): number {
  return rows.find((row) => row.key === key)?.count ?? 0;
}

export function newest(...dates: Array<Date | string | null | undefined>): string | null {
  const times = dates
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));

  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
