import { Icon } from '@/components/ui/Icon';
import {
  COMPARE_AXES,
  DOT_SCALE,
  RATING_NOTE,
  type AssetClass,
} from '@/content/assetClasses';
import { Link } from '@/i18n/navigation';
import styles from './CompareMatrix.module.css';

/**
 * The comparison, in one component.
 *
 * Three screens show it — the Explore column, each class page, and the research
 * comparison — and before this existed the Explore column had its own copy
 * covering three classes out of six. Choosing Bonds got you a table without
 * bonds in it.
 *
 * The word carries the value and the dots repeat it. Anyone who cannot see the
 * fill still reads "Medium", which is the whole reason the word is there.
 */
export function CompareMatrix({
  entries,
  linkToPages = false,
}: {
  entries: AssetClass[];
  /** Whether each column heads a link to that class's own page. */
  linkToPages?: boolean;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.grid} style={{ '--cols': entries.length } as React.CSSProperties}>
        {entries.map((entry) => (
          <div key={entry.key} className={styles.column}>
            <div className={styles.head}>
              <Icon
                name={entry.icon}
                size={18}
                strokeWidth={1.9}
                className={styles[`accent_${entry.accent}`]}
              />
              {linkToPages ? (
                <Link
                  className={styles.name}
                  href={{ pathname: '/explore/[class]', params: { class: entry.key } }}
                  prefetch={false}
                >
                  {entry.name}
                </Link>
              ) : (
                <span className={styles.name}>{entry.name}</span>
              )}
            </div>

            <dl className={styles.axes}>
              {COMPARE_AXES.map((axis) => {
                const rating = entry.ratings[axis];
                return (
                  <div key={axis} className={styles.axis}>
                    <div className={styles.axisLine}>
                      <dt className={styles.axisLabel}>{axis}</dt>
                      <dd className={styles.axisValue}>{rating.value}</dd>
                    </div>
                    <div className={styles.dots} aria-hidden="true">
                      {Array.from({ length: DOT_SCALE }, (_, index) => (
                        <span
                          key={index}
                          className={`${styles.dot} ${
                            index < rating.level ? styles[`dotOn_${entry.accent}`] : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      <div className={styles.note}>
        <Icon name="info" size={13} strokeWidth={2} />
        {RATING_NOTE} <Link href="/how-we-explain">How we explain this</Link>
      </div>
    </div>
  );
}
