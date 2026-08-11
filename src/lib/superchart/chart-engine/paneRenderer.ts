import {
  barWidth,
  formatPaneValue,
  paneTicks,
  valueToY,
  xForIndex,
  type Pane,
  type PaneLayout,
  type TimeAxis,
} from './panes';

/**
 * Painting a secondary pane.
 *
 * Separate from `canvas.ts` for one reason that matters more than tidiness: a
 * function taking a context can be handed a context that writes down what it
 * was asked to do. The pane tests assert that an RSI actually produces line
 * segments inside the RSI rectangle, which is a different claim from "a pane
 * called rsi exists in the layout" — and it is the claim that was wrong before,
 * since the metadata was always right and nothing was ever drawn.
 *
 * Nothing here knows what an RSI is. It draws a line, a histogram or a set of
 * marks in a rectangle, against a domain somebody else computed, and the study
 * that wanted it is a row in a registry.
 *
 * The three series functions return **how many points they actually drew**. That
 * number is what lets the engine record which studies are on the canvas rather
 * than which were handed to it — a series that is entirely null in the visible
 * window returns zero, and the outcome telemetry reports it as data missing
 * instead of claiming the study rendered.
 */

/**
 * The part of a 2D context this module uses.
 *
 * `Pick` rather than a hand-written interface so the property types are the
 * real ones and a `CanvasRenderingContext2D` satisfies it without a cast.
 */
export type PaneContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'rect'
  | 'clip'
  | 'arc'
  | 'stroke'
  | 'fill'
  | 'fillRect'
  | 'setLineDash'
  | 'fillText'
  | 'lineWidth'
  | 'strokeStyle'
  | 'fillStyle'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
>;

export type PanePalette = {
  grid: string;
  border: string;
  textMuted: string;
  up: string;
  down: string;
};

export type SeriesStyle = {
  colour: string;
  width?: number;
  dashed?: boolean;
};

/**
 * Confines everything `paint` does to one pane.
 *
 * Save, clip, paint, restore — in that order and with no way to leave the clip
 * behind, because a `clip()` that outlives its `restore()` silently blanks
 * every pane drawn after it. The plot width is included so a series running off
 * the left edge while panning cannot write over the price scale either.
 */
export function withinPane(
  ctx: PaneContext,
  pane: Pane,
  plotWidth: number,
  paint: () => void
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, pane.rect.top, plotWidth, pane.rect.height);
  ctx.clip();
  paint();
  ctx.restore();
}

/**
 * The line above a pane and the levels inside it.
 *
 * The separator is drawn at the top of each secondary pane rather than the
 * bottom of the one above, so the last pane does not need a rule of its own
 * against the time axis.
 */
export function drawPaneFrame(
  ctx: PaneContext,
  pane: Pane,
  plotWidth: number,
  palette: PanePalette,
  options: { separator: boolean }
): void {
  ctx.save();

  if (options.separator) {
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(pane.rect.top) + 0.5);
    ctx.lineTo(plotWidth, Math.round(pane.rect.top) + 0.5);
    ctx.stroke();
  }

  /*
   * Guides are informational. 30 and 70 on an RSI are where the convention puts
   * a line, not advice — so they are drawn in the grid colour like every other
   * reference on the chart, and nothing about them says buy or sell.
   */
  if (pane.guides.length) {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (const level of pane.guides) {
      const y = Math.round(valueToY(pane, level)) + 0.5;
      if (y < pane.rect.top || y > pane.rect.top + pane.rect.height) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  ctx.restore();
}

/** A series as a line, clipped to its pane. */
export function drawPaneLine(
  ctx: PaneContext,
  pane: Pane,
  axis: TimeAxis,
  values: (number | null)[],
  style: SeriesStyle,
  plotWidth: number
): number {
  let drawn = 0;

  withinPane(ctx, pane, plotWidth, () => {
    ctx.beginPath();
    ctx.strokeStyle = style.colour;
    ctx.lineWidth = style.width ?? 1.6;
    ctx.setLineDash(style.dashed ? [5, 4] : []);

    let started = false;
    for (let index = axis.offset; index < axis.offset + axis.count; index += 1) {
      const value = values[index];
      if (value === null || value === undefined || !Number.isFinite(value)) {
        // A gap ends the line rather than bridging it: joining across a hole
        // draws a segment the calculation never produced.
        started = false;
        continue;
      }

      const x = xForIndex(axis, index);
      const y = valueToY(pane, value);
      if (started) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        started = true;
      }

      drawn += 1;
    }

    ctx.stroke();
    ctx.setLineDash([]);
  });

  return drawn;
}

