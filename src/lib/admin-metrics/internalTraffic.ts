import 'server-only';
import { and, eq, inArray, isNull, ne, notExists, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '@/db';
import { pseudonymousUserKey } from '@/lib/analytics/serverIdentity';

/**
 * Who is a customer, and which telemetry is ours.
 *
 * The Observatory answers questions about a customer base. It was answering
 * them about a population that included the people who build the product: an
 * administrator signing in counted as a registered user, their Free plan
 * counted as entitlement adoption, and their afternoon of clicking through the
 * portal counted as sessions, continuation and retention. Every one of those
 * numbers was arithmetically correct and none of them meant what the card said.
 *
 * ## The contract is the role, and only the role
 *
 * `user.role` is `user | moderator | admin`, and the schema is explicit that it
 * is staff authority rather than anything somebody bought. So **only
 * `role = 'user'` is a customer**, and the two other values are internal.
 *
 * Nothing here names an email, an account id or a person. A reset that turned
 * on "the owner's address" would be wrong the first time somebody else joined
 * the team, and it would put an identity into a query layer that has spent
 * three phases keeping identities out.
 *
 * ## Telemetry: derived on the read side, never written down
 *
 * `product_telemetry_event` stores `user_key_hash` — an HMAC of the application
 * user id — and deliberately has no foreign key to `user`. That is the property
 * this file uses rather than the one it breaks: staff ids are read here, on the
 * server, hashed with the *same* `pseudonymousUserKey` the ingest route uses,
 * and the resulting keys are used as a query predicate. No raw id is written to
 * the telemetry table, no raw id reaches a payload, no new identity is minted
 * and no column is added.
 *
 * The exclusion is therefore only as good as the attribution. An event with no
 * `user_key_hash` cannot be attributed to anybody, so it cannot be attributed
 * to staff either — see `docs/admin-metrics/internal-traffic.md` for which
 * families that limits, and note that a signed-out administrator is
 * indistinguishable from a customer by design.
 */

/** The one role that counts as a customer. */
export const CUSTOMER_ROLE = 'user';

/** Everything else. Named for the reset plan, which preserves exactly these. */
export const STAFF_ROLES: readonly string[] = ['admin', 'moderator'];

/**
 * The rule itself, over a role.
 *
 * `customerAccounts()` below is the same statement in SQL, and the verification
 * asserts the rendered predicate compares against this constant — so a change
 * to one without the other fails rather than drifts. Anything that is not
 * `user` is internal, including a role nobody has invented yet: for a number
 * that claims to count customers, that is the safe direction to be wrong in.
 */
export function isCustomerRole(role: string | null | undefined): boolean {
  return role === CUSTOMER_ROLE;
}

/**
 * The customer population, as a predicate.
 *
 * A function rather than a constant so every adapter applies the *same*
 * condition to `user`, and so a reviewer grepping for who defines "customer"
 * finds one answer. `ne(role, 'user')` is its complement everywhere below —
 * written that way rather than `in ('admin','moderator')` so a role added
 * tomorrow is internal until somebody decides otherwise, which is the safe
 * direction for a number that claims to count customers.
 */
export function customerAccounts(): SQL {
  return eq(schema.user.role, CUSTOMER_ROLE);
}

/** The complement: staff accounts, for the reads that are about staff. */
export function staffAccounts(): SQL {
  return ne(schema.user.role, CUSTOMER_ROLE);
}

/**
 * The analytics keys of every non-customer account.
 *
 * Only `id` is selected, and it never leaves this function — what comes back is
 * the same HMAC the ingest route wrote, so the caller compares hashes against
 * hashes and never holds a user id at all.
 *
 * Cheap by construction: `user` is small, this runs once per report, and the
 * result is a handful of 34-character strings.
 */
export async function staffAnalyticsKeys(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(staffAccounts());

  return rows.map((row) => pseudonymousUserKey(row.id));
}

/**
 * Events not attributable to staff.
 *
 * Keeps unattributed rows. An event with no `user_key_hash` is anonymous or
 * operational, and dropping it would silently shrink every denominator it
 * belongs to — a much worse error than including traffic that might be ours.
 */
export function notStaffEvent(keys: readonly string[]): SQL | undefined {
  if (keys.length === 0) return undefined;

  return or(
    isNull(schema.productTelemetryEvent.userKeyHash),
    notInArray(schema.productTelemetryEvent.userKeyHash, [...keys])
  );
}

/**
 * Attributed events belonging to a customer.
 *
 * For queries that already require a key — retention groups by one — where an
 * unattributed row is out of scope before this predicate is reached.
 */
export function customerKeyOnly(keys: readonly string[]): SQL | undefined {
  if (keys.length === 0) return undefined;
  return notInArray(schema.productTelemetryEvent.userKeyHash, [...keys]);
}

/**
 * Sessions in which no event was ever attributed to staff.
 *
 * Session metrics are reduced per session, so filtering *events* would be the
 * wrong shape: an administrator's session would lose its authenticated rows and
 * keep the ones from before they signed in, and what remained would be reduced
 * into a half-session with a landing surface, a missing action and a place in
 * the PMCR denominator. A session is ours or it is not.
 *
 * `not exists` rather than `not in`, so the planner sees an anti-join and so a
 * null session id — which the schema forbids anyway — could never swallow the
 * whole result set the way `not in` does.
 */
export function notStaffSession(keys: readonly string[]): SQL | undefined {
  if (keys.length === 0) return undefined;

  const staff = alias(schema.productTelemetryEvent, 'staff_event');

  return notExists(
    db
      .select({ one: sql`1` })
      .from(staff)
      .where(
        and(
          eq(staff.sessionId, schema.productTelemetryEvent.sessionId),
          inArray(staff.userKeyHash, [...keys])
        )
      )
  );
}

/**
 * The in-memory counterpart, for a read whose rows are already in hand.
 *
 * Reliability fetches Web Vitals, runtime failures and Supercharts activity in
 * one pass, and only the last of those is a customer-adoption question — a
 * crash is a crash whoever hit it. So the staff exclusion is applied to the
 * Supercharts subset here rather than to the query, and the same session rule
 * as `notStaffSession` is used so the two cannot disagree.
 */
export function staffSessionIds(
  rows: ReadonlyArray<{ sessionId: string; userKeyHash: string | null }>,
  keys: readonly string[]
): Set<string> {
  const staff = new Set(keys);
  const sessions = new Set<string>();

  for (const row of rows) {
    if (row.userKeyHash && staff.has(row.userKeyHash)) sessions.add(row.sessionId);
  }

  return sessions;
}
