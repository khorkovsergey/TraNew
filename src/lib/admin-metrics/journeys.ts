/**
 * The journey layer — what explains PMCR rather than what PMCR is.
 *
 * Pure, and aggregate only. There is no function here that can return a session
 * or a person: every export takes a list of sessions and returns counts by
 * category, and small categories are suppressed rather than shown. A dashboard
 * that can answer "which sessions" is a behavioural inspection tool, and this
 * product's own privacy contract rules one out.
 *
 * The suppression rule matters more than it looks. A breakdown by landing
 * surface, entitlement and acquisition, sliced far enough, eventually describes
 * one person — the classic re-identification path — and a threshold applied at
 * the point of aggregation is the only place it can be enforced once for
 * everything.
 */

import { eligibleOnly, type SessionFacts } from './sessions';

/** Below this, a row reports its count as suppressed rather than its rate. */
export const MIN_BREAKDOWN_COHORT = 25;

export type BreakdownRow = {
  key: string;
  sessions: number;
  continued: number;
  /** null when the row is below the threshold — never a rate on four sessions. */
  rate: number | null;
  suppressed: boolean;
};

function breakdown(
  facts: readonly SessionFacts[],
  keyOf: (session: SessionFacts) => string,
  minimum: number
): BreakdownRow[] {
  const groups = new Map<string, { sessions: number; continued: number }>();

  for (const session of facts) {
    const key = keyOf(session) || 'unknown';
    const bucket = groups.get(key) ?? { sessions: 0, continued: 0 };
    bucket.sessions += 1;
    if (session.actions.length > 0) bucket.continued += 1;
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, bucket]) => ({
      key,
      sessions: bucket.sessions,
      continued: bucket.continued,
      rate: bucket.sessions >= minimum ? bucket.continued / bucket.sessions : null,
      suppressed: bucket.sessions < minimum,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export type JourneyReport = {
  byLandingSurface: BreakdownRow[];
  byAcquisition: BreakdownRow[];
  byAuthState: BreakdownRow[];
  byEntitlement: BreakdownRow[];
  byDevice: BreakdownRow[];
  /** Which action people take first, among sessions that took one. */
  firstAction: Array<{ event: string; sessions: number; share: number | null; suppressed: boolean }>;
  /** Where the first meaningful action happened. */
  firstContinuationSurface: BreakdownRow[];
  internalVsExternal: { internalOnly: number; externalOnly: number; both: number; neither: number };
  exclusions: Record<string, number>;
  eligibleSessions: number;
  minimumCohort: number;
};

export function journeyReport(
  facts: readonly SessionFacts[],
  exclusions: Record<string, number>,
  minimum: number = MIN_BREAKDOWN_COHORT
): JourneyReport {
  const eligible = eligibleOnly(facts);
  const acted = eligible.filter((session) => session.actions.length > 0);

  const firstActionCounts = new Map<string, number>();
  for (const session of acted) {
    const name = session.actions[0].eventName;
    firstActionCounts.set(name, (firstActionCounts.get(name) ?? 0) + 1);
  }

  return {
    byLandingSurface: breakdown(eligible, (session) => session.landingSurface, minimum),
    byAcquisition: breakdown(eligible, (session) => session.acquisition, minimum),
    byAuthState: breakdown(eligible, (session) => session.authState, minimum),
    /*
     * Entitlement is only known for signed-in sessions, and `unknown` here means
     * anonymous rather than a missing value. Kept as its own bucket so nobody
     * reads it as a plan.
     */
    byEntitlement: breakdown(eligible, (session) => session.entitlement ?? 'anonymous', minimum),
    byDevice: breakdown(eligible, (session) => session.device, minimum),

    firstAction: [...firstActionCounts.entries()]
      .map(([event, sessions]) => ({
        event,
        sessions,
        share: acted.length >= minimum ? sessions / acted.length : null,
        suppressed: acted.length < minimum,
      }))
      .sort((a, b) => b.sessions - a.sessions),

    firstContinuationSurface: breakdown(acted, (session) => session.actions[0].surface, minimum),

    internalVsExternal: {
      internalOnly: eligible.filter((s) => s.internalActions > 0 && s.externalActions === 0).length,
      externalOnly: eligible.filter((s) => s.externalActions > 0 && s.internalActions === 0).length,
      both: eligible.filter((s) => s.internalActions > 0 && s.externalActions > 0).length,
      neither: eligible.filter((s) => s.actions.length === 0).length,
    },

    /*
     * Reported rather than hidden. A denominator that shrank by two thirds is
     * something a reader must be able to see, or PMCR becomes a rate over a
     * population nobody can describe.
     */
    exclusions,
    eligibleSessions: eligible.length,
    minimumCohort: minimum,
  };
}
