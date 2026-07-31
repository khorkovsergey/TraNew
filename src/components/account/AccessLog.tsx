import styles from './Account.module.css';

export type AccessEntry = {
  id: string;
  action: string;
  resource: string;
  actor: string;
  ipAddress: string | null;
  createdAt: Date;
};

/**
 * The financial-data access log, kept separate from the general activity timeline
 * exactly as the design requires. It records what was touched and by whom — never
 * the values, so the log does not become an unencrypted copy of the record.
 */
export function AccessLog({ entries }: { entries: AccessEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        Nothing has touched your financial data yet. Every read, change, export and share will
        appear here with its time, source and IP address.
      </div>
    );
  }

  return (
    <>
      <div className={styles.stack}>
        {entries.map((entry) => (
          <div className={styles.row} key={entry.id}>
            <span>
              <span className={styles.typeChip}>{entry.action}</span>
              <span className={styles.itemTitle}>{entry.resource.replace(/_/g, ' ')}</span>
              <span className={styles.itemMeta}>
                by {entry.actor} · {entry.ipAddress ?? 'IP unknown'}
              </span>
            </span>
            <span className={styles.itemMeta}>{entry.createdAt.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className={styles.note}>
        This log is append-only. It exists so you can tell whether anything other than you — a
        Voyager query, an expert snapshot — has read your record.
      </div>
    </>
  );
}
