import styles from './Observatory.module.css';

/**
 * One section of the dashboard.
 *
 * Three parts, in a fixed order, because the page reads top to bottom and a
 * presenter reads the first two: a heading that names the question, a
 * **conclusion** that answers it in one factual sentence, and the evidence.
 *
 * `detail` is everything a reader only wants when they doubt something —
 * breakdown tables, per-event rows, implementation notes. Presentation mode
 * collapses it rather than deleting it, so a question from the room is one
 * click away rather than a different page.
 *
 * A section with no conclusion prints none. A sentence written to fill the gap
 * would be the first thing on the page that was not a measurement.
 */
export function Section({
  id,
  title,
  conclusion,
  children,
  detail,
  detailLabel = 'Detail',
}: {
  id: string;
  title: string;
  conclusion?: string | null;
  children?: React.ReactNode;
  detail?: React.ReactNode;
  detailLabel?: string;
}) {
  return (
    <section className={styles.section} id={id} aria-labelledby={`${id}-heading`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionHeading} id={`${id}-heading`}>
          {title}
        </h2>
        {conclusion ? <p className={styles.conclusion}>{conclusion}</p> : null}
      </div>

      {children}

      {detail ? (
        <details className={styles.detail}>
          <summary>{detailLabel}</summary>
          <div className={styles.detailBody}>{detail}</div>
        </details>
      ) : null}
    </section>
  );
}
