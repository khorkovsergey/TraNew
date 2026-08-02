import type { ChartInterval, ChartType } from '../chart-engine/types';
import type { DrawingInstance, DrawingTool } from '../drawings/types';

/**
 * The saved layout, versioned from the first release.
 *
 * A layout is the only thing in Superchart a person builds over time, so it is
 * the one thing that must survive the code changing underneath it. Versioning
 * it later means writing a migration for layouts that never recorded which
 * version they were — which is guesswork.
 *
 * `migrate` is therefore written now, with one version in it, rather than when
 * it is first needed.
 *
 * Import-free beyond the types it stores, so the harness compiles it alone.
 */

export const LAYOUT_SCHEMA_VERSION = 1;

export type StudyChoice = {
  definitionId: string;
  params: Record<string, number>;
};

export type SerializedChartState = {
  symbolId: string;
  interval: ChartInterval;
  chartType: ChartType;
  studies: StudyChoice[];
  drawings: DrawingInstance[];
  panelOpen: boolean;
  dockOpen: boolean;
};

export type ChartLayout = {
  schemaVersion: number;
  id: string;
  name: string;
  state: SerializedChartState;
  createdAt: string;
  updatedAt: string;
};

const TOOLS: DrawingTool[] = [
  'trendLine',
  'horizontalLine',
  'verticalLine',
  'rectangle',
  'text',
  'priceLabel',
  'fibonacci',
];

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];
const TYPES: ChartType[] = ['candles', 'bars', 'line', 'area', 'baseline', 'hollow', 'heikin'];

/**
 * Reads a layout from storage, whatever shape it is in.
 *
 * Returns null rather than a partial layout. A half-restored workspace — the
 * right symbol with somebody else's drawings, or an interval the provider does
 * not serve — is harder to recognise as broken than an empty one, and it is
 * what a lenient parser produces.
 */
export function parseLayout(raw: unknown): ChartLayout | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  const version = typeof value.schemaVersion === 'number' ? value.schemaVersion : 0;
  const migrated = migrate(value, version);
  if (!migrated) return null;

  const state = migrated.state as Record<string, unknown>;

  if (typeof state?.symbolId !== 'string') return null;
  if (!INTERVALS.includes(state.interval as ChartInterval)) return null;
  if (!TYPES.includes(state.chartType as ChartType)) return null;

  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    id: typeof migrated.id === 'string' ? migrated.id : 'layout',
    name: typeof migrated.name === 'string' ? migrated.name : 'Untitled layout',
    state: {
      symbolId: state.symbolId,
      interval: state.interval as ChartInterval,
      chartType: state.chartType as ChartType,
      studies: parseStudies(state.studies),
      drawings: parseDrawings(state.drawings),
      panelOpen: state.panelOpen !== false,
      dockOpen: state.dockOpen === true,
    },
    createdAt: typeof migrated.createdAt === 'string' ? migrated.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function parseStudies(raw: unknown): StudyChoice[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => typeof entry.definitionId === 'string')
    .map((entry) => ({
      definitionId: entry.definitionId as string,
      // Parameters are re-clamped by `createIndicator` on the way in, so a
      // tampered value cannot reach a calculation.
      params:
        typeof entry.params === 'object' && entry.params !== null
          ? Object.fromEntries(
              Object.entries(entry.params as Record<string, unknown>).filter(
                ([, value]) => typeof value === 'number' && Number.isFinite(value)
              )
            ) as Record<string, number>
          : {},
    }));
}

function parseDrawings(raw: unknown): DrawingInstance[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => TOOLS.includes(entry.tool as DrawingTool))
    .filter((entry) => Array.isArray(entry.points) && entry.points.length > 0)
    .map((entry) => {
      const points = (entry.points as Array<Record<string, unknown>>)
        .filter(
          (point) =>
            typeof point?.barIndex === 'number' &&
            typeof point?.price === 'number' &&
            Number.isFinite(point.barIndex) &&
            Number.isFinite(point.price)
        )
        .map((point) => ({ barIndex: point.barIndex as number, price: point.price as number }));

      const style = (entry.style ?? {}) as Record<string, unknown>;

      return {
        id: typeof entry.id === 'string' ? entry.id : `d_${Math.random().toString(36).slice(2, 8)}`,
        tool: entry.tool as DrawingTool,
        points,
        style: {
          colour: typeof style.colour === 'string' ? style.colour : '#7c4dff',
          width: typeof style.width === 'number' ? style.width : 1.6,
          dashed: style.dashed === true,
        },
        text: typeof entry.text === 'string' ? entry.text : undefined,
        locked: entry.locked === true,
        hidden: entry.hidden === true,
        source: entry.source === 'voyager' ? 'voyager' : 'user',
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // A draft never reaches storage, so anything read back is not one —
        // whatever the stored value claimed.
        draft: false,
      } satisfies DrawingInstance;
    })
    .filter((drawing) => drawing.points.length > 0);
}

/**
 * Brings an older layout forward.
 *
 * Version 0 means "written before layouts were versioned", which in practice
 * means a shape this code has never seen. It is accepted and validated rather
 * than rejected, because the fields it is missing all have safe defaults; a
 * version from the future is refused, since guessing at a shape written by
 * newer code is how a layout gets silently truncated.
 */
function migrate(raw: Record<string, unknown>, version: number): Record<string, unknown> | null {
  if (version > LAYOUT_SCHEMA_VERSION) return null;

  // No transformations yet — this is version 1. Each future step goes here as
  // its own `if (version < N)` block, in order.
  return raw;
}

export function serializeLayout(
  id: string,
  name: string,
  state: SerializedChartState,
  createdAt?: string
): ChartLayout {
  const now = new Date().toISOString();

  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    id,
    name,
    // Drafts are stripped on the way out as well as on the way in: a draft is
    // a proposal, and a proposal is not part of a saved workspace.
    state: { ...state, drawings: state.drawings.filter((drawing) => !drawing.draft) },
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

export const LAYOUT_STORAGE_KEY = 'tn_superchart_layout_v1';
