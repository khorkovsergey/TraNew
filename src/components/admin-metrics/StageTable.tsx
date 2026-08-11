import styles from './Observatory.module.css';

/**
 * A sequential funnel.
 *
 * `ofPrevious` is null below the minimum sample, and the cell says so rather
 * than printing a percentage over four sessions. The absolute count is always
 * shown: a count of four is a fact, and "4 of 6 — 67%" is a claim.
 */
export function StageTable({
  stages,
}: {
  stages: ReadonlyArray<{ stage: string; sessions: number; ofPrevious: number | null }>;
}) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Stage</th>
          <th>Sessions</th>
          <th>Of previous</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((stage) => (
          <tr key={stage.stage}>
            <td>{stage.stage.replace(/_/g, ' ')}</td>
            <td>{stage.sessions.toLocaleString('en')}</td>
            <td>
              {stage.ofPrevious === null ? (
                <span className={styles.cardAbsent}>—</span>
              ) : (
                `${(stage.ofPrevious * 100).toFixed(1)}%`
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
