/**
 * Drawings: the model, the geometry and the hit-testing.
 *
 * This is the piece canvas does not give away. In SVG a trend line is an
 * element and the browser tells you when it was clicked; on a canvas a trend
 * line is two numbers and a stroke, and working out that a pointer at (412,
 * 233) is on it is arithmetic somebody has to write.
 *
 * Points are stored in **data space** — a bar index and a price — never in
 * pixels. A line drawn at one zoom must stay attached to the same bars at every
 * other zoom and after the window is resized, and pixels do not survive any of
 * that.
 *
 * Import-free, so the unit harness compiles it alone and the hit-testing can be
 * asserted without a browser.
 */

export type DrawingTool =
  | 'trendLine'
  | 'horizontalLine'
  | 'verticalLine'
  | 'rectangle'
  | 'text'
  | 'priceLabel'
  | 'fibonacci';

/** A point in data space: which bar, and at what price. */
export type DataPoint = {
  barIndex: number;
  price: number;
};

export type DrawingStyle = {
  colour: string;
  width: number;
  dashed: boolean;
};

export type DrawingInstance = {
  id: string;
  tool: DrawingTool;
  points: DataPoint[];
  style: DrawingStyle;
  text?: string;
  locked: boolean;
  hidden: boolean;
  /** A drawing Voyager proposed is marked, and stays marked after it is applied. */
  source: 'user' | 'voyager';
  createdAt: string;
  updatedAt: string;
  /** Set while a drawing is a Voyager draft; drafts render dashed and are never saved. */
  draft: boolean;
};

/** How many points a tool needs before it is complete. */
export const TOOL_POINTS: Record<DrawingTool, number> = {
  trendLine: 2,
  horizontalLine: 1,
  verticalLine: 1,
  rectangle: 2,
  text: 1,
  priceLabel: 1,
  fibonacci: 2,
};

export const TOOL_LABEL: Record<DrawingTool, string> = {
  trendLine: 'Trend line',
  horizontalLine: 'Horizontal line',
  verticalLine: 'Vertical line',
  rectangle: 'Rectangle',
  text: 'Text',
  priceLabel: 'Price label',
  fibonacci: 'Fibonacci retracement',
};

/* ------------------------------------------------------------- Projection */

/**
 * Data space to screen space.
 *
 * Held as a plain object rather than closures so a hit test can be run in a
 * test with numbers alone — no canvas, no DOM.
 */
export type Projection = {
  /** Left edge of the plot, in pixels. */
  plotWidth: number;
  plotHeight: number;
  /** First and last visible bar index; fractional while panning. */
  fromIndex: number;
  toIndex: number;
  low: number;
  high: number;
};

export function toScreenX(point: DataPoint, projection: Projection): number {
  const span = projection.toIndex - projection.fromIndex || 1;
  return ((point.barIndex - projection.fromIndex) / span) * projection.plotWidth;
}

export function toScreenY(point: DataPoint, projection: Projection): number {
  const span = projection.high - projection.low || 1;
  return projection.plotHeight * (1 - (point.price - projection.low) / span);
}

export function fromScreen(x: number, y: number, projection: Projection): DataPoint {
  const indexSpan = projection.toIndex - projection.fromIndex || 1;
  const priceSpan = projection.high - projection.low || 1;

  return {
    barIndex: projection.fromIndex + (x / projection.plotWidth) * indexSpan,
    price: projection.low + (1 - y / projection.plotHeight) * priceSpan,
  };
}

/* ------------------------------------------------------------ Hit testing */

/** Within this many pixels counts as a hit. Fingers are not precise. */
export const HIT_TOLERANCE = 6;

/** Perpendicular distance from a point to a segment, in pixels. */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  // A zero-length segment is a point, and the projection below would divide by
  // zero rather than saying so.
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  // Clamped, so a click beyond either end measures to the end rather than to
  // the infinite line — which is what makes a short line hard to select and a
  // long one selectable from anywhere along its extension.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export type HitResult = {
  drawingId: string;
  /** Which handle was hit, or null for the body of the shape. */
  handleIndex: number | null;
};

