import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { MARKET_EVENTS, TOP_MOVES, WATCH_NEXT } from '@/content/market';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { TICKERS } from '@/lib/symbolSearch';
import styles from '@/components/content/Content.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/market/brief',
    locale,
    title: t('marketBrief.title'),
    description: t('marketBrief.subtitle'),
  });
}

export default async function MarketBriefPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('brief');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('marketBrief.title')}</h1>
      <p className={styles.lead}>{tScreens('marketBrief.subtitle')}</p>
      <div className={styles.meta}>
        {t('snapshot', { time: '09:45 UTC' })} · <TrustLabel kind="marketData" />
      </div>

      <div className={styles.quoteStrip}>
        {TICKERS.map((ticker) => {
          const symbol = SYMBOLS[ticker];
          return (
            <Link
              className={styles.quoteCard}
              key={ticker}
              href={{ pathname: '/symbols/[ticker]', params: { ticker } }}
            >
              <div className={styles.quoteName}>{pick(symbol.name, locale)}</div>
              <div className={`${styles.quotePrice} tn-num`}>{symbol.price}</div>
              <div
                className={`${styles.quoteChange} ${symbol.up ? styles.up : styles.down} tn-num`}
              >
                {symbol.change}
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className={styles.sectionTitle}>{t('movesTitle')}</h2>
      <div className={styles.gridThree}>
        {TOP_MOVES.map((move) => {
          const symbol = SYMBOLS[move.ticker];
          return (
            <article className={styles.moveCard} key={move.ticker}>
              <div className={styles.moveHead}>
                <span className={styles.moveName}>{pick(symbol.name, locale)}</span>
                <span
                  className={`${styles.moveChange} ${symbol.up ? styles.up : styles.down} tn-num`}
                >
                  {symbol.change}
                </span>
              </div>
              <p className={styles.moveReason}>{pick(move.reason, locale)}</p>
              {/* Source and time sit on every claim, not once at the top of the page. */}
              <div className={styles.moveSource}>
                {move.source} · {pick(move.time, locale)}
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitleSmall} style={{ marginTop: 0 }}>
            {t('eventsTitle')}
          </h2>
          <div style={{ marginTop: 12 }}>
            {MARKET_EVENTS.map((event) => (
              <div className={styles.row} key={event.title.en}>
                <span className={styles.rowKey}>{pick(event.title, locale)}</span>
                <span className={styles.rowValue}>{pick(event.when, locale)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitleSmall} style={{ marginTop: 0 }}>
            {t('watchTitle')}
          </h2>
          <div className={styles.chipRow}>
            {WATCH_NEXT.map((item) => (
              <Link
                className={styles.chip}
                key={item.en}
                href={{ pathname: '/research', query: { q: pick(item, locale) } }}
              >
                {pick(item, locale)}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
