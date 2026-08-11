import { METRIC_STATES, type MetricState } from '@/lib/analytics/states';
import { STATE_LABEL, STATE_MEANING, formatCount } from '../format';
import { Panel, Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 14 — Panel states.
 *
 * The empty-state kit, rendered as real components rather than described.
 *
 * The design shipped eight states plus loading, delayed analytics and unhealthy
 * ingestion. `states.ts` defines **eleven canonical states**, and three of them
 * — `instrumented_going_forward`, `not_measurable`, `stale` — did not exist when
 * the design was drawn. They are corrections engineering made, not omissions to
 * be tidied away, so the design's visual language is applied to all eleven
 * rather than the current vocabulary being trimmed to fit the shorter list.
 *
 * Every card carries the state's word as well as its colour. Nothing on this
 * page means anything by hue alone.
 *
 * The tally underneath is the section's real job: how many metrics a reader can
 * currently see are in each state. It is how somebody tells "this number is
 * bad" from "there is no number", which is the argument the whole Observatory
 * makes.
 */

type Card = {
  state: MetricState;
  title: string;
  body: string;
  action: string;
  glyph: string;
  dashed?: boolean;
};

const CARDS: readonly Card[] = [
  {
    state: 'live',
    title: 'Measured directly',
    body: 'Counted from the event stream. The number is what happened, and a reviewer can go and count the rows behind it.',
    action: 'Source names the stream →',
    glyph: '●',
  },
  {
    state: 'derived',
    title: 'Computed from live events',
    body: 'A rate or a percentile over the stream rather than a count read from it. The formula is one lookup away in the dictionary.',
    action: 'Open the formula →',
    glyph: '∫',
  },
  {
    state: 'instrumented_going_forward',
    title: 'Collecting, with no history',
    body: 'The sink was connected recently, so a window reaching further back is not a smaller number — there is no number for that period. Not the same claim as an insufficient sample.',
    action: 'See collecting-since →',
    glyph: '◐',
  },
  {
    state: 'insufficient_sample',
    title: 'Cohort too small',
    body: 'Data exists but n is below the minimum for a stable rate. The raw count is shown, the rate is withheld.',
    action: 'Raw count shown →',
    glyph: 'n',
  },
  {
    state: 'source_not_connected',
    title: 'Requires an external source',
    body: 'Nothing is inferred and the panel is excluded from every roll-up above. The card names the source that would connect it.',
    action: 'What this unlocks →',
    glyph: '⇱',
    dashed: true,
  },
  {
    state: 'not_measurable',
    title: 'No mechanism exists',
    body: 'Not a missing integration — there is nothing to integrate. The card states what would have to be built, and that it is a product decision rather than an implementation detail.',
    action: 'What it would require →',
    glyph: '∅',
    dashed: true,
  },
  {
    state: 'feature_disabled',
    title: 'Not exposed to users',
    body: 'A feature flag is off, so the surface is unreachable and a zero would be false. The panel names the flag instead of showing the zero.',
    action: 'View the flag →',
    glyph: '⊘',
  },
  {
    state: 'coming_soon',
    title: 'Announced, inert',
    body: 'The entry exists in the UI and does nothing yet. A click on it is counted as demand signal, never as usage.',
    action: 'Demand signal →',
    glyph: '◷',
  },
  {
    state: 'external',
    title: 'Measured outside the portal',
    body: 'The destination or the measurement lives elsewhere — and is actually measured there, which is the test that separates this from a missing source.',
    action: 'Where it is measured →',
    glyph: '↗',
    dashed: true,
  },
  {
    state: 'legacy',
    title: 'Retired flow',
    body: 'Only historical events exist for this journey. Never merged into a current funnel, never into PMCR, never into any rate on this page.',
    action: 'View history →',
    glyph: '⌛',
  },
  {
    state: 'stale',
    title: 'Analytics delayed',
    body: 'The newest event is older than the source’s freshness budget. The panel reports its own lag rather than implying that usage dropped.',
    action: 'Retry the query →',
    glyph: '⏱',
  },
];

export function PanelStates({ data }: { data: ObservatoryData }) {
  const tally = data.stateTally;

  return (
    <Section
      id="s-states"
      number="14"
      title="Panel states"
      lede="Every panel resolves to one of these — a blank card always says why it is blank"
    >
      <div className={styles.fiveGrid}>
        {/* Loading is not a metric state, so it is drawn rather than tallied. */}
        <div className={styles.stateCard}>
          <span className={styles.stateTag} style={{ color: 'var(--obs-faint)' }}>
            Loading
          </span>
          <span className={styles.shimmer} style={{ height: 12, width: '52%' }} aria-hidden="true" />
          <span className={styles.shimmer} style={{ height: 30, width: '74%' }} aria-hidden="true" />
          <span className={styles.shimmer} style={{ height: 44 }} aria-hidden="true" />
          <span className={styles.stateAction} style={{ color: 'var(--obs-faint)' }}>
            Querying the event store…
          </span>
        </div>

        {CARDS.map((card) => (
          <div key={card.state} className={styles.stateCard} data-dashed={card.dashed ? 'true' : 'false'}>
            <span className={`${styles.stateTag} ${styles.stateText}`} data-state={card.state}>
              {STATE_LABEL[card.state]}
            </span>
            <div className={`${styles.stateGlyph} ${styles.stateText}`} data-state={card.state} aria-hidden="true">
              {card.glyph}
            </div>
            <h4 className={styles.stateTitle}>{card.title}</h4>
            <p className={styles.stateBody}>{card.body}</p>
            <span className={`${styles.stateAction} ${styles.stateText}`} data-state={card.state}>
              {card.action}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.gapTop}>
        <Panel
          title="How many visible metrics are in each state"
          lede="The difference between a bad number and no measurement, counted"
        >
          <div className={styles.sixGrid}>
            {METRIC_STATES.map((state) => {
              const count = tally[state] ?? 0;
              return (
                <div key={state} className={styles.tile} data-state={state}>
                  <div className={styles.tileLabel} title={STATE_MEANING[state]}>
                    <StateBadge state={state} small />
                  </div>
                  <div className={`${styles.tileValue} ${styles.stateText}`} data-state={state}>
                    {formatCount(count)}
                  </div>
                  <div className={styles.tileSub}>{count === 1 ? 'metric' : 'metrics'}</div>
                </div>
              );
            })}
          </div>
          <p className={`${styles.note} ${styles.noteTop}`}>
            Counted over the metrics a reader can actually see on this page. A state with a zero here
            has no visible metric in it, which is different from the state not existing.
          </p>
        </Panel>
      </div>
    </Section>
  );
}
