import 'server-only';
import { and, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { PLAN_RANK } from '@/lib/session';
import { customerAccounts, ownedByCustomer } from '../internalTraffic';
import { sourceNotConnected, type MetricValue } from '@/lib/analytics/states';
import { distribution, durableAt, durableCount, newest, pick, type FamilyFacts } from './durable';

/**
 * Commerce — purchases, subscriptions and the one number that stays absent.
 *
 * ## Why `confirmedRevenue` is still `source_not_connected`
 *
 * `purchase.status` distinguishes `demo` from `paid`, and `demo` is documented
 * in the schema as an entitlement granted without money precisely so nothing
 * counting revenue picks it up by accident. That protection is necessary and it
 * is not sufficient.
 *
 * The remaining problem is that a `paid` row is an **application record**, not a
 * provider-confirmed transaction. No reconciliation runs anywhere in this
 * repository. Summing `amount_cents` where status is `paid` would produce a
 * number that looks like revenue, would be quoted as revenue, and would be
 * whatever the application happened to write.
 *
 * So the sum is reported — under a name that says what it is — and confirmed
 * revenue stays absent with the missing source named. The two are different
 * claims and the dashboard makes exactly one of them.
 *
 * ## What `externalRef` actually contains, and what it was being called
 *
 * The schema calls `external_ref` a "provider reference for reconciliation",
 * and this family read `count(external_ref)` and published it under a name that
 * repeated the claim. Production says otherwise: **16 rows carry an
 * `externalRef` and none of them is `paid`.**
 *
 * They are all `demo`, and the writers say why. `lib/academy/enrolment.ts`
 * writes the **course slug** into it; `lib/chartMarket/purchases.ts` writes the
 * **script product id**. Both are internal catalogue identifiers on an
 * entitlement granted without money. Not one of them has been near a payment
 * provider.
 *
 * So the column is a nullable free-form reference that the application uses for
 * whatever it likes, and its presence proves exactly one thing: **a reference
 * exists**. It does not prove reconciliation, provider confirmation, payment or
 * revenue. The metric is named for what it counts —
 * `purchaseRecordsWithExternalRef` — and no wording anywhere in this family, in
 * the conclusions, in the dictionary or on the page turns a non-null column
 * into a settled transaction.
 *
 * The schema comment is another section's file and is left alone; it is
 * reported to the orchestrator instead.
 *
 * ## Plans are read, never listed
 *
 * The entitlement vocabulary comes from `PLAN_RANK` at runtime. Writing the
 * plan names here would be a second source of truth about what the product
 * sells, and this file would be the last place anybody thought to update.
 *
 * ## Whose commerce
 *
 * Everything in this family is **customer** commercial activity: entitlements,
 * purchases and subscriptions alike are scoped to `role = 'user'`.
 *
 * Entitlements were the obvious case — staff accounts carry a `plan` like
 * everybody else, because the entitlement check has no special case for them,
 * and an administrator on Free or Private appeared in the adoption chart as
 * though somebody had chosen it.
 *
 * Purchases and subscriptions were left whole in the first pass, on the
 * argument that a money record is not a population. That was the wrong call for
 * this dashboard. The Observatory's monetization section is read as *what
 * customers bought*, and the owner is going to keep granting himself demo
 * entitlements to show the flow working — so an admin's test purchase would
 * have been monetization, permanently, whatever the reset did. They are scoped
 * now, and the limitation says so rather than leaving a reader to guess which
 * population a figure describes.
 *
 * Nothing is reconciled across the boundary. `purchaseRecordsWithExternalRef`
 * counts a column **within the customer population**, and there is no
 * all-account provider total anywhere to subtract it from — if one ever
 * arrives, it must be compared against an all-account count, exactly as the
 * Events seat counter is.
 */
export async function commerceFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const purchases = durableAt('purchase', generatedAt);
  const subscriptions = durableAt('subscription', generatedAt);
  const users = durableAt('user', generatedAt);

  const customerPurchase = ownedByCustomer(schema.purchase.userId);
  const customerSubscription = ownedByCustomer(schema.subscription.userId);

  const statusRows = await db
    .select({ key: schema.purchase.status, count: sql<number>`count(*)::int` })
    .from(schema.purchase)
    .where(customerPurchase)
    .groupBy(schema.purchase.status);

  const kindRows = await db
    .select({ key: schema.purchase.kind, count: sql<number>`count(*)::int` })
    .from(schema.purchase)
    .where(customerPurchase)
    .groupBy(schema.purchase.kind);

  const [purchaseTotals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${schema.purchase.userId})::int`,
      /* Named for what it is: the sum of rows the application marked paid. */
      paidCents: sql<number>`coalesce(sum(${schema.purchase.amountCents}) filter (where ${schema.purchase.status} = 'paid'), 0)::int`,
      demoCents: sql<number>`coalesce(sum(${schema.purchase.amountCents}) filter (where ${schema.purchase.status} = 'demo'), 0)::int`,
      /*
       * A non-null column, and nothing more. In production every row carrying
       * one is a `demo` entitlement whose reference is a course slug or a
       * script product id — see the header.
       */
      withExternalRef: sql<number>`count(${schema.purchase.externalRef})::int`,
      newest: sql<Date | null>`max(${schema.purchase.purchasedAt})`,
    })
    .from(schema.purchase)
    .where(customerPurchase);

  const [purchasesInWindow] = await db
    .select({ records: sql<number>`count(*)::int` })
    .from(schema.purchase)
    .where(and(customerPurchase, gte(schema.purchase.purchasedAt, since)));

  const subscriptionStatusRows = await db
    .select({ key: schema.subscription.status, count: sql<number>`count(*)::int` })
    .from(schema.subscription)
    .where(customerSubscription)
    .groupBy(schema.subscription.status);

  const subscriptionPlanRows = await db
    .select({ key: schema.subscription.plan, count: sql<number>`count(*)::int` })
    .from(schema.subscription)
    .where(customerSubscription)
    .groupBy(schema.subscription.plan);

  const [subscriptionTotals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${schema.subscription.userId})::int`,
      withExternalRef: sql<number>`count(${schema.subscription.externalRef})::int`,
      newest: sql<Date | null>`max(${schema.subscription.startedAt})`,
    })
    .from(schema.subscription)
    .where(customerSubscription);

  const entitlementRows = await db
    .select({ key: schema.user.plan, count: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(customerAccounts())
    .groupBy(schema.user.plan);

  const status = distribution(statusRows);
  const subscriptionStatus = distribution(subscriptionStatusRows);

  /*
   * Read from the server model rather than written down. A plan the entitlement
   * layer does not know about is surfaced as `unrecognised` instead of being
   * silently charted beside the real ones.
   */
  const knownPlans = new Set(Object.keys(PLAN_RANK));
  const entitlement = distribution(entitlementRows).map((row) => ({
    ...row,
    key: knownPlans.has(row.key) ? row.key : `${row.key} (unrecognised)`,
  }));

  const confirmedRevenue: MetricValue = sourceNotConnected('payment provider reconciliation', {
    metricId: 'confirmed_revenue',
    source: 'purchase',
    sourceType: 'source_not_connected',
    queriedAt: generatedAt,
  });

  return {
    family: 'commerce',
    sources: ['purchase', 'subscription', 'user'],
    generatedAt,
    freshestAt: newest(purchaseTotals?.newest, subscriptionTotals?.newest),
    metrics: {
      confirmedRevenue,

      purchaseRecords: durableCount(purchaseTotals?.records ?? 0, purchases, 'commerce_purchase_records'),
      purchaseRecordsInWindow: durableCount(purchasesInWindow?.records ?? 0, purchases, 'commerce_purchases_window'),
      peopleWithPurchase: durableCount(purchaseTotals?.people ?? 0, purchases, 'commerce_people_with_purchase'),
      paidStatusRecords: durableCount(pick(status, 'paid'), purchases, 'commerce_paid_records'),
      demoEntitlements: durableCount(pick(status, 'demo'), purchases, 'commerce_demo_records'),
      pendingRecords: durableCount(pick(status, 'pending'), purchases, 'commerce_pending_records'),
      failedRecords: durableCount(pick(status, 'failed'), purchases, 'commerce_failed_records'),
      refundedRecords: durableCount(pick(status, 'refunded'), purchases, 'commerce_refunded_records'),

      /* Deliberately named `recorded…`, never `revenue`. */
      recordedPaidGrossCents: durableCount(purchaseTotals?.paidCents ?? 0, purchases, 'commerce_recorded_paid_cents'),
      demoGrossCents: durableCount(purchaseTotals?.demoCents ?? 0, purchases, 'commerce_demo_cents'),
      /*
       * Named for the column, not for a process. Presence of `externalRef`
       * proves a reference exists and nothing else — see the header for what
       * is actually in it.
       */
      purchaseRecordsWithExternalRef: durableCount(
        purchaseTotals?.withExternalRef ?? 0,
        purchases,
        'commerce_purchase_external_ref_records'
      ),

      subscriptionRecords: durableCount(subscriptionTotals?.records ?? 0, subscriptions, 'commerce_subscription_records'),
      peopleWithSubscription: durableCount(subscriptionTotals?.people ?? 0, subscriptions, 'commerce_people_with_subscription'),
      activeSubscriptions: durableCount(pick(subscriptionStatus, 'active'), subscriptions, 'commerce_active_subscriptions'),
      cancelledSubscriptions: durableCount(pick(subscriptionStatus, 'cancelled'), subscriptions, 'commerce_cancelled_subscriptions'),
      subscriptionsWithExternalRef: durableCount(
        subscriptionTotals?.withExternalRef ?? 0,
        subscriptions,
        'commerce_subscription_external_ref_records'
      ),

      entitledUsers: durableCount(
        entitlement.reduce((sum, row) => sum + row.count, 0),
        users,
        'commerce_entitled_users'
      ),
    },
    distributions: {
      purchaseStatus: status,
      purchaseKind: distribution(kindRows),
      subscriptionStatus,
      subscriptionPlan: distribution(subscriptionPlanRows),
      entitlement,
    },
    limitations: [
      'A `paid` row is an application record, not a provider-confirmed transaction. No reconciliation runs anywhere in this repository, so the paid sum is reported as a recorded gross amount and confirmed revenue stays absent.',
      '`purchaseRecordsWithExternalRef` and `subscriptionsWithExternalRef` count a non-null column and prove only that a reference exists. They are NOT reconciliation, NOT provider confirmation, NOT payment and NOT revenue. Every purchase row in production that carries one is a `demo` entitlement whose reference is a course slug or a script product id, written by the Academy and Chart Market enrolment paths — no payment provider has ever seen any of them.',
      '`demo` means an entitlement was granted without money. Demo rows and their amounts are reported separately and never contribute to any money figure.',
      'Entitlement counts come from `user.plan` and prove nothing about payment. A plan the server model does not recognise is labelled rather than charted beside the real ones.',
      'Customers only, throughout — `role = \'user\'`. Entitlements, purchase records and their status and kind mixes, the recorded gross amounts, external-reference counts, subscriptions and their status and plan mixes all exclude rows owned by an `admin` or `moderator` account. An administrator granting himself a demo entitlement to show the flow is not customer monetization.',
      'Every figure here therefore describes the customer population, and none of them is a count of all rows in `purchase` or `subscription`. Nothing is reconciled across that boundary: the external-reference counts are over the same customer population, and a future all-account provider total would have to be compared against an all-account count rather than against these.',
      '`renewsAt` is an intention, not an outcome. Nothing here infers a successful renewal from it.',
      'Plan names are read from the entitlement model at runtime; no lineup is written down in this file.',
    ],
  };
}
