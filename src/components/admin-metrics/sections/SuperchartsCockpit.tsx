import { formatCount, humanize, share } from '../format';
import {
  CellBar,
  EmptyRow,
  Panel,
  Scroller,
  Section,
  StateBadge,
  StatusBadge,
  Tile,
  type Tone,
} from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * The capability outcome vocabulary, from the event registry.
 *
 * `superchart_capability_completed.outcome` is
 * `fulfilled | no_data | unsupported | failure`. There is no `success`, and an
 * earlier version compared against one — so the equality never held and every
 * outcome, `fulfilled` included, fell through to a branch that rendered it as
 * a **disabled feature**. A chart capability that worked was being reported as
 * a flag being off.
 *
 * These are visual tones now, not `MetricState`s. `no_data` is a caution and
 * not an insufficient sample; `unsupported` is a neutral category and not a
 * missing source; `failure` is negative and still says nothing about a flag.
 */
const OUTCOME_TONE: Record<string, Tone> = {
  fulfilled: 'positive',
  no_data: 'caution',
  unsupported: 'quiet',
  failure: 'negative',
};

/** What the engine did with the study. A category, carrying no judgement. */
const PLACEMENT_TONE: Record<string, Tone> = {
  pane: 'neutral',
  overlay: 'neutral',
  unknown: 'quiet',
};

/**
 * 09 — Supercharts cockpit.
 *
 * The design's panel composition, with the three product corrections that
 * outrank it.
 *
 * **Intent, rendered and outcome are three different rows.**
 * `superchart_study_toggled` fires at the top of `toggleIndicator`, before the
 * engine has done anything, so it answers "did somebody ask for RSI" and never
 * "did RSI render". `superchart_study_applied` is the render.
 * `superchart_capability_completed` is the outcome. Every rendered counter on
 * this page derives from the applied event alone; an earlier version added the
 * toggle in too and turned six applied studies into seven activations.
 *
 * **There is no TradingView handoff.** The old brief describes one and the
 * current section contains none — the handoff that exists belongs to Voyager.
 * The design's handoff panel slot is used for capability outcomes and data
 * truthfulness instead, because declaring an outcome nothing can emit would put
 * a permanent zero on the page that reads as a product decision.
 */
