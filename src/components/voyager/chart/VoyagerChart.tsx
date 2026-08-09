'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CanvasChartEngine } from '@/lib/superchart/chart-engine/canvas';
import type { Bar, ChartPalette, ChartType } from '@/lib/superchart/chart-engine/types';
import type { IndicatorInstance } from '@/lib/superchart/indicators';
import { STUDIES } from '@/lib/studies/registry';
import { describeChart, refusalNotes, type VoyagerChartSpec } from '@/lib/voyager/chart/spec';
import styles from './VoyagerChart.module.css';

/**
 * The picture, drawn from the specification the answer was written from.
 *
 * Supercharts' engine, not a second one. That is a decision about truth as much
 * as about tidiness: two renderers is two ideas of what a candle is, and the
 * one nobody is looking at is the one that drifts.
 *
 * Everything on screen comes from `spec`, which has already been through
 * `clampChartSpec` — so this component cannot draw a study the caption does not
 * mention, and the caption cannot mention one this component will not draw.
 * They are the same object.
 *
 * **There is no fallback series.** The demo bar generator exists in this
 * repository and is deliberately not imported here. A chart that quietly
 * substitutes invented prices under a real company's name is the exact failure
 * the trust labels are for; with nothing to draw, this says so and offers a way
 * forward.
 */

export type ChartSeriesData = {
  assetId: string;
  bars: Bar[];
  /** Rebased values, for a comparison. Same length and order as `bars`. */
  normalized?: (number | null)[];
};

type Props = {
  spec: VoyagerChartSpec;
  series: ChartSeriesData[];
  /** Offered when there is nothing to draw, so a dead end has a door. */
  onRetry?: () => void;
};

/** The engine wants values; CSS variables mean nothing to a canvas. */
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

function studyPaletteOf(element: HTMLElement): string[] {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return [
    token('--tn-blue', '#2962ff'),
    token('--tn-amber-text', '#e0a030'),
    token('--tn-mint', '#2ee6a8'),
    token('--tn-text-muted', '#8a93a6'),
    token('--tn-red', '#e0492f'),
  ];
}

const ENGINE_TYPE: Record<VoyagerChartSpec['kind'], ChartType> = {
  candles: 'candles',
  area: 'area',
  line: 'line',
  // A rebased comparison and a drawdown are lines: their numbers are an index
  // and a percentage, and neither has an open or a high to draw.
  performance: 'line',
  drawdown: 'line',
};

/**
 * The bars the engine is given, and the scale they imply.
 *
 * For one instrument this is simply its bars. For a comparison it is the first
 * series' rebased values, with each bar's high and low widened to cover *every*
 * series at that date — because the engine derives its vertical scale from the
 * bars' extremes alone and would otherwise clip the other lines off the top.
 * Nothing false is drawn by this: in line mode the engine paints closes, and
 * the widened extremes only decide how much of the pane is visible.
 */
function baseBars(spec: VoyagerChartSpec, series: ChartSeriesData[]): Bar[] {
  const first = series[0];
  if (!first) return [];

  if (spec.kind !== 'performance') return first.bars;

  const values = series.map((entry) => entry.normalized ?? []);

  return first.bars.map((bar, index) => {
    const column = values
      .map((list) => list[index])
      .filter((value): value is number => typeof value === 'number');

    const own = values[0]?.[index];
    const close = typeof own === 'number' ? own : bar.close;

    return {
      time: bar.time,
      open: close,
      close,
      high: column.length ? Math.max(...column) : close,
      low: column.length ? Math.min(...column) : close,
    };
  });
}

/** The overlay studies, computed by the registry rather than described by a model. */
function studyIndicators(spec: VoyagerChartSpec, bars: Bar[]): IndicatorInstance[] {
  if (!bars.length) return [];
  const closes = bars.map((bar) => bar.close);

  return spec.studies.map((study, index) => {
    const definition = STUDIES[study.id];
    return {
      id: `voyager_${study.id}`,
      definitionId: study.id,
      label: definition.label(study.params),
      pane: 'main',
      params: study.params,
      plots: definition.compute(closes, study.params).map((line) => ({
        key: line.key,
        colour: (line.color + index) % 5,
        values: line.values,
        style: 'line' as const,
      })),
      hidden: false,
      source: 'voyager',
      draft: false,
    };
  });
}

/** The other lines of a comparison, as main-pane plots on the rebased scale. */
function comparisonIndicators(
  spec: VoyagerChartSpec,
  series: ChartSeriesData[]
): IndicatorInstance[] {
  if (spec.kind !== 'performance') return [];

  return series.slice(1).map((entry, index) => ({
    id: `voyager_series_${entry.assetId}`,
    definitionId: 'voyager-series',
    label: spec.series[index + 1]?.label ?? entry.assetId,
    pane: 'main',
    params: {},
    plots: [
      {
        key: spec.series[index + 1]?.symbol ?? entry.assetId,
        colour: (index + 1) % 5,
        values: entry.normalized ?? [],
        style: 'line' as const,
      },
    ],
    hidden: false,
    source: 'voyager',
    draft: false,
  }));
}

export function VoyagerChart({ spec, series, onRetry }: Props) {
  const stage = useRef<HTMLDivElement>(null);

  const bars = useMemo(() => baseBars(spec, series), [spec, series]);
  const caption = useMemo(() => describeChart(spec), [spec]);
  const refusals = useMemo(() => refusalNotes(spec), [spec]);

  useEffect(() => {
    const element = stage.current;
    if (!element || bars.length === 0) return;

    const engine = new CanvasChartEngine();
    let cancelled = false;

    const draw = async () => {
      await engine.initialize(element, {
        theme: 'dark',
        chartType: ENGINE_TYPE[spec.kind],
        palette: readPalette(element),
      });
      // Guarded: initialize is async, and a tab switched away from before it
      // resolves would otherwise draw into a detached element.
      if (cancelled) return;

      engine.setBars(bars);
      engine.setIndicators(
        [...comparisonIndicators(spec, series), ...studyIndicators(spec, bars)],
        studyPaletteOf(element)
      );
    };

    void draw();

    return () => {
      cancelled = true;
      engine.destroy();
    };
  }, [spec, series, bars]);

  if (bars.length === 0) {
    /*
     * The no-data state, which is a real answer. Every alternative — a demo
     * series, an empty axis with a real ticker on it — tells somebody there is
     * a price when there is only an outage.
     */
    return (
      <div className={styles.empty} role="status">
        <p className={styles.emptyTitle}>No price data to draw</p>
        <p className={styles.emptyBody}>
          {spec.series.map((entry) => entry.symbol).join(', ')} returned nothing for{' '}
          {spec.range.start} to {spec.range.end}. That is an unsupported symbol or a spent
          provider allowance — not a price nobody knows.
        </p>
        {onRetry && (
          <button className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.stage} ref={stage} />

      {spec.kind === 'performance' && (
        <div className={styles.legend}>
          {spec.series.map((entry, index) => (
            <span key={entry.assetId} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                data-series={index % 5}
                aria-hidden="true"
              />
              {entry.label}
            </span>
          ))}
        </div>
      )}

      {/* The caption is generated from the same spec the engine was given.
          There is no second description to fall out of step with it. */}
      <figcaption className={styles.caption}>{caption}</figcaption>

      {refusals.length > 0 && (
        <p className={styles.refused}>
          {refusals.join(' ')}
        </p>
      )}
    </figure>
  );
}
