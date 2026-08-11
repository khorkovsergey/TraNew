/**
 * The chart engine contract.
 *
 * Superchart talks to this and never to a rendering library. The point is not
 * abstraction for its own sake: the audit records that the project has ruled out
 * charting dependencies and that the design needs five thousand bars to pan
 * smoothly, so the renderer is hand-written on canvas — and this seam is what
 * makes that decision reversible if canvas turns out not to be enough.
 *
 * Import-free, so the unit harness compiles it on its own.
 */

export type Bar = {
  /** Unix seconds at the bar's open. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartInterval = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M';

export type ChartType = 'candles' | 'bars' | 'line' | 'area' | 'baseline' | 'hollow' | 'heikin';

export type ChartTheme = 'light' | 'dark';

export type VisibleRange = {
  /** Index of the first visible bar, may be fractional while panning. */
  from: number;
  to: number;
};

export type CrosshairContext = {
  barIndex: number;
  bar: Bar | null;
  /**
   * The price under the pointer, on the price pane's scale.
   *
   * Still the price even when the pointer is over an oscillator, because that
   * is what every reader of this field has always meant by it. What the pointer
   * is actually over is `paneId` and `paneValue`.
   */
  price: number;
  /** Which pane the pointer is in, or null below the last one. */
  paneId?: string | null;
  /** The value under the pointer in that pane's own units — an RSI of 62. */
  paneValue?: number | null;
  x: number;
  y: number;
};

export type ChartSelection = {
  kind: 'range' | 'bar';
  fromIndex: number;
  toIndex: number;
};

/**
 * What the last completed paint contains.
 *
 * The engine's own account of what it drew, recorded at the end of `draw()` and
 * therefore only present when the frame finished. It exists because a state
 * setter returning is not evidence that anything rendered: `setIndicators` puts
 * a list on the engine and schedules a frame, and everything that could still go
 * wrong happens after it returns.
 *
 * `studyIds` are the studies that put at least one value on the canvas — not the
 * studies that were handed in. A study whose series is entirely null in the
 * visible window is in the list of indicators and not in this one, which is the
 * distinction the outcome telemetry is built on.
 */
export type PaintedFrame = {
  /** Pane ids of the painted frame, main first. */
  paneIds: string[];
  /** Definition ids that actually drew something. */
  studyIds: string[];
};

/**
 * A range of bars an answer points at.
 *
 * Stored in bar indices rather than pixels, like everything else the engine
 * keeps, so a reference survives panning and zooming — a highlight that drifts
 * off its bars when the chart moves is worse than no highlight, because it
 * points confidently at the wrong thing.
 */
export type ChartHighlight = {
  id: string;
  number: number;
  fromIndex: number;
  toIndex: number;
  /*
   * A reference to the whole visible window is drawn as brackets rather than a
   * fill. Filling it tints the entire chart, which hides every other zone and
   * makes the one thing a highlight has to do — stand out — impossible.
   */
  kind?: 'zone' | 'window';
};

export type DataStatus = 'realtime' | 'delayed' | 'demo';

export type EngineOptions = {
  theme: ChartTheme;
  chartType: ChartType;
  /** Read from the stylesheet so the engine never holds a literal colour. */
  palette: ChartPalette;
};

/**
 * Colours are passed in, never hardcoded.
 *
 * `check-tokens.mjs` fails the build on a `var(--tn-*)` that does not exist, and
 * that check cannot see a hex literal buried in a canvas call. Resolving the
 * tokens once and handing them to the engine keeps every colour in the
 * stylesheet where the check can reach it.
 */
export type ChartPalette = {
  up: string;
  down: string;
  grid: string;
  text: string;
  textMuted: string;
  surface: string;
  border: string;
  crosshair: string;
  volumeUp: string;
  volumeDown: string;
};

export type ChartEngineEvent = 'crosshair' | 'visibleRange' | 'selection' | 'click';

export type UnsubscribeFunction = () => void;

export type ChartSnapshot = { width: number; height: number; dataUrl: string };

export type SerializedChartLayout = {
  interval: ChartInterval;
  chartType: ChartType;
  visibleRange: VisibleRange | null;
};

export interface ChartEngineAdapter {
  initialize(container: HTMLElement, options: EngineOptions): Promise<void>;
  destroy(): void;

  setBars(bars: Bar[]): void;
  updateBar(bar: Bar): void;

  setChartType(type: ChartType): void;
  setTheme(theme: ChartTheme, palette: ChartPalette): void;

  getVisibleRange(): VisibleRange;
  setVisibleRange(range: VisibleRange): void;

  getCrosshairPosition(): CrosshairContext | null;
  getSelection(): ChartSelection | null;

  setHighlights(highlights: ChartHighlight[], activeId: string | null): void;
  highlightAt(x: number): ChartHighlight | null;

  takeSnapshot(): Promise<ChartSnapshot>;
  serializeLayout(): SerializedChartLayout;

  subscribe(event: ChartEngineEvent, handler: (payload: unknown) => void): UnsubscribeFunction;

  /* Kept on the interface and rejecting in the implementation. React owns the
     lists — undo, the object tree and the saved layout all read them from there
     — so an engine that could also own them would be a second copy that drifts.
     Rejecting rather than absent, so a caller reaching for the wrong seam is
     told at once instead of watching nothing happen. */
  addIndicator(definition: unknown): Promise<string>;
  removeIndicator(id: string): Promise<void>;
  addDrawing(definition: unknown): Promise<string>;
  removeDrawing(id: string): Promise<void>;
}

/** How many bars each interval steps by, in seconds. */
export const INTERVAL_SECONDS: Record<ChartInterval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1H': 3600,
  '4H': 14_400,
  '1D': 86_400,
  '1W': 604_800,
  '1M': 2_592_000,
};

export const CHART_TYPE_LABEL: Record<ChartType, string> = {
  candles: 'Candles',
  bars: 'Bars',
  line: 'Line',
  area: 'Area',
  baseline: 'Baseline',
  hollow: 'Hollow',
  heikin: 'Heikin Ashi',
};

/**
 * Heikin Ashi bars, derived rather than fetched.
 *
 * Each close is the average of the raw bar and each open the midpoint of the
 * previous derived bar, so the series smooths — it is a different view of the
 * same data, not different data, and the engine treats it as a render mode.
 */
export function toHeikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    const close = (bar.open + bar.high + bar.low + bar.close) / 4;
    const open =
      i === 0 ? (bar.open + bar.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;

    out.push({
      time: bar.time,
      open,
      close,
      high: Math.max(bar.high, open, close),
      low: Math.min(bar.low, open, close),
      volume: bar.volume,
    });
  }

  return out;
}
