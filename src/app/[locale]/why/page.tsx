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

      {/*
        * Numbers on their own are a claim. What follows is why they are the ones
        * we print — and where to go and check, which is the part a page of
        * statistics usually leaves out.
        */}
      <h2 className={styles.sectionTitle}>What is behind them</h2>

      <div className={styles.cardList}>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Every figure carries its source</h3>
          <p className={styles.cardSummary}>
            Prices, macro series and news are labelled with where they came from and when they were
            last updated. Where the data is delayed, the delay is stated on the number rather than
            in a footnote.
          </p>
          <div className={styles.cardActions}>
            <Link className={styles.chip} href="/trust">
              Read the Trust Center
            </Link>
          </div>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Explanations, not recommendations</h3>
          <p className={styles.cardSummary}>
            Nothing here tells you what to buy. An AI answer is labelled as one, a community opinion
            is labelled as one, and neither is dressed up as market data.
          </p>
          <div className={styles.cardActions}>
            <Link className={styles.chip} href="/how-we-explain">
              How we explain markets
            </Link>
          </div>
        </article>

        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Free to start, and it stays useful</h3>
          <p className={styles.cardSummary}>
            Research, charts, the economy section and Academy do not need a card. An account is
            asked for when there is something of yours to save — a watchlist, an alert, a strategy.
          </p>
          <div className={styles.cardActions}>
            <Link className={styles.chip} href="/start">
              Start free
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
