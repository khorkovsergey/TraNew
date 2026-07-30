import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/start',
    locale,
    title: t('start.title'),
    description: t('start.subtitle'),
  });
}

/**
 * "Open TradingNew" for an anonymous visitor lands here — on value, not on a
 * pricing table. Registration is asked for later, and only to save something.
 */
const ROWS: Array<{ key: string; href: StaticPathname }> = [
  { key: 'research', href: '/explore' },
  { key: 'brief', href: '/market/brief' },
  { key: 'learn', href: '/academy' },
  { key: 'strategy', href: '/strategy' },
  { key: 'charts', href: '/supercharts' },
];

export default async function StartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('start');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('start.title')}</h1>
      <p className={styles.lead}>{tScreens('start.subtitle')}</p>

      <div className={styles.rowLinks}>
        {ROWS.map((row) => (
          <Link className={styles.rowLink} href={row.href} key={row.key}>
            <span>{t(`rows.${row.key}`)}</span>
            <Icon name="arrowRight" size={18} />
          </Link>
        ))}
      </div>

      <p className={styles.note}>{t('note')}</p>
    </div>
  );
}
