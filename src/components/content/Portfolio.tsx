'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { MARKET_EVENTS } from '@/content/market';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import styles from './Content.module.css';

const ALLOCATION = [
  { key: 'equity', label: { en: 'Broad equity ETFs', ru: 'Широкие ETF на акции' }, share: 46, color: 'var(--tn-blue)' },
  { key: 'stocks', label: { en: 'Single stocks', ru: 'Отдельные акции' }, share: 27, color: 'var(--tn-purple)' },
  { key: 'bonds', label: { en: 'Bonds & cash', ru: 'Облигации и наличные' }, share: 19, color: 'var(--tn-green)' },
  { key: 'alts', label: { en: 'Alternatives', ru: 'Альтернативные активы' }, share: 8, color: 'var(--tn-orange)' },
];

export function Portfolio({ startOnSample = false }: { startOnSample?: boolean }) {
  const t = useTranslations('portfolio');
  const locale = useLocale() as Locale;
  const { openLogin } = useLoginModal();
  /*
   * Opened straight on the sample when the link asked for it.
   *
   * The home card promises to show how investments work and this screen opened
   * on a chooser asking which broker to connect — one tile of four matched the
   * promise, and it was the last one. Somebody who wants to see the thing
   * should see the thing; the import options are still here, below it.
   */
  const [view, setView] = useState<'onboarding' | 'sample'>(
    startOnSample ? 'sample' : 'onboarding'
  );

  if (view === 'onboarding') {
    return (
      <>
        <h2 className={styles.sectionTitle}>{t('onboardingTitle')}</h2>
        <div className={styles.grid}>
          {/* Three routes need an account; the fourth deliberately does not. */}
          {(['addManual', 'import', 'upload'] as const).map((key) => (
            <button className={styles.card} key={key} onClick={openLogin} style={{ textAlign: 'left' }}>
              <div className={styles.infoTitle}>{t(key)}</div>
              <div className={styles.infoText}>{t(`${key}Text`)}</div>
            </button>
          ))}
          <button
            className={styles.card}
            style={{ textAlign: 'left', borderColor: 'var(--tn-blue)' }}
            onClick={() => setView('sample')}
          >
            <div className={styles.infoTitle}>{t('sample')}</div>
            <div className={styles.infoText}>{t('sampleText')}</div>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.card} style={{ marginTop: 24 }}>
        <div className={styles.quoteName}>{t('sampleValue')}</div>
        <div className={`${styles.bigValue} tn-num`}>$48,920</div>
        <div className={`${styles.quoteChange} ${styles.up} tn-num`}>+6.4% {t('ytd')}</div>
        <div className={styles.meta}>
          <TrustLabel kind="marketData" />
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitleSmall} style={{ marginTop: 0 }}>
            {t('allocation')}
          </h2>
          {ALLOCATION.map((band) => (
            <div className={styles.allocRow} key={band.key}>
              <div className={styles.allocHead}>
                <span>{pick(band.label, locale)}</span>
                <span className="tn-num">{band.share}%</span>
              </div>
              <div className={styles.allocTrack}>
                <div
                  className={styles.allocFill}
                  style={{ width: `${band.share}%`, background: band.color }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitleSmall} style={{ marginTop: 0 }}>
            {t('eventsTitle')}
          </h2>
          <div style={{ marginTop: 12 }}>
            {MARKET_EVENTS.slice(0, 3).map((event) => (
              <div className={styles.row} key={event.title.en}>
                <span className={styles.rowKey}>{pick(event.title, locale)}</span>
                <span className={styles.rowValue}>{pick(event.when, locale)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.card} style={{ marginTop: 20 }}>
        <h2 className={styles.sectionTitleSmall} style={{ marginTop: 0 }}>
          {t('riskTitle')}
        </h2>
        <p className={styles.infoText}>{t('riskText')}</p>
      </section>

      <div className={styles.banner}>
        <div>
          <div className={styles.bannerTitle}>{t('bannerTitle')}</div>
          <div className={styles.bannerText}>{t('bannerText')}</div>
        </div>
        <button className={styles.primary} onClick={openLogin}>
          {t('bannerCta')}
        </button>
      </div>

      <div className={styles.ctaRow}>
        <Link className={styles.ghost} href="/strategy">
          {t('onboardingTitle')}
        </Link>
      </div>
    </>
  );
}
