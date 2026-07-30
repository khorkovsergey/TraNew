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
    href: '/why',
    locale,
    title: t('why.title'),
    description: t('why.subtitle'),
  });
}

const STATS: Array<{ key: string; value: string }> = [
  { key: 'users', value: '100M+' },
  { key: 'markets', value: '150+' },
  { key: 'exchanges', value: '49' },
  { key: 'setup', value: '15 min' },
  { key: 'presets', value: '3' },
  { key: 'cost', value: '€0' },
];

export default async function WhyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('info.whyStats');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('why.title')}</h1>
      <p className={styles.lead}>{tScreens('why.subtitle')}</p>

      <div className={styles.infoGrid}>
        {STATS.map((stat) => (
          <div className={styles.infoCard} key={stat.key}>
            <div className={`${styles.infoValue} tn-num`}>{stat.value}</div>
            <div className={styles.infoKey}>{t(stat.key)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
