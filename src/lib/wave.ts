/**
 * Deterministic pseudo-market polyline. Charts in the portal are illustrative, but
 * they must render identically on the server and the client — so no Math.random().
 */
export function wave(seed: number, points: number, width: number, height: number): string {
  let state = seed * 9301 + 49297;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };

  const values: number[] = [];
  let value = 0.5;

  for (let i = 0; i < points; i += 1) {
    value += (random() - 0.48) * 0.16;
    value = Math.min(0.92, Math.max(0.08, value));
    values.push(value);
  }

  return values
    .map((v, i) => {
      const x = (i / (points - 1)) * width;
      const y = height - v * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * A deterministic pseudo-price series, for when no market data is configured.
 *
 * Same generator as `wave`, but it returns prices rather than SVG points, so the
 * studies can be computed against it and the chart still draws something with a
 * shape. Deterministic because the server and the browser both render it — a
 * random walk here would be a hydration mismatch on every load.
 *
 * Anything drawn from this is labelled as illustrative on screen. A demo may
 * invent a price; it may not let one pass for a real one.
 */
export function waveSeries(seed: number, points: number, base: number): number[] {
  let state = seed * 9301 + 49297;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };

  const out: number[] = [];
  let value = 0.5;

  for (let i = 0; i < points; i += 1) {
    value += (random() - 0.48) * 0.16;
    value = Math.min(0.92, Math.max(0.08, value));
    // Spread around the base rather than scaling from zero, so a 250 base gives
    // prices in the 200-300 range instead of anywhere between 20 and 230.
    out.push(Number((base * (0.8 + value * 0.4)).toFixed(2)));
  }

  return out;
}
