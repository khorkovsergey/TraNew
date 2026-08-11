import type { BreakdownRow } from '@/lib/admin-metrics/journeys';
import { formatCount, humanize, share, titleize, widthOf } from '../format';
import { CellBar, EmptyRow, Panel, Scroller, Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 04 — Continuation & research journeys.
 *
 * Three panels from the handoff: continuation by landing surface, the hop-by-hop
 * journey paths, and the dead-end ranking.
 *
 * The design's landing table also carries a second-action and a TTFA column per
 * surface. Neither is segmented in the current query layer — both exist only as
 * portal-wide figures — so those columns are absent rather than filled with the
 * global number repeated down the page, which would read as a per-surface
 * measurement and be wrong in every row but the aggregate.
 *
 * "Exit" is rendered as **did not continue**, which is what the data defines: an
 * eligible session with no meaningful action. It is not a bounce rate and not an
 * exit rate in the analytics sense, and calling it either would import a
 * definition nothing here computes.
 */

/** The hop visualisation, built only from funnels that are genuinely sequential. */
function Path({
  label,
  total,
  hops,
}: {
  label: string;
  total: number;
  hops: Array<{ label: string; value: number }>;
}) {
  const base = hops[0]?.value ?? 0;

  return (
    <div>
      <div className={styles.pathHead}>
        <span className={styles.pathLabel}>{label}</span>
        <span className={styles.pathN}>{formatCount(total)} sessions</span>
      </div>
      <div className={styles.hops}>
        {hops.map((hop, index) => {
          const width = base > 0 ? Math.max(6, (hop.value / base) * 100) : 0;
          const reached = hop.value > 0;

          return (
            <div
              key={hop.label}
              className={`${styles.hop} ${reached ? styles.stateText : styles.hopEmpty}`}
              data-state={reached ? 'derived' : 'insufficient_sample'}
              style={{ flex: `0 1 ${width}%`, minWidth: 44 }}
              title={`${hop.label} — ${formatCount(hop.value)}${
                index > 0 && base > 0 ? ` · ${share(hop.value, base)} of the first hop` : ''
              }`}
            >
              <span className={reached ? styles.hopInner : undefined}>
                {formatCount(hop.value)}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.pathHead} style={{ marginTop: 3, marginBottom: 0 }}>
        <span className={styles.rankNote}>{hops.map((hop) => hop.label).join(' → ')}</span>
      </div>
    </div>
  );
}

export function ContinuationJourneys({ data }: { data: ObservatoryData }) {
  const journeys = data.portal.journeys;
  const { secondAction, continuation } = data.portal;
  const start = data.families.start.funnel;
  const events = data.families.events.funnel;

  const landings = journeys.byLandingSurface;

  /*
   * A dead end is an eligible session that arrived and did nothing. Ranked by
   * the share that did not continue, and only over rows large enough to publish
   * a rate at all — a surface with four sessions is not a finding.
   */
  const deadEnds: BreakdownRow[] = [...landings]
    .filter((row) => !row.suppressed && row.rate !== null)
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))
    .slice(0, 7);

  const exclusions = Object.entries(journeys.exclusions).sort((a, b) => b[1] - a[1]);
  const split = journeys.internalVsExternal;

  return (
    <Section
      id="s-continuation"
      number="04"
      title="Continuation &amp; research journeys"
      lede="Where the journey continues, where it stops"
    >
      <Panel
        title="Continuation by landing surface"
        lede={`Sorted by session volume · the landing surface is the first product surface of the session · rows under ${journeys.minimumCohort} sessions report a count and withhold the rate`}
      >
        <Scroller minWidth={760}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Landing surface</th>
                <th scope="col" className={styles.right}>
                  Sessions
                </th>
                <th scope="col" className={styles.right}>
                  Continued
                </th>
                <th scope="col" className={styles.right}>
                  PMCR
                </th>
                <th scope="col" className={styles.right}>
                  Did not continue
                </th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {landings.length === 0 ? (
                <EmptyRow span={6}>
                  No eligible session has been recorded in this window. Telemetry began at the Phase 1
                  deployment, and this is an absence of collected sessions rather than of visitors.
                </EmptyRow>
              ) : (
                landings.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className={styles.nowrap}>
                      {titleize(row.key)}
                    </th>
                    <td className={styles.num}>{formatCount(row.sessions)}</td>
                    <td className={styles.num}>{formatCount(row.continued)}</td>
                    <td>
                      <div className={styles.barRowEnd}>
                        {row.rate === null ? null : (
                          <CellBar value={row.continued} total={row.sessions} />
                        )}
                        <span
                          className={`${styles.barValue} ${styles.stateText}`}
                          data-state={row.rate === null ? 'insufficient_sample' : 'derived'}
                        >
                          {row.rate === null ? 'low n' : share(row.continued, row.sessions)}
                        </span>
                      </div>
                    </td>
                    <td className={styles.num}>{formatCount(row.sessions - row.continued)}</td>
                    <td>
                      <StateBadge state={row.suppressed ? 'insufficient_sample' : 'derived'} small />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Scroller>
        <p className={`${styles.note} ${styles.noteTop}`}>
          Second-action and time-to-first-action are portal-wide in the current query layer and are
          not segmented by landing surface, so those columns are absent rather than repeated.
        </p>
      </Panel>

      <div className={`${styles.twoGridWide} ${styles.gapTop}`}>
        <Panel title="Journey paths" lede="Session share reaching each hop · the bar stops where the path stops">
          <div className={styles.stack}>
            <Path
              label="Portal continuation"
              total={continuation.eligibleSessions}
              hops={[
                { label: 'Eligible session', value: continuation.eligibleSessions },
                { label: 'First meaningful action', value: continuation.continuedSessions },
                { label: 'Second meaningful action', value: secondAction.numerator },
              ]}
            />

            <Path
              label="Find my next step"
              total={start.sessionsSeen}
              hops={start.stages.map((stage) => ({
                label: titleize(stage.stage),
                value: stage.sessions,
              }))}
            />

            <Path
              label="Events discovery"
              total={events.sessionsSeen}
              hops={events.stages.map((stage) => ({
                label: titleize(stage.stage.replace(/^events?_/, '')),
                value: stage.sessions,
              }))}
            />
          </div>

          <p className={`${styles.note} ${styles.noteTop}`}>
            Only chains the telemetry orders sequentially within a session are drawn. A hop is
            counted where every earlier hop happened earlier in the same session — dividing one event
            total by another would assume an order the events do not carry.
          </p>
        </Panel>

        <div className={styles.stack}>
          <Panel title="Dead ends" lede="Eligible sessions that arrived and did nothing else">
            {deadEnds.length === 0 ? (
              <p className={styles.note}>
                No landing surface has reached {journeys.minimumCohort} sessions, which is the
                threshold below which a continuation rate describes individuals rather than a
                pattern. Counts are in the table above.
              </p>
            ) : (
              <div>
                {deadEnds.map((row) => (
                  <div key={row.key} className={styles.rankRow}>
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.rankName}>{titleize(row.key)}</div>
                      <div className={styles.rankNote}>
                        {formatCount(row.sessions - row.continued)} of {formatCount(row.sessions)} did
                        not continue
                      </div>
                    </div>
                    <span
                      className={`${styles.rankValue} ${styles.stateText}`}
                      data-state="derived"
                    >
                      {share(row.sessions - row.continued, row.sessions)}
                    </span>
                    <span className={styles.rankN}>{formatCount(row.sessions)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Internal, external, both, neither" lede="A session that left is not a session that stayed">
            <div>
              {(
                [
                  ['Stayed in the portal', split.internalOnly, 'derived'],
                  ['Continued outward only', split.externalOnly, 'external'],
                  ['Both', split.both, 'derived'],
                  ['Neither', split.neither, 'insufficient_sample'],
                ] as const
              ).map(([label, value, state]) => (
                <div key={label} className={styles.kv}>
                  <span className={styles.kvLabel}>{label}</span>
                  <span className={styles.kvValue}>
                    <span className={styles.mono}>{formatCount(value)}</span>{' '}
                    <span className={`${styles.stateText}`} data-state={state}>
                      {share(value, journeys.eligibleSessions)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className={styles.gapTop}>
        <Panel
          title="Why sessions left the denominator"
          lede="A denominator that shrank is something a reader has to be able to see"
        >
          <Scroller minWidth={420}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Reason</th>
                  <th scope="col" className={styles.right}>
                    Sessions
                  </th>
                  <th scope="col" className={styles.right}>
                    Share of excluded
                  </th>
                  <th scope="col">Bar</th>
                </tr>
              </thead>
              <tbody>
                {exclusions.length === 0 ? (
                  <EmptyRow span={4}>Nothing was excluded in this window.</EmptyRow>
                ) : (
                  exclusions.map(([reason, count]) => {
                    const total = exclusions.reduce((sum, [, n]) => sum + n, 0);
                    return (
                      <tr key={reason}>
                        <th scope="row">{humanize(reason)}</th>
                        <td className={styles.num}>{formatCount(count)}</td>
                        <td className={styles.num}>{share(count, total)}</td>
                        <td>
                          <div className={`${styles.barTrack} ${styles.stateText}`} data-state="derived">
                            <span
                              className={styles.barFill}
                              style={{ width: widthOf(count, total) }}
                              aria-hidden="true"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Scroller>
        </Panel>
      </div>
    </Section>
  );
}
