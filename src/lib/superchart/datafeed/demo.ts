import { INTERVAL_SECONDS, type Bar, type ChartInterval } from '../chart-engine/types';

/**
 * The demo datafeed.
 *
 * The provider behind this portal returns daily closes with no volume and no
 * intraday. The design needs OHLCV at eight intervals. Rather than dress the
 * daily series up as something it is not, this generates a complete series
 * deterministically and every surface that shows it says **demo**.
 *
 * Deterministic for two reasons: the server and the browser must agree, and a
 * demo whose numbers move between visits cannot be discussed.
 */

export type DemoSeriesOptions = {
  symbol: string;
  interval: ChartInterval;
  bars: number;
  /** Ending price, so a demo symbol looks like itself between intervals. */
  lastPrice: number;
};

/** A small deterministic generator; the same seed gives the same series. */
function seeded(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

/**
 * A full OHLCV series ending at `lastPrice`.
 *
 * Built backwards from the close so the most recent bar matches the quote a
 * person sees elsewhere in the product — a demo chart whose last candle
 * disagrees with the price above it reads as a bug rather than as a demo.
 */
export function demoBars(options: DemoSeriesOptions): Bar[] {
  const { symbol, interval, bars: count, lastPrice } = options;
  const random = seeded(hash(`${symbol}:${interval}`));
  const step = INTERVAL_SECONDS[interval];

  // Intraday moves less per bar than a day does; without this every interval
  // looks equally violent, which is the giveaway of a generated series.
  const scale = step <= 900 ? 0.0025 : step <= 14_400 ? 0.006 : step <= 86_400 ? 0.014 : 0.03;

  const closes: number[] = new Array(count);
  let price = lastPrice;

  for (let i = count - 1; i >= 0; i -= 1) {
    closes[i] = price;
    const drift = (random() - 0.5) * scale * 2;
    const trend = Math.sin(i / 34) * scale * 0.35;
    price = price / (1 + drift + trend);
  }

  const now = Math.floor(Date.now() / 1000);
  const alignedNow = now - (now % step);

  return closes.map((close, index) => {
    const open = index === 0 ? close * (1 - (random() - 0.5) * scale) : closes[index - 1];
    const spread = Math.abs(close - open) + close * scale * (0.4 + random() * 0.8);

    const high = Math.max(open, close) + spread * random() * 0.6;
    const low = Math.min(open, close) - spread * random() * 0.6;

    // Volume rises with the size of the move, which is what makes an anomaly
    // detector have anything to find.
    const move = Math.abs(close - open) / (open || 1);
    const volume = Math.round((0.6 + random() * 0.8 + move * 30) * 1_000_000);

    return {
      time: alignedNow - (count - 1 - index) * step,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume,
    };
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Every demo series says so; nothing in the product may present it otherwise. */
export const DEMO_NOTICE = 'Demo data — generated, not a market feed.';
