import 'server-only';
import { and, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { MARKETPLACE_MIN_SAMPLE } from '../dictionary';
import { ownedByCustomer } from '../internalTraffic';
import { distribution, durableAt, durableCount, durableRate, newest, type FamilyFacts } from './durable';

/**
 * Academy, from `academy_progress`.
 *
 * ## Learners are customers
 *
 * Every figure is scoped to progress rows owned by `role = 'user'`. Walking
 * through the diagnostic to show somebody how the Academy works produces a real
 * `academy_progress` row, and one internal learner in a small cohort moves the
 * completion rate visibly. The course catalogue is untouched by this — it lives
 * in `src/content` and is product inventory, not a count of people.
 *
 * ## Current state is not a funnel
 *
 * There is exactly one row per user — a unique index enforces it — and it is
 * overwritten as they move. So the stage distribution is a **photograph of
 * where everybody is now**, not a record of how they got there. Reading it as a
 * conversion funnel would be wrong in a way that looks convincing: "60% are at
 * `landing`" invites the conclusion that 60% dropped out there, when it may
 * equally mean they arrived this morning.
 *
 * Everything below is therefore labelled current state. The historical
 * progression funnel needs transition events, and the Academy section does not
 * emit any — that is a cross-section request, not something to approximate from
 * a snapshot.
 *
 * ## What is never read
 *
 * `diagnostic` holds five lists of answer ids about somebody's own experience
 * with money. It is not selected here, and no query groups by it.
 */
export async function academyFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const at = durableAt('academy_progress', generatedAt);

  const customerLearner = ownedByCustomer(schema.academyProgress.userId);

  const stageRows = await db
    .select({ key: schema.academyProgress.stage, count: sql<number>`count(*)::int` })
    .from(schema.academyProgress)
    .where(customerLearner)
    .groupBy(schema.academyProgress.stage);

  const modeRows = await db
    .select({ key: schema.academyProgress.mode, count: sql<number>`count(*)::int` })
    .from(schema.academyProgress)
    .where(customerLearner)
    .groupBy(schema.academyProgress.mode);

  const [totals] = await db
    .select({
      learners: sql<number>`count(*)::int`,
      pathReady: sql<number>`count(*) filter (where ${schema.academyProgress.pathReady})::int`,
      completed: sql<number>`count(*) filter (where ${schema.academyProgress.completed})::int`,
      asked: sql<number>`count(*) filter (where ${schema.academyProgress.questionsAsked} > 0)::int`,
      /*
       * `lessons_done` is a JSON array of slugs. Its *length* is a count of
       * progress; its contents are which lessons a person needed, which is
       * closer to a fact about them than about the product. Only the length is
       * read, and only in aggregate.
       */
      withLesson: sql<number>`count(*) filter (where coalesce(jsonb_array_length(${schema.academyProgress.lessonsDone}), 0) > 0)::int`,
      medianLessons: sql<number | null>`percentile_cont(0.5) within group (order by coalesce(jsonb_array_length(${schema.academyProgress.lessonsDone}), 0))`,
      newest: sql<Date | null>`max(${schema.academyProgress.updatedAt})`,
    })
    .from(schema.academyProgress)
    .where(customerLearner);

  const [started] = await db
    .select({ learners: sql<number>`count(*)::int` })
    .from(schema.academyProgress)
    .where(and(customerLearner, gte(schema.academyProgress.createdAt, since)));

  const learners = totals?.learners ?? 0;

  return {
    family: 'academy',
    sources: ['academy_progress'],
    generatedAt,
    freshestAt: newest(totals?.newest),
    metrics: {
      learners: durableCount(learners, at, 'academy_learners'),
      newLearnersInWindow: durableCount(started?.learners ?? 0, at, 'academy_new_learners'),
      pathReady: durableCount(totals?.pathReady ?? 0, at, 'academy_path_ready'),
      completed: durableCount(totals?.completed ?? 0, at, 'academy_completed'),
      withAtLeastOneLesson: durableCount(totals?.withLesson ?? 0, at, 'academy_with_lesson'),
      askedQuestions: durableCount(totals?.asked ?? 0, at, 'academy_asked'),
      medianLessonsDone: durableCount(Math.round(Number(totals?.medianLessons ?? 0)), at, 'academy_median_lessons'),

      /*
       * The one rate with a sound denominator here: everybody counted has an
       * `academy_progress` row, which is the documented definition of having
       * started. It is still current state — it says how many of today's
       * learners have finished, not how many of a cohort did.
       */
      completionRate: durableRate(
        totals?.completed ?? 0,
        learners,
        at,
        'academy_completion_rate',
        MARKETPLACE_MIN_SAMPLE
      ),
    },
    distributions: { stage: distribution(stageRows), mode: distribution(modeRows) },
    limitations: [
      'Customer learners only. Progress rows owned by an `admin` or `moderator` account are excluded: demonstrating the Academy writes a real row, and one internal learner in a small cohort moves the completion rate visibly. The course catalogue is unaffected — it is inventory, not people.',
      'One row per user, overwritten in place. Every figure here is current state — where people are now — and none of it is a historical funnel.',
      'The stage distribution must not be read as drop-off. Somebody at `landing` may have arrived this morning.',
      'A historical progression funnel needs transition events, which the Academy section does not emit. That is a cross-section request, not something to approximate from a snapshot.',
      'Diagnostic answers are never read. Only the length of `lessons_done` is used, never its contents.',
    ],
  };
}
