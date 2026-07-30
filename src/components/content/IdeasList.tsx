'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { IDEAS, IDEA_TABS } from '@/content/market';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import styles from './Content.module.css';

export function IdeasList() {
  const t = useTranslations('ideas');
  const locale = useLocale() as Locale;
  const [tab, setTab] = useState(0);

  return (
    <>
      <div className={styles.tabs} role="tablist">
        {IDEA_TABS.map((item, index) => (
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
        {IDEAS.map((idea) => {
          const symbol = SYMBOLS[idea.ticker];
          return (
            <article className={styles.card} key={idea.id}>
              <div className={styles.cardMeta}>
                <TrustLabel kind="communityOpinion" small />
                {/* An idea's status after publication is stated, not quietly dropped. */}
                <span
                  className={`${styles.badge} ${
                    idea.status === 'active' ? styles.badgeActive : styles.badgeInvalidated
                  }`}
                >
                  {idea.status === 'active' ? t('statusActive') : t('statusInvalidated')}
                </span>
                <span>
                  {idea.author} · {pick(idea.time, locale)} · {pick(symbol.name, locale)} ·{' '}
                  {t('horizon')}: {pick(idea.horizon, locale)}
                </span>
              </div>

              <p className={styles.cardSummary} style={{ marginTop: 12 }}>
                {pick(idea.thesis, locale)}
              </p>

              <div className={`${styles.since} ${idea.sinceUp ? styles.up : styles.down} tn-num`}>
                {t('since')} {idea.since}
              </div>
              {idea.discloses && <div className={styles.disclosure}>{t('discloses')}</div>}

              <div className={styles.cardActions}>
                <Link
                  className={styles.chip}
                  href={{ pathname: '/symbols/[ticker]', params: { ticker: idea.ticker } }}
                >
                  {pick(symbol.name, locale)}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
