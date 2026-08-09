import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ExchangeSessions,
  MarketBreadcrumbs,
  MarketContextNavigation,
  MarketSelector,
  MarketTrustFooter,
  RelatedMarkets,
} from '@/components/markets/MarketShell';
import { MarketOverview } from '@/components/markets/MarketOverview';
import { getMarket } from '@/content/markets';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { marketSession } from '@/lib/market/session';
import type { SymbolHit } from '@/lib/market/overview';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';
import content from '@/components/content/Content.module.css';
import styles from '@/components/markets/Markets.module.css';

/**
 * Global Markets — the top of the cluster.
 *
 * It is not trying to rank for everything. Its job is to explain how the pieces
 * fit together and to hand the reader to the page that actually answers their
 * question, which is why almost every block on it ends in a link with a reason
 * attached.
 */

type Props = { params: Promise<{ locale: Locale }> };

const MARKET = getMarket('global')!;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/markets/global',
    locale,
    title: MARKET.seo.title,
    description: MARKET.seo.description,
  });
}

const FAQ = [
  {
    q: 'Which global markets are open now?',
    a: 'It depends on the hour. Tokyo trades while Europe and the Americas are closed, London overlaps the end of the Asian day and the start of the American one, and New York closes last. The panel above shows the current state of each exchange in its own local time.',
  },
  {
    q: 'What is the difference between a market, an exchange and an index?',
    a: 'An exchange is the venue where trading happens. A market is the broader idea of all trading in a country or region, often across more than one exchange. An index is a measurement — a fixed rule for combining a set of listed companies into a single number.',
  },
  {
    q: 'Why do global markets move together?',
    a: 'Large listed companies earn revenue in many countries, the same institutions invest across borders, and interest rates set by a few central banks affect what every asset is worth. The correlation is not constant: it rises during a crisis and falls when the news is local.',
  },
  {
    q: 'How can I follow a foreign stock market?',
    a: 'Start with its main index and its trading hours, because those determine when news about it will actually be priced. The market pages here list both, along with the exchanges involved.',
  },
];

export default async function GlobalMarketsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('markets');
  const tCommon = await getTranslations('common');

  // Rendered on the server on each request window, so the session state is the
  // state at render time — which is what the "last updated" line below reports.
  const now = new Date();
  const updated = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(now);

  return (
    <div className={content.wrap}>
      <VoyagerPageContext context={buildContext('market', MARKET.name)} />

      <MarketBreadcrumbs
        trail={[
          { label: tCommon('backHome'), href: '/' },
          { label: 'Market', href: '/market' },
          { label: MARKET.name },
        ]}
      />

      {/*
       * Market Overview is the page now.
       *
       * This route is the canonical live-markets destination — Home's "Explore
       * markets" button and the Explore menu both land here, so what a person
       * meets first has to be the market rather than an essay about what a
       * market is. It carries the `h1`.
       *
       * The essay is still below it, and deliberately: this page ranks for how
       * exchanges, markets and indices differ, and that traffic arrives wanting
       * exactly the prose further down. What went was the material the overview
       * now does better — the scenario cards it routes past, the three index
       * descriptions its pulse replaced, and the story list its movers replaced.
       */}
      <MarketOverview session={marketSession(now)} symbols={symbolHits(locale)} />

      <h2 className={styles.h2}>{t('openNow')}</h2>
      <ExchangeSessions exchanges={MARKET.exchanges} now={now} note={t('holidaysUnknown')} />

      <MarketSelector current="global" />
      <MarketContextNavigation market={MARKET} active="overview" />

      <h2 className={styles.h2}>{t('regions')}</h2>
      <RelatedMarkets market={MARKET} title="" />

      <h2 className={styles.h2}>{t('howItWorks')}</h2>
      <div className={styles.prose}>
        {MARKET.seo.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} dangerouslySetInnerHTML={{ __html: bold(paragraph) }} />
        ))}
      </div>

      <h2 className={styles.h2}>{t('faqTitle')}</h2>
      {FAQ.map((entry) => (
        <div className={styles.faq} key={entry.q}>
          <h3 className={styles.faqQ}>{entry.q}</h3>
          <p className={styles.faqA}>{entry.a}</p>
        </div>
      ))}

      <MarketTrustFooter updated={updated} dataNote={t('sessionsSource')} disclaimer={t('disclaimer')} />
    </div>
  );
}

/**
 * The symbols the search overlay can actually open.
 *
 * Built from the pages that exist rather than from a list of famous tickers.
 * The prototype offered Apple and QQQ, which this portal does not carry, and a
 * search result that 404s is a worse answer than a short list that works.
 */
function symbolHits(locale: Locale): SymbolHit[] {
  return Object.values(SYMBOLS).map((symbol) => ({
    ticker: symbol.ticker,
    name: pick(symbol.name, locale),
    meta: pick(symbol.type, locale),
    price: symbol.price,
    change: symbol.change,
    up: symbol.up,
  }));
}

/**
 * The intros mark a few terms with `**`, because the sentence that separates
 * market, exchange and index is the one people re-read. Nothing else in the
 * string is interpreted, and the source is this repository rather than user
 * input — there is no path by which a reader could put markup here.
 */
function bold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
