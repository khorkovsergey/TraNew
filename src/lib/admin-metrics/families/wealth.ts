import 'server-only';
import { isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { featureDisabled } from '@/lib/analytics/states';
import { durableAt, durableCount, newest, type FamilyFacts } from './durable';

/**
 * Wealth Hub — adoption, and nothing else.
 *
 * This is the strictest boundary in the Observatory, and it is kept
 * structurally rather than by care: **no encrypted column is named anywhere in
 * this file.** Not `nameEnc`, not `valueEnc`, not `detailsEnc`, not
 * `balanceEnc`, not `termsEnc`, not `targetEnc`, not `metaEnc`. Nothing here
 * decrypts anything, because nothing here selects anything to decrypt. A test
 * asserts the file mentions none of them.
 *
 * There is therefore no portfolio value, no assets under management, no net
 * worth, no average holding and no liability total — not because they are hard,
 * but because the product's promise is that this data does not travel, and a
 * dashboard that aggregated it would have broken that promise on everybody's
 * behalf at once.
 *
 * `country` and `currency` are in the clear on `wealth_asset` and are also left
 * alone. Combined with a small cohort they narrow a person down, and the
 * questions they would answer are not worth that.
 *
 * ## Superseded rows
 *
 * A wealth asset is versioned: an update writes a new row and stamps
 * `supersededAt` on the old one, so the record shows its own history. Counting
 * every row would report somebody who revised one holding five times as five
 * assets. Current means `supersededAt is null`, and the superseded count is
 * reported separately as the revision activity it is.
 *
 * ## When the feature is off
 *
 * Adoption reports `feature_disabled`, never zero. Rows can exist while the
 * surface is unreachable, and a zero would say nobody wanted it.
 */
export async function wealthFacts(): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const assets = durableAt('wealth_asset', generatedAt);
  const liabilities = durableAt('wealth_liability', generatedAt);
  const goals = durableAt('wealth_goal', generatedAt);

  const [assetTotals] = await db
    .select({
      current: sql<number>`count(*)::int`,
      holders: sql<number>`count(distinct ${schema.wealthAsset.userId})::int`,
      newest: sql<Date | null>`max(${schema.wealthAsset.updatedAt})`,
    })
    .from(schema.wealthAsset)
    .where(isNull(schema.wealthAsset.supersededAt));

  const [supersededTotals] = await db
    .select({ superseded: sql<number>`count(*)::int` })
    .from(schema.wealthAsset)
    .where(sql`${schema.wealthAsset.supersededAt} is not null`);

  const [liabilityTotals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      holders: sql<number>`count(distinct ${schema.wealthLiability.userId})::int`,
      newest: sql<Date | null>`max(${schema.wealthLiability.updatedAt})`,
    })
    .from(schema.wealthLiability);

  const [goalTotals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      holders: sql<number>`count(distinct ${schema.wealthGoal.userId})::int`,
      newest: sql<Date | null>`max(${schema.wealthGoal.updatedAt})`,
    })
    .from(schema.wealthGoal);

  const [consentTotals] = await db
    .select({
      granted: sql<number>`count(*) filter (where ${schema.consent.revokedAt} is null)::int`,
      revoked: sql<number>`count(*) filter (where ${schema.consent.revokedAt} is not null)::int`,
    })
    .from(schema.consent)
    .where(sql`${schema.consent.kind} = 'voyager_context'`);

  const enabled = FEATURE_FLAGS.wealthHubEnabled;
  const off = (metricId: string) =>
    featureDisabled('Wealth Hub', {
      metricId,
      source: 'wealth_asset',
      sourceType: 'durable_fact',
      queriedAt: generatedAt,
    });

  return {
    family: 'wealth',
    sources: ['wealth_asset', 'wealth_liability', 'wealth_goal', 'consent'],
    generatedAt,
    freshestAt: newest(assetTotals?.newest, liabilityTotals?.newest, goalTotals?.newest),
    metrics: {
      usersWithAsset: enabled
        ? durableCount(assetTotals?.holders ?? 0, assets, 'wealth_users_with_asset')
        : off('wealth_users_with_asset'),
      usersWithLiability: enabled
        ? durableCount(liabilityTotals?.holders ?? 0, liabilities, 'wealth_users_with_liability')
        : off('wealth_users_with_liability'),
      usersWithGoal: enabled
        ? durableCount(goalTotals?.holders ?? 0, goals, 'wealth_users_with_goal')
        : off('wealth_users_with_goal'),
      currentAssetRecords: enabled
        ? durableCount(assetTotals?.current ?? 0, assets, 'wealth_current_assets')
        : off('wealth_current_assets'),
      supersededAssetRecords: enabled
        ? durableCount(supersededTotals?.superseded ?? 0, assets, 'wealth_superseded_assets')
        : off('wealth_superseded_assets'),
      liabilityRecords: enabled
        ? durableCount(liabilityTotals?.records ?? 0, liabilities, 'wealth_liability_records')
        : off('wealth_liability_records'),
      goalRecords: enabled
        ? durableCount(goalTotals?.records ?? 0, goals, 'wealth_goal_records')
        : off('wealth_goal_records'),

      /*
       * Consent adoption is the one number here that is about the product
       * rather than about anybody's money: how many people were willing to let
       * Voyager read the record at all, and how many changed their minds.
       */
      voyagerContextGranted: durableCount(
        consentTotals?.granted ?? 0,
        durableAt('consent', generatedAt),
        'wealth_consent_granted'
      ),
      voyagerContextRevoked: durableCount(
        consentTotals?.revoked ?? 0,
        durableAt('consent', generatedAt),
        'wealth_consent_revoked'
      ),
    },
    distributions: {},
    limitations: [
      'Adoption counts only. No monetary column is selected anywhere in this family, so no portfolio value, net worth, average holding or liability total exists to be reported.',
      'Country and currency are in the clear on the asset table and are still not read: combined with a small cohort they narrow a person down.',
      'Current assets exclude superseded rows. A person who revised one holding five times is one holder with one asset, and the revisions are counted separately.',
      enabled
        ? 'Wealth Hub is enabled, so these figures describe a reachable surface.'
        : 'Wealth Hub is switched off. Adoption reports feature-disabled rather than zero — rows can exist while the surface is unreachable.',
    ],
  };
}
