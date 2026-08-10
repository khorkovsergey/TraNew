/**
 * Ingest validation, as arithmetic over the registry.
 *
 * Import-free next to `registry.ts`, for the same reason `lib/voyager/quota.ts`
 * is: this is the rule that decides what the portal is allowed to store about
 * the people using it, and it has to be exhaustively checkable without a
 * database, a browser or a network.
 *
 * The posture is allowlist, not sanitisation. Nothing here trims, coerces or
 * repairs a payload — an event that does not match its registry entry is
 * rejected whole. A validator that quietly fixes input is a validator whose
 * output nobody can describe, and the point of this layer is that every stored
 * row can be traced to a declared shape.
 */

import {
  EVENT_BY_NAME,
  FORBIDDEN_PROPERTY_NAMES,
  TOKEN_PATTERN,
  type EventDefinition,
  type EventKind,
  type PropertySpec,
} from './registry';

/**
 * Which kinds each entry point may accept.
 *
 * Two lists rather than one because they are opposite trust boundaries, not a
 * setting. A browser may never post a `server` event — it cannot observe what
 * one describes, so anything claiming to be one is forged. And the server
 * tracker may never write a `client` event, or a feature could manufacture an
 * interaction that nobody had.
 */
export const CLIENT_KINDS: readonly EventKind[] = ['client'];
export const SERVER_KINDS: readonly EventKind[] = ['server', 'operational'];

/* ----------------------------------------------------------------- Limits */

export const LIMITS = {
  /** Events per POST. A page hide flushes at most this many. */
  maxBatch: 50,
  /** Bytes per POST body. Comfortably above a full batch of the widest event. */
  maxBytes: 32_768,
  /**
   * How far a client clock may disagree with the server before the timestamp is
   * refused. Clock skew is ordinary; an hour of it is a replay or a bug, and
   * either way `occurred_at` would poison every funnel it appears in.
   */
  maxFutureSkewMs: 60_000,
  maxAgeMs: 6 * 60 * 60 * 1000,
} as const;

/* ------------------------------------------------------------- Rejections */

export type RejectionReason =
  | 'unknown_event'
  | 'unknown_property'
  | 'bad_property_value'
  | 'batch_too_large'
  | 'payload_too_large'
  | 'bad_timestamp'
  | 'legacy_event'
  | 'malformed';

export type Rejected = { ok: false; reason: RejectionReason; detail: string };

export type Accepted = {
  ok: true;
  name: string;
  definition: EventDefinition;
  properties: Record<string, string | number | boolean>;
  occurredAt: Date;
};

export type ValidationResult = Accepted | Rejected;

function reject(reason: RejectionReason, detail: string): Rejected {
  return { ok: false, reason, detail };
}

/* ------------------------------------------------------- Property checking */

export function checkProperty(spec: PropertySpec, value: unknown): string | null {
  switch (spec.kind) {
    case 'boolean':
      return typeof value === 'boolean' ? null : 'expected a boolean';

    case 'integer':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'expected a finite number';
      if (!Number.isInteger(value)) return 'expected an integer';
      if (value < spec.min || value > spec.max) return `outside ${spec.min}..${spec.max}`;
      return null;

    case 'enum':
      if (typeof value !== 'string') return 'expected a string';
      return spec.values.includes(value) ? null : `not one of ${spec.values.join('|')}`;

    case 'token':
      if (typeof value !== 'string') return 'expected a string';
      if (value.length === 0) return 'empty';
      if (value.length > spec.maxLength) return `longer than ${spec.maxLength}`;
      /*
       * The pattern is what stops a token being used as a smuggling route for
       * prose. It admits identifiers, slugs and comma-joined id lists, and
       * rejects spaces — which is the cheapest reliable separator between "an
       * id" and "something somebody typed".
       */
      return TOKEN_PATTERN.test(value) ? null : 'not an identifier';
  }
}

/* ------------------------------------------------------------ One event */

export type RawEvent = {
  name?: unknown;
  occurredAt?: unknown;
  properties?: unknown;
  schemaVersion?: unknown;
};

/**
 * One validator, both directions.
 *
 * `allowedKinds` is the only thing that differs between the browser posting an
 * event and the server recording one. Everything else — the allowlist, the
 * property contract, the token pattern, the forbidden names, the timestamp
 * window — is identical, and identical because it is literally the same code.
 *
 * That parameter is why this function is shaped this way rather than copied.
 * The server tracker originally checked only that an event existed and was of a
 * server kind, and passed its properties through unread; a feature-local call
 * site could then have written `{ prompt: '…' }` into the table, and the
 * registry's inability to *declare* free text would not have stopped it,
 * because nothing was consulting the registry. A second server-side schema
 * would have had the same failure mode one refactor later.
 */
