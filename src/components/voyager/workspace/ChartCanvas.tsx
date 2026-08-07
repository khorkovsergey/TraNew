'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasChartEngine } from '@/lib/superchart/chart-engine/canvas';
import type { ChartPalette } from '@/lib/superchart/chart-engine/types';
import { DEMO_NOTICE, demoBars } from '@/lib/superchart/datafeed/demo';
import styles from './VoyagerWorkspace.module.css';

/**
 * The picture, at last.
 *
 * Voyager was deciding what to plot — instrument, interval, the levels it found
 * — and then describing it in a paragraph, because the drawing lived in
 * Supercharts and the two had never been joined. This is the join: the same
 * engine Supercharts uses, mounted in the Output panel, given what the answer
 * decided.
 *
 * The engine is Supercharts' rather than a second one on purpose. Two chart
 * renderers in one product is two sets of colours, two ideas of what a candle
 * looks like, and two places to fix anything.
 *
 * **The caption says which series is on screen, every time.** Real candles come
 * from the market provider through a server route, because the key stays on the
 * server. When there is no key, no such ticker, or the rate limit is spent, it
 * falls back to the demo datafeed — and says *that* instead. Drawing invented
 * prices without labelling them is the failure the whole trust-label system
 * exists to prevent, and a caption that is right only most of the time is the
 * same failure with extra steps.
 */

type Props = {
  symbol: string;
  interval: string;
  /** Roughly where the series should sit, so the picture matches the summary. */
  lastPrice?: number;
};

/** The engine wants tokens resolved to values; CSS variables mean nothing to a canvas. */
function readPalette(element: HTMLElement): ChartPalette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    up: token('--tn-green', '#1aa966'),
    down: token('--tn-red', '#e0492f'),
    grid: token('--tn-border-card', '#1a2536'),
    text: token('--tn-text', '#e8edf5'),
    textMuted: token('--tn-text-muted', '#8a93a6'),
    surface: token('--tn-surface', '#070e16'),
    border: token('--tn-border-card', '#1a2536'),
    crosshair: token('--tn-text-faint', '#9aa3b5'),
    volumeUp: token('--tn-green', '#1aa966'),
    volumeDown: token('--tn-red', '#e0492f'),
  };
}

export function ChartCanvas({ symbol, interval, lastPrice = 300 }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  /** Null until the first draw, so the caption never describes an empty canvas. */
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;

    const engine = new CanvasChartEngine();
    let cancelled = false;

    const draw = async () => {
      await engine.initialize(element, {
        theme: 'dark',
        chartType: 'candles',
        palette: readPalette(element),
      });
      // Guarded: initialize is async, and a tab switched away from before it
      // resolves would otherwise draw into a detached element.
      if (cancelled) return;

      const real = await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => (Array.isArray(payload?.bars) ? payload.bars : null))
        .catch(() => null);
      if (cancelled) return;

      engine.setBars(real ?? demoBars({ symbol, interval: interval as never, bars: 180, lastPrice }));
      setLive(Boolean(real));
    };

    void draw();

    return () => {
      cancelled = true;
      engine.destroy();
    };
  }, [symbol, interval, lastPrice]);

  return (
    <>
      <div className={styles.chartStage} ref={stage} />
      <p className={styles.chartCaption}>
        {live === null
          ? `Loading ${symbol}…`
          : live
            ? `Daily candles · ${symbol} · delayed, from our market provider`
            : `${DEMO_NOTICE} ${symbol} · ${interval}`}
      </p>
    </>
  );
}
