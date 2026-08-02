import type { IndicatorInstance } from '../indicators';
import {
  hitTest,
  toScreenX,
  toScreenY,
  type DrawingInstance,
  type Projection,
} from '../drawings/types';
import {
  CHART_TYPE_LABEL,
  NotImplementedYet,
  toHeikinAshi,
  type Bar,
  type ChartEngineAdapter,
  type ChartEngineEvent,
  type ChartPalette,
  type ChartSelection,
  type ChartSnapshot,
  type ChartType,
  type ChartTheme,
  type CrosshairContext,
  type EngineOptions,
  type SerializedChartLayout,
  type UnsubscribeFunction,
  type VisibleRange,
} from './types';

/**
 * The canvas chart engine.
 *
 * Hand-written, no dependency — the project has ruled out charting libraries and
 * the design needs five thousand bars to pan smoothly. SVG cannot do the second:
 * five thousand candles is five thousand DOM nodes before wicks, and a crosshair
 * moving through React state re-renders the tree on every pointer event.
 *
 * So bars never enter React. The engine owns them, owns the pointer, and repaints
 * on an animation frame. React is told about the crosshair only through the
 * subscription, and the panel that displays it decides how often to listen.
 *
 * The price pane, the volume pane and the scales are drawn on one canvas rather
 * than several: one context, one clear, one paint per frame, and no compositing
 * between layers that always move together.
 */

type Layout = {
  width: number;
  height: number;
  priceTop: number;
  priceHeight: number;
  volumeTop: number;
  volumeHeight: number;
  timeHeight: number;
  scaleWidth: number;
};

const SCALE_WIDTH = 66;
const VOLUME_HEIGHT = 74;
const TIME_HEIGHT = 24;
const MIN_BARS = 20;

export class CanvasChartEngine implements ChartEngineAdapter {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;

  private bars: Bar[] = [];
  private derived: Bar[] = [];
  private chartType: ChartType = 'candles';
  private palette: ChartPalette | null = null;

  private range: VisibleRange = { from: 0, to: 0 };
  private crosshair: CrosshairContext | null = null;
  private selection: ChartSelection | null = null;

  private frame = 0;
  private listeners = new Map<ChartEngineEvent, Set<(payload: unknown) => void>>();

  private dragging: { startX: number; startFrom: number; startTo: number } | null = null;

  /*
   * Drawings and indicators are handed in whole rather than built through
   * `addDrawing`. React owns those lists — undo, the object tree and the saved
   * layout all read them from there — and the engine paints whatever it is
   * given. Two copies of one list drift.
   */
  private drawings: DrawingInstance[] = [];
  private indicators: IndicatorInstance[] = [];
  private studyPalette: string[] = [];
  private selectedId: string | null = null;

