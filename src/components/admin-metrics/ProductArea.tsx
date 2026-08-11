import type { FamilyFacts } from '@/lib/admin-metrics/families/durable';
import { explain, isNumeric, type MetricValue } from '@/lib/analytics/states';
import styles from './Observatory.module.css';

/**
 * One product family.
 *
 * The layout exists to keep two things apart on the page, because keeping them
 * apart in the query is not enough if the UI stacks them into one column:
 * **durable facts** are what the product recorded, and **behaviour** is what
 * people did. A reader who cannot see which is which will average them in their
 * head.
 *
 * So every figure carries its source table, the section says its source type in
 * words, and the family's limitations are printed rather than hidden behind a
 * disclosure — a current-state table presented as a funnel is the mistake this
 * whole phase is guarding against, and it is not a footnote.
 */
export function ProductArea({
  title,
  facts,
  children,
}: {
  title: string;
  facts: FamilyFacts;
  children?: React.ReactNode;
}) {
  const entries = Object.entries(facts.metrics);

  return (
    <section className={styles.family}>
      <header className={styles.familyHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <p className={styles.subtitle}>
          <span className={styles.state}>durable facts</span>{' '}
          {facts.sources.map((source) => (
            <code key={source} className={styles.source}>
              {source}
            </code>
          ))}{' '}
          · {facts.freshestAt ? `newest record ${facts.freshestAt}` : 'no records yet'}
        </p>
      </header>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fact</th>
            <th>Value</th>
            <th>State</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, metric]) => (
            <tr key={key}>
              <td>{humanise(key)}</td>
              <td>{format(metric)}</td>
              <td>{metric.state.replace(/_/g, ' ')}</td>
              <td>
                <code>{metric.source}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {Object.entries(facts.distributions).map(([name, rows]) =>
        rows.length === 0 ? null : (
          <div key={name}>
            <h4 className={styles.sectionTitle}>{humanise(name)} — current distribution</h4>
            <table className={styles.table}>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td>{row.count.toLocaleString('en')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {children}

      <ul className={styles.limitations}>
        {facts.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

function format(metric: MetricValue): string {
  if (!isNumeric(metric)) return explain(metric);
  return metric.value.toLocaleString('en');
}

function humanise(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}