export function SuperchartsCockpit({ data }: { data: ObservatoryData }) {
  const charts = data.reliability.supercharts;
  const enabled = data.flags.superchartEnabled;

  return (
    <Section
      id="s-charts"
      number="09"
      title="Supercharts cockpit"
      lede="Intent, render and capability outcome are three different measurements and are never added"
    >
      {!enabled ? (
        <div className={styles.subPanel} style={{ marginBottom: 12, borderStyle: 'dashed' }}>
          <div className={styles.kicker}>Not exposed</div>
          <p className={styles.note}>
            The <code className={styles.mono}>superchartEnabled</code> flag is off, so the workspace
            is unreachable and every declared Superchart event is on a code path nobody can run. The
            counts below are what arrived while it was reachable — a zero here is the flag, not the
            product.
          </p>
        </div>
      ) : null}

      <div className={styles.fourGrid}>
        <Tile
          label="Chart opens"
          value={formatCount(charts.opens)}
          sub="superchart_opened"
          tone={enabled ? 'info' : 'quiet'}
        />
        <Tile
          label="Study requests — intent"
          value={formatCount(charts.studyRequests)}
          sub="superchart_study_toggled · a click, not a render"
          tone={enabled ? 'info' : 'quiet'}
        />
        <Tile
          label="Sessions rendering a study"
          value={formatCount(charts.sessionsWithStudy)}
          sub="superchart_study_applied only"
          tone={enabled ? 'info' : 'quiet'}
        />
        <Tile
          label="Sessions with a separate pane"
          value={formatCount(charts.sessionsWithPaneStudy)}
          sub="the engine gave the study its own axis"
          tone={enabled ? 'info' : 'quiet'}
        />
      </div>

      <div className={`${styles.twoGrid} ${styles.gapTop}`}>
        <Panel
          title="Intent and outcome are different rows"
          lede="Requested from the toggle, rendered from the applied event · the two are never summed"
        >
          <Scroller minWidth={480}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Study</th>
                  <th scope="col">Placement</th>
                  <th scope="col" className={styles.right}>Requested</th>
                  <th scope="col" className={styles.right}>Rendered</th>
                  <th scope="col">Rendered share</th>
                </tr>
              </thead>
              <tbody>
                {charts.studyMix.length === 0 && charts.requestedStudyMix.length === 0 ? (
                  <EmptyRow span={5}>
                    No study has been requested or rendered in this window.
                  </EmptyRow>
                ) : (
                  [
                    ...new Set([
                      ...charts.requestedStudyMix.map((row) => row.study),
                      ...charts.studyMix.map((row) => row.study),
                    ]),
                  ].map((study) => {
                    const requested = charts.requestedStudyMix.find((row) => row.study === study);
                    const rendered = charts.studyMix.find((row) => row.study === study);
                    const placement = rendered?.placement ?? requested?.placement ?? 'unknown';

                    return (
                      <tr key={study}>
                        <th scope="row"><code className={styles.mono}>{study}</code></th>
                        <td>
                          {/*
                            A category, not a provenance state. An overlay is
                            not "live" and a pane is not "derived" — both are
                            simply what the engine drew, and the previous
                            mapping existed only to reach two different colours.
                          */}
                          <StatusBadge
                            tone={PLACEMENT_TONE[placement] ?? 'quiet'}
                            small
                            label={placement}
                            title={
                              placement === 'pane'
                                ? 'The engine gave the study its own pane and scale'
                                : placement === 'overlay'
                                  ? 'The engine drew the study on the price axis'
                                  : 'The engine did not report a placement and the study is not in the catalogue'
                            }
                          />
                        </td>
                        <td className={styles.num}>{formatCount(requested?.requests ?? 0)}</td>
                        <td className={styles.num}>{formatCount(rendered?.activations ?? 0)}</td>
                        <td>
                          <div className={styles.barRow}>
                            <CellBar
                              value={rendered?.activations ?? 0}
                              total={Math.max(1, charts.overlayActivations + charts.paneActivations)}
                            />
                            <span className={styles.barValue}>
                              {share(
                                rendered?.activations ?? 0,
                                charts.overlayActivations + charts.paneActivations
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Scroller>

          <div className={`${styles.twoGrid} ${styles.gapTop}`}>
            <Tile
              label="Overlay renders"
              value={formatCount(charts.overlayActivations)}
              sub="drawn on the price axis"
              tone="info"
            />
            <Tile
              label="Separate-pane renders"
              value={formatCount(charts.paneActivations)}
              sub="the engine gave it its own scale"
              tone="info"
            />
          </div>

          <p className={`${styles.note} ${styles.noteTop}`}>
            A toggle-off is somebody removing a study and is not counted as use. Rendered placement
            comes from the applied event&apos;s own <code className={styles.mono}>placement</code> —
            what the engine did — falling back to the catalogue only when the property is absent.
            Toggles recorded before the applied event shipped are{' '}
            <strong className={styles.strong}>not backfilled as rendered activity</strong>: nobody
            observed whether the engine painted them, and assuming it did would manufacture renders.
          </p>
        </Panel>

        <div className={styles.stack}>
          <Panel
            title="Capability outcomes"
            lede="What the engine reported when a capability finished"
            aside={
              <StateBadge
                state={charts.awaitingCapabilityEmitter ? 'not_measurable' : 'instrumented_going_forward'}
              />
            }
          >
            {charts.awaitingCapabilityEmitter ? (
              <p className={styles.note}>
                The <code className={styles.mono}>superchart_capability_completed</code> emitter has
                never fired, so capability success and failure are not measurable rather than zero.
                This panel occupies the slot the old brief gave to a{' '}
                <strong className={styles.strong}>native vs TradingView handoff</strong> split, which
                is not reintroduced: Supercharts has no handoff, and a permanent zero would read as a
                product decision rather than as an absence.
              </p>
            ) : (
              <div>
                {charts.capability.map((row) => {
                  const tone = OUTCOME_TONE[row.outcome] ?? 'quiet';
                  return (
                    <div key={row.outcome} className={styles.kv}>
                      <span className={styles.kvLabel}>
                        <StatusBadge tone={tone} small label={humanize(row.outcome)} />
                      </span>
                      <span className={`${styles.kvValue} ${styles.toneText}`} data-tone={tone}>
                        {formatCount(row.count)}
                      </span>
                    </div>
                  );
                })}
                <p className={`${styles.note} ${styles.noteTop}`}>
                  <strong className={styles.strong}>Fulfilled</strong> is the capability working.{' '}
                  <strong className={styles.strong}>No data</strong> is the engine finishing with
                  nothing to draw, <strong className={styles.strong}>unsupported</strong> is a
                  capability the chart does not offer for that input, and{' '}
                  <strong className={styles.strong}>failure</strong> is it going wrong. None of the
                  four says anything about a feature flag.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Native panes" lede="The three studies the product built native panes for">
            <div className={styles.threeGrid}>
              {charts.nativePaneMix.map((row) => (
                <Tile
                  key={row.study}
                  label={row.study.toUpperCase()}
                  value={formatCount(row.activations)}
                  sub="renders"
                  tone={row.activations > 0 ? 'info' : 'quiet'}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Drawings, layouts and Pine" lede="Durable-feeling actions, all behavioural">
            <div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Drawings created</span>
                <span className={styles.kvValue}>{formatCount(charts.drawings)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Layouts saved</span>
                <span className={styles.kvValue}>{formatCount(charts.layoutsSaved)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Pine scripts generated</span>
                <span className={styles.kvValue}>{formatCount(charts.scriptsGenerated)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Pine scripts exported</span>
                <span className={styles.kvValue}>{formatCount(charts.scriptsExported)}</span>
              </div>
            </div>

            <p className={`${styles.note} ${styles.noteTop}`}>
              Pine is generated, exported and previewed —{' '}
              <strong className={styles.strong}>never executed or backtested</strong>. A preview is a
              syntax and shape check, so no result, return or win rate exists for any script the
              product produced.
            </p>

            {charts.previewOutcomes.length > 0 ? (
              <>
                <div className={`${styles.kicker} ${styles.noteTop}`}>Preview runs</div>
                <div className={styles.pillRow}>
                  {charts.previewOutcomes.map((row) => (
                    <span key={row.outcome} className={styles.pill}>
                      {humanize(row.outcome)} · {row.count}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </Panel>
        </div>
      </div>
    </Section>
  );
}
