import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Intake } from '@/components/marketplace/Intake';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/marketplace/experts/intake',
    locale,
    title: t('expertsIntake.title'),
    description: t('expertsIntake.subtitle'),
  });
}

export default async function ExpertsIntakePage({ params }: Props) {
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

      <h1 className={styles.h1}>{tScreens('expertsIntake.title')}</h1>
      <p className={styles.lead}>{tScreens('expertsIntake.subtitle')}</p>

      <Intake />
    </div>
  );
}
