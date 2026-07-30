import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Dashboard } from '@/components/academy/Dashboard';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/academy/Academy.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/academy/dashboard',
    locale,
    title: t('academyDashboard.title'),
    description: t('academyDashboard.subtitle'),
  });
}

export default async function AcademyDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('academy.dashboard');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1} style={{ marginTop: 0 }}>
        {t('welcome')}
        <span className={styles.savedChip}>{t('saved')}</span>
      </h1>

      <Dashboard />
    </div>
  );
}
