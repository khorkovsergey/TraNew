import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/academy/Academy.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/academy',
    locale,
    title: t('academy.title'),
    description: t('academy.subtitle'),
  });
}

export default async function AcademyLandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('academy');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <div className={styles.crumbs}>
        <span className={styles.crumbActive}>{t('breadcrumb.intro')}</span>
        <span className={styles.crumbSep}>→</span>
        <span className={styles.crumbIdle}>{t('breadcrumb.plan')}</span>
        <span className={styles.crumbSep}>→</span>
        <span className={styles.crumbIdle}>{t('breadcrumb.lesson')}</span>
      </div>

      <h1 className={styles.h1}>{tScreens('academy.title')}</h1>
      <p className={styles.lead}>{t('landing.sub')}</p>
      <p className={styles.note}>{t('landing.note')}</p>

      <div className={styles.chips}>
        <span className={styles.chipPurple}>{t('landing.chipTime')}</span>
        <span className={styles.chipGreen}>{t('landing.chipFree')}</span>
      </div>

      <div className={styles.ctaRow}>
        <Link className={styles.primary} href="/academy/setup">
          {t('landing.start')}
        </Link>
        <Link
          className={styles.secondary}
          href={{ pathname: '/tool/[slug]', params: { slug: 'courses' } }}
        >
          {t('landing.browse')}
        </Link>
        {/* Skipping the level question is a shortcut through setup, not a separate path. */}
        <Link
          className={styles.textLink}
          href={{ pathname: '/academy/setup', query: { skip: '1' } }}
        >
          {t('landing.skip')}
        </Link>
      </div>
    </div>
  );
}
