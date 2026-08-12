import { dayKey, type UserDay } from './retention';

/**
 * The cohort heatmap, aggregated from the user-days the page already loaded.
 *
 * ## Why this is not a new metric
 *
 * It is `cohortRetention` sliced by cohort instead of summed over all of them,
 * and it applies **exactly the same rule**: a cell is the share of a cohort that
 * had another eligible portal day within a *cumulative* window of [1, N] days
 * after their first eligible portal day. Not an anniversary, not a per-day
 * return curve. A per-offset-day grid is the shape most cohort heatmaps have and
 * it is deliberately *not* what this draws, because it would be a second
 * retention semantic sitting next to the D1/D7/D30 cards and disagreeing with
 * them for reasons no reader could be expected to work out.
 *
 * Because the windows are cumulative, each row is non-decreasing left to right,
 * and the rightmost mature column of a row is that cohort's contribution to the
 * D-number above it.
 *
 * ## Privacy
 *
 * `UserDay` carries a `userKeyHash`. Nothing here returns one. The function
 * takes rows and gives back counts per cohort day, which is the only shape
 * allowed to leave the server — the same rule `journeys.ts` applies to session
 * breakdowns, for the same re-identification reason.
 *
 * Pure and import-light on purpose, so the maturity and suppression boundaries
 * are checkable with fixtures.
 */

/** The cumulative windows drawn as columns. Matches `RETENTION_HORIZONS` plus
 *  the intermediate ones a heatmap needs to show a shape at all. */
export const COHORT_OFFSETS = [1, 3, 7, 14, 30] as const;

export type CohortCell = {
  offset: number;
  /** Cohort members who returned at least once within [1, offset] days. */
  returned: number;
  /**
   * `null` when the cohort is too young for this window, or too small to
   * publish a rate. The two are different and `reason` says which.
   */
  rate: number | null;
  reason: 'ok' | 'immature' | 'insufficient';
};

export type CohortRow = {
  /** `YYYY-MM-DD`, the cohort's first eligible portal day. */
  day: string;
  size: number;
  cells: CohortCell[];
};

export type CohortGrid = {
  offsets: readonly number[];
  rows: CohortRow[];
  /** Cohort members below this get a count and no rate. */
  minimumCohort: number;
  /** Users with at least one eligible portal day — the whole population. */
  population: number;
  /** True when no cohort is both mature and large enough for any cell. */
  empty: boolean;
};

function addDays(day: string, days: number): string {
  const at = new Date(`${day}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return dayKey(at);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

export function cohortGrid(
  userDays: readonly UserDay[],
  options: {
    today: Date;
    telemetryStartedOn: string | null;
    minimumCohort: number;
    /** Newest cohorts first, capped so the panel does not grow without bound. */
    maxRows?: number;
  }
): CohortGrid {
  const { today, telemetryStartedOn, minimumCohort, maxRows = 14 } = options;
  const todayKey = dayKey(today);

  /* One entry per user, exactly as `cohortRetention` builds it. */
  const collected = new Map<string, Map<string, UserDay>>();

  for (const row of userDays) {
    if (!row.userKeyHash) continue;
    const days = collected.get(row.userKeyHash) ?? new Map<string, UserDay>();
    collected.set(row.userKeyHash, days);

    const prior = days.get(row.day);
    days.set(
      row.day,
      prior
        ? { ...row, eligible: prior.eligible || row.eligible, meaningful: prior.meaningful || row.meaningful }
        : row
    );
  }

  /* Grouped by first *eligible portal* day — never by first telemetry row. */
  const cohorts = new Map<string, Array<Map<string, UserDay>>>();
  let population = 0;

  for (const days of collected.values()) {
    const firstEligible = [...days.values()]
      .filter((row) => row.eligible)
      .map((row) => row.day)
      .sort()[0];

    if (!firstEligible) continue;

    /*
     * A cohort formed before telemetry existed cannot be shown to have churned
     * over a period nobody was watching, so it is not a row at all — the same
     * exclusion the D-numbers apply, made visible by its absence.
     */
    if (telemetryStartedOn && daysBetween(telemetryStartedOn, firstEligible) < 0) continue;

    population += 1;
    const members = cohorts.get(firstEligible) ?? [];
    members.push(days);
    cohorts.set(firstEligible, members);
  }

  const rows: CohortRow[] = [...cohorts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, maxRows)
    .map(([day, members]) => ({
      day,
      size: members.length,
      cells: COHORT_OFFSETS.map((offset) => {
        /* Mature only once the whole window has elapsed. */
        if (daysBetween(addDays(day, offset), todayKey) < 0) {
          return { offset, returned: 0, rate: null, reason: 'immature' as const };
        }

        let returned = 0;
        for (const days of members) {
          for (const [visited, row] of days) {
            if (!row.eligible) continue;
            const gap = daysBetween(day, visited);
            if (gap < 1 || gap > offset) continue;
            returned += 1;
            break;
          }
        }

        return {
          offset,
          returned,
          rate: members.length >= minimumCohort ? returned / members.length : null,
          reason: members.length >= minimumCohort ? ('ok' as const) : ('insufficient' as const),
        };
      }),
    }));

  return {
    offsets: COHORT_OFFSETS,
    rows,
    minimumCohort,
    population,
    empty: !rows.some((row) => row.cells.some((cell) => cell.reason === 'ok')),
  };
}
