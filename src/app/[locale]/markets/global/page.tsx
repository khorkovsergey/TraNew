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
import { getMarket } from '@/content/markets';
import { NEWS } from '@/content/market';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
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

const SCENARIOS: Array<{ title: string; text: string; cta: string; href: StaticPathname }> = [
  {
    title: 'What is happening now?',
    text: 'Which exchanges are trading at this moment, and what the major indices have done today.',
    cta: 'See the global overview',
    href: '/market',
  },
  {
    title: 'Market news',
    text: 'What moved and why, with the reporting it came from rather than a headline on its own.',
    cta: 'Read market news',
    href: '/news',
  },
  {
    title: 'Explore assets',
    text: 'Stocks, indices, currencies and commodities, and how to compare them against each other.',
    cta: 'Explore assets',
    href: '/explore',
  },
  {
    title: 'Understand the charts',
    text: 'Apply an indicator by asking for it in plain words, and see the Pine Script behind it.',
    cta: 'Open Supercharts',
    href: '/supercharts',
  },
  {
    title: 'Communities and ideas',
    text: 'Theses written by people investing their own money, argued with in public.',
    cta: 'Read the ideas feed',
    href: '/ideas',
  },
  {
    title: 'Events',
    text: 'Webinars, meetups and conferences, filtered by where you are and what you follow.',
    cta: 'Find events',
    href: '/events',
  },
  {
    title: 'Learn how markets work',
    text: 'Start from what an exchange is and why indices disagree, before touching a chart.',
    cta: 'Open Academy',
    href: '/academy',
  },
];

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

  const stories = NEWS.slice(0, 4);

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

      <h1 className={content.h1}>{MARKET.seo.h1}</h1>
      <p className={content.lead}>{t('heroLead')}</p>

      <MarketSelector current="global" />
      <MarketContextNavigation market={MARKET} active="overview" />

      <h2 className={styles.h2}>{t('intentHeading')}</h2>
      <div className={styles.scenarioGrid}>
        {SCENARIOS.map((card) => (
          <Link className={styles.scenario} key={card.title} href={card.href}>
            <span className={styles.scenarioTitle}>{card.title}</span>
            <span className={styles.scenarioText}>{card.text}</span>
            <span className={styles.scenarioCta}>{card.cta} →</span>
          </Link>
        ))}
      </div>

      <h2 className={styles.h2}>{t('openNow')}</h2>
      <ExchangeSessions exchanges={MARKET.exchanges} now={now} note={t('holidaysUnknown')} />

      <h2 className={styles.h2}>{t('pulse')}</h2>
      <div className={styles.pulseGrid}>
        {MARKET.indices.map((index) => (
          <div className={styles.pulse} key={index.symbol}>
            <div className={styles.pulseName}>{index.name}</div>
            {/* What the index measures, not what it printed — a number here
                without a source would be the one thing the brief forbids. */}
            <div className={styles.pulseDescribes}>{index.describes}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.h2}>Today’s key stories</h2>
      <div className={styles.storyList}>
        {stories.map((story) => (
          <Link className={styles.story} key={story.id} href="/news">
            <span className={styles.storyTitle}>{pick(story.title, locale)}</span>
            <span className={styles.storySummary}>{pick(story.summary, locale)}</span>
            <span className={styles.storyMeta}>{pick(story.source, locale)}</span>
          </Link>
        ))}
      </div>

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
 * The intros mark a few terms with `**`, because the sentence that separates
 * market, exchange and index is the one people re-read. Nothing else in the
 * string is interpreted, and the source is this repository rather than user
 * input — there is no path by which a reader could put markup here.
 */
function bold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
