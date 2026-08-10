import { explain, isNumeric, type MetricValue } from '@/lib/analytics/states';
import styles from './Observatory.module.css';

/**
 * One number, or the reason there is not one.
 *
 * The component takes a `MetricValue` and nothing else — there is no `value`
 * prop it could be handed a zero for. That is the whole design: the type makes
 * the caller narrow the state before a figure can be read out of it, so a card
 * cannot render a missing source as `0%` by forgetting a check. Every state that
 * is not numeric renders its own sentence instead, and the sentence says which
 * source is missing and what it would take to have it.
 */
export function MetricCard({
  label,
  metric,
  format = 'count',
}: {
  label: string;
  metric: MetricValue;
  format?: 'count' | 'percent';
}) {
  const numeric = isNumeric(metric);

  return (
    <article className={styles.card} data-state={metric.state}>
      <h3 className={styles.cardLabel}>{label}</h3>

      {numeric ? (
        <p className={styles.cardValue}>
          {format === 'percent'
            ? `${(metric.value * 100).toFixed(1)}%`
            : metric.value.toLocaleString('en')}
        </p>
      ) : (
        <p className={styles.cardAbsent}>{explain(metric)}</p>
      )}

      <footer className={styles.cardMeta}>
        <span className={styles.state}>{metric.state.replace(/_/g, ' ')}</span>
        <span className={styles.source}>{metric.source}</span>
        {numeric && metric.state === 'instrumented_going_forward' ? (
          <span className={styles.warn}>no history before instrumentation</span>
        ) : null}
        {!numeric && metric.state === 'not_measurable' ? (
          <span className={styles.warn}>would require: {metric.wouldRequire}</span>
        ) : null}
      </footer>
    </article>
  );
}
