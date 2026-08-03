import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsList } from '@/components/content/NewsList';
import { LiveNews } from '@/components/content/LiveNews';
import { getMarketNews, liveNewsConfigured } from '@/lib/market/news';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/news',
    locale,
    title: t('news.title'),
    description: t('news.subtitle'),
  });
}

export default async function NewsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  // Fetched on the server: the vendor key never reaches a browser, and the
  // page renders with the headlines already in it rather than filling in after.
  const feed = await getMarketNews('top');

  return (
    <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
      <VoyagerPageContext context={buildContext('news')} />
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{t('news.title')}</h1>
      <p className={styles.lead}>{t('news.subtitle')}</p>

      <LiveNews feed={feed} configured={liveNewsConfigured()} title="Live wire" />

      <h2 className={styles.h2}>Analysis</h2>
      <p className={styles.lead}>
        Written against reporting, each with the consequence spelled out. The wire above says what
        happened; these say what it means, and who says so.
      </p>

      <NewsList />
    </div>
  );
}
