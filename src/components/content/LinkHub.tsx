import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import styles from './Content.module.css';

/**
 * Index screen for a section: heading, lead, and the contextual next actions the
 * handoff asks every screen to offer. Used where the section's value is getting
 * people to the right tool rather than showing content of its own.
 */
export async function LinkHub({
  screenKey,
  rows,
  note,
}: {
  screenKey: string;
  rows: Array<{ labelKey: string; href: StaticPathname }>;
  note?: string;
}) {
  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{t(`${screenKey}.title`)}</h1>
      <p className={styles.lead}>{t(`${screenKey}.subtitle`)}</p>

      <div className={styles.rowLinks}>
        {rows.map((row) => (
          <Link className={styles.rowLink} href={row.href} key={row.labelKey}>
            <span>{t(row.labelKey)}</span>
            <Icon name="arrowRight" size={18} />
          </Link>
        ))}
      </div>

      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
