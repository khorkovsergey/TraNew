import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EconomicDrivers, loadEconomicDrivers } from '@/components/economy/EconomicDrivers';
import { SymbolActions } from '@/components/screens/SymbolActions';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { topicsForSymbol } from '@/lib/events/related';
import { Icon } from '@/components/ui/Icon';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { getQuote } from '@/lib/market/client';
import { getCompanyNews } from '@/lib/market/news';
import { pageMetadata } from '@/lib/metadata';
import { isTicker, TICKERS, type Ticker } from '@/lib/symbolSearch';
import styles from '@/components/screens/Symbol.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale; ticker: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => TICKERS.map((ticker) => ({ locale, ticker })));
}

function resolve(raw: string): Ticker | null {
  const upper = raw.toUpperCase();
  return isTicker(upper) ? (upper as Ticker) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ticker } = await params;
  const key = resolve(ticker);
  if (!key) return {};

  const symbol = SYMBOLS[key];
  const t = await getTranslations({ locale, namespace: 'symbol' });
  const name = pick(symbol.name, locale);

  return pageMetadata({
    href: { pathname: '/symbols/[ticker]', params: { ticker: key } },
    locale,
    title: `${name} (${symbol.ticker}) — ${symbol.price}`,
    description: `${t('whyTitle')}: ${pick(symbol.why, locale).slice(0, 150)}…`,
  });
}

const NEXT_STEPS = ['competitors', 'sector', 'etfs', 'events'] as const;

