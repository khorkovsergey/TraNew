import { DICTIONARY_BY_ID } from '@/lib/admin-metrics/dictionary';
import { explain, isNumeric, type MetricValue } from '@/lib/analytics/states';
import styles from './Observatory.module.css';

export type CardFormat = 'count' | 'percent' | 'seconds';

function render(value: number, format: CardFormat): string {
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (format === 'seconds') return value >= 60 ? `${(value / 60).toFixed(1)} min` : `${value.toFixed(1)} s`;
  return value.toLocaleString('en');
}

/**
 * One number, or the reason there is not one.
 *
 * The component takes a `MetricValue` and nothing else — there is no `value`
 * prop it could be handed a zero for. The type makes the caller narrow the
 * state before a figure can be read out of it, so a card cannot render a
 * missing source as `0%` by forgetting a check.
 *
 * ## Anatomy, fixed
 *
 * label · value or absence · **what the denominator was** · state · source ·
 * definition on demand. In that order, on every card on the page.
 *
 * `of` is the part a presenter needs and a dashboard usually omits. "72%" is
 * not a claim anybody can check; "72% of executed Voyager requests" is. Where a
 * rate has a denominator worth naming, it is named on the face of the card
 * rather than in a drawer.
 *
 * The definition itself is **read from the Metric Dictionary**, never restated
 * here — a formula written into JSX drifts from the query the first time
 * somebody edits one and not the other.
 */
export function MetricCard({
  label,
  metric,
  format = 'count',
  of,
  emphasis,
}: {
  label: string;
  metric: MetricValue;
  format?: CardFormat;
  /** The denominator, in words. "of executed requests", "of eligible sessions". */
  of?: string;
  /** Headline cards in the executive grid read larger. */
  emphasis?: boolean;
}) {
  const numeric = isNumeric(metric);
  const definition = DICTIONARY_BY_ID.get(metric.metricId);

  return (
    <article
      className={emphasis ? `${styles.card} ${styles.cardEmphasis}` : styles.card}
      data-state={metric.state}
    >
      <h3 className={styles.cardLabel}>{label}</h3>

      {numeric ? (
        <p className={styles.cardValue}>
          {render(metric.value, format)}
          {of ? <span className={styles.cardDenominator}> {of}</span> : null}
        </p>
      ) : (
        <p className={styles.cardAbsent}>{explain(metric)}</p>
      )}

      <footer className={styles.cardMeta}>
        {/*
          The state is spelled out, not encoded in a colour. A dot would fail
          for anybody who cannot distinguish two of them, and it would let a
          reader guess "amber means roughly fine" — which is exactly what
          `instrumented_going_forward` does not mean.
        */}
        <span className={styles.state}>{metric.state.replace(/_/g, ' ')}</span>
        {numeric ? <span>n={metric.sample.toLocaleString('en')}</span> : null}
        <span className={styles.source}>{metric.source}</span>
      </footer>

      {definition ? (
        <details className={styles.definition}>
          <summary>Where does this number come from?</summary>
          <dl>
            <dt>Formula</dt>
            <dd>{definition.formula}</dd>
            <dt>Denominator</dt>
            <dd>{definition.denominator}</dd>
            <dt>Eligible population</dt>
            <dd>{definition.eligiblePopulation}</dd>
            <dt>Exclusions</dt>
            <dd>{definition.exclusions.join(' · ') || 'none'}</dd>
            <dt>Minimum sample</dt>
            <dd>{definition.minimumSample}</dd>
            <dt>Limitations</dt>
            <dd>
              <ul>
                {definition.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </dd>
          </dl>
        </details>
      ) : null}
    </article>
  );
}
