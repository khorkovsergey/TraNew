import { Icon } from '@/components/ui/Icon';
import {
  CAUTION_AXES,
  COMPARE_AXES,
  DOT_SCALE,
  RATING_NOTE,
  ratingWord,
  type AssetClass,
} from '@/content/assetClasses';
import { Link } from '@/i18n/navigation';
import styles from './CompareMatrix.module.css';

/**
 * The comparison, in one component.
 *
 * Three screens show it — Investment options, each class page, and the research
 * comparison — and before this existed the Explore column had its own copy
 * covering three classes out of six. Choosing Bonds got you a table without
 * bonds in it.
 *
 * It reads across rather than down now. A column per class with the axes
 * stacked inside it meant comparing "Costs" between two classes was a matter of
 * finding the same row twice, in two separate cards, by eye. A criterion is one
 * line here, which is the only arrangement in which the comparison is a
 * comparison.
 *
 * A real table, not a grid of divs: the first column is a row header and the
 * first row is a column header, and a reader who cannot see the layout is told
 * which class a cell belongs to rather than hearing six numbers in a row.
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
  /*
   * The first column is the one being read about — `comparisonSet` puts it
   * there, and a comparison whose subject is somewhere in the middle makes the
   * reader find it before they can use it.
   */
  const [subject] = entries;

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          {/* Named for a reader who arrives at the table without the heading
              above it. The same sentence is on screen beside the chips. */}
          <caption className={styles.caption}>
            {entries.map((entry) => entry.name).join(' vs ')} — how these ways of investing differ
            in risk, cost and effort.
          </caption>

          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                Criterion
              </th>
              {entries.map((entry) => (
                <th
                  key={entry.key}
                  scope="col"
                  className={`${styles.colHead} ${entry.key === subject.key ? styles.colHeadOn : ''}`}
                >
                  <span className={styles.colName}>
                    {linkToPages ? (
                      <Link
                        href={{ pathname: '/explore/[class]', params: { class: entry.key } }}
                        prefetch={false}
                      >
                        {entry.name}
                      </Link>
                    ) : (
                      entry.name
                    )}
                  </span>
                  <span className={styles.colTagline}>{entry.tagline}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {COMPARE_AXES.map((axis) => {
              const caution = CAUTION_AXES.includes(axis);
              return (
                <tr key={axis}>
                  <th scope="row" className={styles.rowHead}>
                    {axis}
                  </th>
                  {entries.map((entry) => {
                    const level = entry.ratings[axis];
                    /*
                     * Amber only where more is worse, and only at the top of the
                     * scale. A high "Growth potential" is not a warning, and
                     * colouring every full row the same makes neither readable.
                     */
                    const warn = caution && level >= 4;
                    return (
                      <td key={entry.key} className={styles.cell}>
                        <span className={styles.dots} aria-hidden="true">
                          {Array.from({ length: DOT_SCALE }, (_, index) => (
                            <span
                              key={index}
                              className={`${styles.dot} ${
                                index < level ? (warn ? styles.dotWarn : styles.dotOn) : ''
                              }`}
                            />
                          ))}
                        </span>
                        <span className={styles.scaleWord}>{ratingWord(level)}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/*
             * Two rows that are not scales and are not pretending to be. What it
             * takes to start and what people hold it for are answers, not
             * positions between very low and very high, and the dots that used
             * to be under "Minimum amount" were ranking one share against any
             * amount as though that were a quantity.
             */}
            <tr>
              <th scope="row" className={styles.rowHead}>
                Minimum amount
              </th>
              {entries.map((entry) => (
                <td key={entry.key} className={styles.cell}>
                  <span className={styles.cellText}>{entry.minimum}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={styles.rowHead}>
                Typical use case
              </th>
              {entries.map((entry) => (
                <td key={entry.key} className={styles.cell}>
                  <span className={styles.cellText}>{entry.useCase}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.note}>
        <Icon name="info" size={13} strokeWidth={2} />
        {RATING_NOTE} <Link href="/how-we-explain">How we explain this</Link>
      </div>
    </div>
  );
}
