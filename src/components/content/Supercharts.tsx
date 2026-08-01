'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { useChartStudies } from '@/components/voyager/VoyagerProvider';
import {
  defaultSpec,
  STUDIES,
  STUDY_IDS,
  type StudyId,
  type StudyLine,
} from '@/lib/studies/registry';
import styles from './Content.module.css';

type Mode = 'simple' | 'standard' | 'pro';
const MODES: Mode[] = ['simple', 'standard', 'pro'];
const PRO_TOOLS = ['indicators', 'drawing', 'replay', 'multi', 'volume', 'tester'] as const;

/**
 * How many daily bars each range shows.
 *
 * The series is daily, so 1D and 5D have nothing to draw — one point is not a
 * chart. They map to a month rather than being removed or disabled: the row is
 * part of the reference design, and a dead chip that cannot explain itself is
 * worse than one that quietly shows the shortest range this data supports.
 */
const RANGES: Array<{ key: string; bars: number | null }> = [
  { key: '1D', bars: 21 },
  { key: '5D', bars: 21 },
  { key: '1M', bars: 21 },
  { key: '6M', bars: 126 },
  { key: 'YTD', bars: 180 },
  { key: '1Y', bars: null },
  { key: '5Y', bars: null },
  { key: 'All', bars: null },
];

const ACTIONS: Array<{ key: string; href: StaticPathname; ai?: boolean }> = [
  { key: 'explain', href: '/research', ai: true },
  { key: 'voyager', href: '/research', ai: true },
  { key: 'news', href: '/news' },
  { key: 'events', href: '/market/brief' },
  { key: 'compare', href: '/explore' },
  { key: 'watchlist', href: '/start' },
  { key: 'alert', href: '/start' },
  { key: 'screener', href: '/explore' },
];

const PRICE = { width: 600, height: 220 };
const PANE = { width: 600, height: 90 };

export type SuperchartsProps = {
  series: number[];
  dates: string[];
  illustrative: boolean;
  asOf?: string;
};

