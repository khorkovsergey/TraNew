/**
 * The daily question counter, as arithmetic.
 *
 * Import-free on purpose: `usage.ts` next door talks to the database and cannot
 * be compiled by the unit harness, so the rule it follows lives here where it
 * can be checked exhaustively — without a database, and without spending
 * anybody's allowance.
 *
 * The route does not describe this rule separately; it calls it. That is the
 * point. A specification kept beside an implementation is a specification that
 * drifts, and this one guards a number people are charged against.
 */

/**
 * What one request does to the counter, as arithmetic.
 *
 * Extracted so the invariant can be tested without a database and without
 * spending anybody's allowance: **one intentional question moves the counter by
 * exactly one, whatever happens inside it.** The route charges on the way in
 * and gives the charge back in the two cases where nothing was bought — a
 * refusal, and an attempt that produced no answer — and this is that decision,
 * on its own, where it can be checked exhaustively.
 *
 * `tools` is a parameter for one reason: to state that it is not used. A
 * multi-tool answer costs the same as a one-word one, and the test asserts it
 * across the whole range.
 */
export function quotaDelta(outcome: {
  /** The count before the request, as the row stands. */
  before: number;
  quota: number | null;
  /** Whether the model produced an answer. False for an outage or a demo. */
  answered: boolean;
}): { charged: boolean; after: number } {
  const { before, quota, answered } = outcome;

  // Unmetered plans are not counted at all.
  if (quota === null) return { charged: false, after: before };

  // The increment is the check: two requests arriving together must not both
  // read the same count and both pass.
  const incremented = before + 1;

  // Over the ceiling, so refused — and refunded, or the row climbs for as long
  // as somebody keeps asking and every number derived from it becomes fiction.
  if (incremented > quota) return { charged: false, after: before };

  // Nothing was answered, so nothing is charged: the outage card offers a retry
  // button, and charging each attempt is how one question becomes five.
  if (!answered) return { charged: false, after: before };

  return { charged: true, after: incremented };
}
