/**
 * The pane manager.
 *
 * A chart is one horizontal coordinate system and several vertical ones. That
 * sentence is the whole design: a timestamp resolves to the same x in every
 * pane, and each pane owns a y-domain that nothing outside it can move. RSI
 * running 0–100 underneath a $150 stock has to be impossible by construction,
 * not by remembering to exclude it — the engine used to skip every study whose
 * pane was not `main` for exactly that reason, which is a way of not having the
 * bug and also not having the feature.
 *
 * Pure and import-free: no canvas, no DOM, no knowledge of what an indicator
 * is. It takes rectangles and numbers and returns rectangles and numbers, which
 * is what makes the layout assertable without a browser — `verify-superchart-
 * panes.mjs` compiles this file on its own and checks the geometry directly
 * rather than photographing it.
 */

/** How a pane decides its vertical domain from the series drawn in it. */
export type PaneScalePolicy =
  /** The price pane. Its domain comes from the bars and from nothing else. */
  | { kind: 'price' }
  /** A bounded oscillator: RSI is 0–100 whatever the data does. */
  | { kind: 'fixed'; min: number; max: number }
  /** Centred on zero, so the sign of the series is the vertical middle. */
  | { kind: 'symmetric' }
  /** Counts. The floor is zero even when every bar is far above it. */
  | { kind: 'zeroBased' }
  /** Fit the values, with a little air. */
  | { kind: 'auto' };

export type PaneDomain = { min: number; max: number };

export type PaneRect = { top: number; height: number };

/** How a pane's axis labels are written. */
export type PaneFormat = 'plain' | 'compact';

/**
 * What a study asks the layout for.
 *
 * Several studies may name the same `id` — volume, its moving average and the
 * anomaly flags all live in the volume pane — and then they share one rectangle
 * and one domain computed over all of their series together.
 */
export type PaneRequest = {
  id: string;
  title: string;
  scale: PaneScalePolicy;
  /** Informational levels drawn behind the series. 30/70, zero. No semantics. */
  guides?: number[];
  /** Relative height against the other secondary panes. */
  weight?: number;
  format?: PaneFormat;
  /** Decimal places on the axis labels. */
  precision?: number;
};

/** A request with the values that decide its domain, already windowed. */
export type PaneInput = PaneRequest & { series: Array<(number | null)[]> };

export type Pane = {
  id: string;
  title: string;
  rect: PaneRect;
  scale: PaneScalePolicy;
  domain: PaneDomain;
  guides: number[];
  format: PaneFormat;
  precision: number;
};

export type PaneLayout = {
  width: number;
  height: number;
  scaleWidth: number;
  timeHeight: number;
  /** The horizontal extent every pane shares, left of the price scale. */
  plotWidth: number;
  /** Everything above the time axis, main plus secondaries. */
  plotHeight: number;
  /** Main first, then the secondaries top to bottom. */
  panes: Pane[];
  /**
   * Which pane sits against the time axis.
   *
   * The axis is drawn once, at the bottom, as it always has been — this names
   * the pane it belongs to so a caller does not have to work it out from the
   * rectangles.
   */
  axisPaneId: string;
};

export const MAIN_PANE = 'main';

export const SCALE_WIDTH = 66;
export const TIME_HEIGHT = 24;

/**
 * The height one secondary pane asks for.
 *
 * 74 because that is the volume strip that shipped: with volume alone on the
 * chart the new layout produces the old one to the pixel, which is the point —
 * a pane manager that redraws every existing chart is a redesign wearing a
 * refactor's name.
 */
export const SECONDARY_BASE = 74;
const SECONDARY_MIN = 40;
const MAIN_MIN = 80;

/**
 * The most of the plot the secondaries may take between them.
 *
 * Four oscillators at 74 each would leave a price chart the height of its own
 * legend. Past this share they are scaled down together rather than one of them
 * being dropped, because a study somebody switched on and cannot see is worse
 * than a short one.
 */
const SECONDARY_MAX_SHARE = 0.6;

/* ----------------------------------------------------------------- Domains */

/**
 * The domain a pane draws in.
 *
 * Every branch has to return a range with a non-zero span. A flat series, an
 * empty one and one that is entirely null all arrive here, and each of them
 * divides by `max - min` a moment later.
 */