  async initialize(container: HTMLElement, options: EngineOptions): Promise<void> {
    this.container = container;
    this.chartType = options.chartType;
    this.palette = options.palette;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // The canvas is opaque to a screen reader; the accessible representation of
    // the series lives beside it in the DOM, so this element is decoration.
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  destroy(): void {
    const canvas = this.canvas;
    if (canvas) {
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerleave', this.onPointerLeave);
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('wheel', this.onWheel);
      canvas.remove();
    }

    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.listeners.clear();
    this.canvas = null;
    this.ctx = null;
  }

  /* --------------------------------------------------------------- Data */

  setBars(bars: Bar[]): void {
    this.bars = bars;
    this.derived = this.chartType === 'heikin' ? toHeikinAshi(bars) : bars;

    // A first load shows the most recent stretch rather than the whole history,
    // because two years of daily bars squeezed into a pane is a texture, not a
    // chart.
    if (this.range.to === 0 && bars.length) {
      const visible = Math.min(180, bars.length);
      this.range = { from: bars.length - visible, to: bars.length };
    }

    this.paint();
  }

  updateBar(bar: Bar): void {
    const last = this.bars[this.bars.length - 1];

    if (last && last.time === bar.time) this.bars[this.bars.length - 1] = bar;
    else this.bars.push(bar);

    this.derived = this.chartType === 'heikin' ? toHeikinAshi(this.bars) : this.bars;
    this.paint();
  }

  setChartType(type: ChartType): void {
    this.chartType = type;
    this.derived = type === 'heikin' ? toHeikinAshi(this.bars) : this.bars;
    this.paint();
  }

  setTheme(_theme: ChartTheme, palette: ChartPalette): void {
    this.palette = palette;
    this.paint();
  }

  setDrawings(drawings: DrawingInstance[], selectedId: string | null): void {
    this.drawings = drawings;
    this.selectedId = selectedId;
    this.paint();
  }

  setIndicators(indicators: IndicatorInstance[], palette: string[]): void {
    this.indicators = indicators;
    this.studyPalette = palette;
    this.paint();
  }

  /** The mapping a hit test needs, in the units drawings are stored in. */
  projection(): Projection {
    const layout = this.layout();
    const { low, high } = this.extremes();

    return {
      plotWidth: layout.width - layout.scaleWidth,
      plotHeight: layout.priceHeight,
      fromIndex: this.range.from,
      toIndex: this.range.to,
      low,
      high,
    };
  }

  /** What sits under the pointer. */
  hitAt(x: number, y: number) {
    return hitTest(this.drawings, x, y, this.projection());
  }

  /* -------------------------------------------------------------- Range */

  getVisibleRange(): VisibleRange {
    return { ...this.range };
  }

  setVisibleRange(range: VisibleRange): void {
    this.range = this.clampRange(range);
    this.paint();
    this.emit('visibleRange', this.getVisibleRange());
  }

  private clampRange(range: VisibleRange): VisibleRange {
    const count = this.bars.length;
    if (!count) return { from: 0, to: 0 };

    let { from, to } = range;
    if (to - from < MIN_BARS) to = from + MIN_BARS;

    // Panning past either end is allowed to stop rather than to rubber-band:
    // a chart that drifts into empty space loses the reader's place.
    if (from < 0) {
      to -= from;
      from = 0;
    }
    if (to > count) {
      from -= to - count;
      to = count;
    }

    return { from: Math.max(0, from), to: Math.min(count, to) };
  }

  getCrosshairPosition(): CrosshairContext | null {
    return this.crosshair;
  }

  getSelection(): ChartSelection | null {
    return this.selection;
  }

  /* ------------------------------------------------------------ Pointer */

  private onPointerMove = (event: PointerEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.dragging) {
      const layout = this.layout();
      const perBar = (layout.width - layout.scaleWidth) / (this.range.to - this.range.from);
      const shift = (this.dragging.startX - x) / perBar;

      this.range = this.clampRange({
        from: this.dragging.startFrom + shift,
        to: this.dragging.startTo + shift,
      });

      this.paint();
      this.emit('visibleRange', this.getVisibleRange());
      return;
    }

    const layout = this.layout();
    const index = this.indexAt(x, layout);
    const bar = this.bars[index] ?? null;

    this.crosshair = { barIndex: index, bar, price: this.priceAt(y, layout), x, y };
    this.paint();
    this.emit('crosshair', this.crosshair);
  };

  private onPointerLeave = () => {
    this.crosshair = null;
    this.paint();
    // Null rather than the last position: the legend restores the latest bar,
    // and a stale crosshair reading is worse than none.
    this.emit('crosshair', null);
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dragging = {
      startX: event.clientX - rect.left,
      startFrom: this.range.from,
      startTo: this.range.to,
    };
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };

  private onPointerUp = (event: PointerEvent) => {
    this.dragging = null;
    this.canvas?.releasePointerCapture(event.pointerId);
    if (this.canvas) this.canvas.style.cursor = 'crosshair';
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!this.canvas || !this.bars.length) return;

    const rect = this.canvas.getBoundingClientRect();
    const layout = this.layout();
    const anchor = this.indexAt(event.clientX - rect.left, layout);

    const span = this.range.to - this.range.from;
    const next = span * (event.deltaY > 0 ? 1.12 : 0.89);
    const ratio = (anchor - this.range.from) / span;

