import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CompareMatrix } from '@/components/explore/CompareMatrix';
import { SearchForm } from '@/components/shared/SearchForm';
import { assetClass } from '@/content/assetClasses';
import { parseCompare } from '@/lib/explore/compareLink';
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
  searchParams: Promise<{ q?: string; assets?: string }>;
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

  const { q, assets } = await searchParams;
  const t = await getTranslations('workspace');
  const tCommon = await getTranslations('common');

  /*
   * No question, no answer.
   *
   * This page used to render its canned "Direct answer" — with sources and a
   * timestamp — under a heading that admitted nobody had asked anything. On a
   * product whose whole claim is that it separates facts from opinions, an
   * answer to a question that was never put is the worst thing that can be on
   * the screen. Without `q` the page is a search box.
   */
  if (!q?.trim()) {
    return (
      <div className={styles.wrap}>
        <Link className={styles.backHome} href="/">
          {tCommon('backHome')}
        </Link>

        <div className={styles.eyebrow}>{t('eyebrow')}</div>
        <h1 className={styles.question}>What would you like to understand?</h1>
        <p className={styles.emptyLead}>
          Search for a company, or ask a question in your own words. The answer will show the data
          it used and where each figure came from.
        </p>

        <SearchForm autoFocus />
      </div>
    );
  }

  /*
   * A comparison, when the URL asks for one.
   *
   * "Compare in detail" on Explore used to land here and get the same canned
   * answer as everything else — the only thing the person had told us was the
   * three things they wanted side by side, and it was discarded on arrival.
   * The list is parsed rather than trusted: it comes from a URL, and a slug
   * nobody recognises is dropped instead of rendering an empty column.
   */
  const compared = parseCompare(assets);
  if (compared) {
    const entries = compared.map((key) => assetClass(key)!);

    return (
      <div className={styles.wrap}>
        <Link className={styles.backHome} href="/explore">
          ← Explore
        </Link>

        <div className={styles.eyebrow}>{t('eyebrow')}</div>
        <h1 className={styles.question}>{entries.map((entry) => entry.name).join(' vs ')}</h1>
        <p className={styles.emptyLead}>
          The same six measures for each, side by side. They are coarse guides to a whole category —
          the words carry the value and the bars only repeat them.
        </p>

        <CompareMatrix entries={entries} linkToPages />

        <section className={styles.compareProse}>
          <h2 className={styles.compareHeading}>How to choose between them</h2>
          <p>
            Start with when you need the money. Anything you may want within a year or two belongs
            in the steadiest column here, whatever the growth figures say — a fall does not matter
            until you have to sell into it, and a short horizon is what turns a fall into a sale.
          </p>
          <p>
            Then read the risk row against your own position rather than against the other columns.
            The question is not which is riskiest; it is which of these you could watch fall by a
            third without changing anything else you had planned.
          </p>
          <p>
            Costs compound in the direction you do not notice. A fraction of a per cent each year is
            invisible in a statement and decisive over decades, and it is charged whether the year
            was good or bad.
          </p>
          <p>
            Most people end up holding more than one of these rather than choosing between them.
            That is the usual answer, and it is not a compromise — the reason to hold two is that
            they do not fall at the same time.
          </p>
        </section>

        <div className={styles.compareCtas}>
          {entries.map((entry) => (
            <Link
              key={entry.key}
              className={styles.compareCta}
              href={{ pathname: '/explore/[class]', params: { class: entry.key } }}
              prefetch={false}
            >
              Understand {entry.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <div className={styles.eyebrow}>{t('eyebrow')}</div>
      <h1 className={styles.question}>{`“${q}”`}</h1>

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
