'use client';

import { useLocale, useTranslations } from 'next-intl';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { SIMPLE_VIEW, SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useAcademy, type AcademyMode } from '@/lib/academyProgress';
import type { Ticker } from '@/lib/symbolSearch';
import { wave } from '@/lib/wave';
import styles from './Academy.module.css';
import symbolStyles from '@/components/screens/Symbol.module.css';

const MODES: AcademyMode[] = ['beginner', 'standard', 'pro'];

export function PracticeSymbol({ ticker }: { ticker: Ticker }) {
  const t = useTranslations('academy.practice');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, update } = useAcademy();

  const symbol = SYMBOLS[ticker];
  const simple = SIMPLE_VIEW[ticker];
  const added = state?.watch.includes(ticker) ?? false;

  const setMode = (mode: AcademyMode) => {
    update({ mode });
    // Standard and Pro are the same product seen at a different depth — hand the
    // reader over to the full Symbol Research Overview rather than a second page.
    if (mode !== 'beginner') {
      router.push({ pathname: '/symbols/[ticker]', params: { ticker } });
    }
  };

  const addToWatchlist = () => {
    if (added) return;
    update({ watch: [...(state?.watch ?? []), ticker], practiced: true });
  };

  return (
    <>
      <div className={styles.practiceCard} style={{ marginTop: 0 }}>
        <div className={styles.practiceText} style={{ marginTop: 0 }}>
          {t('banner')}
        </div>
      </div>

      <div className={styles.ctaRow} style={{ marginTop: 20, gap: 8 }}>
        <span className={styles.progressLabel}>{t('modeLabel')}</span>
        {MODES.map((mode) => {
          const active = (state?.mode ?? 'beginner') === mode;
          return (
            <button
              key={mode}
              className={styles.quizOption}
              style={
                active
                  ? { background: 'var(--tn-text)', color: '#fff', borderColor: 'var(--tn-text)' }
                  : undefined
              }
              onClick={() => setMode(mode)}
            >
              {t(mode === 'beginner' ? 'modeBeginner' : mode === 'standard' ? 'modeStandard' : 'modePro')}
            </button>
          );
        })}
        <span className={styles.hint}>{t('modeSaved')}</span>
      </div>

      <div className={symbolStyles.head} style={{ marginTop: 24 }}>
        <div>
          <div className={symbolStyles.eyebrow}>
            {symbol.ticker} · {pick(symbol.type, locale)}
          </div>
          <h1 className={symbolStyles.name}>{pick(symbol.name, locale)}</h1>
        </div>
        <div className={symbolStyles.priceBlock}>
          <div className={`${symbolStyles.price} tn-num`}>{symbol.price}</div>
          <div
            className={`${symbolStyles.change} ${
              symbol.up ? symbolStyles.up : symbolStyles.down
            } tn-num`}
          >
            {symbol.change}
          </div>
        </div>
      </div>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{t('whatIs')}</h2>
        <p className={styles.paragraph}>{pick(simple.what, locale)}</p>
      </section>

      <section className={styles.cardWide}>
        <div className={symbolStyles.cardHead}>
          <h2 className={styles.cardTitle}>{t('whatChanged')}</h2>
          <TrustLabel kind="aiExplanation" />
        </div>
        <p className={styles.paragraph}>{pick(symbol.why, locale)}</p>
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{t('facts')}</h2>
        <div className={symbolStyles.facts}>
          {symbol.facts.map((fact) => (
            <div className={symbolStyles.factRow} key={fact.k.en}>
              <span className={symbolStyles.factKey}>{pick(fact.k, locale)}</span>
              <span className={`${symbolStyles.factValue} tn-num`}>{pick(fact.v, locale)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{t('risks')}</h2>
        <p className={styles.paragraph}>{pick(simple.risks, locale)}</p>
      </section>

      <section className={styles.cardWide}>
        <div className={symbolStyles.cardHead}>
          <h2 className={styles.cardTitle}>{t('event')}</h2>
          <TrustLabel kind="marketData" />
        </div>
        <p className={styles.paragraph}>{pick(symbol.event, locale)}</p>
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{t('chart')}</h2>
        <svg viewBox="0 0 300 90" className={styles.exampleChart} aria-hidden="true">
          <polyline
            points={wave(2.4, 40, 300, 90)}
            fill="none"
            stroke="var(--tn-blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </section>

      <div className={styles.ctaRow}>
        <button
          className={added ? styles.completeCta : styles.practiceCta}
          onClick={addToWatchlist}
        >
          {added ? t('added') : t('addWatchlist')}
        </button>
        <Link
          className={styles.secondary}
          href={{ pathname: '/symbols/[ticker]', params: { ticker } }}
        >
          {t('more')}
        </Link>
      </div>
    </>
  );
}
