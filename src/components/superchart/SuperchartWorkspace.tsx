'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { CanvasChartEngine } from '@/lib/superchart/chart-engine/canvas';
import {
  CHART_TYPE_LABEL,
  INTERVAL_SECONDS,
  type Bar,
  type ChartInterval,
  type ChartPalette,
  type ChartType,
  type CrosshairContext,
} from '@/lib/superchart/chart-engine/types';
import { CachingDatafeed } from '@/lib/superchart/datafeed/cache';
import { DemoDatafeed, DEMO_SYMBOLS } from '@/lib/superchart/datafeed/demoAdapter';
import type { ResolvedSymbol } from '@/lib/superchart/datafeed/types';
import styles from './Superchart.module.css';

/**
 * The Superchart workspace — Phase 1 of the plan.
 *
 * The frame at the design's geometry, with a canvas engine drawing real bars.
 * It composes the interface and holds no market-data, AI or indicator logic:
 * the engine owns the bars and the pointer, and this component owns the layout
 * and the small amount of state a panel needs.
 *
 * What is deliberately not here yet, rather than stubbed to look present:
 * indicators, drawings, the object tree, layouts and the Voyager command bus.
 * Each has a phase, and the engine's methods for them reject rather than
 * quietly succeeding.
 */

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];
const CHART_TYPES: ChartType[] = ['candles', 'bars', 'line', 'area', 'baseline', 'hollow', 'heikin'];

/**
 * The engine is handed resolved colours rather than reading the stylesheet.
 *
 * `check-tokens.mjs` fails the build on a token that does not exist, and it
 * cannot see a hex literal inside a canvas call. Resolving here keeps every
 * colour in `tokens.css` where the check can reach it.
 */
function readPalette(element: HTMLElement): ChartPalette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    up: token('--tn-green', '#1aa966'),
    down: token('--tn-red', '#e0492f'),
    grid: token('--tn-border-card', '#eef1f6'),
    text: token('--tn-text', '#131722'),
    textMuted: token('--tn-text-muted', '#8a93a6'),
    surface: token('--tn-surface', '#ffffff'),
    border: token('--tn-border-card', '#e6eaf2'),
    crosshair: token('--tn-text-muted', '#9aa3b5'),
    volumeUp: token('--tn-green-tint', '#b6e6cd'),
    volumeDown: token('--tn-red-tint', '#f7cfc6'),
  };
}

export type SuperchartWorkspaceProps = {
  symbol: string;
  companyName: string;
  exchange: string;
};