export function paneDomain(
  policy: PaneScalePolicy,
  series: Array<(number | null)[]>
): PaneDomain {
  if (policy.kind === 'fixed') return { min: policy.min, max: policy.max };

  let low = Infinity;
  let high = -Infinity;

  for (const values of series) {
    for (const value of values) {
      if (value === null || value === undefined || !Number.isFinite(value)) continue;
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }

  const empty = low === Infinity;

  if (policy.kind === 'zeroBased') {
    // The floor is zero by definition; only the ceiling is read from the data,
    // and a series of zeroes still needs a pane that is not zero tall.
    const peak = empty ? 1 : Math.max(high, 0);
    return { min: 0, max: peak > 0 ? peak * 1.08 : 1 };
  }

  if (policy.kind === 'symmetric') {
    const reach = empty ? 1 : Math.max(Math.abs(low), Math.abs(high));
    const padded = reach > 0 ? reach * 1.12 : 1;
    return { min: -padded, max: padded };
  }

  if (empty) return { min: 0, max: 1 };

  const pad = (high - low) * 0.08 || Math.abs(high) * 0.08 || 1;
  return { min: low - pad, max: high + pad };
}

/* ------------------------------------------------------------------ Layout */

/**
 * Rectangles for the price pane and everything below it.
 *
 * Deterministic: the same width, height and requests always produce the same
 * numbers, which is what lets a resize be tested as a pure function rather than
 * by resizing something. Boundaries are rounded once and shared, so panes tile
 * exactly — no gap to show the background through, no overlap for one pane to
 * paint into its neighbour.
 */
export function buildPaneLayout(input: {
  width: number;
  height: number;
  price: PaneDomain;
  secondary: PaneInput[];
  scaleWidth?: number;
  timeHeight?: number;
  priceTitle?: string;
}): PaneLayout {
  const scaleWidth = input.scaleWidth ?? SCALE_WIDTH;
  const timeHeight = input.timeHeight ?? TIME_HEIGHT;

  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const plotWidth = Math.max(0, width - scaleWidth);
  const plotHeight = Math.max(0, height - timeHeight);

  const requests = input.secondary;
  const weights = requests.map((request) => Math.max(0.1, request.weight ?? 1));
  const requested = weights.reduce((total, weight) => total + weight, 0) * SECONDARY_BASE;

  const roomBelowMain = Math.max(0, plotHeight - MAIN_MIN);
  const floor = Math.min(requests.length * SECONDARY_MIN, roomBelowMain);
  const allowance = requests.length
    ? Math.max(floor, Math.min(requested, roomBelowMain, plotHeight * SECONDARY_MAX_SHARE))
    : 0;

  const scale = requested > 0 ? allowance / requested : 0;
  const heights = weights.map((weight) => weight * SECONDARY_BASE * scale);
  const mainHeight = Math.max(0, plotHeight - heights.reduce((total, value) => total + value, 0));

  const panes: Pane[] = [
    {
      id: MAIN_PANE,
      title: input.priceTitle ?? 'Price',
      rect: { top: 0, height: Math.round(mainHeight) },
      scale: { kind: 'price' },
      domain: input.price,
      guides: [],
      format: 'plain',
      precision: 2,
    },
  ];

  let cursor = mainHeight;
  requests.forEach((request, index) => {
    const top = Math.round(cursor);
    cursor += heights[index];
    const bottom = index === requests.length - 1 ? Math.round(plotHeight) : Math.round(cursor);

    panes.push({
      id: request.id,
      title: request.title,
      rect: { top, height: Math.max(0, bottom - top) },
      scale: request.scale,
      domain: paneDomain(request.scale, request.series),
      guides: request.guides ?? [],
      format: request.format ?? 'plain',
      precision: request.precision ?? 2,
    });
  });

  return {
    width,
    height,
    scaleWidth,
    timeHeight,
    plotWidth,
    plotHeight,
    panes,
    axisPaneId: panes[panes.length - 1].id,
  };
}

export function findPane(layout: PaneLayout, id: string): Pane | null {
  return layout.panes.find((pane) => pane.id === id) ?? null;
}

export function mainPane(layout: PaneLayout): Pane {
  return layout.panes[0];
}

/**
 * Which pane a y belongs to.
 *
 * Null outside the plot — below the last pane is the time axis, and resolving a
 * pointer down there against the nearest pane's scale would report a value the
 * chart is not showing.
 */
export function paneAt(layout: PaneLayout, y: number): Pane | null {
  for (const pane of layout.panes) {
    if (y >= pane.rect.top && y < pane.rect.top + pane.rect.height) return pane;
  }
  return null;
}

/* ------------------------------------------------------------------ Y axis */

/** A value in this pane's units to a y on the canvas. */
export function valueToY(pane: Pane, value: number): number {
  const span = pane.domain.max - pane.domain.min;
  if (!Number.isFinite(span) || span === 0) return pane.rect.top + pane.rect.height / 2;
  const ratio = (value - pane.domain.min) / span;
  return pane.rect.top + pane.rect.height * (1 - ratio);
}

/** And back, for the crosshair. */
export function yToValue(pane: Pane, y: number): number {
  if (pane.rect.height === 0) return pane.domain.min;
  const ratio = 1 - (y - pane.rect.top) / pane.rect.height;
  return pane.domain.min + ratio * (pane.domain.max - pane.domain.min);
}

/**
 * The levels a pane labels.
 *
 * A bounded pane labels its guides — 0, 30, 70, 100 says more about an RSI than
 * four evenly spaced numbers do — and everything else divides its domain.
 *
 * `floor` is off for every pane but the last, and that is a layout decision
 * rather than a stylistic one: a pane's lowest label sits a few pixels above
 * its own bottom edge and the next pane's highest sits a few below its top, so
 * printing both puts two unrelated numbers on almost the same line. The
 * bottom-most pane has the time axis under it and nothing to collide with.
 */
export function paneTicks(pane: Pane, count = 2, floor = true): number[] {
  const levels =
    pane.scale.kind === 'fixed'
      ? [...new Set([pane.domain.min, ...pane.guides, pane.domain.max])].sort((a, b) => a - b)
      : Array.from({ length: Math.max(1, count) + 1 }, (_, i) => {
          const steps = Math.max(1, count);
          return pane.domain.min + ((pane.domain.max - pane.domain.min) * i) / steps;
        });

  return floor ? levels : levels.filter((value) => value !== pane.domain.min);
}

/** Axis text. Volume is written 4.2M rather than 4200000, which does not fit. */
export function formatPaneValue(pane: Pane, value: number): string {
  if (pane.format === 'compact') {
    const size = Math.abs(value);
    if (size >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (size >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (size >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  }
  return value.toFixed(pane.precision);
}

/* ------------------------------------------------------------------ X axis */

/**
 * The one horizontal mapping.
 *
 * Every pane is handed this, so alignment between a candle and the volume bar
 * under it is not something the two drawing routines have to agree about — they
 * cannot disagree, because they call the same function with the same bar index.
 */
export type TimeAxis = {
  /** First visible bar index, floored — the origin the step counts from. */
  offset: number;
  /** Pixels per bar. */
  step: number;
  plotWidth: number;
  count: number;
};

export function timeAxis(
  range: { from: number; to: number },
  plotWidth: number,
  visibleCount: number
): TimeAxis {
  const count = Math.max(1, visibleCount);
  return {
    offset: Math.floor(range.from),
    step: plotWidth / count,
    plotWidth,
    count: visibleCount,
  };
}

/** The centre of a bar, by its index in the whole series. */
export function xForIndex(axis: TimeAxis, index: number): number {
  return (index - axis.offset) * axis.step + axis.step / 2;
}

/** The left edge of a bar's slot, for anything drawn as a band. */
export function xForEdge(axis: TimeAxis, index: number): number {
  return (index - axis.offset) * axis.step;
}

export function indexForX(axis: TimeAxis, x: number, range: { from: number; to: number }): number {
  const ratio = axis.plotWidth > 0 ? Math.max(0, Math.min(1, x / axis.plotWidth)) : 0;
  return Math.floor(range.from + ratio * (range.to - range.from));
}

/** How wide a bar body is drawn, shared by candles, volume and histograms. */
export function barWidth(axis: TimeAxis): number {
  return Math.max(1, axis.step * 0.58);
}