export function validateEvent(
  raw: RawEvent,
  now: Date,
  allowedKinds: readonly EventKind[] = CLIENT_KINDS
): ValidationResult {
  if (!raw || typeof raw !== 'object') return reject('malformed', 'not an object');

  const { name } = raw;
  if (typeof name !== 'string' || !name) return reject('malformed', 'missing event name');

  const definition = EVENT_BY_NAME.get(name);
  if (!definition) return reject('unknown_event', name);

  /*
   * A legacy event arriving is not a validation failure in the ordinary sense —
   * it means something nobody expected is still emitting, which is worth
   * knowing. It gets its own reason rather than being lumped in with an
   * unknown name, and it is refused so it cannot land in a current funnel.
   */
  if (definition.lifecycle === 'legacy') return reject('legacy_event', name);

  if (!allowedKinds.includes(definition.kind)) {
    /*
     * Refused in both directions. A browser posting a `server` event would be
     * forging an outcome it cannot observe; the server tracker writing a
     * `client` event would be manufacturing an interaction nobody had.
     */
    return reject('unknown_event', `${name} is ${definition.kind}, not ${allowedKinds.join('|')}`);
  }

  const occurredAt = readTimestamp(raw.occurredAt, now);
  if (!occurredAt) return reject('bad_timestamp', String(raw.occurredAt));

  if (raw.schemaVersion !== undefined && raw.schemaVersion !== definition.schemaVersion) {
    return reject('malformed', `schema version ${String(raw.schemaVersion)}`);
  }

  const properties = raw.properties ?? {};
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
    return reject('malformed', 'properties is not an object');
  }

  const declared = definition.properties;
  const supplied = properties as Record<string, unknown>;
  const clean: Record<string, string | number | boolean> = {};

  for (const key of Object.keys(supplied)) {
    const spec = declared[key];
    if (!spec) return reject('unknown_property', `${name}.${key}`);

    const problem = checkProperty(spec, supplied[key]);
    if (problem) return reject('bad_property_value', `${name}.${key}: ${problem}`);

    clean[key] = supplied[key] as string | number | boolean;
  }

  for (const key of Object.keys(declared)) {
    if (!(key in supplied)) return reject('malformed', `${name} is missing ${key}`);
  }

  return { ok: true, name, definition, properties: clean, occurredAt };
}

function readTimestamp(value: unknown, now: Date): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;

  const skew = time - now.getTime();
  if (skew > LIMITS.maxFutureSkewMs) return null;
  if (-skew > LIMITS.maxAgeMs) return null;

  return parsed;
}

/* --------------------------------------------------------------- A batch */

export type BatchResult = {
  accepted: Accepted[];
  rejected: Array<{ name: string; reason: RejectionReason; detail: string }>;
};

/**
 * Validates a batch, keeping the good events and reporting the bad ones.
 *
 * Partial acceptance is deliberate. One malformed event in a batch of thirty
 * must not discard the other twenty-nine — the browser cannot retry
 * selectively, and losing a whole flush because one emitter has a bug is how a
 * dashboard develops holes that look like user behaviour.
 */
export function validateBatch(rawEvents: unknown, now: Date): BatchResult | Rejected {
  if (!Array.isArray(rawEvents)) return reject('malformed', 'events is not an array');
  if (rawEvents.length === 0) return reject('malformed', 'empty batch');
  if (rawEvents.length > LIMITS.maxBatch) {
    return reject('batch_too_large', `${rawEvents.length} > ${LIMITS.maxBatch}`);
  }

  const accepted: Accepted[] = [];
  const rejected: BatchResult['rejected'] = [];

  for (const raw of rawEvents) {
    const result = validateEvent(raw as RawEvent, now);
    if (result.ok) accepted.push(result);
    else {
      const named = raw && typeof raw === 'object' ? (raw as RawEvent).name : undefined;
      rejected.push({
        name: typeof named === 'string' ? named.slice(0, 64) : 'unnamed',
        reason: result.reason,
        detail: result.detail,
      });
    }
  }

  return { accepted, rejected };
}

/* ------------------------------------------------------- The last line */

/**
 * Whether a row about to be written matches its declared shape.
 *
 * Defence in depth, checked at the point of persistence rather than at either
 * entry point. Both callers validate before they get here and this should never
 * fail — which is exactly the argument for having it: the guarantee becomes a
 * property of the table rather than a property of everybody who ever writes to
 * it. A call site added in two years' time that assembles a row by hand cannot
 * put an undeclared field in the database, whatever it forgot to call.
 *
 * Deliberately a predicate rather than a sanitiser. Dropping the row loses one
 * event; silently stripping a field would leave a row that looks complete and
 * is not, which is worse in a table people will draw conclusions from.
 */
export function conformsToRegistry(
  eventName: string,
  properties: Record<string, unknown>
): boolean {
  const definition = EVENT_BY_NAME.get(eventName);
  if (!definition) return false;

  for (const [key, value] of Object.entries(properties)) {
    const spec = definition.properties[key];
    if (!spec) return false;
    if (checkProperty(spec, value)) return false;
  }

  return true;
}

/* ------------------------------------------------- The registry's own audit */

/**
 * The privacy invariant, checked against the registry itself rather than
 * against any particular payload.
 *
 * Two locks. The kind system already makes free text unrepresentable — there is
 * no string spec without either a closed set or a bounded identifier pattern —
 * and this adds the name check, because a field can be a perfectly well-formed
 * token and still be the wrong thing to keep. `email` is short. An IP address
 * matches the token pattern. A ticker is a position somebody may hold.
 *
 * Run by the verification suite over every declared event, so adding an unsafe
 * field fails the build rather than a review.
 */
export function auditRegistry(
  definitions: readonly EventDefinition[]
): Array<{ event: string; property: string; problem: string }> {
  const problems: Array<{ event: string; property: string; problem: string }> = [];
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (seen.has(definition.name)) {
      problems.push({ event: definition.name, property: '—', problem: 'duplicate event name' });
    }
    seen.add(definition.name);

    for (const [key, spec] of Object.entries(definition.properties)) {
      const normalised = key.toLowerCase().replace(/[^a-z]/g, '');

      if ((FORBIDDEN_PROPERTY_NAMES as readonly string[]).includes(normalised)) {
        problems.push({ event: definition.name, property: key, problem: 'forbidden property name' });
      }

      if (spec.kind === 'token' && spec.maxLength > 128) {
        problems.push({
          event: definition.name,
          property: key,
          problem: `token bound of ${spec.maxLength} is wide enough for prose`,
        });
      }

      if (spec.kind === 'enum' && spec.values.length === 0) {
        problems.push({ event: definition.name, property: key, problem: 'empty enum accepts nothing' });
      }
    }
  }

  return problems;
}
