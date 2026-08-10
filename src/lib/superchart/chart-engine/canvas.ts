import { collectPaneRequests, paneRequestFor, type IndicatorInstance } from '../indicators';
import {
  hitTest,
  toScreenX,
  toScreenY,
  type DrawingInstance,
  type Projection,
} from '../drawings/types';
import {
  barWidth,
  buildPaneLayout,
  mainPane,
  paneAt,
  timeAxis,
  valueToY,
  yToValue,
  SCALE_WIDTH,
  type Pane,
  type PaneInput,
  type PaneLayout,
  type TimeAxis,
} from './panes';
import {
  drawPaneBaseline,
  drawPaneFlags,
  drawPaneFrame,
  drawPaneHistogram,
  drawPaneLine,
  drawPaneScale,
  drawPaneTitle,
  withinPane,
  type PanePalette,
} from './paneRenderer';
import {
  CHART_TYPE_LABEL,
  toHeikinAshi,
  type Bar,
  type ChartEngineAdapter,
  type ChartEngineEvent,
  type ChartHighlight,
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
 * Every pane and every scale is drawn on one canvas rather than several: one
 * context, one clear, one paint per frame, and no compositing between layers
 * that always move together.
 *
 * Vertical space is `panes.ts`. The engine asks the studies which panes they
 * want, hands the list to the layout, and paints whatever comes back — so an
 * oscillator added next year needs a row in the indicator registry and nothing
 * here.
 */

/** What the geometry of a frame is, computed once and passed down. */
type Geometry = { layout: PaneLayout; axis: TimeAxis };

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
  private highlights: ChartHighlight[] = [];
  private activeHighlight: string | null = null;
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

  /**
   * The zones an answer refers to.
   *
   * Held here rather than drawn by the panel because a reference has to stay
   * attached to its bars while the chart is panned and zoomed, and only the
   * engine knows where those bars currently are. The active one is passed
   * separately so hovering a sentence can light up its zone without the whole
   * set being rebuilt.
   */
  setHighlights(highlights: ChartHighlight[], activeId: string | null): void {
    this.highlights = highlights;
    this.activeHighlight = activeId;
    this.paint();
  }

  /** Which reference is under the pointer, for the hover that runs the other way. */
  highlightAt(x: number): ChartHighlight | null {
    const { plotWidth } = this.size();
    const step = plotWidth / Math.max(1, this.range.to - this.range.from);

    for (const highlight of this.highlights) {
      const left = (highlight.fromIndex - this.range.from) * step;
      const right = (highlight.toIndex - this.range.from + 1) * step;
      if (x >= left - 2 && x <= right + 2) return highlight;
    }

    return null;
  }

  /**
   * The panes as they currently stand.
   *
   * Read by the tests, and by anything that needs to know what the chart is
   * showing without taking a picture of it. The rectangles are the engine's
   * answer to "is the RSI actually drawn somewhere" in a form that can be
   * asserted.
   */
  paneLayout(): PaneLayout {
    return this.geometry().layout;
  }

  setIndicators(indicators: IndicatorInstance[], palette: string[]): void {
    this.indicators = indicators;
    this.studyPalette = palette;
    this.paint();
  }

  /** The mapping a hit test needs, in the units drawings are stored in. */
  projection(): Projection {
    const { layout } = this.geometry();
    const { low, high } = this.extremes();

    return {
      plotWidth: layout.plotWidth,
      // Drawings live on the price pane, so a hit test is against its rectangle
      // and not the whole canvas — clicking in the volume pane must not resolve
      // against a trend line that ends above it.
      plotHeight: mainPane(layout).rect.height,
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
      const perBar = this.size().plotWidth / (this.range.to - this.range.from);
      const shift = (this.dragging.startX - x) / perBar;

      this.range = this.clampRange({
        from: this.dragging.startFrom + shift,
        to: this.dragging.startTo + shift,
      });

      this.paint();
      this.emit('visibleRange', this.getVisibleRange());
      return;
    }

    const { layout } = this.geometry();
    const index = this.indexAt(x, layout.plotWidth);
    const bar = this.bars[index] ?? null;

    /*
     * The pointer reads against the pane it is in.
     *
     * `price` stays the price under the cursor on the price pane, because the
     * legend and the data window have always meant that by it. What is new is
     * the pane and the value in that pane's own units — an RSI of 62 rather
     * than the price the same y would be if the chart had no lower panes,
     * which is a number that describes nothing.
     */
    const pane = paneAt(layout, y);
    const price = yToValue(mainPane(layout), y);

    this.crosshair = {
      barIndex: index,
      bar,
      price,
      paneId: pane?.id ?? null,
      paneValue: pane ? yToValue(pane, y) : null,
      x,
      y,
    };
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
    const anchor = this.indexAt(event.clientX - rect.left, this.size().plotWidth);

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

  /** Width and height only, for the callers that do not need the panes. */
  private size(): { width: number; height: number; plotWidth: number } {
    const width = this.container?.clientWidth ?? 0;
    return {
      width,
      height: this.container?.clientHeight ?? 0,
      plotWidth: Math.max(0, width - SCALE_WIDTH),
    };
  }

  /**
   * The panes the studies currently on the chart are asking for.
   *
   * Series are cut to the visible window before the domain is computed, for the
   * same reason the price scale is: a volume spike three months off screen
   * should not flatten the bars somebody is actually looking at.
   */
  private paneRequests(): PaneInput[] {
    const from = Math.floor(this.range.from);
    const to = from + this.visibleBars().length;

    return collectPaneRequests(this.indicators).map((request) => ({
      ...request,
      series: request.series.map((values) => values.slice(from, to)),
    }));
  }

  /**
   * The frame's geometry.
   *
   * One call produces the pane rectangles, every pane's domain and the single
   * time mapping they all share — so nothing downstream can compute an x a
   * different way and land a volume bar half a candle off.
   */
  private geometry(): Geometry {
    const { width, height, plotWidth } = this.size();
    const { low, high } = this.extremes();

    return {
      layout: buildPaneLayout({
        width,
        height,
        price: { min: low, max: high },
        secondary: this.paneRequests(),
      }),
      axis: timeAxis(this.range, plotWidth, this.visibleBars().length),
    };
  }

  private visibleBars(): Bar[] {
    return this.derived.slice(Math.floor(this.range.from), Math.ceil(this.range.to));
  }

  private indexAt(x: number, plotWidth: number): number {
    const ratio = plotWidth > 0 ? Math.max(0, Math.min(1, x / plotWidth)) : 0;
    return Math.floor(this.range.from + ratio * (this.range.to - this.range.from));
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

    const { layout, axis } = this.geometry();
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

    const main = mainPane(layout);
    const { min: low, max: high } = main.domain;
    const step = axis.step;
    const bodyWidth = barWidth(axis);

    const toY = (price: number) => valueToY(main, price);

    this.drawGrid(ctx, layout, palette, low, high, toY);

    /*
     * The price pane paints inside its own rectangle.
     *
     * Every save has its restore inside `withinPane`, so a clip cannot outlive
     * the pane that set it — the failure mode being one study leaving the
     * canvas clipped and every pane below it silently blank.
     */
    withinPane(ctx, main, layout.plotWidth, () => {
      if (this.chartType === 'line' || this.chartType === 'area' || this.chartType === 'baseline') {
        this.drawLineSeries(ctx, bars, step, toY, palette, main);
      } else {
        this.drawBarSeries(ctx, bars, step, bodyWidth, toY, palette);
      }

      this.drawIndicators(ctx, toY, step);
      this.drawHighlights(ctx, layout, step);
      this.drawDrawings(ctx, layout);
    });

    this.drawSecondaryPanes(ctx, layout, axis, palette, bars);
    this.drawPriceScale(ctx, layout, palette, low, high);
    this.drawTimeScale(ctx, bars, step, layout, palette);
    if (this.crosshair) this.drawCrosshair(ctx, layout, palette);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    layout: PaneLayout,
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
      ctx.lineTo(layout.plotWidth, y);
      ctx.stroke();
    }
  }

  /**
   * The colours a pane renderer is allowed.
   *
   * A subset of the chart palette rather than the whole of it, so a pane cannot
   * reach for a colour the price pane owns and quietly invent a second visual
   * language halfway down the chart.
   */
  private panePalette(palette: ChartPalette): PanePalette {
    return {
      grid: palette.grid,
      border: palette.border,
      textMuted: palette.textMuted,
      up: palette.up,
      down: palette.down,
    };
  }

  /**
   * Every pane below the price, drawn from the studies that asked for one.
   *
   * There is no branch here on which study this is. A plot says it is a line, a
   * histogram or a set of flags; the pane says how tall it is and what its
   * domain is; this loop joins the two. Adding an oscillator changes the
   * registry, not this function.
   */
  private drawSecondaryPanes(
    ctx: CanvasRenderingContext2D,
    layout: PaneLayout,
    axis: TimeAxis,
    palette: ChartPalette,
    bars: Bar[]
  ): void {
    if (layout.panes.length < 2) return;

    const panePalette = this.panePalette(palette);
    const offset = Math.floor(this.range.from);

    for (const pane of layout.panes.slice(1)) {
      drawPaneFrame(ctx, pane, layout.plotWidth, panePalette, { separator: true });

      // Zero is a line you can see on a pane that has negative values; on one
      // that starts at zero it is the floor and drawing it is noise.
      if (pane.scale.kind === 'symmetric') {
        drawPaneBaseline(ctx, pane, layout.plotWidth, panePalette, 0);
      }

      for (const instance of this.indicators) {
        if (paneRequestFor(instance)?.id !== pane.id) continue;

        for (const plot of instance.plots) {
          const colour =
            this.studyPalette[plot.colour % this.studyPalette.length] ?? '#7c4dff';

          if (plot.style === 'histogram') {
            drawPaneHistogram(ctx, pane, axis, plot.values, {
              // Zero for both a volume column and a MACD bar: one stands on the
              // floor of its pane and the other hangs from the middle of its
              // own, and that difference is the domain's, not the bar's.
              baseline: 0,
              /*
               * Bar direction is the chart's existing way of colouring a
               * column: volume takes it from the candle above, a MACD
               * histogram from its own sign. Both are "up is up".
               */
              colourAt: (index) =>
                this.histogramColour(pane, plot.values[index], bars[index - offset], palette),
              plotWidth: layout.plotWidth,
            });
            continue;
          }

          if (plot.style === 'flags') {
            drawPaneFlags(
              ctx,
              pane,
              axis,
              plot.values,
              { colour, dashed: instance.draft },
              layout.plotWidth
            );
            continue;
          }

          drawPaneLine(
            ctx,
            pane,
            axis,
            plot.values,
            { colour, width: 1.6, dashed: instance.draft },
            layout.plotWidth
          );
        }
      }

      drawPaneTitle(ctx, pane, panePalette, layout.plotWidth);
      drawPaneScale(ctx, pane, layout, panePalette);
    }
  }

  /**
   * Which way a column points.
   *
   * On a pane that starts at zero the bar belongs to its candle — volume on a
   * day the price fell is a down bar, whatever the volume did. Anywhere else
   * the sign of the value is the only thing that could mean up or down.
   */
  private histogramColour(
    pane: Pane,
    value: number | null,
    bar: Bar | undefined,
    palette: ChartPalette
  ): string {
    if (pane.scale.kind === 'zeroBased') {
      if (!bar) return palette.volumeUp;
      return bar.close >= bar.open ? palette.volumeUp : palette.volumeDown;
    }

    return (value ?? 0) >= 0 ? palette.up : palette.down;
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
    pane: Pane
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
      const floor = pane.rect.top + pane.rect.height;
      ctx.lineTo((bars.length - 1) * step + step / 2, floor);
      ctx.lineTo(step / 2, floor);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, pane.rect.top, 0, floor);
      gradient.addColorStop(0, `${colour}33`);
      gradient.addColorStop(1, `${colour}00`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  /**
   * Overlay indicators, on the price pane scale.
   *
   * Separate-pane studies are not drawn here — `drawSecondaryPanes` has them,
   * each on a scale of its own. Putting a volume figure of forty million on the
   * price scale would place it somewhere off the top of the chart, which is why
   * the two paths exist at all.
   */
  private drawIndicators(
    ctx: CanvasRenderingContext2D,
    toY: (price: number) => number,
    step: number
  ): void {
    const offset = Math.floor(this.range.from);

    for (const indicator of this.indicators) {
      // One question, asked in one place: does this study want a pane of its
      // own? Anything that does not is an overlay, whatever it is called.
      if (indicator.hidden || paneRequestFor(indicator)) continue;

      for (const plot of indicator.plots) {
        /*
         * Flags mark individual bars — a crossover, not a series. Drawn as a
         * ring rather than a filled dot so the lines underneath stay readable
         * at the exact point somebody is trying to look at.
         */
        if (plot.style === 'flags') {
          ctx.save();
          ctx.strokeStyle = this.studyPalette[plot.colour % this.studyPalette.length] ?? '#7c4dff';
          ctx.lineWidth = 2;
          ctx.setLineDash(indicator.draft ? [3, 3] : []);

          for (let i = 0; i < Math.ceil(this.range.to) - offset; i += 1) {
            const value = plot.values[offset + i];
            if (value === null || value === undefined) continue;

            ctx.beginPath();
            ctx.arc(i * step + step / 2, toY(value), 4.5, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
          continue;
        }

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

  /*
   * A reference drawn as a zone with a number.
   *
   * Translucent rather than solid so the bars it is pointing at stay readable —
   * a highlight that hides its own subject is decoration. Single-bar references
   * get a minimum width, because one bar at a year of daily candles is under a
   * pixel and would be invisible exactly when it matters most.
   */
  private drawHighlights(ctx: CanvasRenderingContext2D, layout: PaneLayout, step: number): void {
    if (!this.highlights.length) return;

    const plotHeight = mainPane(layout).rect.height;

    for (const highlight of this.highlights) {
      const active = highlight.id === this.activeHighlight;
      const left = (highlight.fromIndex - this.range.from) * step;
      const width = Math.max(6, (highlight.toIndex - highlight.fromIndex + 1) * step);

      if (left + width < 0 || left > layout.plotWidth) continue;

      ctx.save();

      if (highlight.kind !== 'window') {
        ctx.fillStyle = active ? 'rgba(124, 77, 255, 0.20)' : 'rgba(124, 77, 255, 0.08)';
        ctx.fillRect(left, 0, width, plotHeight);
      }

      ctx.strokeStyle = active ? 'rgba(124, 77, 255, 0.95)' : 'rgba(124, 77, 255, 0.45)';
      ctx.lineWidth = active ? 1.6 : 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(left, 0);
      ctx.lineTo(left, plotHeight);
      ctx.moveTo(left + width, 0);
      ctx.lineTo(left + width, plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // The badge is the whole point of numbering: the sentence says "2" and
      // the chart has to show a "2" somewhere findable.
      const badgeX = left + width / 2;
      ctx.beginPath();
      ctx.arc(badgeX, 14, active ? 11 : 9, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(124, 77, 255, 1)' : 'rgba(124, 77, 255, 0.75)';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `${active ? 700 : 600} 11px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(highlight.number), badgeX, 14);
      ctx.restore();
    }
  }

  private drawDrawings(ctx: CanvasRenderingContext2D, layout: PaneLayout): void {
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
        ctx.lineTo(layout.plotWidth, points[0].y);
        ctx.stroke();
      } else if (drawing.tool === 'verticalLine') {
        ctx.beginPath();
        ctx.moveTo(points[0].x, 0);
        ctx.lineTo(points[0].x, mainPane(layout).rect.height);
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

  /*
   * Volume used to be drawn here, as a strip the engine always reserved and
   * always painted. It is a study now — `INDICATORS.volume`, on the shared
   * volume pane — which is why there is nothing left in this file that knows
   * what a volume bar is.
   */

  private drawPriceScale(
    ctx: CanvasRenderingContext2D,
    layout: PaneLayout,
    palette: ChartPalette,
    low: number,
    high: number
  ): void {
    const main = mainPane(layout);

    // Clipped to the price pane's own band of the gutter: the bottom label sits
    // a few pixels below the value it belongs to, which is enough to land it in
    // the pane underneath.
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.plotWidth, main.rect.top, layout.scaleWidth, main.rect.height);
    ctx.clip();

    ctx.fillStyle = palette.textMuted;
    ctx.font = '10.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';

    for (let i = 0; i <= 4; i += 1) {
      const price = low + ((high - low) * i) / 4;
      const y = main.rect.height * (1 - i / 4);
      ctx.fillText(
        price.toFixed(2),
        layout.plotWidth + 8,
        Math.min(main.rect.height - 2, y + 4)
      );
    }

    ctx.restore();
  }

  /**
   * One time axis, at the bottom, for every pane.
   *
   * The bottom-most pane owns the visible labels — `layout.axisPaneId` names it
   * — while all of them share the mapping that put the bars where they are. A
   * second axis between panes would be the same numbers written twice, and two
   * places for them to disagree.
   */
  private drawTimeScale(
    ctx: CanvasRenderingContext2D,
    bars: Bar[],
    step: number,
    layout: PaneLayout,
    palette: ChartPalette
  ): void {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';

    /*
     * The label follows the spacing of the data, not a fixed format.
     *
     * Every label was a date, so a minute chart printed the same day eight
     * times across the axis and told you nothing about where you were in it.
     * The gap between bars is what decides: inside a day, the time is the only
     * part that varies.
     */
    const gap = bars.length > 1 ? bars[1].time - bars[0].time : 86_400;
    const intraday = gap < 86_400;

    const every = Math.max(1, Math.floor(bars.length / 8));
    bars.forEach((bar, index) => {
      if (index % every !== 0) return;

      const at = new Date(bar.time * 1000).toISOString();
      const label = intraday ? at.slice(11, 16) : at.slice(5, 10);
      ctx.fillText(label, index * step + step / 2, layout.height - 8);
    });

    ctx.textAlign = 'left';
    ctx.fillText('UTC', layout.plotWidth + 8, layout.height - 8);
  }

  /**
   * The crosshair, one line through everything and one inside a pane.
   *
   * The vertical runs the full height of the plot, because a moment in time is
   * the same moment in every pane. The horizontal belongs to whichever pane the
   * pointer is in and stops at its edges — drawn across the whole chart it
   * would sit at 62 on the RSI and at nothing in particular everywhere else.
   */
  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    layout: PaneLayout,
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
    ctx.lineTo(Math.round(crosshair.x) + 0.5, layout.plotHeight);
    ctx.stroke();

    const pane = paneAt(layout, crosshair.y);
    if (pane) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(crosshair.y) + 0.5);
      ctx.lineTo(layout.plotWidth, Math.round(crosshair.y) + 0.5);
      ctx.stroke();
    }

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
}

export { CHART_TYPE_LABEL };
