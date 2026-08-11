import 'server-only';
import {
  count as countMetric,
  notMeasurable,
  withFreshness,
  type MetricProvenance,
  type MetricValue,
  type NumericState,
} from '@/lib/analytics/states';
import { DEFAULT_MIN_SAMPLE } from './dictionary';
import { journeyReport, type JourneyReport } from './journeys';
import {
  continuationRate,
  exclusionBreakdown,
  secondActionRate,
  timeToFirstAction,
  type ContinuationBreakdown,
  type SecondActionResult,
  type TtfaResult,
} from './sessions';
import { MAX_PROJECTION_ROWS, readSessions } from './telemetryQuery';

/**
 * The four headline metrics, composed once.
 *
 * `/overview` and `/journeys` both call this rather than each assembling the
 * numbers themselves. Two endpoints that computed PMCR separately would
 * eventually disagree about the denominator, and a dashboard where two panels
 * disagree is worse than one with fewer panels — nobody can tell which is
 * lying.
 */

const FRESHNESS_BUDGET_SECONDS = 15 * 60;

export type PortalMetrics = {
  continuation: ContinuationBreakdown;
  ttfa: TtfaResult;
  secondAction: SecondActionResult;
  journeys: JourneyReport;
  sessionsSeen: MetricValue;
  eligibleSessions: MetricValue;
  /** Set when the projection cap was hit and nothing here may be believed. */
  truncated: boolean;
  collectingSince: string | null;
  freshestAt: string | null;
  queriedAt: string;
};

export async function portalMetrics(since: Date): Promise<PortalMetrics> {
  const queriedAt = new Date();
  const read = await readSessions(since);

  /*
   * `derived`, not `telemetry`: these are rates and percentiles computed over
   * the event stream rather than counts read from it, and the distinction is
   * what tells a reader whether a number can be checked by counting rows.
   */
  const at = (metricId: string): MetricProvenance => ({
    metricId,
    source: 'product_telemetry_event',
    sourceType: 'derived',
    queriedAt: queriedAt.toISOString(),
    freshestAt: read.freshest ? read.freshest.toISOString() : undefined,
  });

  /*
   * Every telemetry-derived figure is `instrumented_going_forward` while the
   * collection start falls inside the window being asked about. Analytics was a
   * no-op before Phase 1 deployed, so a 90-day window is not ninety days of
   * data — and a card that said `live` would be claiming a history that does
   * not exist.
   */
  const partialWindow = !read.collectingSince || read.collectingSince > since;
  const state: NumericState = partialWindow ? 'instrumented_going_forward' : 'live';
  const options = { threshold: DEFAULT_MIN_SAMPLE, state };

  /*
   * A truncated read is not a smaller answer, it is a wrong one: the
   * denominator is missing whatever fell past the cap. Every rate becomes
   * `not_measurable` and says so, rather than being quietly computed over
   * whatever fitted.
   */
  if (read.truncated) {
    const blocked = (metricId: string) =>
      notMeasurable(
        `the window returned more than ${MAX_PROJECTION_ROWS.toLocaleString('en')} telemetry rows, so the session population is incomplete and every rate over it would be wrong`,
        'a narrower date range, or pushing the session aggregation into SQL — see the Phase 2 backlog',
        at(metricId)
      );

    return {
      continuation: {
        overall: blocked('pmcr'),
        internal: blocked('pmcr_internal'),
        external: blocked('pmcr_external'),
        eligibleSessions: 0,
        continuedSessions: 0,
      },
      ttfa: {
        median: blocked('ttfa_median'),
        p75: blocked('ttfa_p75'),
        p90: blocked('ttfa_p90'),
        withoutAction: blocked('ttfa_no_action'),
        sample: 0,
      },
      secondAction: { rate: blocked('second_action_rate'), numerator: 0, denominator: 0 },
      journeys: journeyReport([], {}),
      sessionsSeen: blocked('sessions'),
      eligibleSessions: blocked('eligible_sessions'),
      truncated: true,
      collectingSince: read.collectingSince ? read.collectingSince.toISOString() : null,
      freshestAt: read.freshest ? read.freshest.toISOString() : null,
      queriedAt: queriedAt.toISOString(),
    };
  }

  const continuation = continuationRate(read.facts, at, options);
  const exclusions = exclusionBreakdown(read.facts);

  return {
    continuation,
    ttfa: timeToFirstAction(read.facts, at, options),
    secondAction: secondActionRate(read.facts, at, options),
    journeys: journeyReport(read.facts, exclusions),
    sessionsSeen: withFreshness(
      countMetric(read.facts.length, at('sessions'), state),
      read.freshest,
      FRESHNESS_BUDGET_SECONDS,
      queriedAt
    ),
    eligibleSessions: countMetric(continuation.eligibleSessions, at('eligible_sessions'), state),
    truncated: false,
    collectingSince: read.collectingSince ? read.collectingSince.toISOString() : null,
    freshestAt: read.freshest ? read.freshest.toISOString() : null,
    queriedAt: queriedAt.toISOString(),
  };
}
