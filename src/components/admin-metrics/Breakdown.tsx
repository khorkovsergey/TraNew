import type { BreakdownRow } from '@/lib/admin-metrics/journeys';
import styles from './Observatory.module.css';

/**
 * One journey breakdown.
 *
 * A row below the minimum shows its counts and **withholds the rate**. That is
 * not tidiness: a percentage over four sessions reads as a finding, and sliced
 * far enough a breakdown by surface, entitlement and acquisition eventually
 * describes one person. The count is still shown, because hiding the row
 * entirely would make the total stop adding up and invite somebody to
 * reconstruct it.
 */
export function Breakdown({
  title,
  rows,
  minimum,
}: {
  title: string;
  rows: readonly BreakdownRow[];
  minimum: number;
}) {
  return (
    <div>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{title}</th>
            <th>Sessions</th>
            <th>Continued</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No eligible sessions in this window.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>{row.sessions}</td>
                <td>{row.continued}</td>
                <td>
                  {row.rate === null ? (
                    <span className={styles.cardAbsent}>under {minimum}</span>
                  ) : (
                    `${(row.rate * 100).toFixed(1)}%`
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
