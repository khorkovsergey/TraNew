import { type MetricValue } from '@/lib/analytics/states';
import { display, type ValueFormat } from '../format';
import { Panel, Scroller, Section, StatusBadge, type Tone } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 02 — Strategy → Observability.
 *
 * The traceability matrix: every product hypothesis, the surface that carries
 * it, whether the surface is instrumented, the metric that would move, the
 * guardrail that must not, and what the signal is right now.
 *
 * Built entirely on the frontend from things already on the page — the metric
 * dictionary, the coverage report, the surface registry and the runtime flags.
 * No new query, and none needed: the matrix is a join across data the page has
 * already fetched, and stating it as a table is the whole contribution.
 *
 * The hypotheses are the product's own, taken from what the sections below
 * actually measure rather than from the design's placeholder list. Each row
 * names a real `metricId`, so the signal cell can never drift from the number
 * the rest of the page shows: it is the same `MetricValue`, formatted once.
 */

type Row = {
  hypothesis: string;
  surface: string;
  /** The coverage key this row's instrumentation verdict is read from. */
  coverageSurfaces: readonly string[];
  metric: string;
  guardrail: string;
  signal: MetricValue;
  format?: ValueFormat;
};

/**
 * The instrumentation verdict for a row, from the real coverage report.
 *
 * A coverage ratio, so a tone rather than a `MetricState`. The provenance of
 * the number itself is in the Current signal column beside it, which renders
 * the real `MetricValue` and its canonical state — so an unreachable surface
 * still reads "Not exposed" there, from the metric rather than from a colour
 * chosen here.
 */
function instrumentation(
  data: ObservatoryData,
  surfaces: readonly string[]
): { label: string; tone: Tone; title: string } {
  const rows = data.coverage.rows.filter(
    (row) => surfaces.includes(row.surface) && row.lifecycle === 'current'
  );

  if (rows.length === 0) {
    return {
      label: 'None declared',
      tone: 'quiet',
      title: 'No behavioural event is declared for this surface',
    };
  }

  const observed = rows.filter((row) => row.status === 'observed').length;
  const unexposed = rows.filter((row) => row.status === 'unexposed').length;

  if (unexposed === rows.length) {
    return {
      label: `${rows.length} unreachable`,
      tone: 'negative',
      title: 'Every declared event is behind a feature flag that is off',
    };
  }

  return {
    label: `${observed} / ${rows.length} seen`,
    tone: observed === rows.length ? 'positive' : observed > 0 ? 'info' : 'caution',
    title: 'Declared current events for this surface, and how many have arrived',
  };
}