export function SuperchartWorkspace({
  symbol,
  companyName,
  exchange,
}: SuperchartWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasChartEngine | null>(null);

  const [interval, setInterval] = useState<ChartInterval>('1D');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [focus, setFocus] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(false);
  const [crosshair, setCrosshair] = useState<CrosshairContext | null>(null);

  const [resolved, setResolved] = useState<ResolvedSymbol | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [symbolId, setSymbolId] = useState(`NASDAQ:${symbol}`);

  // One instance for the life of the component: the cache is the point, and a
  // new one per render would never hit.
  const feed = useMemo(() => new CachingDatafeed(new DemoDatafeed()), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const found = await feed.resolveSymbol(symbolId);
      if (cancelled || !found) return;
      setResolved(found);

      const step = INTERVAL_SECONDS[interval];
      const to = Math.floor(Date.now() / 1000);
      const response = await feed.getBars({
        symbolId: found.id,
        interval,
        from: to - step * 5000,
        to,
      });

      // A superseded response carries no bars; applying it would replace what
      // the person is looking at with what they left.
      if (cancelled || response.note === 'superseded') return;

      setBars(response.bars);
      setNote(response.note ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [feed, symbolId, interval]);

  // The engine is created once and told about changes; recreating it on every
  // prop change would throw away the visible range the person just set.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const engine = new CanvasChartEngine();
    engineRef.current = engine;

    void engine.initialize(stage, {
      theme: 'light',
      chartType,
      palette: readPalette(stage),
    });

    const off = engine.subscribe('crosshair', (payload) => {
      setCrosshair(payload as CrosshairContext | null);
    });

    return () => {
      off();
      engine.destroy();
      engineRef.current = null;
    };
    // Created once: chartType and bars are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setBars(bars);
  }, [bars]);

  useEffect(() => {
    engineRef.current?.setChartType(chartType);
  }, [chartType]);

  const cycleChartType = useCallback(() => {
    setChartType((current) => CHART_TYPES[(CHART_TYPES.indexOf(current) + 1) % CHART_TYPES.length]);
  }, []);

  // `F` toggles focus and Escape leaves it, per the design's keyboard map.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if (event.key === 'f' || event.key === 'F') setFocus((value) => !value);
      if (event.key === 'Escape') setFocus(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const last = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  const change = last && previous ? last.close - previous.close : 0;
  const changePercent = previous ? (change / previous.close) * 100 : 0;
  const up = change >= 0;

  const shown = crosshair?.bar ?? last;

  return (
    <div className={`${styles.workspace} ${focus ? styles.focused : ''}`}>
      {/*
        * The workspace covers the portal chrome, so it carries its own header
        * and its own way back.
        *
        * Phase 1 dropped this header as a duplicate. That was the wrong
        * diagnosis: the duplicate existed because the workspace was drawn
        * inside the portal layout, not because the header was redundant. A
        * full-viewport terminal with no navigation is a trap.
        */}
      {!focus && (
        <header className={styles.globalHeader}>
          <Link className={styles.back} href="/">
            <span className={styles.brandMark} aria-hidden="true">TN</span>
            <span className={styles.brand}>TradingNew</span>
          </Link>
          <Link
            className={styles.headerLink}
            href={{ pathname: '/symbols/[ticker]', params: { ticker: resolved?.ticker ?? symbol } }}
          >
            Leave chart
          </Link>
          <div className={styles.spacer} />
          <button className={styles.headerButton} onClick={() => setFocus(true)} title="Focus mode (F)">
            Focus
          </button>
        </header>
      )}

      {focus && (
        <button className={styles.restoreStrip} onClick={() => setFocus(false)}>
          Restore header · press F
        </button>
      )}

      <div className={styles.chartHeader}>

        <div className={styles.symbolWrap}>
          <button
            className={styles.symbolButton}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <Icon name="search" size={14} />
            <span className={styles.ticker}>{resolved?.ticker ?? symbol}</span>
            <span className={styles.exchange}>{resolved?.exchange ?? exchange}</span>
          </button>

          {pickerOpen && (
            <div className={styles.picker} role="listbox" aria-label="Choose a symbol">
              {DEMO_SYMBOLS.map((entry) => (
                <button
                  key={entry.id}
                  role="option"
                  aria-selected={entry.id === symbolId}
                  className={`${styles.pickerRow} ${entry.id === symbolId ? styles.pickerRowOn : ''}`}
                  onClick={() => {
                    setSymbolId(entry.id);
                    setPickerOpen(false);
                  }}
                >
                  <span className={styles.pickerTicker}>{entry.ticker}</span>
                  <span className={styles.pickerName}>{entry.name}</span>
                  <span className={styles.pickerExchange}>{entry.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.quote}>
          <span className={`${styles.price} tn-num`}>{last?.close.toFixed(2)}</span>
          <span className={`${styles.change} ${up ? styles.up : styles.down} tn-num`}>
            {/* The glyph carries direction as well as the colour. */}
            {up ? '▲' : '▼'} {change.toFixed(2)} ({changePercent.toFixed(2)}%)
          </span>
          <span className={styles.quoteSub}>
            {resolved?.name ?? companyName} · {resolved?.dataStatus ?? 'demo'}
          </span>
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.intervalGroup} role="group" aria-label="Timeframe">
          {(resolved?.supportedIntervals ?? INTERVALS).map((item) => (
            <button
              key={item}
              className={`${styles.intervalItem} ${item === interval ? styles.intervalActive : ''}`}
              aria-pressed={item === interval}
              onClick={() => setInterval(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button className={styles.typeButton} onClick={cycleChartType}>
          {CHART_TYPE_LABEL[chartType]}
        </button>

        <div className={styles.spacer} />

        <button
          className={styles.panelToggle}
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen((value) => !value)}
        >
          Panel
        </button>
        <button
          className={styles.panelToggle}
          aria-pressed={dockOpen}
          onClick={() => setDockOpen((value) => !value)}
        >
          Dock
        </button>
      </div>

      <div className={styles.body}>
        <nav className={styles.toolRail} aria-label="Chart tools">
          {['cursor', 'crosshair', 'trendLine', 'horizontal', 'text', 'measure'].map((tool) => (
            <button className={styles.tool} key={tool} title={tool} aria-label={tool} disabled>
              <Icon name="chart" size={17} />
            </button>
          ))}
          <span className={styles.toolNote}>Phase 3</span>
        </nav>

        <div className={styles.stageColumn}>
          <div className={styles.legend}>
            <span className={styles.legendSymbol}>
              {symbol} · {interval} · {exchange}
            </span>
            <span className={styles.demoPill}>
              {resolved?.dataStatus === 'demo'
                ? 'Demo data — generated, not a market feed.'
                : 'Delayed data'}
            </span>
            {note && <span className={styles.note}>{note}</span>}

            {shown && (
              <span className={`${styles.ohlc} tn-num`}>
                O {shown.open.toFixed(2)} H {shown.high.toFixed(2)} L {shown.low.toFixed(2)} C{' '}
                {shown.close.toFixed(2)}
                {shown.volume ? ` Vol ${(shown.volume / 1e6).toFixed(1)}M` : ''}
              </span>
            )}
          </div>

          {/* The canvas is aria-hidden; this is the series a screen reader gets. */}
          <div className={styles.stage} ref={stageRef} />
          <p className={styles.srOnly}>
            {symbol} at {interval}, {bars.length} bars. Latest close {last?.close.toFixed(2)},{' '}
            {up ? 'up' : 'down'} {Math.abs(changePercent).toFixed(2)} percent on the previous bar.
          </p>
        </div>

        {panelOpen && (
          <aside className={styles.rightPanel} aria-label="Chart panels">
            <div className={styles.panelTabs}>
              <span className={`${styles.panelTab} ${styles.panelTabActive}`}>Data</span>
              <span className={styles.panelTabSoon}>Voyager · Phase 5</span>
            </div>

            <div className={styles.dataWindow}>
              <div className={styles.dataTitle}>
                DATA WINDOW ·{' '}
                {shown ? new Date(shown.time * 1000).toISOString().slice(0, 10) : '—'} · {interval}
              </div>
              {shown &&
                (
                  [
                    ['Open', shown.open.toFixed(2)],
                    ['High', shown.high.toFixed(2)],
                    ['Low', shown.low.toFixed(2)],
                    ['Close', shown.close.toFixed(2)],
                    ['Volume', shown.volume ? `${(shown.volume / 1e6).toFixed(2)}M` : '—'],
                  ] as Array<[string, string]>
                ).map(([label, value]) => (
                  <div className={styles.dataRow} key={label}>
                    <span>{label}</span>
                    <span className="tn-num">{value}</span>
                  </div>
                ))}
            </div>
          </aside>
        )}
      </div>

      {dockOpen && (
        <div className={styles.dock}>
          <div className={styles.dockTabs}>
            <span className={styles.dockTabSoon}>Script Lab · Phase 7</span>
            <span className={styles.dockTabSoon}>Strategy Tester · Coming next</span>
          </div>
          <p className={styles.dockNote}>
            The dock arrives with Script Lab. It is empty rather than filled with a placeholder,
            because a panel that looks finished and does nothing is harder to trust than one that
            says what it is waiting for.
          </p>
        </div>
      )}
    </div>
  );
}
