import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ExchangeSessions,
  MarketBreadcrumbs,
  MarketContextNavigation,
  MarketSelector,
  MarketTrustFooter,
  RelatedMarkets,
} from '@/components/markets/MarketShell';
import { getMarket, listMarkets, sectionState } from '@/content/markets';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';
import content from '@/components/content/Content.module.css';
import styles from '@/components/markets/Markets.module.css';

/**
 * One market.
 *
 * The template is shared; the content is not. Everything specific to a market —
 * its exchanges, its indices and what each of them actually measures, the
 * paragraphs explaining how it works — comes from its own entry in the registry
 * and is written per market. A page that is this one with the country name
 * swapped is the failure mode the brief names, and it is also the reason such
 * pages do not earn a search result.
 */

type Props = { params: Promise<{ locale: Locale; market: string }> };

/** Only markets whose overview is actually built. Nothing is generated blind. */
export function generateStaticParams() {
  return listMarkets()
    .filter((market) => market.slug !== 'global' && sectionState(market, 'overview') !== 'disabled')
    .map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, market: slug } = await params;
  const market = getMarket(slug);
  if (!market) return {};

  const base = pageMetadata({
    href: { pathname: '/markets/[market]', params: { market: slug } },
    locale,
    title: market.seo.title,
    description: market.seo.description,
  });

  // A page can be reachable and still not be offered to a search engine. That
  // decision lives in the registry so the sitemap and the robots meta cannot
  // disagree about it.
  return sectionState(market, 'overview') === 'index'
    ? base
    : { ...base, robots: { index: false, follow: true } };
}

export default async function MarketPage({ params }: Props) {
  const { locale, market: slug } = await params;
  setRequestLocale(locale);

  const market = getMarket(slug);
  // `global` has its own route; serving it here too would be a second URL for
  // one page, which is the duplicate the canonical rules exist to prevent.
  if (!market || slug === 'global' || sectionState(market, 'overview') === 'disabled') {
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

  return (
    <div className={content.wrap}>
      <VoyagerPageContext
        context={buildContext('market', market.name, {
          exchanges: market.exchanges.map((exchange) => exchange.name).join(', '),
          indices: market.indices.map((index) => index.name).join(', '),
        })}
      />

      <MarketBreadcrumbs
        trail={[
          { label: tCommon('backHome'), href: '/' },
          { label: 'Market', href: '/market' },
          { label: 'Global Markets', href: '/markets/global' },
          { label: market.name },
        ]}
      />

      <h1 className={content.h1}>{market.seo.h1}</h1>
      <p className={content.lead}>{market.summary}</p>

      <MarketSelector current={market.slug} />
      <MarketContextNavigation market={market} active="overview" />

      <h2 className={styles.h2}>Trading right now</h2>
      <ExchangeSessions exchanges={market.exchanges} now={now} note={t('holidaysUnknown')} />

      <h2 className={styles.h2}>Major indices</h2>
      <div className={styles.pulseGrid}>
        {market.indices.map((index) => (
          <div className={styles.pulse} key={index.symbol}>
            <div className={styles.pulseName}>{index.name}</div>
            <div className={styles.pulseDescribes}>{index.describes}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.h2}>Exchanges</h2>
      <div className={styles.cardList}>
        {market.exchanges.map((exchange) => (
          <div className={styles.relatedCard} key={exchange.id}>
            <span className={styles.relatedName}>{exchange.name}</span>
            <span className={styles.relatedWhy}>{exchange.role}</span>
            <span className={styles.storyMeta}>
              {exchange.city} · {exchange.currency} · {exchange.timeZone}
              {exchange.officialUrl && (
                <>
                  {' · '}
                  <a href={exchange.officialUrl} rel="noopener noreferrer nofollow" target="_blank">
                    Official site
                  </a>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      <h2 className={styles.h2}>How the {market.adjective} market works</h2>
      <div className={styles.prose}>
        {market.seo.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} dangerouslySetInnerHTML={{ __html: bold(paragraph) }} />
        ))}
      </div>

      {sectionState(market, 'news') !== 'disabled' && (
        <p className={styles.note}>
          <Link
            className={styles.crumbLink}
            href={{ pathname: '/markets/[market]/news', params: { market: market.slug } }}
          >
            What moved the {market.adjective} market today →
          </Link>
        </p>
      )}

      <RelatedMarkets market={market} title={t('relatedMarkets')} />

      <MarketTrustFooter updated={updated} dataNote={t('sessionsSource')} disclaimer={t('disclaimer')} />
    </div>
  );
}

function bold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
