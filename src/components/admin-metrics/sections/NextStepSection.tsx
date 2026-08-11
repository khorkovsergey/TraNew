import { formatCount, share, titleize } from '../format';
import { EmptyRow, Meter, Panel, Scroller, Section, StateBadge, StatusBadge, Tile } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 05 — Find My Next Step.
 *
 * The **current** router funnel, and nothing else: open → level → intent →
 * optional clarification → recommendation → destination click.
 *
 * The retired diagnostic/plan journey — diagnostic completed, plan generated,
 * plan step started, plan step completed, save prompt viewed, registration from
 * plan, plan resumed — is not in this funnel and never will be. It has no
 * emitter, its screen is a redirect, and the seven declarations survive only in
 * the registry as `legacy`. They get their own gold panel below, which is
 * exactly what the design's Legacy state is for: visible, labelled, and
 * arithmetically separate.
 *
 * Clarification is shown beside the funnel rather than inside it. Not every
 * route asks, so a stage would report every unambiguous path as a drop-off.
 */
export function NextStepSection({ data }: { data: ObservatoryData }) {
  const funnel = data.families.start.funnel;
  const opened = funnel.stages[0]?.sessions ?? 0;

  /* The seven retired declarations, read from the registry rather than listed. */
  const legacy = data.coverage.rows.filter((row) => row.lifecycle === 'legacy');
  const stillEmitting = legacy.filter((row) => row.status === 'legacy_still_emitting');

  return (
    <Section
      id="s-start"
      number="05"
      title="Find My Next Step"
      lede="Current router funnel at /start — level → intent → optional clarification → recommendation → destination"
    >
      <div className={styles.twoGridWide}>
        {/*
          Collecting either way. No router session inside the window is an
          absence of traffic, not a sample too small to publish a rate over —
          the funnel is declared, reachable and emitting, and the note under the
          meters says which of the two a reader is looking at.
        */}
        <Panel
          title="Router funnel"
          lede="Sequential within a session: a stage counts only where the stage before it happened earlier in the same session"
          aside={<StateBadge state="instrumented_going_forward" />}
        >
          <div className={styles.stackTight}>
            {funnel.stages.map((stage) => (
              <Meter
                key={stage.stage}
                label={titleize(stage.stage)}
                value={stage.sessions}
                total={opened}
                tone="info"
                caption={
                  stage.ofPrevious === null
                    ? opened === 0
                      ? '—'
                      : `${(stage.ofPrevious ?? 1) * 100}%`
                    : `${(stage.ofPrevious * 100).toFixed(1)}% of prev`
                }
              />
            ))}
          </div>

          {opened === 0 ? (
            <p className={`${styles.note} ${styles.noteTop}`}>
              No router session has been recorded in this window. The events are declared, reachable
              and emitted — this is an absence of traffic, not of instrumentation.
            </p>
          ) : null}
        </Panel>

        <div className={styles.stack}>
          <div className={styles.twoGrid}>
            <Tile
              label="Clarification asked"
              value={formatCount(funnel.clarifiedSessions)}
              sub={
                funnel.clarificationShare === null
                  ? 'share withheld — low n'
                  : `${(funnel.clarificationShare * 100).toFixed(1)}% of sessions that reached a recommendation`
              }
              tone="neutral"
            />
            <Tile
              label="Restarted"
              value={formatCount(funnel.restartedSessions)}
              sub={
                funnel.restartShare === null
                  ? 'share withheld — low n'
                  : `${(funnel.restartShare * 100).toFixed(1)}% of sessions that opened the router`
              }
              tone="caution"
            />
            <Tile
              label="Internal destination clicks"
              value={formatCount(funnel.internalClicks)}
              sub="kept the person in the portal"
              tone="positive"
            />
            <Tile
              label="External destination clicks"
              value={formatCount(funnel.externalClicks)}
              sub="continuation, counted apart"
              tone="info"
            />
          </div>

          <Panel title="Where the router sent people" lede="Destination of the click, and whether it left the portal">
            <Scroller minWidth={360}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Destination</th>
                    <th scope="col" className={styles.right}>
                      Sessions
                    </th>
                    <th scope="col" className={styles.right}>
                      External
                    </th>
                    <th scope="col" className={styles.right}>
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.destinations.length === 0 ? (
                    <EmptyRow span={4}>No destination click has been recorded in this window.</EmptyRow>
                  ) : (
                    funnel.destinations.slice(0, 10).map((row) => (
                      <tr key={row.destination}>
                        <th scope="row">{row.destination}</th>
                        <td className={styles.num}>{formatCount(row.sessions)}</td>
                        <td className={styles.num}>{formatCount(row.external)}</td>
                        <td className={styles.num}>
                          {share(row.sessions, funnel.internalClicks + funnel.externalClicks)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Scroller>
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- Legacy telemetry */}
      <div className={styles.gapTop}>
        <Panel
          title="Legacy telemetry — the retired plan funnel"
          lede="Historical only. Never merged into the funnel above, never into PMCR, never into any rate on this page."
          aside={<StateBadge state="legacy" />}
        >
          <Scroller minWidth={620}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Retired event</th>
                  <th scope="col">Surface</th>
                  <th scope="col" className={styles.right}>
                    Rows in window
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {legacy.length === 0 ? (
                  <EmptyRow span={4}>The registry declares no legacy events.</EmptyRow>
                ) : (
                  legacy.map((row) => (
                    <tr key={row.event}>
                      <th scope="row">
                        <code className={styles.mono}>{row.event}</code>
                      </th>
                      <td>{row.surface}</td>
                      <td className={styles.num}>{formatCount(row.count)}</td>
                      <td>
                        {/*
                          Two facts, two badges. Every row here is genuinely
                          `legacy`, so that badge stays canonical — and whether
                          it is still arriving is an operational finding beside
                          it, not a different provenance. Overloading the one
                          badge lost the word "Legacy" from the row that needed
                          it most.
                        */}
                        <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                          <StateBadge state="legacy" small />
                          <StatusBadge
                            tone={row.status === 'legacy_still_emitting' ? 'negative' : 'quiet'}
                            small
                            label={row.status === 'legacy_still_emitting' ? 'Still emitting' : 'Silent'}
                            title={
                              row.status === 'legacy_still_emitting'
                                ? 'Ingest refuses legacy events, so a row can only exist if it was written before the event was reclassified'
                                : 'No row for this retired event, which is the expected state'
                            }
                          />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Scroller>

          <p className={`${styles.note} ${styles.noteTop}`}>
            {stillEmitting.length > 0 ? (
              <>
                <strong className={styles.strong}>{stillEmitting.length}</strong> of these are still
                arriving, which is a finding: ingest refuses legacy events, so a row can only exist if
                it was written before the event was reclassified.
              </>
            ) : (
              <>
                All silent, which is the expected state. Ingest refuses legacy events, so a non-zero
                count here could only be a row written before the event was reclassified.
              </>
            )}{' '}
            The current router replaced this flow: there is no diagnostic to complete, no plan to
            generate and no plan to save.
          </p>
        </Panel>
      </div>
    </Section>
  );
}
