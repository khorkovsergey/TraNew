import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import type { Ticker } from '@/lib/symbolSearch';
import { wave } from '@/lib/wave';
import styles from '@/components/screens/Workspace.module.css';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/research',
    locale,
    title: q ? `“${q}”` : t('research.title'),
    description: t('research.subtitle'),
  });
}

const SUPPORTING: Ticker[] = ['TSLA', 'SPX', 'BTC', 'NVDA'];
const ACTIONS = ['brief', 'news', 'charts', 'ideas', 'expert'] as const;

const ACTION_HREF = {
  brief: '/market/brief',
  news: '/news',
  charts: '/supercharts',
  ideas: '/ideas',
  expert: '/marketplace/experts',
} as const;

export default async function ResearchWorkspacePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { q } = await searchParams;
  const t = await getTranslations('workspace');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <div className={styles.eyebrow}>{t('eyebrow')}</div>
      <h1 className={styles.question}>{q ? `“${q}”` : t('emptyQuestion')}</h1>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('directAnswer')}</h2>
          <TrustLabel kind="aiExplanation" />
        </div>
        <p className={styles.answer}>{t('answer')}</p>
        <div className={styles.sources}>{t('sources')}</div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitleSmall}>{t('supportingData')}</h2>
            <TrustLabel kind="marketData" />
          </div>
          <div className={styles.quotes}>
            {SUPPORTING.map((ticker) => {
              const symbol = SYMBOLS[ticker];
              return (
                <Link
                  className={styles.quote}
                  key={ticker}
                  href={{ pathname: '/symbols/[ticker]', params: { ticker } }}
                >
                  <span className={styles.quoteName}>{pick(symbol.name, locale)}</span>
                  <span
                    className={`${styles.quoteValue} ${symbol.up ? styles.up : styles.down} tn-num`}
                  >
                    {symbol.price} · {symbol.change}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.cardTitleSmall}>{t('relevantChart')}</h2>
          <svg viewBox="0 0 300 110" className={styles.chart} aria-hidden="true">
            <polyline
              points={wave(1.7, 40, 300, 110)}
              fill="none"
              stroke="var(--tn-blue)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Link className={styles.chartLink} href="/supercharts">
            {t('openInCharts')}
          </Link>
        </section>
      </div>

      <section className={styles.nextCard}>
        <h2 className={styles.cardTitleSmall}>{t('suggestedActions')}</h2>
        <div className={styles.chips}>
          {ACTIONS.map((action) => (
            <Link className={styles.chip} key={action} href={ACTION_HREF[action]}>
              {t(`actions.${action}`)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