function rowsFor(data: ObservatoryData): Row[] {
  const { overview, voyager, reliability, families, retention } = data;
  const d7 = retention.horizons.find((horizon) => horizon.horizon === 7);

  return [
    {
      hypothesis: 'A beginner who lands on an answer will continue into a journey rather than leave',
      surface: 'Home, Markets, Explore, Symbols, Research',
      coverageSurfaces: ['portal', 'home', 'markets', 'explore', 'symbols', 'research'],
      metric: 'Portal Meaningful Continuation Rate',
      guardrail: 'A page view is never meaningful, so the rate is allowed to be low',
      signal: overview.meaningfulContinuation,
      format: 'percent',
    },
    {
      hypothesis: 'A router that asks two questions beats a diagnostic that asks twelve',
      surface: 'Find my next step · /start',
      coverageSurfaces: ['start'],
      metric: 'Router funnel — open → level → intent → recommendation → destination',
      guardrail: 'Clarification is optional and never a denominator',
      signal: overview.secondActionRate,
      format: 'percent',
    },
    {
      hypothesis: 'An AI that answers in the product keeps research inside the portal',
      surface: 'Voyager · /voyager, /voyager/research',
      coverageSurfaces: ['voyager', 'voyager_research'],
      metric: 'Real AI answer rate over executed requests',
      guardrail: 'A scripted fallback is never counted as a real answer',
      signal: voyager.headline.realAnswerRate,
      format: 'percent',
    },
    {
      hypothesis: 'Native multi-pane studies remove the reason to leave for another charting tool',
      surface: 'Supercharts · /supercharts',
      coverageSurfaces: ['supercharts'],
      metric: 'Sessions that rendered a study on its own pane',
      guardrail: 'A toggle is intent; only an applied study is a render',
      signal: {
        state: data.flags.superchartEnabled ? 'instrumented_going_forward' : 'feature_disabled',
        ...(data.flags.superchartEnabled
          ? { value: reliability.supercharts.sessionsWithPaneStudy, sample: reliability.supercharts.sessionsSeen }
          : { feature: 'Supercharts' }),
        metricId: 'superchart_pane_sessions',
        source: 'product_telemetry_event · superchart_study_applied',
        sourceType: 'telemetry',
        queriedAt: reliability.queriedAt,
      } as MetricValue,
    },
    {
      hypothesis: 'People who register come back within a week',
      surface: 'Accounts, and every surface behind sign-in',
      coverageSurfaces: ['portal', 'account'],
      metric: 'Authenticated D7 return',
      guardrail: 'Anonymous cross-session return stays not measurable',
      signal: d7 ? d7.returned : retention.anonymous,
      format: 'percent',
    },
    {
      hypothesis: 'Community events convert an audience into registered members',
      surface: 'Events · /events',
      coverageSurfaces: ['events'],
      metric: 'Event registrations, and attendance where an organiser marked it',
      guardrail: 'Unresolved seats are reported apart, never as non-attendance',
      signal: families.events.metrics.registrations,
    },
    {
      hypothesis: 'A structured path finishes more lessons than a library does',
      surface: 'Learn · /academy',
      coverageSurfaces: ['academy'],
      metric: 'Academy completion rate over learners with a progress row',
      guardrail: 'A current-state table is not a cohort completion rate',
      signal: families.academy.metrics.completionRate ?? families.academy.metrics.learners,
      format: 'percent',
    },
    {
      hypothesis: 'Expert consultations are the paid bridge out of self-service',
      surface: 'Expert services · /marketplace/experts',
      coverageSurfaces: ['experts'],
      metric: 'Bookings by current pipeline status',
      guardrail: 'No conversion rate is published — draft and completed are not comparable',
      signal: families.experts.metrics.bookings,
    },
    {
      hypothesis: 'A private balance sheet makes the portal a place people return to',
      surface: 'Wealth Hub · /account/wealth',
      coverageSurfaces: ['wealth'],
      metric: 'Adoption — distinct users with a current record',
      guardrail: 'Counts and presence only; no monetary column is ever selected',
      signal: families.wealth.metrics.voyagerContextGranted ?? overview.anonymousReturn,
    },
    {
      hypothesis: 'Subscriptions turn sustained use into recurring revenue',
      surface: 'Subscriptions · /marketplace/subscriptions',
      coverageSurfaces: ['subscriptions'],
      metric: 'Provider-confirmed transactions',
      guardrail: 'A paid row is an application record, and a demo entitlement is not money',
      signal: overview.confirmedRevenue,
    },
    {
      hypothesis: 'Organic discovery brings beginners who continue as well as referred ones do',
      surface: 'Search engines, AI assistants',
      coverageSurfaces: [],
      metric: 'Continuation by acquisition source',
      guardrail: 'Nothing is inferred from a source that is not connected',
      signal: {
        state: 'source_not_connected',
        missingSource: 'Search Console and AI-citation monitoring',
        metricId: 'acquisition_organic',
        source: '—',
        sourceType: 'source_not_connected',
        queriedAt: data.coverage.queriedAt,
      },
    },
    {
      hypothesis: 'A fast portal continues more sessions than a slow one',
      surface: 'Every surface',
      coverageSurfaces: ['portal'],
      metric: 'LCP p75, and client runtime failures per 1,000 page views',
      guardrail: 'CLS is a score, not a duration; no provider uptime is claimed',
      signal: reliability.failures.perThousandPageViews,
      format: 'ratio',
    },
  ];
}

export function StrategyObservability({ data }: { data: ObservatoryData }) {
  const rows = rowsFor(data);

  return (
    <Section
      id="s-strategy"
      number="02"
      title="Strategy → Observability"
      lede="Every hypothesis, its live surface, its metric, its guardrail — and whether it is actually measured"
    >
      <Panel flush>
        <Scroller minWidth={1120}>
          <table className={`${styles.table} ${styles.tableInset}`}>
            <thead>
              <tr>
                <th scope="col">Hypothesis / initiative</th>
                <th scope="col">Product surface</th>
                <th scope="col">Instrumentation</th>
                <th scope="col">Primary metric</th>
                <th scope="col">Guardrail</th>
                <th scope="col">Current signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = instrumentation(data, row.coverageSurfaces);
                const shown = display(row.signal, row.format ?? 'count');

                return (
                  <tr key={row.hypothesis}>
                    <th scope="row" className={styles.strong}>
                      {row.hypothesis}
                    </th>
                    <td>{row.surface}</td>
                    <td>
                      <StatusBadge tone={status.tone} small label={status.label} title={status.title} />
                    </td>
                    <td className={styles.strong} style={{ fontWeight: 500 }}>
                      {row.metric}
                    </td>
                    <td>{row.guardrail}</td>
                    <td>
                      <span
                        className={`${styles.stateText} ${styles.nowrap}`}
                        data-state={shown.state}
                        style={{ fontWeight: 700 }}
                        title={shown.kind === 'absent' ? shown.detail : undefined}
                      >
                        {shown.text}
                      </span>
                      {shown.kind === 'absent' ? (
                        <div className={styles.rankNote}>{shown.detail}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroller>
      </Panel>
    </Section>
  );
}