    // Zoom around the pointer rather than the centre, so the bar under the
    // cursor stays where it is.
    this.range = this.clampRange({ from: anchor - next * ratio, to: anchor + next * (1 - ratio) });
    this.paint();
    this.emit('visibleRange', this.getVisibleRange());
  };

  /* ------------------------------------------------------------ Geometry */

  private layout(): Layout {
    const width = this.container?.clientWidth ?? 0;
    const height = this.container?.clientHeight ?? 0;
    const volumeHeight = VOLUME_HEIGHT;
    const priceHeight = Math.max(80, height - volumeHeight - TIME_HEIGHT);

    return {
      width,
      height,
      priceTop: 0,
      priceHeight,
      volumeTop: priceHeight,
      volumeHeight,
      timeHeight: TIME_HEIGHT,
      scaleWidth: SCALE_WIDTH,
    };
  }

  private visibleBars(): Bar[] {
    return this.derived.slice(Math.floor(this.range.from), Math.ceil(this.range.to));
  }

  private indexAt(x: number, layout: Layout): number {
    const plot = layout.width - layout.scaleWidth;
    const ratio = Math.max(0, Math.min(1, x / plot));
    return Math.floor(this.range.from + ratio * (this.range.to - this.range.from));
  }

  private priceAt(y: number, layout: Layout): number {
    const { low, high } = this.extremes();
    const ratio = 1 - y / layout.priceHeight;
    return low + ratio * (high - low);
  }

  private extremes(): { low: number; high: number } {
    const bars = this.visibleBars();
    if (!bars.length) return { low: 0, high: 1 };

    let low = Infinity;
    let high = -Infinity;
    for (const bar of bars) {
      if (bar.low < low) low = bar.low;
      if (bar.high > high) high = bar.high;
    }

    const pad = (high - low) * 0.06 || 1;
    return { low: low - pad, high: high + pad };
  }

  /* -------------------------------------------------------------- Paint */

  private resize(): void {
    if (!this.canvas || !this.container) return;

    const ratio = window.devicePixelRatio || 1;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.canvas.width = Math.floor(width * ratio);
    this.canvas.height = Math.floor(height * ratio);
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.canvas.style.cursor = 'crosshair';

    this.paint();
  }

  /** Coalesces to one paint per frame however many events arrived. */
  private paint(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    const ctx = this.ctx;
    const palette = this.palette;
    if (!ctx || !palette) return;

    const layout = this.layout();
    const bars = this.visibleBars();

    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, layout.width, layout.height);

    if (!bars.length) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('No data for this range', 16, 24);
      return;
    }

    const { low, high } = this.extremes();
    const plotWidth = layout.width - layout.scaleWidth;
    const step = plotWidth / bars.length;
    const bodyWidth = Math.max(1, step * 0.58);

    const toY = (price: number) => layout.priceHeight * (1 - (price - low) / (high - low));

    this.drawGrid(ctx, layout, palette, low, high, toY);

    if (this.chartType === 'line' || this.chartType === 'area' || this.chartType === 'baseline') {
      this.drawLineSeries(ctx, bars, step, toY, palette, layout);
    } else {
      this.drawBarSeries(ctx, bars, step, bodyWidth, toY, palette);
    }

    this.drawIndicators(ctx, toY, step);
    this.drawDrawings(ctx, layout);
    this.drawVolume(ctx, bars, step, layout, palette);
    this.drawPriceScale(ctx, layout, palette, low, high);
    this.drawTimeScale(ctx, bars, step, layout, palette);
    if (this.crosshair) this.drawCrosshair(ctx, layout, palette);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    layout: Layout,
    palette: ChartPalette,
    low: number,
    high: number,
    toY: (price: number) => number
  ): void {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i += 1) {
      const price = low + ((high - low) * i) / 4;
      const y = Math.round(toY(price)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(layout.width - layout.scaleWidth, y);
      ctx.stroke();
    }
  }

  private drawBarSeries(
    ctx: CanvasRenderingContext2D,
    bars: Bar[],
    step: number,
    bodyWidth: number,
    toY: (price: number) => number,
    palette: ChartPalette
  ): void {
    const hollow = this.chartType === 'hollow';

    bars.forEach((bar, index) => {
      const x = index * step + step / 2;
      const up = bar.close >= bar.open;
      const colour = up ? palette.up : palette.down;

      ctx.strokeStyle = colour;
      ctx.fillStyle = colour;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, toY(bar.high));
      ctx.lineTo(Math.round(x) + 0.5, toY(bar.low));
      ctx.stroke();

      if (this.chartType === 'bars') {
        ctx.beginPath();
        ctx.moveTo(x - bodyWidth / 2, toY(bar.open));
        ctx.lineTo(x, toY(bar.open));
        ctx.moveTo(x, toY(bar.close));
        ctx.lineTo(x + bodyWidth / 2, toY(bar.close));
        ctx.stroke();
        return;
      }

      const top = toY(Math.max(bar.open, bar.close));
      const height = Math.max(1, Math.abs(toY(bar.open) - toY(bar.close)));

      if (hollow && up) ctx.strokeRect(x - bodyWidth / 2, top, bodyWidth, height);
      else ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, height);
    });
  }

  private drawLineSeries(
    ctx: CanvasRenderingContext2D,
    bars: Bar[],
    step: number,
    toY: (price: number) => number,
    palette: ChartPalette,
    layout: Layout
  ): void {
    const first = bars[0].close;
    const last = bars[bars.length - 1].close;
    const colour =
      this.chartType === 'baseline' ? (last >= first ? palette.up : palette.down) : palette.up;

    ctx.beginPath();
    bars.forEach((bar, index) => {
      const x = index * step + step / 2;
      const y = toY(bar.close);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (this.chartType === 'area') {
      ctx.lineTo((bars.length - 1) * step + step / 2, layout.priceHeight);
      ctx.lineTo(step / 2, layout.priceHeight);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, layout.priceHeight);
      gradient.addColorStop(0, `${colour}33`);
      gradient.addColorStop(1, `${colour}00`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  /**
   * Overlay indicators, on the price pane scale.
   *
   * Separate-pane studies are not drawn here: they need their own vertical
   * scale and their own strip of canvas, which is the pane manager's job.
   * Putting a volume figure of forty million on the price scale would place it
   * somewhere off the top of the chart.
   */
  private drawIndicators(
    ctx: CanvasRenderingContext2D,
    toY: (price: number) => number,
    step: number
  ): void {
    const offset = Math.floor(this.range.from);

    for (const indicator of this.indicators) {
      if (indicator.hidden || indicator.pane !== 'main') continue;

      for (const plot of indicator.plots) {
        if (plot.style !== 'line') continue;

        ctx.beginPath();
        ctx.strokeStyle = this.studyPalette[plot.colour % this.studyPalette.length] ?? '#7c4dff';
        ctx.lineWidth = 1.6;
        // A draft is dashed and stays dashed until it is applied, so nothing
        // proposed can be mistaken for something already accepted.
        ctx.setLineDash(indicator.draft ? [5, 4] : []);

        let started = false;
        for (let i = 0; i < Math.ceil(this.range.to) - offset; i += 1) {
          const value = plot.values[offset + i];
          if (value === null || value === undefined) continue;

          const x = i * step + step / 2;
          const y = toY(value);
          if (started) ctx.lineTo(x, y);
          else {
            ctx.moveTo(x, y);
            started = true;
          }
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawDrawings(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const projection = this.projection();

    for (const drawing of this.drawings) {
      if (drawing.hidden) continue;

      const points = drawing.points.map((point) => ({
        x: toScreenX(point, projection),
        y: toScreenY(point, projection),
      }));

      ctx.save();
      ctx.strokeStyle = drawing.style.colour;
      ctx.lineWidth = drawing.style.width;
      ctx.setLineDash(drawing.style.dashed || drawing.draft ? [5, 4] : []);

      if (drawing.tool === 'trendLine' || drawing.tool === 'fibonacci') {
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();
        }
      } else if (drawing.tool === 'horizontalLine' || drawing.tool === 'priceLabel') {
        ctx.beginPath();
        ctx.moveTo(0, points[0].y);
        ctx.lineTo(layout.width - layout.scaleWidth, points[0].y);
        ctx.stroke();
      } else if (drawing.tool === 'verticalLine') {
        ctx.beginPath();
        ctx.moveTo(points[0].x, 0);
        ctx.lineTo(points[0].x, layout.priceHeight);
        ctx.stroke();
      } else if (drawing.tool === 'rectangle') {
        if (points.length >= 2) {
          ctx.strokeRect(
            Math.min(points[0].x, points[1].x),
            Math.min(points[0].y, points[1].y),
            Math.abs(points[1].x - points[0].x),
            Math.abs(points[1].y - points[0].y)
          );
        }
      } else if (drawing.tool === 'text') {
        ctx.fillStyle = drawing.style.colour;
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(drawing.text ?? 'Text', points[0].x, points[0].y);
      }

      // Handles only on the selected object: showing them on everything turns a
      // chart with a dozen drawings into a field of squares.
      if (drawing.id === this.selectedId) {
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = drawing.style.colour;
        ctx.lineWidth = 1.5;
        for (const point of points) {
          ctx.beginPath();
          ctx.rect(point.x - 3.5, point.y - 3.5, 7, 7);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  private drawVolume(
    ctx: CanvasRenderingContext2D,
    bars: Bar[],
    step: number,
    layout: Layout,
    palette: ChartPalette
  ): void {
    const peak = Math.max(...bars.map((bar) => bar.volume ?? 0));
    if (!peak) return;

    bars.forEach((bar, index) => {
      const volume = bar.volume ?? 0;
      const height = (volume / peak) * (layout.volumeHeight - 10);
      const x = index * step + step / 2;

      ctx.fillStyle = bar.close >= bar.open ? palette.volumeUp : palette.volumeDown;
      ctx.fillRect(
        x - Math.max(1, step * 0.58) / 2,
        layout.volumeTop + layout.volumeHeight - height,
        Math.max(1, step * 0.58),
        height
      );
    });
  }

  private drawPriceScale(
    ctx: CanvasRenderingContext2D,
    layout: Layout,
    palette: ChartPalette,
    low: number,
    high: number
  ): void {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '10.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';

    for (let i = 0; i <= 4; i += 1) {
      const price = low + ((high - low) * i) / 4;
      const y = layout.priceHeight * (1 - i / 4);
      ctx.fillText(price.toFixed(2), layout.width - layout.scaleWidth + 8, Math.min(layout.priceHeight - 2, y + 4));
    }
  }

  private drawTimeScale(
    ctx: CanvasRenderingContext2D,
    bars: Bar[],
    step: number,
    layout: Layout,
    palette: ChartPalette
  ): void {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';

    const every = Math.max(1, Math.floor(bars.length / 8));
    bars.forEach((bar, index) => {
      if (index % every !== 0) return;
      const label = new Date(bar.time * 1000).toISOString().slice(5, 10);
      ctx.fillText(label, index * step + step / 2, layout.height - 8);
    });

    ctx.textAlign = 'left';
    ctx.fillText('UTC', layout.width - layout.scaleWidth + 8, layout.height - 8);
  }

  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    layout: Layout,
    palette: ChartPalette
  ): void {
    const crosshair = this.crosshair;
    if (!crosshair) return;

    ctx.save();
    ctx.strokeStyle = palette.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    ctx.beginPath();
    ctx.moveTo(Math.round(crosshair.x) + 0.5, 0);
    ctx.lineTo(Math.round(crosshair.x) + 0.5, layout.priceHeight + layout.volumeHeight);
    ctx.moveTo(0, Math.round(crosshair.y) + 0.5);
    ctx.lineTo(layout.width - layout.scaleWidth, Math.round(crosshair.y) + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  /* ----------------------------------------------------------- Snapshot */

  async takeSnapshot(): Promise<ChartSnapshot> {
    if (!this.canvas) throw new Error('The chart is not initialised.');
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      dataUrl: this.canvas.toDataURL('image/png'),
    };
  }

  serializeLayout(): SerializedChartLayout {
    return {
      interval: '1D',
      chartType: this.chartType,
      visibleRange: this.getVisibleRange(),
    };
  }

  /* -------------------------------------------------------------- Events */

  subscribe(event: ChartEngineEvent, handler: (payload: unknown) => void): UnsubscribeFunction {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private emit(event: ChartEngineEvent, payload: unknown): void {
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }

  /* -------------------------------------------------------- Later phases */

  /*
   * These stay on the interface for callers written against the whole surface,
   * and point at the setter instead of quietly doing nothing: the lists live in
   * React, not in the engine.
   */
  async addIndicator(): Promise<string> {
    throw new Error('Use setIndicators(): the chart paints the list, it does not own it.');
  }
  async removeIndicator(): Promise<void> {
    throw new Error('Use setIndicators(): the chart paints the list, it does not own it.');
  }
  async addDrawing(): Promise<string> {
    throw new Error('Use setDrawings(): the chart paints the list, it does not own it.');
  }
  async removeDrawing(): Promise<void> {
    throw new Error('Use setDrawings(): the chart paints the list, it does not own it.');
  }
  async highlightRange(): Promise<string> {
    throw new NotImplementedYet('Highlights', 'Phase 6');
  }
  async removeHighlight(): Promise<void> {
    throw new NotImplementedYet('Highlights', 'Phase 6');
  }
}

export { CHART_TYPE_LABEL };
