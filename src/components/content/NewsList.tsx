'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { NEWS, NEWS_TABS } from '@/content/market';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import styles from './Content.module.css';

export function NewsList() {
  const t = useTranslations('news');
  const locale = useLocale() as Locale;
  // Tab 1 ("Top stories") is the default in the handoff, not "For you".
  const [tab, setTab] = useState(1);

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {NEWS_TABS.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={index === tab}
            className={`${styles.tab} ${index === tab ? styles.tabActive : ''}`}
            onClick={() => setTab(index)}
          >
            {pick(item.label, locale)}
          </button>
        ))}
      </div>

      <div className={styles.cardList}>
        {NEWS.map((item) => (
          <article className={styles.card} key={item.id}>
            <div className={styles.cardMeta}>
              <TrustLabel kind={item.label} small />
              <span>
                {item.source} · {pick(item.time, locale)}
              </span>
            </div>

            <h2 className={styles.cardTitle}>{pick(item.title, locale)}</h2>
            <p className={styles.cardSummary}>{pick(item.summary, locale)}</p>

            {/* The reason this portal exists: the consequence, not just the event. */}
            <p className={styles.whyItMatters}>
              <span className={styles.whyLabel}>{t('whyItMatters')} </span>
              {pick(item.whyItMatters, locale)}
            </p>

            <div className={styles.cardActions}>
              {item.related.map((ticker) => (
                <Link
                  className={styles.chip}
                  key={ticker}
                  href={{ pathname: '/symbols/[ticker]', params: { ticker } }}
                >
                  {pick(SYMBOLS[ticker].name, locale)}
                </Link>
              ))}
              <Link className={`${styles.chip} ${styles.chipBlue}`} href="/supercharts">
                {t('openChart')}
              </Link>
              <Link
                className={`${styles.chip} ${styles.chipAi}`}
                href={{
                  pathname: '/research',
                  query: { q: pick(item.title, locale) },
                }}
              >
                {t('askCopilot')}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
