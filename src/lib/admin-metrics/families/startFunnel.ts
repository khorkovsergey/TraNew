/**
 * The "Find my next step" funnel, computed per session and in order.
 *
 * Import-free, so every rule is checkable with fixtures.
 *
 * ## Why sequence rather than totals
 *
 * The naive version divides one event total by another. That is not a funnel:
 * it assumes the events happened in the order the diagram draws them, and the
 * assumption is false often enough to matter. A session that restarted emits
 * `next_step_opened` twice. A session that arrived on a deep link may emit a
 * recommendation with no level selection before it. Dividing totals turns both
 * into rates above 100% or below the truth, and neither is visible in the
 * result.
 *
 * So a step counts for a session only when the step before it happened **in
 * that session, earlier**. Duplicates within a session collapse to the first
 * occurrence, so a component that re-fires cannot inflate a stage.
 *
 * ## Clarification is optional and stays optional
 *
 * Not every route asks a clarifying question. Making
 * `next_step_clarification_selected` a mandatory stage would report every
 * unambiguous path as a drop-off, which is the opposite of what happened. It is
 * measured as a share of sessions that reached the recommendation, and it is
 * never a denominator.
 */

export const START_EVENTS = [
  'next_step_opened',
  'next_step_level_selected',
  'next_step_intent_selected',
  'next_step_clarification_selected',
  'next_step_recommendation_shown',
  'next_step_destination_clicked',
  'next_step_restarted',
] as const;

/** The mandatory chain, in order. Clarification is deliberately absent. */
export const START_STAGES = [
  'opened',
  'level_selected',
  'intent_selected',
  'recommendation_shown',
  'destination_clicked',
] as const;

export type StartStage = (typeof START_STAGES)[number];

const EVENT_OF_STAGE: Record<StartStage, string> = {
  opened: 'next_step_opened',
  level_selected: 'next_step_level_selected',
  intent_selected: 'next_step_intent_selected',
  recommendation_shown: 'next_step_recommendation_shown',
  destination_clicked: 'next_step_destination_clicked',
};

export type StartPoint = {
  sessionId: string;
  eventName: string;
  occurredAt: number;
  properties: Record<string, unknown>;
};

/* ------------------------------------------------- The generic, for reuse */

export type SequentialStage = { stage: string; sessions: number; ofPrevious: number | null; ofFirst: number | null };

/**
 * A funnel over any ordered chain of event names.
 *
 * Extracted so the Events discovery funnel does not grow a second, subtly
 * different implementation of "did this happen after that". The rule is the one
 * described above: a stage counts for a session only when every earlier stage
 * happened in that session, no later than it.
 */
export function sequentialFunnel(
  points: readonly StartPoint[],
  chain: readonly string[],
  minimum: number
): { stages: SequentialStage[]; sessionsSeen: number } {
  const bySession = new Map<string, StartPoint[]>();
  for (const point of points) {
    const bucket = bySession.get(point.sessionId);
    if (bucket) bucket.push(point);
    else bySession.set(point.sessionId, [point]);
  }

  const reached = chain.map(() => 0);

  for (const events of bySession.values()) {
    const firstAt = new Map<string, number>();
    for (const event of [...events].sort((a, b) => a.occurredAt - b.occurredAt)) {
      if (!firstAt.has(event.eventName)) firstAt.set(event.eventName, event.occurredAt);
    }

    let previousAt: number | null = null;
    for (let index = 0; index < chain.length; index += 1) {
      const at = firstAt.get(chain[index]);
      if (at === undefined) break;
      if (previousAt !== null && at < previousAt) break;
      reached[index] += 1;
      previousAt = at;
    }
  }

  const first = reached[0] ?? 0;
  const share = (numerator: number, denominator: number) =>
    denominator >= minimum && denominator > 0 ? numerator / denominator : null;

  return {
    stages: chain.map((stage, index) => ({
      stage,
      sessions: reached[index],
      ofPrevious: index === 0 ? null : share(reached[index], reached[index - 1]),
      ofFirst: index === 0 ? null : share(reached[index], first),
    })),
    sessionsSeen: bySession.size,
  };
}

export type StartFunnel = {
  /** One entry per stage, each a subset of the one before it. */
  stages: Array<{ stage: StartStage; sessions: number; ofPrevious: number | null; ofStarts: number | null }>;
  /** Sessions that reached the recommendation and were asked to clarify. */
  clarificationShare: number | null;
  clarifiedSessions: number;
  restartedSessions: number;
  restartShare: number | null;
  /** Where people were sent, and whether it kept them in the portal. */
  destinations: Array<{ destination: string; sessions: number; external: number }>;
  internalClicks: number;
  externalClicks: number;
  sessionsSeen: number;
};

