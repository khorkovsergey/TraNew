/**
 * The status semantics of the durable families, as data.
 *
 * Import-free, so the decisions below can be checked without a database. They
 * are small, and every one of them is a place where a plausible alternative
 * would produce a different number that nobody could tell was wrong.
 */

/* ------------------------------------------------------------------ Events */

/**
 * The statuses that mean a seat is held.
 *
 * `cancelled` is not one: the seat was given back. `waitlisted` is not one
 * either — a waitlisted person never had a seat, and counting them would make a
 * popular event look badly attended precisely because it was popular.
 */
export const SEAT_STATUSES: readonly string[] = ['registered', 'attended', 'no_show'];

/**
 * The statuses where somebody has decided what happened.
 *
 * `registered` is deliberately absent, and this is the correction that matters.
 * A `registered` row means "holds a seat", which covers a talk next month and a
 * talk last week that nobody has marked up yet. Putting it in the denominator
 * makes every future event drag the attendance rate down before attendance is
 * knowable, so a healthy pipeline of upcoming events reads as an attendance
 * problem — and the rate would climb as organisers did their paperwork rather
 * than as more people turned up.
 */
export const ATTENDANCE_RESOLVED_STATUSES: readonly string[] = ['attended', 'no_show'];

export const REGISTRATION_STATUSES: readonly string[] = [
  'registered',
  'waitlisted',
  'cancelled',
  'attended',
  'no_show',
];

function total(counts: Readonly<Record<string, number>>, statuses: readonly string[]): number {
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

/** Seats whose outcome is known. The denominator of the attendance rate. */
export function attendanceResolvedSeats(counts: Readonly<Record<string, number>>): number {
  return total(counts, ATTENDANCE_RESOLVED_STATUSES);
}

/**
 * Seats still waiting for an outcome.
 *
 * Reported beside the rate rather than folded into it. A rate over four
 * resolved seats out of nine hundred held is technically correct and useless,
 * and the only way a reader can tell is if both numbers are on the page.
 */
export function attendanceUnresolvedSeats(counts: Readonly<Record<string, number>>): number {
  return counts.registered ?? 0;
}

/** All seats held, resolved or not. The denominator of marking coverage. */
export function heldSeats(counts: Readonly<Record<string, number>>): number {
  return total(counts, SEAT_STATUSES);
}

/* ----------------------------------------------------------------- Experts */

export const BOOKING_STATUSES: readonly string[] = [
  'draft',
  'slot_held',
  'payment_pending',
  'confirmed',
  'completed',
  'cancelled',
  'refunded',
  'no_show',
  'disputed',
];

/**
 * Bookings still in play.
 *
 * `confirmed` is open because the consultation has not happened yet; `completed`
 * is not, because it has. The point of the set is to have one number that says
 * how much work is outstanding without implying it is a conversion stage.
 */
export const OPEN_BOOKING_STATUSES: readonly string[] = [
  'draft',
  'slot_held',
  'payment_pending',
  'confirmed',
];

export function openPipeline(counts: Readonly<Record<string, number>>): number {
  return OPEN_BOOKING_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

/* ---------------------------------------------------------------- Commerce */

export const PURCHASE_STATUSES: readonly string[] = ['paid', 'pending', 'refunded', 'failed', 'demo'];

/**
 * The statuses that could ever be money, if a provider were connected.
 *
 * `demo` is absent and always will be: the schema comment says it is an
 * entitlement granted without money, and it is a separate status precisely so
 * nothing counting revenue picks it up by accident.
 *
 * `paid` being here does **not** make it revenue. It makes it the only status a
 * future reconciliation would have anything to reconcile.
 */
export const POTENTIALLY_MONETARY_STATUSES: readonly string[] = ['paid'];

export function isRevenueBearing(status: string): boolean {
  return POTENTIALLY_MONETARY_STATUSES.includes(status);
}

/**
 * Whether the application can claim confirmed revenue at all.
 *
 * One reconciled record is not enough on its own to call a total confirmed, but
 * zero is enough to be certain it is not: nothing has ever been checked against
 * a provider. Kept as a function so the answer comes from the data rather than
 * from a constant somebody has to remember to change.
 */
export function revenueIsConfirmable(reconciledRecords: number): boolean {
  return reconciledRecords > 0;
}
