/**
 * The meaningful-action taxonomy, made executable.
 *
 * Phase 1 put `meaningful` and `continuation` on registry entries. This turns
 * those flags into the two things a metric query actually needs: whether an
 * event counts, and whether two events are the *same* action.
 *
 * Import-free apart from the registry, so every rule below is checkable by the
 * harness without a database.
 *
 * The discipline that matters more than the code: **an event is not promoted to
 * meaningful because a metric wants volume.** PMCR is allowed to be low. A
 * denominator inflated by page views, or a numerator inflated by clicks, would
 * make it a number that goes up when nothing improves — which is the failure
 * mode the whole Observatory exists to avoid.
 */

import { EVENT_BY_NAME, EVENT_REGISTRY, type EventDefinition } from '@/lib/analytics/registry';

export const MEANINGFUL_EVENTS: readonly string[] = EVENT_REGISTRY.filter(
  (definition) => definition.meaningful === true && definition.lifecycle === 'current'
).map((definition) => definition.name);

export const EXTERNAL_CONTINUATION_EVENTS: readonly string[] = EVENT_REGISTRY.filter(
  (definition) => definition.continuation === 'external' && definition.lifecycle === 'current'
).map((definition) => definition.name);

const MEANINGFUL = new Set(MEANINGFUL_EVENTS);
const EXTERNAL = new Set(EXTERNAL_CONTINUATION_EVENTS);

export function isMeaningful(eventName: string): boolean {
  return MEANINGFUL.has(eventName);
}

/**
 * External continuation is continuation, and is never folded into the internal
 * rate.
 *
 * A TradingView handoff is a product boundary the portal chose to have, not a
 * failure — but a session that left is not a session that stayed, and a
 * headline that quietly mixed them would hide whichever one moved.
 */
export function isExternalContinuation(eventName: string): boolean {
  return EXTERNAL.has(eventName);
}

/**
 * The identity of an action, for deciding whether two events are one action.
 *
 * Built from the event's *identifying* properties — its tokens and enums — and
 * never from its counts or booleans, because a count is a measurement of the
 * action rather than a part of what it was. Saving event `x` twice is one save.
 * Toggling study `rsi` on, off and on again is one study interaction, not three.
 *
 * Events marked `repeatable` opt out, because for them repetition genuinely is
 * more value: a second Voyager question is a second question, and a second
 * drawing is a second drawing. Each occurrence gets a unique identity so none
 * of them collapse.
 *
 * The `ordinal` argument is what makes a repeatable event unique without
 * needing anything from its payload — deliberately, since payloads are shapes
 * and counts and two genuinely distinct questions can look identical here.
 */
export function actionIdentity(
  eventName: string,
  properties: Record<string, unknown>,
  ordinal: number
): string {
  const definition = EVENT_BY_NAME.get(eventName);
  if (!definition) return `${eventName}#${ordinal}`;
  if (definition.repeatable) return `${eventName}#${ordinal}`;

  const parts = identifyingKeys(definition).map((key) => `${key}=${String(properties[key] ?? '')}`);
  return parts.length ? `${eventName}|${parts.join('|')}` : eventName;
}

function identifyingKeys(definition: EventDefinition): string[] {
  return Object.entries(definition.properties)
    .filter(([, spec]) => spec.kind === 'token' || spec.kind === 'enum')
    .map(([key]) => key)
    .sort();
}

/**
 * Whether a metric's inputs are instrumented at all.
 *
 * The question coverage has to be able to answer is "can this number be
 * trusted", and the first way it cannot be is that an event it depends on has
 * no emitter anywhere. Returning the list rather than a boolean lets the
 * dashboard say which one is missing instead of showing a confident zero.
 */
export function requiredEventsPresent(required: readonly string[]): {
  ok: boolean;
  missing: string[];
} {
  const missing = required.filter((name) => !EVENT_BY_NAME.has(name));
  return { ok: missing.length === 0, missing };
}