/**
 * Reduces raw Start telemetry to a funnel.
 *
 * `minimum` guards the ratios only: a stage still reports its absolute count
 * below it, because a count of four is a fact and "4 out of 6 (67%)" is a claim.
 */
export function startFunnel(points: readonly StartPoint[], minimum: number): StartFunnel {
  const bySession = new Map<string, StartPoint[]>();

  for (const point of points) {
    const bucket = bySession.get(point.sessionId);
    if (bucket) bucket.push(point);
    else bySession.set(point.sessionId, [point]);
  }

  let clarified = 0;
  let restarted = 0;
  let internalClicks = 0;
  let externalClicks = 0;

  const reached: Record<StartStage, number> = {
    opened: 0,
    level_selected: 0,
    intent_selected: 0,
    recommendation_shown: 0,
    destination_clicked: 0,
  };

  const destinations = new Map<string, { sessions: number; external: number }>();

  for (const events of bySession.values()) {
    const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt);

    /* The first time each stage's event appears. Later repeats are the same stage. */
    const firstAt = new Map<string, number>();
    for (const event of ordered) {
      if (!firstAt.has(event.eventName)) firstAt.set(event.eventName, event.occurredAt);
    }

    /*
     * Walk the chain. `previousAt` is the time the last satisfied stage
     * happened; a stage counts only if its own event happened at or after it.
     * Equal timestamps are allowed — two steps inside one tick of the clock are
     * a fast click, not a violation.
     */
    let previousAt: number | null = null;

    /*
     * Session-local, and it has to be. An earlier version asked
     * `reached.recommendation_shown > 0`, which is the count across *every*
     * session — so once one session had legitimately reached a recommendation,
     * any other session that emitted a clarification counted too, whether or
     * not it had walked the chain. A funnel described as sequential within a
     * session was consulting a global.
     */
    const stagesReachedHere = new Set<StartStage>();

    for (const stage of START_STAGES) {
      const at = firstAt.get(EVENT_OF_STAGE[stage]);
      if (at === undefined) break;
      if (previousAt !== null && at < previousAt) break;

      reached[stage] += 1;
      stagesReachedHere.add(stage);
      previousAt = at;
    }

    /*
     * A clarification counts when this session earned it: it reached the
     * recommendation through the mandatory chain, and the clarification sits
     * where the router would have asked it — after the intent it clarifies and
     * no later than the recommendation it shaped.
     *
     * `firstAt` already collapses repeats, so a session that emitted three
     * clarifications is one clarified session.
     */
    if (stagesReachedHere.has('recommendation_shown')) {
      const clarifiedAt = firstAt.get('next_step_clarification_selected');
      const intentAt = firstAt.get('next_step_intent_selected');
      const recommendationAt = firstAt.get('next_step_recommendation_shown');

      if (
        clarifiedAt !== undefined &&
        intentAt !== undefined &&
        recommendationAt !== undefined &&
        clarifiedAt >= intentAt &&
        clarifiedAt <= recommendationAt
      ) {
        clarified += 1;
      }
    }

    if (firstAt.has('next_step_restarted')) restarted += 1;

    /*
     * Destinations come from the click, not the recommendation: what was
     * offered and what was taken are different facts, and only one of them is a
     * continuation. Counted once per session per destination, so a session that
     * clicked the same card twice is one journey.
     */
    const seenDestinations = new Set<string>();
    for (const event of ordered) {
      if (event.eventName !== 'next_step_destination_clicked') continue;

      const destination = String(event.properties.destination ?? 'unknown');
      const external = event.properties.external === true;

      if (external) externalClicks += 1;
      else internalClicks += 1;

      if (seenDestinations.has(destination)) continue;
      seenDestinations.add(destination);

      const bucket = destinations.get(destination) ?? { sessions: 0, external: 0 };
      bucket.sessions += 1;
      if (external) bucket.external += 1;
      destinations.set(destination, bucket);
    }
  }

  const starts = reached.opened;
  const share = (numerator: number, denominator: number): number | null =>
    denominator >= minimum && denominator > 0 ? numerator / denominator : null;

  const stages = START_STAGES.map((stage, index) => {
    const previous = index === 0 ? starts : reached[START_STAGES[index - 1]];
    return {
      stage,
      sessions: reached[stage],
      ofPrevious: index === 0 ? null : share(reached[stage], previous),
      ofStarts: index === 0 ? null : share(reached[stage], starts),
    };
  });

  return {
    stages,
    clarificationShare: share(clarified, reached.recommendation_shown),
    clarifiedSessions: clarified,
    restartedSessions: restarted,
    restartShare: share(restarted, starts),
    destinations: [...destinations.entries()]
      .map(([destination, bucket]) => ({ destination, ...bucket }))
      .sort((a, b) => b.sessions - a.sessions),
    internalClicks,
    externalClicks,
    sessionsSeen: bySession.size,
  };
}