/**
 * A series as bars standing on a baseline.
 *
 * `baseline` is a value, not a pixel — zero for volume and for a MACD
 * histogram, which is what makes a negative bar hang below the line instead of
 * being drawn upside down from the floor of the pane.
 */
export function drawPaneHistogram(
  ctx: PaneContext,
  pane: Pane,
  axis: TimeAxis,
  values: (number | null)[],
  options: {
    baseline: number;
    colour?: string;
    /** Bar-by-bar colouring, for volume's up and down days. */
    colourAt?: (index: number) => string;
    plotWidth: number;
  }
): number {
  const width = barWidth(axis);
  const zero = valueToY(pane, options.baseline);
  let drawn = 0;

  withinPane(ctx, pane, options.plotWidth, () => {
    ctx.setLineDash([]);

    for (let index = axis.offset; index < axis.offset + axis.count; index += 1) {
      const value = values[index];
      if (value === null || value === undefined || !Number.isFinite(value)) continue;

      const y = valueToY(pane, value);
      const top = Math.min(y, zero);
      // A bar worth less than a pixel is still a bar; rounding it away makes a
      // quiet day look like a missing one.
      const height = Math.max(1, Math.abs(y - zero));

      ctx.fillStyle = options.colourAt ? options.colourAt(index) : (options.colour ?? '#888888');
      ctx.fillRect(xForIndex(axis, index) - width / 2, top, width, height);
      drawn += 1;
    }
  });

  return drawn;
}

/** Individual bars picked out, drawn as rings so the series stays readable. */
export function drawPaneFlags(
  ctx: PaneContext,
  pane: Pane,
  axis: TimeAxis,
  values: (number | null)[],
  style: SeriesStyle,
  plotWidth: number
): number {
  let drawn = 0;

  withinPane(ctx, pane, plotWidth, () => {
    ctx.strokeStyle = style.colour;
    ctx.lineWidth = style.width ?? 2;
    ctx.setLineDash(style.dashed ? [3, 3] : []);

    for (let index = axis.offset; index < axis.offset + axis.count; index += 1) {
      const value = values[index];
      if (value === null || value === undefined || !Number.isFinite(value)) continue;

      ctx.beginPath();
      ctx.arc(xForIndex(axis, index), valueToY(pane, value), 4.5, 0, Math.PI * 2);
      ctx.stroke();
      drawn += 1;
    }

    ctx.setLineDash([]);
  });

  return drawn;
}

/** The zero rule a MACD hangs from, drawn solid so the sign is unambiguous. */
export function drawPaneBaseline(
  ctx: PaneContext,
  pane: Pane,
  plotWidth: number,
  palette: PanePalette,
  value = 0
): void {
  const y = Math.round(valueToY(pane, value)) + 0.5;
  if (y < pane.rect.top || y > pane.rect.top + pane.rect.height) return;

  ctx.save();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(plotWidth, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * A pane's own numbers, in the gutter.
 *
 * Clipped to the pane's own band of the scale column, so an RSI's 100 cannot
 * end up printed beside the MACD below it — the labels are the part of a
 * multi-pane chart that bleeds first, because a baseline sits a few pixels
 * below the value it belongs to.
 */
export function drawPaneScale(
  ctx: PaneContext,
  pane: Pane,
  layout: PaneLayout,
  palette: PanePalette,
  options: { ticks?: number; floor?: boolean } = {}
): void {
  const ticks = options.ticks ?? 2;
  // Only the pane against the time axis prints its lowest number; see
  // `paneTicks`.
  const floor = options.floor ?? pane.id === layout.axisPaneId;

  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.plotWidth, pane.rect.top, layout.scaleWidth, pane.rect.height);
  ctx.clip();

  ctx.fillStyle = palette.textMuted;
  ctx.font = '10.5px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const bottom = pane.rect.top + pane.rect.height;
  for (const value of paneTicks(pane, ticks, floor)) {
    const y = valueToY(pane, value);
    ctx.fillText(
      formatPaneValue(pane, value),
      layout.plotWidth + 8,
      Math.max(pane.rect.top + 9, Math.min(bottom - 2, y + 3.5))
    );
  }

  ctx.restore();
}

/** The pane's name, top left, so a strip of numbers says what it is. */
export function drawPaneTitle(
  ctx: PaneContext,
  pane: Pane,
  palette: PanePalette,
  plotWidth: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, pane.rect.top, plotWidth, pane.rect.height);
  ctx.clip();
  ctx.fillStyle = palette.textMuted;
  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(pane.title, 6, pane.rect.top + 12);
  ctx.restore();
}
