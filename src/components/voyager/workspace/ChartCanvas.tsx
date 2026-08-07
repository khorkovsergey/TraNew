'use client';

import { useEffect, useRef } from 'react';
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
 * **The series is generated, and says so.** These bars come from the demo
 * datafeed, which is deterministic per symbol and interval rather than a market
 * feed — this is a demo portal and drawing invented prices without labelling
 * them is the failure the whole trust-label system exists to prevent. The
 * notice sits under the canvas, not in a tooltip.
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

  useEffect(() => {
    const element = stage.current;
    if (!element) return;

    const engine = new CanvasChartEngine();
    let cancelled = false;

    void engine
      .initialize(element, {
        theme: 'dark',
        chartType: 'candles',
        palette: readPalette(element),
      })
      .then(() => {
        // Guarded: initialize is async, and a tab switched away from before it
        // resolves would otherwise draw into a detached element.
        if (cancelled) return;
        engine.setBars(demoBars({ symbol, interval: interval as never, bars: 180, lastPrice }));
      });

    return () => {
      cancelled = true;
      engine.destroy();
    };
  }, [symbol, interval, lastPrice]);

  return (
    <>
      <div className={styles.chartStage} ref={stage} />
      <p className={styles.chartCaption}>
        {DEMO_NOTICE} {symbol} · {interval}
      </p>
    </>
  );
}
