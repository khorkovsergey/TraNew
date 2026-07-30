'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { wave } from '@/lib/wave';
import styles from './Content.module.css';

type Mode = 'simple' | 'standard' | 'pro';
const MODES: Mode[] = ['simple', 'standard', 'pro'];
const RANGES = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'All'];
const PRO_TOOLS = ['indicators', 'drawing', 'replay', 'multi', 'volume', 'tester'] as const;

const ACTIONS: Array<{ key: string; href: StaticPathname; ai?: boolean }> = [
  { key: 'explain', href: '/research', ai: true },
  { key: 'copilot', href: '/research', ai: true },
  { key: 'news', href: '/news' },
  { key: 'events', href: '/market/brief' },
  { key: 'compare', href: '/explore' },
  { key: 'watchlist', href: '/start' },
  { key: 'alert', href: '/start' },
  { key: 'screener', href: '/explore' },
];

export function Supercharts() {
  const t = useTranslations('charts');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;
  const [mode, setMode] = useState<Mode>('simple');
  const [range, setRange] = useState('1M');

  const symbol = SYMBOLS.TSLA;

  return (
    <>
      {/* Beginner, Standard and Pro are depths of one product, not three products. */}
      <div className={styles.modeRow}>
        {MODES.map((item) => (
          <button
            key={item}
            className={`${styles.mode} ${mode === item ? styles.modeActive : ''}`}
            aria-pressed={mode === item}
            onClick={() => setMode(item)}
          >
            {t(`mode${item.charAt(0).toUpperCase()}${item.slice(1)}`)}
          </button>
        ))}
        <Link className={styles.ghost} href={{ pathname: '/tool/[slug]', params: { slug: 'layout' } }}>
          {t('openFull')}
        </Link>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.moveHead}>
          <span className={styles.moveName}>{pick(symbol.name, locale)}</span>
          <span className={`${styles.moveChange} ${styles.up} tn-num`}>
            {symbol.price} · {symbol.change}
          </span>
        </div>

        <div className={styles.chipRow}>
          {RANGES.map((item) => (
            <button
              key={item}
              className={`${styles.chip} ${item === range ? styles.chipBlue : ''}`}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <svg viewBox="0 0 600 220" className={styles.chartSvg} aria-hidden="true">
          {[0, 55, 110, 165, 220].map((y) => (
            <line key={y} x1="0" y1={y} x2="600" y2={y} className={styles.gridLine} />
          ))}
          <polyline
            points={wave(5.1, 80, 600, 220)}
            fill="none"
            stroke="var(--tn-blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {mode === 'pro' && (
          <>
            <h2 className={styles.sectionTitleSmall}>{t('toolsTitle')}</h2>
            <div className={styles.chipRow}>
              {PRO_TOOLS.map((tool) => (
                <span className={styles.chip} key={tool}>
                  {t(`tools.${tool}`)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.nextBlock}>
        <div className={styles.nextTitle}>{tCommon('nextSteps')}</div>
        <div className={styles.chipRow}>
          {ACTIONS.map((action) => (
            <Link
              className={`${styles.chip} ${action.ai ? styles.chipAi : ''}`}
              key={action.key}
              href={action.href}
            >
              {t(`actions.${action.key}`)}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
