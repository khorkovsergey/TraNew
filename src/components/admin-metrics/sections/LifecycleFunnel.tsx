import { isNumeric, type MetricState, type MetricValue } from '@/lib/analytics/states';
import { MEANINGFUL_EVENTS } from '@/lib/admin-metrics/meaningful';
import { display, formatCount, humanize, share } from '../format';
import { Panel, Scroller, Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import type { DrawerRequest, ObservatoryData } from '../types';

/**
 * 03 — Lifecycle funnel.
 *
 * Nine stages, Awareness → Expansion, in the design's staged-column language.
 *
 * The rule that shapes the whole section: **a stage with no source stays
 * visible as a stage with no source.** Awareness has no Search Console behind
 * it and Monetization has no payment provider; both keep their column, both
 * render dashed, and neither is converted into a zero. A funnel that dropped
 * its unmeasured stages would read as a shorter product rather than as a
 * partially instrumented one, and the conversion figures between the survivors
 * would silently span a gap.
 *
 * The columns are sized against the largest *measured* stage, so an absent
 * stage cannot set the scale and the measured ones stay comparable.
 */

/**
 * Why a stage has no conversion figure, in three words.
 *
 * Each absent state gets its own line rather than sharing one: a stage that is
 * stale, a stage nobody built a source for and a stage that cannot be measured
 * at all are three different problems with three different fixes, and
 * collapsing them into "no source" was exactly the flattening this section
 * exists to prevent.
 */
const WHY_ABSENT: Record<MetricState, string> = {
  live: '',
  derived: '',
  instrumented_going_forward: '',
  insufficient_sample: 'below the sample floor',
  source_not_connected: 'no source connected',
  feature_disabled: 'feature not exposed',
  coming_soon: 'announced, inert',
  external: 'measured elsewhere',
  legacy: 'retired flow',
  stale: 'awaiting fresh telemetry',
  not_measurable: 'no mechanism exists',
};

type Stage = {
  step: string;
  label: string;
  metric: MetricValue;
  /** The count the column height is drawn from, when the stage has one. */
  count: number | null;
  /** What the previous measured stage was, for the conversion line. */
  previous: number | null;
  metricId: string;
  source: string;
};

function stagesFor(data: ObservatoryData): Stage[] {
  const { overview, portal, retention, families, coverage } = data;
  const d7 = retention.horizons.find((horizon) => horizon.horizon === 7);

  const sessions = isNumeric(overview.sessions) ? overview.sessions.value : null;
  const eligible = isNumeric(overview.eligibleSessions) ? overview.eligibleSessions.value : null;
  const continued = portal.continuation.continuedSessions || null;
  const second = portal.secondAction.numerator || null;
  const registrations = isNumeric(overview.newRegistrations) ? overview.newRegistrations.value : null;

  /*
   * The D7 numerator, reconstructed from the rate and the cohort it was taken
   * over. Not a new measurement — it is the numerator the rate was built from,
   * and it is only shown when the rate itself passed its sample threshold.
   */
  const returned =
    d7 && isNumeric(d7.returned) ? Math.round(d7.returned.value * d7.cohortSize) : null;

  const notConnected = (metricId: string, missingSource: string): MetricValue => ({
    state: 'source_not_connected',
    missingSource,
    metricId,
    source: '—',
    sourceType: 'source_not_connected',
    queriedAt: coverage.queriedAt,
  });

  return [
    {
      step: '01',
      label: 'Awareness',
      metric: notConnected('lifecycle_awareness', 'Search Console and AI-citation monitoring'),
      count: null,
      previous: null,
      metricId: 'lifecycle_awareness',
      source: '—',
    },
    {
      step: '02',
      label: 'Acquisition',
      metric: overview.sessions,
      count: sessions,
      previous: null,
      metricId: 'sessions',
      source: 'product_telemetry_event',
    },
    {
      step: '03',
      label: 'Eligible visit',
      metric: overview.eligibleSessions,
      count: eligible,
      previous: sessions,
      metricId: 'eligible_sessions',
      source: 'product_telemetry_event',
    },
    {
      step: '04',
      label: 'First meaningful action',
      metric: overview.meaningfulContinuation,
      count: continued,
      previous: eligible,
      metricId: 'pmcr',
      source: 'product_telemetry_event',
    },
    {
      step: '05',
      label: 'Activation — second action',
      metric: overview.secondActionRate,
      count: second,
      previous: continued,
      metricId: 'second_action_rate',
      source: 'product_telemetry_event',
    },
    {
      step: '06',
      label: 'Registration',
      metric: overview.newRegistrations,
      count: registrations,
      previous: null,
      metricId: 'new_registrations',
      source: 'user',
    },
    {
      step: '07',
      label: 'Return — D7',
      metric: d7 ? d7.returned : retention.anonymous,
      count: returned,
      previous: d7 ? d7.cohortSize || null : null,
      metricId: 'retention_d7',
      source: 'product_telemetry_event',
    },
    {
      step: '08',
      label: 'Monetization',
      metric: overview.confirmedRevenue,
      count: null,
      previous: null,
      metricId: 'confirmed_revenue',
      source: 'purchase',
    },
    {
      step: '09',
      label: 'Expansion',
      metric: {
        state: 'not_measurable',
        reason:
          'no plan-change record exists — `subscription` holds a current tier and is overwritten in place, so an upgrade leaves no trace to count',
        wouldRequire: 'a subscription transition log, and a provider-confirmed transaction behind it',
        metricId: 'lifecycle_expansion',
        source: 'subscription',
        sourceType: 'source_not_connected',
        queriedAt: families.queriedAt,
      },
      count: null,
      previous: null,
      metricId: 'lifecycle_expansion',
      source: 'subscription',
    },
  ];
}

export function LifecycleFunnel({
  data,
  onOpen,
}: {
  data: ObservatoryData;
  onOpen: (request: DrawerRequest) => void;
}) {
  const stages = stagesFor(data);
  const scale = Math.max(1, ...stages.map((stage) => stage.count ?? 0));

  return (
    <Section
      id="s-lifecycle"
      number="03"
      title="Lifecycle funnel"
      lede="Awareness → Acquisition → Eligible visit → First meaningful action → Activation → Registration → Return → Monetization → Expansion"
    >
      <Panel>
        <div className={styles.lifecycle}>
          {stages.map((stage) => {
            const shown = display(stage.metric, stage.metric.state === 'derived' || stage.metricId.includes('rate') || stage.metricId.startsWith('retention') || stage.metricId === 'pmcr' ? 'percent' : 'count');
            const absent = shown.kind === 'absent';
            const height = stage.count === null ? 0 : Math.max(3, (stage.count / scale) * 100);

            return (
              <button
                key={stage.step}
                type="button"
                className={styles.stageCard}
                data-absent={absent ? 'true' : 'false'}
                data-state={shown.state}
                onClick={() => onOpen({ kind: 'metric', metricId: stage.metricId, label: stage.label })}
              >
                <div className={styles.stageTop}>
                  <span className={styles.stageStep}>{stage.step}</span>
                  <StateBadge state={shown.state} small />
                </div>
                <span className={styles.stageLabel}>{stage.label}</span>

                <div className={`${styles.stageColumn} ${styles.accent}`} data-state={shown.state}>
                  <span
                    className={styles.stageColumnFill}
                    style={{ height: `${height}%` }}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  {stage.count !== null ? (
                    <div className={`${styles.stageValue} ${styles.stateText}`} data-state={shown.state}>
                      {formatCount(stage.count)}
                    </div>
                  ) : (
                    <div className={`${styles.stageAbsent} ${styles.stateText}`} data-state={shown.state}>
                      {shown.text}
                    </div>
                  )}
                  <div className={styles.stageConv}>
                    {stage.count !== null && stage.previous
                      ? `${share(stage.count, stage.previous)} of previous`
                      : absent
                        ? WHY_ABSENT[shown.state]
                        : 'no comparable previous stage'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={`${styles.twoGridWide} ${styles.gapTop}`}>
          <Scroller minWidth={600}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  <th scope="col" className={styles.right}>
                    Reached
                  </th>
                  <th scope="col" className={styles.right}>
                    From previous
                  </th>
                  <th scope="col">Source</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => {
                  const shown = display(stage.metric);
                  return (
                    <tr key={stage.step}>
                      <th scope="row" className={styles.nowrap}>
                        {stage.label}
                      </th>
                      <td className={styles.num}>
                        {stage.count !== null ? formatCount(stage.count) : '—'}
                      </td>
                      <td className={styles.num}>
                        {stage.count !== null && stage.previous ? share(stage.count, stage.previous) : '—'}
                      </td>
                      <td className={styles.nowrap}>{stage.source}</td>
                      <td>
                        <StateBadge state={shown.state} small />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroller>

          <div className={styles.subPanel}>
            <div className={styles.kicker}>What counts as a meaningful action</div>
            <div className={styles.pillRow}>
              {MEANINGFUL_EVENTS.map((event) => (
                <span key={event} className={styles.pill}>
                  {humanize(event)}
                </span>
              ))}
            </div>
            <p className={`${styles.note} ${styles.noteTop}`}>
              A plain page view is never a meaningful action. Actions on features a user cannot reach
              are excluded from both numerator and denominator rather than counted as failure. The
              list is read from the event registry, so it cannot drift from what the queries count.
            </p>
            <p className={`${styles.note} ${styles.noteTop}`}>
              Per-stage segmentation — strongest and weakest cohort, top transition — is not shown:
              the breakdowns that exist are over sessions at the continuation stage, and there is no
              equivalent for registration, return or monetization.
            </p>
          </div>
        </div>
      </Panel>
    </Section>
  );
}
