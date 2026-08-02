import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  MarketBreadcrumbs,
  MarketContextNavigation,
  MarketSelector,
  MarketTrustFooter,
  RelatedMarkets,
} from '@/components/markets/MarketShell';
import { getMarket, listMarkets, sectionState } from '@/content/markets';
import { NEWS } from '@/content/market';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';
import content from '@/components/content/Content.module.css';
import styles from '@/components/markets/Markets.module.css';

/**
 * What moved this market, and why.
 *
 * The "why it matters" line is the reason this page exists rather than being a
 * filtered view of the news feed. It is written per story and attributed; where
 * there is no reporting behind an explanation, the line is absent rather than
 * inferred — "the market rose because X" assembled automatically is a claim
 * nobody checked.
 */

type Props = { params: Promise<{ locale: Locale; market: string }> };

export function generateStaticParams() {
  return listMarkets()
    .filter((market) => sectionState(market, 'news') !== 'disabled' && market.slug !== 'global')
    .map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, market: slug } = await params;
  const market = getMarket(slug);
  if (!market) return {};

  const base = pageMetadata({
    href: { pathname: '/markets/[market]/news', params: { market: slug } },
    locale,
    title: `${market.adjective} Stock Market News Today`,
    description: `What moved the ${market.adjective} market today, why it mattered and which indices and exchanges were affected.`,
  });

  return sectionState(market, 'news') === 'index'
    ? base
    : { ...base, robots: { index: false, follow: true } };
}

/**
 * Why each story matters to this market specifically.
 *
 * Keyed by story id, written by hand, and absent where nobody has written one.
 * A generated sentence here would read exactly like the ones that were checked.
 */
const WHY_IT_MATTERS: Record<string, Record<string, string>> = {
  us: {
    'fed-hold':
      'Rate decisions set the return available without taking equity risk, so they move what every other US asset is worth — not only the companies mentioned.',
    'tech-earnings':
      'The largest technology companies are a substantial share of the S&P 500 by value, so their results move the index that most people mean by "the US market".',
  },
  japan: {
    'boj-policy':
      'Japanese policy decisions move the yen, and a large share of the Nikkei’s constituents earn abroad — so the currency and the index frequently move in opposite directions on the same news.',
  },
};

export default async function MarketNewsPage({ params }: Props) {
  const { locale, market: slug } = await params;
  setRequestLocale(locale);

  const market = getMarket(slug);
  if (!market || sectionState(market, 'news') === 'disabled') {
    notFound();
  }

  const t = await getTranslations('markets');
  const tCommon = await getTranslations('common');

  const now = new Date();
  const updated = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(now);

  const why = WHY_IT_MATTERS[market.slug] ?? {};
  const stories = NEWS.slice(0, 6);

  return (
    <div className={content.wrap}>
      <VoyagerPageContext context={buildContext('market', `${market.name} news`)} />

      <MarketBreadcrumbs
        trail={[
          { label: tCommon('backHome'), href: '/' },
          { label: 'Global Markets', href: '/markets/global' },
          { label: market.name, href: `/markets/${market.slug}` },
          { label: 'News' },
        ]}
      />

      <h1 className={content.h1}>{market.adjective} Stock Market News</h1>

      {/* The direct answer, above everything else: someone arriving from a
          search for "what happened in the US market today" should not have to
          scroll past a navigation row to find out. */}
      <p className={content.lead}>
        {market.exchanges.map((exchange) => exchange.name).join(' and ')} trade{' '}
        {market.exchanges[0].segments.map((s) => `${s.open}–${s.close}`).join(' and ')} local time. Below
        is what moved during the most recent session, with the reporting each explanation rests on.
      </p>

      <MarketSelector current={market.slug} />
      <MarketContextNavigation market={market} active="news" />

      <div className={styles.storyList}>
        {stories.map((story) => (
          <Link className={styles.story} key={story.id} href="/news">
            <span className={styles.storyTitle}>{pick(story.title, locale)}</span>
            <span className={styles.storySummary}>{pick(story.summary, locale)}</span>
            {why[story.id] && <span className={styles.storyWhy}>Why it matters: {why[story.id]}</span>}
            <span className={styles.storyMeta}>{pick(story.source, locale)}</span>
          </Link>
        ))}
      </div>

      <h2 className={styles.h2}>Where to look next</h2>
      <div className={styles.cardList}>
        <Link className={styles.relatedCard} href={`/markets/${market.slug}` as never}>
          <span className={styles.relatedName}>{market.name} overview</span>
          <span className={styles.relatedWhy}>
            Exchanges, indices and trading hours for this market.
          </span>
        </Link>
        <Link className={styles.relatedCard} href="/news">
          <span className={styles.relatedName}>All market news</span>
          <span className={styles.relatedWhy}>The same stories without the market filter.</span>
        </Link>
      </div>

      <RelatedMarkets market={market} title={t('relatedMarkets')} />

      <MarketTrustFooter
        updated={updated}
        dataNote="Stories are reference content for the demo; each carries the outlet it is attributed to."
        disclaimer={t('disclaimer')}
      />
    </div>
  );
}
