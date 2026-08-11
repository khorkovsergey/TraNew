import 'server-only';
import { gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { PLAN_RANK } from '@/lib/session';
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
 * provider-confirmed transaction. `externalRef` exists as the hook for a
 * payment provider and nothing populates it; no reconciliation runs anywhere in
 * this repository. Summing `amount_cents` where status is `paid` would produce
 * a number that looks like revenue, would be quoted as revenue, and would be
 * whatever the application happened to write.
 *
 * So the sum is reported — under a name that says what it is — and confirmed
 * revenue stays absent with the missing source named. The two are different
 * claims and the dashboard makes exactly one of them.
 *
 * ## Plans are read, never listed
 *
 * The entitlement vocabulary comes from `PLAN_RANK` at runtime. Writing the
 * plan names here would be a second source of truth about what the product
 * sells, and this file would be the last place anybody thought to update.
 */
export async function commerceFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const purchases = durableAt('purchase', generatedAt);
  const subscriptions = durableAt('subscription', generatedAt);
  const users = durableAt('user', generatedAt);

  const statusRows = await db
    .select({ key: schema.purchase.status, count: sql<number>`count(*)::int` })
    .from(schema.purchase)
    .groupBy(schema.purchase.status);

  const kindRows = await db
    .select({ key: schema.purchase.kind, count: sql<number>`count(*)::int` })
    .from(schema.purchase)
    .groupBy(schema.purchase.kind);

  const [purchaseTotals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${schema.purchase.userId})::int`,
      /* Named for what it is: the sum of rows the application marked paid. */
      paidCents: sql<number>`coalesce(sum(${schema.purchase.amountCents}) filter (where ${schema.purchase.status} = 'paid'), 0)::int`,
      demoCents: sql<number>`coalesce(sum(${schema.purchase.amountCents}) filter (where ${schema.purchase.status} = 'demo'), 0)::int`,
      /* The provider hook. Zero means nothing has ever been reconciled. */
      reconciled: sql<number>`count(${schema.purchase.externalRef})::int`,
      newest: sql<Date | null>`max(${schema.purchase.purchasedAt})`,
    })
    .from(schema.purchase);

  const [purchasesInWindow] = await db
    .select({ records: sql<number>`count(*)::int` })
    .from(schema.purchase)
    .where(gte(schema.purchase.purchasedAt, since));

  const subscriptionStatusRows = await db
    .select({ key: schema.subscription.status, count: sql<number>`count(*)::int` })
    .from(schema.subscription)
    .groupBy(schema.subscription.status);

  const subscriptionPlanRows = await db
    .select({ key: schema.subscription.plan, count: sql<number>`count(*)::int` })
    .from(schema.subscription)
    .groupBy(schema.subscription.plan);

  const [subscriptionTotals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${schema.subscription.userId})::int`,
      reconciled: sql<number>`count(${schema.subscription.externalRef})::int`,
      newest: sql<Date | null>`max(${schema.subscription.startedAt})`,
    })
    .from(schema.subscription);

  const entitlementRows = await db
    .select({ key: schema.user.plan, count: sql<number>`count(*)::int` })
    .from(schema.user)
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
      providerReconciledRecords: durableCount(purchaseTotals?.reconciled ?? 0, purchases, 'commerce_reconciled'),

      subscriptionRecords: durableCount(subscriptionTotals?.records ?? 0, subscriptions, 'commerce_subscription_records'),
      peopleWithSubscription: durableCount(subscriptionTotals?.people ?? 0, subscriptions, 'commerce_people_with_subscription'),
      activeSubscriptions: durableCount(pick(subscriptionStatus, 'active'), subscriptions, 'commerce_active_subscriptions'),
      cancelledSubscriptions: durableCount(pick(subscriptionStatus, 'cancelled'), subscriptions, 'commerce_cancelled_subscriptions'),
      subscriptionsWithProviderRef: durableCount(subscriptionTotals?.reconciled ?? 0, subscriptions, 'commerce_subscription_reconciled'),

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
      'A `paid` row is an application record, not a provider-confirmed transaction. `externalRef` is the reconciliation hook and nothing populates it, so the paid sum is reported as a recorded gross amount and confirmed revenue stays absent.',
      '`demo` means an entitlement was granted without money. Demo rows and their amounts are reported separately and never contribute to any money figure.',
      'Entitlement counts come from `user.plan` and prove nothing about payment. A plan the server model does not recognise is labelled rather than charted beside the real ones.',
      '`renewsAt` is an intention, not an outcome. Nothing here infers a successful renewal from it.',
      'Plan names are read from the entitlement model at runtime; no lineup is written down in this file.',
    ],
  };
}
