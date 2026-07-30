import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { IdeasList } from '@/components/content/IdeasList';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/ideas',
    locale,
    title: t('ideas.title'),
    description: t('ideas.subtitle'),
  });
}

export default async function IdeasPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{t('ideas.title')}</h1>
      <p className={styles.lead}>{t('ideas.subtitle')}</p>

      <IdeasList />
    </div>
  );
}
