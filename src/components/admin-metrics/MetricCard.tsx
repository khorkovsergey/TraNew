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
 * prop it could be handed a zero for. That is the whole design: the type makes
 * the caller narrow the state before a figure can be read out of it, so a card
 * cannot render a missing source as `0%` by forgetting a check. Every state that
 * is not numeric renders its own sentence instead, and the sentence says which
 * source is missing and what it would take to have it.
 *
 * The definition underneath is **read from the Metric Dictionary**, never
 * restated here. A formula written into JSX drifts from the query the first time
 * somebody edits one and not the other, and then nobody can say which of the two
 * produced the number on the card.
 */
export function MetricCard({
  label,
  metric,
  format = 'count',
}: {
  label: string;
  metric: MetricValue;
  format?: CardFormat;
}) {
  const numeric = isNumeric(metric);
  const definition = DICTIONARY_BY_ID.get(metric.metricId);

  return (
    <article className={styles.card} data-state={metric.state}>
      <h3 className={styles.cardLabel}>{label}</h3>

      {numeric ? (
        <p className={styles.cardValue}>{render(metric.value, format)}</p>
      ) : (
        <p className={styles.cardAbsent}>{explain(metric)}</p>
      )}

      <footer className={styles.cardMeta}>
        <span className={styles.state}>{metric.state.replace(/_/g, ' ')}</span>
        <span className={styles.source}>{metric.source}</span>
        {numeric ? <span>n={metric.sample.toLocaleString('en')}</span> : null}
        {numeric && metric.state === 'instrumented_going_forward' ? (
          <span className={styles.warn}>no history before instrumentation</span>
        ) : null}
        {!numeric && metric.state === 'not_measurable' ? (
          <span className={styles.warn}>would require: {metric.wouldRequire}</span>
        ) : null}
      </footer>

      {definition ? (
        <details className={styles.definition}>
          <summary>Where does this number come from?</summary>
          <dl>
            <dt>Formula</dt>
            <dd>{definition.formula}</dd>
            <dt>Numerator</dt>
            <dd>{definition.numerator}</dd>
            <dt>Denominator</dt>
            <dd>{definition.denominator}</dd>
            <dt>Eligible population</dt>
            <dd>{definition.eligiblePopulation}</dd>
            <dt>Exclusions</dt>
            <dd>{definition.exclusions.join(' · ') || 'none'}</dd>
            <dt>Time semantics</dt>
            <dd>{definition.timeSemantics}</dd>
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