export default async function SymbolPage({ params }: Props) {
  const { locale, ticker } = await params;
  setRequestLocale(locale);

  const key = resolve(ticker);
  if (!key) notFound();

  const symbol = SYMBOLS[key];
  const t = await getTranslations('symbol');
  const tCommon = await getTranslations('common');
  const name = pick(symbol.name, locale);

  /*
   * Live headlines for this instrument. Null when the key is absent or the
   * vendor is quiet, and the page renders the written stories alone — a news
   * feed that fails should cost a section, not a page.
   */
  const companyFeed = await getCompanyNews(key);

  /*
   * A live quote when the vendor answers, the authored figure when it does not.
   * The distinction is shown rather than hidden: a delayed price says so, and a
   * reference figure says that instead of quietly passing for a real one.
   */
  /*
   * Which macro forces to show. Mapped from the ticker rather than inferred from
   * price history: a correlation computed over a handful of symbols would look
   * precise and mean nothing.
   */
  const DRIVER_GROUP = {
    TSLA: 'consumer',
    NVDA: 'tech',
    SPX: 'index',
    GOLD: 'commodity',
    BTC: 'commodity',
  } as const;

  const quote = await getQuote(key);
  const drivers = await loadEconomicDrivers(DRIVER_GROUP[key]);
  const price = quote
    ? quote.price.toLocaleString('en-GB', { style: 'currency', currency: quote.currency })
    : symbol.price;
  const change = quote
    ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`
    : symbol.change;
  const up = quote ? quote.changePercent >= 0 : symbol.up;
  const freshness = quote
    ? `${quote.exchange} · delayed 15 min · ${quote.asOf}`
    : 'Reference figure — no live feed connected';

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('symbol', name, { ticker: key, price, change })} />
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <div className={styles.head}>
        <div>
          <div className={styles.eyebrow}>
            {symbol.ticker} · {pick(symbol.type, locale)}
          </div>
          <h1 className={styles.name}>{name}</h1>
        </div>
        <div className={styles.priceBlock}>
          <div className={`${styles.price} tn-num`}>{price}</div>
          <div className={`${styles.change} ${up ? styles.up : styles.down} tn-num`}>
            {change} {t('today')}
          </div>
          {/* Where the number came from and how old it is, always. */}
          <div className={styles.eyebrow}>{freshness}</div>
        </div>
      </div>

      <SymbolActions ticker={symbol.ticker} name={name} price={price} />

      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{t('whyTitle')}</h2>
              <TrustLabel kind="aiExplanation" />
            </div>
            <p className={styles.body}>{pick(symbol.why, locale)}</p>
            <div className={styles.provenance}>{t('whyProvenance')}</div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{t('techTitle')}</h2>
              <TrustLabel kind="technicalSignal" />
            </div>
            <p className={styles.body}>{pick(symbol.tech, locale)}</p>
            <div className={styles.provenance}>{t('techProvenance')}</div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('newsTitle')}</h2>

            {/*
              Live headlines for this instrument, above the written ones. Kept
              in the same card rather than given its own, because a reader
              looking for "news about this company" wants one place — but each
              live item links out and says which publisher it belongs to.
            */}
            {companyFeed && (
              <div className={styles.newsList}>
                {companyFeed.stories.map((story) => (
                  <a
                    className={styles.newsItem}
                    key={story.id}
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <span className={styles.newsMeta}>
                      <TrustLabel kind="fact" small />
                      <span>
                        {story.source} · {story.publishedAt.slice(0, 10)}
                      </span>
                    </span>
                    <span className={styles.newsTitle}>{story.title} ↗</span>
                  </a>
                ))}
              </div>
            )}

            <div className={styles.newsList}>
              {symbol.news.map((item) => (
                <Link className={styles.newsItem} href="/news" key={item.title.en}>
                  <span className={styles.newsMeta}>
                    <TrustLabel kind={item.label} small />
                    <span>
                      {item.source} · {item.time}
                    </span>
                  </span>
                  <span className={styles.newsTitle}>{pick(item.title, locale)}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={`${styles.card} ${styles.cardTight}`}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitleSmall}>{t('eventTitle')}</h2>
              <TrustLabel kind="marketData" />
            </div>
            <div className={styles.bodySmall}>{pick(symbol.event, locale)}</div>
          </section>

          <section className={`${styles.card} ${styles.cardTight}`}>
            <h2 className={styles.cardTitleSmall}>{t('factsTitle')}</h2>
            <div className={styles.facts}>
              {symbol.facts.map((fact) => (
                <div className={styles.factRow} key={fact.k.en}>
                  <span className={styles.factKey}>{pick(fact.k, locale)}</span>
                  <span className={`${styles.factValue} tn-num`}>{pick(fact.v, locale)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.card} ${styles.cardTight}`}>
            <h2 className={styles.cardTitleSmall}>{t('relatedTitle')}</h2>
            <div className={styles.chips}>
              {symbol.related.map((related) => (
                <Link
                  className={styles.chip}
                  key={related}
                  href={{ pathname: '/symbols/[ticker]', params: { ticker: related } }}
                >
                  {pick(SYMBOLS[related].name, locale)}
                </Link>
              ))}
            </div>
          </section>

          {/* Path from an asset into the macro data that moves it, with the asset
              still in context. */}
          <EconomicDrivers drivers={drivers} assetName={name} />

          <section className={styles.nextCard}>
            <h2 className={styles.cardTitleSmall}>{t('nextTitle')}</h2>
            <div className={styles.nextList}>
              {NEXT_STEPS.map((step) => (
                <Link
                  className={styles.nextItem}
                  key={step}
                  href={{
                    pathname: '/tool/[slug]',
                    params: { slug: `${step}-${key.toLowerCase()}` },
                  }}
                >
                  <span>{t(`next.${step}`)}</span>
                  <Icon name="arrowRight" size={15} />
                </Link>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/*
        * Events belongs beside the thing it is about — but below both columns
        * rather than inside the right one.
        *
        * It was the last item in that column, which is already the longer of the
        * two, so it rendered against a screen-height of empty space on the left
        * and squeezed its cards into half a column. This is a section about the
        * whole asset, so it gets the whole width.
        */}
      <RelatedEvents topics={topicsForSymbol(key)} title="Events on this asset" limit={2} />
    </div>
  );
}
