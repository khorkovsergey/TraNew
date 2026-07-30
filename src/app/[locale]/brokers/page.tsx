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
    href: '/brokers',
    locale,
    title: t('brokers.title'),
    description: t('brokers.subtitle'),
  });
}

const FILTERS = ['regulated', 'lowFees', 'fractional', 'isa'] as const;

const BROKERS = [
  { id: 'a', name: 'Northline Securities', jurisdiction: 'Cyprus / EU', fee: '€0.99', min: '€0' },
  { id: 'b', name: 'Harbour Invest', jurisdiction: 'Germany / EU', fee: '€1.50', min: '€100' },
  { id: 'c', name: 'Meridian Markets', jurisdiction: 'United Kingdom', fee: '£1.20', min: '£50' },
];

export default async function BrokersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('brokers');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('brokers.title')}</h1>
      <p className={styles.lead}>{tScreens('brokers.subtitle')}</p>

      <div className={styles.chipRow}>
        {FILTERS.map((filter) => (
          <span className={styles.chip} key={filter}>
            {t(`filters.${filter}`)}
          </span>
        ))}
      </div>

      <div className={styles.gridThree}>
        {BROKERS.map((broker) => (
          <article className={styles.card} key={broker.id}>
            <div className={styles.infoTitle}>{broker.name}</div>
            <div className={styles.row} style={{ marginTop: 12 }}>
              <span className={styles.rowKey}>Jurisdiction</span>
              <span className={styles.rowValue}>{broker.jurisdiction}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowKey}>Commission</span>
              <span className={`${styles.rowValue} tn-num`}>{broker.fee}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowKey}>Minimum</span>
              <span className={`${styles.rowValue} tn-num`}>{broker.min}</span>
            </div>
          </article>
        ))}
      </div>

      {/* Stated plainly because a broker list is exactly where a conflict would sit. */}
      <p className={styles.note}>{t('compareNote')}</p>
    </div>
  );
}