/**
 * What is under the pointer.
 *
 * Handles are tested before bodies and the list is walked backwards, so the
 * most recently drawn object wins and a handle always beats the shape it sits
 * on. Both are what a person expects and neither happens by itself.
 */
export function hitTest(
  drawings: DrawingInstance[],
  x: number,
  y: number,
  projection: Projection
): HitResult | null {
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const drawing = drawings[i];
    if (drawing.hidden || drawing.locked) continue;

    for (let handle = 0; handle < drawing.points.length; handle += 1) {
      const hx = toScreenX(drawing.points[handle], projection);
      const hy = toScreenY(drawing.points[handle], projection);
      if (Math.hypot(x - hx, y - hy) <= HIT_TOLERANCE + 2) {
        return { drawingId: drawing.id, handleIndex: handle };
      }
    }

    if (hitsBody(drawing, x, y, projection)) {
      return { drawingId: drawing.id, handleIndex: null };
    }
  }

  return null;
}

function hitsBody(
  drawing: DrawingInstance,
  x: number,
  y: number,
  projection: Projection
): boolean {
  const screen = drawing.points.map((point) => ({
    x: toScreenX(point, projection),
    y: toScreenY(point, projection),
  }));

  switch (drawing.tool) {
    case 'trendLine':
    case 'fibonacci':
      if (screen.length < 2) return false;
      return (
        distanceToSegment(x, y, screen[0].x, screen[0].y, screen[1].x, screen[1].y) <= HIT_TOLERANCE
      );

    case 'horizontalLine':
    case 'priceLabel':
      // Spans the plot, so only the vertical distance matters.
      return Math.abs(y - screen[0].y) <= HIT_TOLERANCE;

    case 'verticalLine':
      return Math.abs(x - screen[0].x) <= HIT_TOLERANCE;

    case 'rectangle': {
      if (screen.length < 2) return false;
      const left = Math.min(screen[0].x, screen[1].x);
      const right = Math.max(screen[0].x, screen[1].x);
      const top = Math.min(screen[0].y, screen[1].y);
      const bottom = Math.max(screen[0].y, screen[1].y);

      // The edges, not the fill: a rectangle used as a zone marker should not
      // swallow every click inside it.
      const nearVertical = (Math.abs(x - left) <= HIT_TOLERANCE || Math.abs(x - right) <= HIT_TOLERANCE) &&
        y >= top - HIT_TOLERANCE && y <= bottom + HIT_TOLERANCE;
      const nearHorizontal = (Math.abs(y - top) <= HIT_TOLERANCE || Math.abs(y - bottom) <= HIT_TOLERANCE) &&
        x >= left - HIT_TOLERANCE && x <= right + HIT_TOLERANCE;

      return nearVertical || nearHorizontal;
    }

    case 'text': {
      // A text box has no stroke to measure, so its hit area is the label box.
      const width = Math.max(40, (drawing.text?.length ?? 4) * 7);
      return x >= screen[0].x - 4 && x <= screen[0].x + width && Math.abs(y - screen[0].y) <= 10;
    }

    default:
      return false;
  }
}

/* ------------------------------------------------------------------ Moves */

/** Shifts a whole drawing by a delta in data space. */
export function moveDrawing(
  drawing: DrawingInstance,
  deltaIndex: number,
  deltaPrice: number
): DrawingInstance {
  return {
    ...drawing,
    points: drawing.points.map((point) => ({
      barIndex: point.barIndex + deltaIndex,
      price: point.price + deltaPrice,
    })),
    updatedAt: new Date().toISOString(),
  };
}

/** Moves one handle, leaving the rest of the shape where it is. */
export function moveHandle(
  drawing: DrawingInstance,
  handleIndex: number,
  point: DataPoint
): DrawingInstance {
  return {
    ...drawing,
    points: drawing.points.map((existing, index) => (index === handleIndex ? point : existing)),
    updatedAt: new Date().toISOString(),
  };
}

/** The retracement levels a Fibonacci drawing shows, as fractions of its span. */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
