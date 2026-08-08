import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { courseBySlug, type Course } from '@/content/academyCourses';
import { courseProgress, progressKey, type CourseProgress } from '@/lib/academy/courses';
import { getProgress } from '@/lib/data/academy';
import { recordActivity } from '@/lib/data/activity';

/**
 * Who is enrolled in which course.
 *
 * Enrolment is a row in `purchase`, the table that already answers "what has
 * this person bought" for consultations and scripts. A fourth kind rather than a
 * fourth table: My Learning, the account's purchases list and a receipt are all
 * asking the same question, and two records of one purchase would eventually
 * disagree about it.
 *
 * Nothing here charges anybody. No payment provider is connected, so a demo
 * enrolment is written as `demo` — the same convention Chart Market uses. It
 * entitles exactly the same access and every screen says what it is. Writing
 * `paid` and putting a disclaimer beside the button would leave a database full
 * of sales that never happened, and the disclaimer is not in the database.
 */

export const PURCHASE_KIND = 'course';

/** The statuses that grant access. `demo` stays until a provider is connected. */
const ENTITLED = new Set(['paid', 'demo']);

export type Enrolment = {
  slug: string;
  title: string;
  amountCents: number;
  currency: string;
  /** True when nothing was charged, because no provider is connected. */
  demo: boolean;
  enrolledAt: Date;
};

export async function listEnrolments(userId: string): Promise<Enrolment[]> {
  // The catalogue is public and has to render with no database behind it. With
  // none there is also no session, so "enrolled in nothing" is the true answer
  // rather than a fallback.
  if (!isDatabaseConfigured()) return [];

  const rows = await db
    .select()
    .from(schema.purchase)
    .where(and(eq(schema.purchase.userId, userId), eq(schema.purchase.kind, PURCHASE_KIND)));

  return rows
    .filter((row) => ENTITLED.has(row.status) && row.externalRef !== null)
    .map((row) => ({
      slug: row.externalRef as string,
      title: row.title,
      amountCents: row.amountCents,
      currency: row.currency,
      demo: row.status === 'demo',
      enrolledAt: row.purchasedAt,
    }))
    .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
}

export async function enrolledSlugs(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const enrolments = await listEnrolments(userId);
  return new Set(enrolments.map((enrolment) => enrolment.slug));
}

export async function isEnrolled(userId: string | null, slug: string): Promise<boolean> {
  if (!userId) return false;
  return (await enrolledSlugs(userId)).has(slug);
}

export type EnrolResult = 'enrolled' | 'already_enrolled' | 'unknown_course';

/**
 * Enrols someone in a course.
 *
 * The price comes from the catalogue, never from the caller: an amount that
 * arrives from a browser is a number somebody can choose, and the one place it
 * must not be chosen is the record of what was bought.
 */
export async function enrol(userId: string, slug: string): Promise<EnrolResult> {
  const course = courseBySlug(slug);
  if (!course) return 'unknown_course';

  if (await isEnrolled(userId, slug)) return 'already_enrolled';

  await db.insert(schema.purchase).values({
    id: randomUUID(),
    userId,
    kind: PURCHASE_KIND,
    title: course.title,
    amountCents: Math.round(course.price * 100),
    currency: course.currency,
    status: 'demo',
    externalRef: course.slug,
  });

  await recordActivity({
    userId,
    type: 'purchase',
    title: `Enrolled: ${course.title}`,
    kind: 'course',
    ref: course.slug,
  });

  return 'enrolled';
}

/* --------------------------------------------------------------- Progress */

/**
 * Marking a course lesson watched.
 *
 * Written into the same `lessonsDone` array the free path uses, under a
 * `course:` prefix — see `progressKey`. Course progress is therefore the same
 * kind of record as Learn progress, migrates with it on sign-in, and needed no
 * migration of its own.
 *
 * The write is one statement, and that is the point. Read-modify-write on a
 * whole array loses ticks: somebody marking three lessons in a row sends three
 * requests, and whichever finishes last writes an array assembled before the
 * others landed. This lets the database do the appending, so overlapping
 * requests each add their own key instead of overwriting each other's.
 */
export async function setLessonWatched(
  userId: string,
  slug: string,
  lessonId: string,
  watched: boolean
): Promise<void> {
  const key = progressKey(slug, lessonId);

  // A learner who has never touched the free path has no row yet. Created
  // empty rather than through `saveProgress`, which would write defaults over
  // whatever a concurrent request had just put there.
  await db
    .insert(schema.academyProgress)
    .values({ id: randomUUID(), userId, lessonsDone: [] })
    .onConflictDoNothing({ target: schema.academyProgress.userId });

  const entry = JSON.stringify([key]);

  await db
    .update(schema.academyProgress)
    .set({
      lessonsDone: watched
        ? sql`case when coalesce(${schema.academyProgress.lessonsDone}, '[]'::jsonb) @> ${entry}::jsonb
                then ${schema.academyProgress.lessonsDone}
                else coalesce(${schema.academyProgress.lessonsDone}, '[]'::jsonb) || ${entry}::jsonb end`
        : sql`coalesce((
              select jsonb_agg(value)
              from jsonb_array_elements(coalesce(${schema.academyProgress.lessonsDone}, '[]'::jsonb))
              where value <> to_jsonb(${key}::text)
            ), '[]'::jsonb)`,
      updatedAt: new Date(),
    })
    .where(eq(schema.academyProgress.userId, userId));
}

export async function lessonsDoneFor(userId: string | null): Promise<string[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    return (await getProgress(userId)).lessonsDone;
  } catch {
    // Progress is the decoration on these screens, not the screen. A database
    // that cannot be reached costs the percentage, not the course list.
    return [];
  }
}

export function progressFor(course: Course, lessonsDone: readonly string[]): CourseProgress {
  return courseProgress(course, lessonsDone);
}
