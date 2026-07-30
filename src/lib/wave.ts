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
