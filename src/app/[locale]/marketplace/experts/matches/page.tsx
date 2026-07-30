import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Matches } from '@/components/marketplace/Matches';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/marketplace/experts/matches',
    locale,
    title: t('expertsMatches.title'),
    description: t('expertsMatches.subtitle'),
  });
}

export default async function ExpertsMatchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/marketplace/experts">
        ← {tScreens('experts.title')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>{tScreens('expertsMatches.title')}</h1>
      <p className={styles.lead}>{t('matches.sub')}</p>

      <Matches />
    </div>
  );
}
