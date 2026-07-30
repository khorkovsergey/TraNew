import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsList } from '@/components/content/NewsList';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';

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

  return (
    <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{t('news.title')}</h1>
      <p className={styles.lead}>{t('news.subtitle')}</p>

      <NewsList />
    </div>
  );
}
