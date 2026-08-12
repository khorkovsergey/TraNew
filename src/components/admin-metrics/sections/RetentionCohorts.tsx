import { isNumeric } from '@/lib/analytics/states';
import { display, formatCount } from '../format';
import { KpiCard, Panel, Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import type { DrawerRequest, ObservatoryData } from '../types';

/**
 * 06 — Retention & cohorts.
 *
 * D1/D7/D30 cards over the cohort heatmap, in the design's dense grid language.
 *
 * Two rules from the current implementation survive the redesign intact.
 * **Retention is authenticated only** — the portal has no cross-session
 * anonymous identity and none was invented, so the anonymous row is
 * `not_measurable` and says what enabling it would cost. And **the windows are
 * cumulative**, so D1 ≤ D7 ≤ D30 always; the heatmap uses the same cumulative
 * rule rather than a per-offset-day return curve, because two retention
 * semantics side by side would disagree for reasons no reader could resolve.
 *
 * A cell is blank for two different reasons and says which: the cohort is too
 * young for the window, or it is too small to publish a rate. Neither is zero.
 */
export function RetentionCohorts({
  data,
  onOpen,
}: {
  data: ObservatoryData;
  onOpen: (request: DrawerRequest) => void;
}) {
  const { retention, cohorts } = data;

  /* The heat ramp: mint at the top, fading toward the panel as the rate drops. */
  const heat = (rate: number) => {
    const clamped = Math.max(0, Math.min(1, rate));
    return {
      background: `rgba(46, 230, 168, ${(0.14 + clamped * 0.76).toFixed(3)})`,
      color: clamped > 0.35 ? 'var(--obs-page)' : 'var(--obs-text)',
    };
  };

  return (
    <Section
      id="s-retention"
      number="06"
      title="Retention &amp; cohorts"
      lede="Cumulative return windows from the first eligible portal day · authenticated users only"
    >
      <div className={styles.fourGrid}>
        {retention.horizons.map((horizon) => (
          <KpiCard
            key={horizon.horizon}
            label={`Authenticated D${horizon.horizon} return`}
            metric={horizon.returned}
            format="percent"
            denominator={`of ${formatCount(horizon.cohortSize)} mature cohort members · ${formatCount(horizon.immatureUsers)} too young to count`}
            onOpen={() =>
              onOpen({
                kind: 'metric',
                metricId: `retention_d${horizon.horizon}`,
                label: `Authenticated D${horizon.horizon} return`,
              })
            }
          />
        ))}
        <KpiCard
          label="Anonymous D1/D7/D30 return"
          metric={retention.anonymous}
          onOpen={() =>
            onOpen({ kind: 'metric', metricId: 'retention_anonymous', label: 'Anonymous return' })
          }
        />
      </div>

      <div className={`${styles.twoGridWide} ${styles.gapTop}`}>
        <Panel
          title="Cohort heatmap"
          lede={`Share of each cohort that had another eligible portal day within the window · cumulative, so each row is non-decreasing`}
          aside={<StateBadge state={cohorts.empty ? 'insufficient_sample' : 'derived'} />}
        >
          {cohorts.rows.length === 0 ? (
            <p className={styles.note}>
              No cohort has formed since telemetry began. A cohort starts on a user&apos;s first
              eligible portal day, and a user whose first day predates collection is excluded rather
              than counted as churned — nobody was watching over that window.
            </p>
          ) : (
            <>
              <div
                className={styles.cohortGrid}
                style={{
                  gridTemplateColumns: `86px 52px repeat(${cohorts.offsets.length}, minmax(0, 1fr))`,
                }}
                role="table"
                aria-label="Cohort retention heatmap"
              >
                <div className={styles.cohortHeadCell} style={{ justifyContent: 'flex-start' }}>
                  Cohort
                </div>
                <div className={styles.cohortHeadCell}>Size</div>
                {cohorts.offsets.map((offset) => (
                  <div key={offset} className={styles.cohortHeadCell}>
                    D{offset}
                  </div>
                ))}

                {cohorts.rows.map((row) => (
                  <div key={row.day} style={{ display: 'contents' }}>
                    <div className={styles.cohortRowLabel}>{row.day}</div>
                    <div className={styles.cohortCell} title={`${row.size} users started on ${row.day}`}>
                      {row.size}
                    </div>
                    {row.cells.map((cell) => {
                      const filled = cell.reason === 'ok' && cell.rate !== null;
                      const title =
                        cell.reason === 'immature'
                          ? `Cohort ${row.day} has not yet had ${cell.offset} days to return`
                          : cell.reason === 'insufficient'
                            ? `${row.size} of ${cohorts.minimumCohort} needed before a rate is published — ${cell.returned} returned`
                            : `${cell.returned} of ${row.size} returned within ${cell.offset} days`;

                      return (
                        <div
                          key={cell.offset}
                          className={styles.cohortCell}
                          data-filled={filled ? 'true' : 'false'}
                          style={filled ? heat(cell.rate!) : undefined}
                          title={title}
                        >
                          {filled
                            ? `${(cell.rate! * 100).toFixed(0)}%`
                            : cell.reason === 'immature'
                              ? '·'
                              : cell.returned > 0
                                ? `${cell.returned}`
                                : '—'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <p className={`${styles.note} ${styles.noteTop}`}>
                <span className={styles.mono}>·</span> the cohort has not yet had that many days to
                return. A number without a percentage is a raw return count over a cohort below{' '}
                {cohorts.minimumCohort}, where a rate would describe individuals. Neither is zero.
              </p>
            </>
          )}
        </Panel>

        <div className={styles.stack}>
          <Panel title="Population" lede="Who is in a cohort at all">
            <div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Users with an eligible portal day</span>
                <span className={styles.kvValue}>{formatCount(retention.usersWithEligiblePortalDay)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Cohorts formed since telemetry began</span>
                <span className={styles.kvValue}>{formatCount(cohorts.rows.length)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Telemetry started</span>
                <span className={styles.kvValue}>{retention.telemetryStartedOn ?? '—'}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Minimum cohort for a rate</span>
                <span className={styles.kvValue}>{cohorts.minimumCohort}</span>
              </div>
            </div>
            <p className={`${styles.note} ${styles.noteTop}`}>
              A cohort starts on the user&apos;s first <strong className={styles.strong}>eligible
              portal day</strong> — a UTC day with a page view on a real customer surface. Not their
              first telemetry row, not a server event, not sign-in plumbing, not an Observatory
              visit. A user with no eligible portal day has not started a cohort and can be neither
              retained nor lost from one.
            </p>
          </Panel>

          <Panel title="Returned, and returned meaningfully" lede="Reported apart and never conflated">
            {retention.horizons.map((horizon) => {
              const returned = display(horizon.returned, 'percent');
              const meaningful = display(horizon.returnedMeaningfully, 'percent');
              return (
                <div key={horizon.horizon} className={styles.kv}>
                  <span className={styles.kvLabel}>D{horizon.horizon}</span>
                  <span className={styles.kvValue}>
                    <span className={styles.stateText} data-state={returned.state}>
                      {returned.text}
                    </span>
                    <span style={{ color: 'var(--obs-faint)' }}> came back · </span>
                    <span className={styles.stateText} data-state={meaningful.state}>
                      {meaningful.text}
                    </span>
                    <span style={{ color: 'var(--obs-faint)' }}> also acted</span>
                  </span>
                </div>
              );
            })}
            <p className={`${styles.note} ${styles.noteTop}`}>
              A meaningful action on a day with no portal visit counts as neither: the person was not
              there.{' '}
              {isNumeric(retention.horizons[0]?.returned)
                ? null
                : 'Both figures are withheld until the cohorts are large enough for a rate.'}
            </p>
          </Panel>
        </div>
      </div>

      <p className={`${styles.note} ${styles.noteTop}`}>
        Split-by controls — acquisition source, entitlement, device, landing surface — are not
        offered here. Cohort membership is keyed on the authenticated user and the session
        attributes those splits need are not carried onto the user-day rows, so a split would be a
        different population from the one the D-numbers are computed over.
      </p>
    </Section>
  );
}
