import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LearningPath } from '@/components/academy/LearningPath';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/academy/Academy.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/academy/path',
    locale,
    title: t('academyPath.title'),
    description: t('academyPath.subtitle'),
  });
}

export default async function AcademyPathPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('academy');
  const tScreens = await getTranslations('screens');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/academy">
        ← {tScreens('academy.title')}
      </Link>

      <div className={styles.crumbs}>
        <span className={styles.crumbIdle}>{t('breadcrumb.intro')}</span>
        <span className={styles.crumbSep}>→</span>
        <span className={styles.crumbActive}>{t('breadcrumb.plan')}</span>
        <span className={styles.crumbSep}>→</span>
        <span className={styles.crumbIdle}>{t('breadcrumb.lesson')}</span>
      </div>

      <h1 className={styles.h1}>{tScreens('academyPath.title')}</h1>
      <p className={styles.lead}>{tScreens('academyPath.subtitle')}</p>

      <LearningPath />
    </div>
  );
}
