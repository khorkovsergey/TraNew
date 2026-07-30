import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/trust',
    locale,
    title: t('trust.title'),
    description: t('trust.subtitle'),
  });
}

const SECTIONS = ['sources', 'labels', 'ai', 'signals', 'sponsored', 'never'] as const;

export default async function TrustCenterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('info.trust');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('trust.title')}</h1>
      <p className={styles.lead}>{tScreens('trust.subtitle')}</p>

      <div className={styles.infoGrid}>
        {SECTIONS.map((section) => (
          <div className={styles.infoCard} key={section}>
            <div className={styles.infoTitle}>{t(`${section}Title`)}</div>
            <div className={styles.infoText}>{t(`${section}Text`)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
