import { isNumeric } from '@/lib/analytics/states';
import { KpiCard, Panel, Section, StateBadge } from '../primitives';
import { formatCount } from '../format';
import styles from '../Observatory.module.css';
import type { ObservatoryData, DrawerRequest } from '../types';

/**
 * 01 — Executive overview.
 *
 * The design's first screenful: eight KPI cards over a North Star trend panel.
 *
 * Two things the mockup has that this does not, and both absences are the
 * point. There is **no sparkline**, because no daily series exists in the query
 * layer and a shaped path drawn from nothing is the most convincing thing on a
 * dashboard. There is **no delta**, because no previous-period comparison
 * exists — `+2.1 pp vs previous period` under a real number would be a lie
 * wearing the credibility of the number above it.
 *
 * The North Star panel keeps its proportions and says so in the state language
 * of the design, rather than being deleted or filled in.
 */
export function ExecutiveOverview({
  data,
  onOpen,
}: {
  data: ObservatoryData;
  onOpen: (request: DrawerRequest) => void;
}) {
  const { overview, retention, voyager, portal } = data;
  const d7 = retention.horizons.find((horizon) => horizon.horizon === 7);

  const pmcr = overview.meaningfulContinuation;
  const eligible = isNumeric(overview.eligibleSessions) ? overview.eligibleSessions.value : 0;

  const open = (metricId: string, label: string) => () => onOpen({ kind: 'metric', metricId, label });

  return (
    <Section
      id="s-exec"
      number="01"
      title="Executive overview"
      lede="Are we turning a one-off informational visit into a journey, a return and monetizable value?"
    >
      <div className={styles.kpiGrid}>
        <KpiCard
          label="Eligible sessions"
          metric={overview.eligibleSessions}
          denominator={`of ${formatCount(isNumeric(overview.sessions) ? overview.sessions.value : 0)} sessions seen`}
          onOpen={open('eligible_sessions', 'Eligible sessions')}
        />
        <KpiCard
          label="Portal Meaningful Continuation Rate"
          metric={pmcr}
          format="percent"
          denominator={
            isNumeric(pmcr)
              ? `${formatCount(portal.continuation.continuedSessions)} of ${formatCount(eligible)} eligible sessions`
              : undefined
          }
          onOpen={open('pmcr', 'Portal Meaningful Continuation Rate')}
        />
        <KpiCard
          label="Second meaningful action"
          metric={overview.secondActionRate}
          format="percent"
          denominator={`of ${formatCount(portal.secondAction.denominator)} sessions that acted once`}
          onOpen={open('second_action_rate', 'Second meaningful action rate')}
        />
        <KpiCard
          label="Authenticated D7 return"
          metric={d7 ? d7.returned : overview.anonymousReturn}
          format="percent"
          denominator={d7 ? `of ${formatCount(d7.cohortSize)} mature cohort members` : undefined}
          onOpen={open('retention_d7', 'Authenticated D7 return')}
        />
        <KpiCard
          label="Time to first meaningful action"
          metric={overview.ttfaMedian}
          format="seconds"
          denominator="median over sessions that acted"
          onOpen={open('ttfa_median', 'Time to first meaningful action')}
        />
        <KpiCard
          label="Real AI answer rate"
          metric={voyager.headline.realAnswerRate}
          format="percent"
          denominator="of executed Voyager requests"
          onOpen={open('voyager_real_answer_rate', 'Real AI answer rate')}
        />
        <KpiCard
          label="New registrations"
          metric={overview.newRegistrations}
          denominator={`of ${formatCount(isNumeric(overview.registeredUsers) ? overview.registeredUsers.value : 0)} registered users`}
          onOpen={open('new_registrations', 'New registrations')}
        />
        <KpiCard
          label="Confirmed revenue"
          metric={overview.confirmedRevenue}
          onOpen={open('confirmed_revenue', 'Confirmed revenue')}
        />
      </div>

      <div className={styles.gapTop}>
        <Panel
          title="North Star trend"
          lede="PMCR and D7 authenticated return, over time"
          aside={<StateBadge state="not_measurable" />}
        >
          {/*
            The design draws a two-series daily chart with release annotations
            and a dashed comparison basis. None of the three exists: the query
            layer returns one aggregate per window, there is no previous-period
            source, and the build pipeline publishes no timestamped change list.
            The panel keeps its place and its proportions and says which of the
            three is missing, because the missing series is itself a finding
            about the measurement layer.
          */}
          <div className={styles.subPanel} style={{ minHeight: 182, display: 'grid', placeItems: 'center' }}>
            <div style={{ maxWidth: 560, textAlign: 'center' }}>
              <div className={styles.kicker}>Historical trend not available</div>
              <p className={styles.note}>
                The current query layer returns one aggregate per window, not a daily series. No
                previous-period comparison basis exists and no release annotation feed is published,
                so a trend line here would be drawn rather than measured. PMCR and D7 are exact for
                the selected window and are shown above.
              </p>
              <p className={`${styles.note} ${styles.noteTop}`}>
                Collecting since{' '}
                <strong className={styles.strong}>{portal.collectingSince ?? 'nothing has arrived yet'}</strong>.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
