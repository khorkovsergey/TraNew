import { INDICATORS } from '../indicators';
import type { ChartInterval } from '../chart-engine/types';
import type { StudyChoice } from './schema';

/**
 * A workspace handed to the chart through the address bar.
 *
 * The Superchart catalogue does not render a chart of its own — it links to the
 * one that exists with a symbol, an interval and a set of studies attached. That
 * makes the link the whole contract, and a link is something anybody can edit,
 * so everything in it is checked here before it reaches the workspace.
 *
 * Unknown values are dropped rather than corrected to a nearest guess. A chart
 * that quietly opened a different symbol from the one in the URL would be worse
 * than one that opened the default.
 */

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];

export type ChartPreset = {
  symbolId: string;
  interval: ChartInterval;
  studies: StudyChoice[];
  /** The catalogue entry this came from, when it came from one. */
  presetId: string | null;
};

function first(value: string | string[] | undefined): string | null {
  const entry = Array.isArray(value) ? value[0] : value;
  return typeof entry === 'string' && entry !== '' ? entry : null;
}

/**
 * `sma:fast=20,slow=50;volume-ma:length=20`
 *
 * Parameters are kept only when they are finite numbers the definition declares.
 * Whatever survives is clamped again by `createIndicator` on the way into a
 * calculation — this is the first of two gates, not the only one.
 */
function parseStudies(raw: string | null): StudyChoice[] {
  if (!raw) return [];

  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, paramList] = entry.split(':');
      const definition = INDICATORS[id];
      if (!definition) return null;

      const params: Record<string, number> = {};
      for (const pair of (paramList ?? '').split(',')) {
        const [key, value] = pair.split('=');
        if (!key || !(key in definition.defaults)) continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) params[key] = parsed;
      }

      return { definitionId: id, params } satisfies StudyChoice;
    })
    .filter((study): study is StudyChoice => study !== null)
    .slice(0, 6);
}

/**
 * Reads a preset from search parameters, or returns null.
 *
 * Null means "no preset was asked for", which is different from "the preset was
 * wrong": a symbol the feed does not serve returns null too, and the workspace
 * opens on its default rather than on an empty chart with a broken header.
 */
export function parsePreset(
  raw: Record<string, string | string[] | undefined>,
  knownSymbols: readonly string[]
): ChartPreset | null {
  const symbolId = first(raw.symbol);
  if (!symbolId || !knownSymbols.includes(symbolId)) return null;

  const interval = first(raw.interval);

  return {
    symbolId,
    interval: INTERVALS.includes(interval as ChartInterval)
      ? (interval as ChartInterval)
      : '1D',
    studies: parseStudies(first(raw.studies)),
    presetId: first(raw.preset),
  };
}
