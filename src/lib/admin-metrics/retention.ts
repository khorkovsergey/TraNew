/**
 * Authenticated cohort retention.
 *
 * Pure, and deliberately narrow: **only signed-in people are measured here.**
 * Anonymous cross-session retention is `not_measurable` and stays that way —
 * the portal has no cross-session anonymous identity, the only anonymous key it
 * has is a day-scoped hash of an IP that exists to rate-limit Voyager, and
 * there is no consent surface to hang a new one on. That was decided in Phase 0
 * and implemented in Phase 1; this module does not quietly reopen it.
 *
 * ## Time semantics
 *
 * Cohort days are UTC calendar days taken from **`received_at`**, the server
 * clock. This is the one place `occurred_at` must not be used: retention
 * compares one client's days against another's, and a client whose clock is
 * wrong would land in the wrong cohort. Ordering *inside* a session is the
 * opposite case and uses `occurred_at` — see `sessions.ts`.
 *
 * ## Window semantics
 *
 * `D1`, `D7` and `D30` are **cumulative return windows**, not anniversaries.
 * DN is the share of a cohort that came back at least once on a UTC day between
 * 1 and N days after their first day. Asking whether somebody appeared exactly
 * seven days later measures whether they happen to use the product weekly, not
 * whether they came back, and it produces a number that moves with the day of
 * the week the cohort started on.
 *
 * Because the windows are cumulative, D1 ≤ D7 ≤ D30 always. A reader who sees
 * otherwise is looking at a bug.
 *
 * ## Maturity
 *
 * A cohort is only counted in DN once N days of telemetry have actually
 * elapsed since its first day. A cohort formed yesterday has not failed D7; it
 * has not had the chance. Immature cohorts are excluded and reported, never
 * counted as churn — and since telemetry only began when Phase 1 deployed,
 * every horizon is unavailable until enough days exist to fill it.
 */

import {
  notMeasurable,
  rate,
  type MetricProvenance,
  type MetricValue,
  type NumericState,
} from '@/lib/analytics/states';

export const RETENTION_HORIZONS = [1, 7, 30] as const;
export type RetentionHorizon = (typeof RETENTION_HORIZONS)[number];

/** One row per authenticated user per UTC day. Aggregated before it gets here. */
export type UserDay = {
  userKeyHash: string;
  /** `YYYY-MM-DD`, UTC, from `received_at`. */
  day: string;
  /** The day contained at least one eligible portal session. */
  eligible: boolean;
  /** The day contained at least one meaningful action. */
  meaningful: boolean;
};

export type HorizonResult = {
  horizon: RetentionHorizon;
  /** Any eligible return. The primary definition. */
  returned: MetricValue;
  /** Returned and did something. The secondary, never conflated with the above. */
  returnedMeaningfully: MetricValue;
  cohortSize: number;
  /** Cohorts too young for this horizon, excluded rather than counted as churn. */
  immatureUsers: number;
};

export type RetentionReport = {
  horizons: HorizonResult[];
  anonymous: MetricValue;
  /** First day telemetry exists at all. Everything before it is unknowable. */
  telemetryStartedOn: string | null;
  totalAuthenticatedUsers: number;
};

export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

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

export function cohortRetention(
  userDays: readonly UserDay[],
  options: {
    today: Date;
    /** The first day any telemetry exists. Before it, nothing is knowable. */
    telemetryStartedOn: string | null;
    minimumCohort: number;
    provenance: (metricId: string) => MetricProvenance;
    state: NumericState;
  }
): RetentionReport {
  const { today, telemetryStartedOn, minimumCohort, provenance, state } = options;
  const todayKey = dayKey(today);

  /* One entry per user: their first day, and every day they came back. */
  const byUser = new Map<string, { firstDay: string; days: Map<string, UserDay> }>();

  for (const row of userDays) {
    if (!row.userKeyHash) continue;
    const existing = byUser.get(row.userKeyHash);

    if (!existing) {
      byUser.set(row.userKeyHash, { firstDay: row.day, days: new Map([[row.day, row]]) });
      continue;
    }

    if (row.day < existing.firstDay) existing.firstDay = row.day;

    // A day can appear twice if the aggregation was not exact; merging keeps
    // the stronger signal rather than whichever row happened to arrive last.
    const prior = existing.days.get(row.day);
    existing.days.set(
      row.day,
      prior
        ? { ...row, eligible: prior.eligible || row.eligible, meaningful: prior.meaningful || row.meaningful }
        : row
    );
  }

  const horizons = RETENTION_HORIZONS.map((horizon) => {
    let cohortSize = 0;
    let returned = 0;
    let returnedMeaningfully = 0;
    let immature = 0;

    for (const { firstDay, days } of byUser.values()) {
      /*
       * Maturity, twice over. The cohort has to be old enough for the window to
       * have passed, and telemetry has to have existed for that whole window —
       * a user whose first day was the day collection began cannot be shown to
       * have churned over a period nobody was watching.
       */
      const windowEnds = addDays(firstDay, horizon);
      if (daysBetween(windowEnds, todayKey) < 0) {
        immature += 1;
        continue;
      }
      if (telemetryStartedOn && daysBetween(telemetryStartedOn, firstDay) < 0) {
        immature += 1;
        continue;
      }

      cohortSize += 1;

      let came = false;
      let acted = false;

      for (const [day, row] of days) {
        const offset = daysBetween(firstDay, day);
        if (offset < 1 || offset > horizon) continue;
        if (row.eligible) came = true;
        if (row.meaningful) acted = true;
      }

      if (came) returned += 1;
      if (acted) returnedMeaningfully += 1;
    }

    return {
      horizon,
      returned: rate(returned, cohortSize, provenance(`retention_d${horizon}`), {
        threshold: minimumCohort,
        state,
      }),
      returnedMeaningfully: rate(
        returnedMeaningfully,
        cohortSize,
        provenance(`retention_d${horizon}_meaningful`),
        { threshold: minimumCohort, state }
      ),
      cohortSize,
      immatureUsers: immature,
    };
  });

  return {
    horizons,
    anonymous: notMeasurable(
      'the portal has no cross-session anonymous identity — the only anonymous key it has is a day-scoped HMAC of an IP address used to rate-limit Voyager, and reusing it would turn a rate limiter into a behavioural history',
      'a consent surface, a first-party analytics cookie with a stated lifetime, and a privacy review',
      provenance('retention_anonymous')
    ),
    telemetryStartedOn,
    totalAuthenticatedUsers: byUser.size,
  };
}
