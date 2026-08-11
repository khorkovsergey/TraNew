import 'server-only';
import { gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { distribution, durableAt, durableCount, newest, type FamilyFacts } from './durable';

/**
 * Saved objects and collections.
 *
 * ## Kind, never ref
 *
 * `saved_object` holds `kind` and `ref` — "symbol" and "TSLA". The kind is a
 * fact about the product; the ref is a fact about the person, and a list of the
 * symbols somebody saved is a list of what they are watching, which is close
 * enough to what they hold. The application can query a ref because the person
 * asked it to; a metrics dashboard has no such mandate.
 *
 * So this reports counts by kind and nothing below that. `title`, `subtitle`
 * and the encrypted `noteEnc` are not selected either.
 *
 * Collections are reported as adoption only. Their names and descriptions are
 * the person's own words and are never read.
 */
export async function savesFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const at = durableAt('saved_object', generatedAt);
  const collections = durableAt('collection', generatedAt);

  const kindRows = await db
    .select({ key: schema.savedObject.kind, count: sql<number>`count(*)::int` })
    .from(schema.savedObject)
    .groupBy(schema.savedObject.kind);

  const [totals] = await db
    .select({
      objects: sql<number>`count(*)::int`,
      savers: sql<number>`count(distinct ${schema.savedObject.userId})::int`,
      newest: sql<Date | null>`max(${schema.savedObject.createdAt})`,
    })
    .from(schema.savedObject);

  const [inWindow] = await db
    .select({ objects: sql<number>`count(*)::int` })
    .from(schema.savedObject)
    .where(gte(schema.savedObject.createdAt, since));

  /* Savers with more than one object — adoption depth, without naming anybody. */
  const [depth] = await db
    .select({ repeat: sql<number>`count(*)::int` })
    .from(
      db
        .select({ userId: schema.savedObject.userId })
        .from(schema.savedObject)
        .groupBy(schema.savedObject.userId)
        .having(sql`count(*) > 1`)
        .as('repeat_savers')
    );

  const [collectionTotals] = await db
    .select({
      collections: sql<number>`count(*)::int`,
      owners: sql<number>`count(distinct ${schema.collection.userId})::int`,
    })
    .from(schema.collection);

  const [collectionItems] = await db
    .select({
      items: sql<number>`count(*)::int`,
      nonEmpty: sql<number>`count(distinct ${schema.collectionItem.collectionId})::int`,
    })
    .from(schema.collectionItem);

  const nonEmpty = collectionItems?.nonEmpty ?? 0;

  return {
    family: 'saves',
    sources: ['saved_object', 'collection', 'collection_item'],
    generatedAt,
    freshestAt: newest(totals?.newest),
    metrics: {
      savedObjects: durableCount(totals?.objects ?? 0, at, 'saves_objects'),
      savers: durableCount(totals?.savers ?? 0, at, 'saves_savers'),
      repeatSavers: durableCount(depth?.repeat ?? 0, at, 'saves_repeat_savers'),
      savedInWindow: durableCount(inWindow?.objects ?? 0, at, 'saves_in_window'),
      collections: durableCount(collectionTotals?.collections ?? 0, collections, 'saves_collections'),
      collectionOwners: durableCount(collectionTotals?.owners ?? 0, collections, 'saves_collection_owners'),
      collectionsWithItems: durableCount(nonEmpty, collections, 'saves_collections_with_items'),
      meanItemsPerCollection: durableCount(
        nonEmpty > 0 ? Math.round(((collectionItems?.items ?? 0) / nonEmpty) * 10) / 10 : 0,
        collections,
        'saves_mean_items'
      ),
    },
    distributions: { kind: distribution(kindRows) },
    limitations: [
      'Counts by kind only. A `ref` is what somebody is watching, which is close enough to what they hold, and it is never read.',
      'Titles, subtitles and the encrypted note are never selected.',
      'Collection names and descriptions are the person\'s own words and are never read. Only adoption counts are reported.',
      'These are current saved state. Conversion from a save action belongs to telemetry, where the emitters exist.',
    ],
  };
}