export function Supercharts({ series, illustrative, asOf }: SuperchartsProps) {
  const t = useTranslations('charts');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [mode, setMode] = useState<Mode>('simple');
  const [range, setRange] = useState('1M');
  const { studies, applyStudy, removeStudy, pineRequested } = useChartStudies();

  const pineRef = useRef<HTMLDetailsElement>(null);
  const symbol = SYMBOLS.TSLA;

  /*
   * Studies are computed over the whole series and sliced afterwards, never
   * computed over the slice. An RSI(14) of the last twenty-one bars is a
   * different number from the RSI of the chart it is drawn beside — the warm-up
   * has to come from history the visible window does not contain.
   */
  const computed = useMemo(
    () =>
      studies.map((spec) => ({
        spec,
        definition: STUDIES[spec.id],
        lines: STUDIES[spec.id].compute(series, spec.params),
      })),
    [studies, series]
  );

  const bars = RANGES.find((item) => item.key === range)?.bars ?? null;
  const from = bars === null ? 0 : Math.max(0, series.length - bars);

  const visible = series.slice(from);
  const slice = (lines: StudyLine[]) =>
    lines.map((line) => ({ ...line, values: line.values.slice(from) }));

  const overlays = computed.filter((study) => study.definition.placement === 'overlay');
  const panes = computed.filter((study) => study.definition.placement === 'pane');

  // Voyager's "view_pine" opens the block and brings it into view.
  useEffect(() => {
    if (!pineRequested || !pineRef.current) return;
    pineRef.current.open = true;
    pineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [pineRequested]);

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
              key={item.key}
              className={`${styles.chip} ${item.key === range ? styles.chipBlue : ''}`}
              onClick={() => setRange(item.key)}
            >
              {item.key}
            </button>
          ))}
        </div>

        {/*
          * The study chips are hidden in Simple.
          *
          * Not because a beginner could not use them, but because the point of
          * that mode is that the way in is a sentence — "show me RSI". A study
          * Voyager applies still appears: the control is hidden, the capability
          * is not.
          */}
        {mode !== 'simple' && (
          <div className={styles.chipRow}>
            {STUDY_IDS.map((id) => {
              const on = studies.some((spec) => spec.id === id);
              return (
                <button
                  key={id}
                  className={`${styles.chip} ${on ? styles.chipBlue : ''}`}
                  aria-pressed={on}
                  onClick={() => (on ? removeStudy(id) : applyStudy(defaultSpec(id)))}
                >
                  {t(`studies.${id}`)}
                </button>
              );
            })}
          </div>
        )}

        <svg
          viewBox={`0 0 ${PRICE.width} ${PRICE.height}`}
          className={styles.chartSvg}
          role="img"
          aria-label={pick(symbol.name, locale)}
        >
          {[0, 55, 110, 165, 220].map((y) => (
            <line key={y} x1="0" y1={y} x2={PRICE.width} y2={y} className={styles.gridLine} />
          ))}

          {/* Price and its overlays share one scale, or a crossing would be drawn
              somewhere the numbers never cross. */}
          <PriceAndOverlays
            visible={visible}
            overlays={overlays.flatMap((study) => slice(study.lines))}
          />
        </svg>

        <p className={styles.chartNote}>
          {illustrative ? t('illustrative') : t('delayedAsOf', { time: asOf ?? '' })}
        </p>

        {panes.map((study) => (
          <StudyPane
            key={study.spec.id}
            id={study.spec.id}
            label={study.definition.label(study.spec.params)}
            lines={slice(study.lines)}
          />
        ))}

        {computed.length > 0 && (
          <div className={styles.legendRow}>
            {computed.map((study) => (
              <span className={styles.legendItem} key={study.spec.id}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: `var(--tn-study-${study.lines[0].color})` }}
                  aria-hidden="true"
                />
                {study.definition.label(study.spec.params)}
                <button
                  className={styles.legendRemove}
                  onClick={() => removeStudy(study.spec.id)}
                  aria-label={t('removeStudy', {
                    study: study.definition.label(study.spec.params),
                  })}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {computed.length > 0 && (
          <details className={styles.pineBlock} ref={pineRef}>
            <summary className={styles.pineSummary}>{t('pineTitle')}</summary>

            {computed.map((study) => (
              <PineSnippet
                key={study.spec.id}
                title={study.definition.label(study.spec.params)}
                code={study.definition.pine(study.spec.params)}
                copyLabel={t('copy')}
                copiedLabel={t('copied')}
              />
            ))}

            <p className={styles.pineCaption}>{t('pineCaption')}</p>
          </details>
        )}

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

/* ------------------------------------------------------------- Rendering */

/** Maps values onto a pane, against the extremes they should be scaled to. */
function points(
  values: (number | null)[],
  low: number,
  high: number,
  box: { width: number; height: number }
): string {
  const span = high - low || 1;
  const step = values.length > 1 ? box.width / (values.length - 1) : 0;

  const segments: string[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    // A warm-up gap is a gap in the line, not a plunge to zero.
    if (value === null) continue;
    const x = i * step;
    const y = box.height - ((value - low) / span) * box.height;
    segments.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return segments.join(' ');
}

function extremes(sets: Array<(number | null)[]>): { low: number; high: number } {
  const all = sets.flat().filter((value): value is number => value !== null);
  if (!all.length) return { low: 0, high: 1 };

  const low = Math.min(...all);
  const high = Math.max(...all);
  // A little air, so a line never sits exactly on the frame.
  const pad = (high - low) * 0.05 || 1;
  return { low: low - pad, high: high + pad };
}

function PriceAndOverlays({
  visible,
  overlays,
}: {
  visible: number[];
  overlays: StudyLine[];
}) {
  const { low, high } = extremes([visible, ...overlays.map((line) => line.values)]);

  return (
    <>
      {overlays.map((line, index) => (
        <polyline
          key={`${line.key}-${index}`}
          points={points(line.values, low, high, PRICE)}
          fill="none"
          stroke={`var(--tn-study-${line.color})`}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Drawn last: the price is the subject, the studies are commentary. */}
      <polyline
        points={points(visible, low, high, PRICE)}
        fill="none"
        stroke="var(--tn-blue)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** An oscillator gets its own pane because it does not share the price's scale. */
function StudyPane({ id, label, lines }: { id: StudyId; label: string; lines: StudyLine[] }) {
  const isRsi = id === 'rsi';

  // RSI is bounded 0–100 by construction, so it is drawn against that rather
  // than against what it happened to do — otherwise the 30 and 70 lines move,
  // and they are the only reason those numbers are worth printing.
  const { low, high } = isRsi
    ? { low: 0, high: 100 }
    : extremes(lines.map((line) => line.values));

  const hist = lines.find((line) => line.key === 'hist');
  const curves = lines.filter((line) => line.key !== 'hist');
  const span = high - low || 1;
  const zero = PANE.height - ((0 - low) / span) * PANE.height;
  const step = (lines[0]?.values.length ?? 0) > 1 ? PANE.width / (lines[0].values.length - 1) : 0;

  return (
    <svg
      viewBox={`0 0 ${PANE.width} ${PANE.height}`}
      className={styles.paneSvg}
      role="img"
      aria-label={label}
    >
      {isRsi &&
        [30, 70].map((level) => {
          const y = PANE.height - (level / 100) * PANE.height;
          return (
            <line
              key={level}
              x1="0"
              y1={y}
              x2={PANE.width}
              y2={y}
              className={styles.gridLine}
              strokeDasharray="4 5"
            />
          );
        })}

      {/* MACD's histogram, as columns from the zero line — the gap between the
          two lines is the part people actually read. */}
      {hist?.values.map((value, index) =>
        value === null ? null : (
          <line
            key={index}
            x1={(index * step).toFixed(1)}
            y1={zero.toFixed(1)}
            x2={(index * step).toFixed(1)}
            y2={(PANE.height - ((value - low) / span) * PANE.height).toFixed(1)}
            stroke={`var(--tn-study-${hist.color})`}
            strokeWidth={1}
            opacity={0.5}
          />
        )
      )}

      {curves.map((line) => (
        <polyline
          key={line.key}
          points={points(line.values, low, high, PANE)}
          fill="none"
          stroke={`var(--tn-study-${line.color})`}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function PineSnippet({
  title,
  code,
  copyLabel,
  copiedLabel,
}: {
  title: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className={styles.pineSnippet}>
      <div className={styles.pineHead}>
        <span className={styles.pineName}>{title}</span>
        <button
          className={styles.pineCopy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              // Clipboard access can be refused. The code is on screen and
              // selectable, so this is a lost convenience, not a lost feature.
            }
          }}
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>

      <pre className={styles.pineCode}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
