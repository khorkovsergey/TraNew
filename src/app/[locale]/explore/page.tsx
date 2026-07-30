import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ASSET_CLASSES, EXPLORE_GOALS, TOP_MOVES } from '@/content/market';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/explore',
    locale,
    title: t('explore.title'),
    description: t('explore.subtitle'),
  });
}

const TOOLS: Array<{ key: string; href: StaticPathname | null; slug?: string }> = [
  { key: 'screeners', href: null, slug: 'screeners' },
  { key: 'heatmaps', href: null, slug: 'heatmaps' },
  { key: 'calendars', href: null, slug: 'calendars' },
  { key: 'compare', href: null, slug: 'compare' },
  { key: 'charts', href: '/supercharts' },
  { key: 'alerts', href: null, slug: 'alerts' },
  { key: 'watchlists', href: null, slug: 'watchlists' },
  { key: 'portfolio', href: '/portfolio' },
  { key: 'brokers', href: '/brokers' },
  { key: 'copilot', href: '/research' },
];

export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('explore');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('explore.title')}</h1>
      <p className={styles.lead}>{tScreens('explore.subtitle')}</p>

      <h2 className={styles.sectionTitle}>{t('todayTitle')}</h2>
      <div className={styles.gridThree}>
        {TOP_MOVES.map((move) => {
          const symbol = SYMBOLS[move.ticker];
          return (
            <Link
              className={styles.moveCard}
              key={move.ticker}
              href={{ pathname: '/symbols/[ticker]', params: { ticker: move.ticker } }}
            >
              <div className={styles.moveHead}>
                <span className={styles.moveName}>{pick(symbol.name, locale)}</span>
                <span
                  className={`${styles.moveChange} ${symbol.up ? styles.up : styles.down} tn-num`}
                >
                  {symbol.change}
                </span>
              </div>
              <p className={styles.moveReason}>{pick(move.reason, locale)}</p>
              <div className={styles.moveSource}>
                {move.source} · {pick(move.time, locale)}
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className={styles.sectionTitle}>{t('byClassTitle')}</h2>
      <div className={styles.chipRow}>
        {ASSET_CLASSES.map((item, index) => (
          <Link
            className={styles.chip}
            key={item.en}
            href={{ pathname: '/tool/[slug]', params: { slug: `class-${index}` } }}
          >
            {pick(item, locale)}
          </Link>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>{t('byGoalTitle')}</h2>
      <div className={styles.chipRow}>
        {EXPLORE_GOALS.map((item) => (
          <Link
            className={`${styles.chip} ${styles.chipBlue}`}
            key={item.en}
            href={{ pathname: '/research', query: { q: pick(item, locale) } }}
          >
            {pick(item, locale)}
          </Link>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>{t('toolsTitle')}</h2>
      <div className={styles.toolGrid}>
        {TOOLS.map((tool) =>
          tool.href ? (
            <Link className={styles.tool} key={tool.key} href={tool.href}>
              {t(`tools.${tool.key}`)}
            </Link>
          ) : (
            <Link
              className={styles.tool}
              key={tool.key}
              href={{ pathname: '/tool/[slug]', params: { slug: tool.slug! } }}
            >
              {t(`tools.${tool.key}`)}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
