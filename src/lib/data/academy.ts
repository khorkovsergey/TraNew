import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordActivity } from './activity';
import { updateProfile } from './profile';

/**
 * Academy progress.
 *
 * The Academy works without an account today, and that is worth keeping — asking
 * someone to register before their first lesson is a bad trade. So the browser
 * keeps a local draft, and `importLocalProgress` folds it into the account on
 * sign-in. Moving to the database without that import would take a working
 * feature away from anonymous learners.
 */

export type AcademyStage = 'landing' | 'diagnostic' | 'path' | 'dashboard' | 'lesson' | 'done';
export type AcademyMode = 'beginner' | 'standard' | 'pro';

export type AcademyProgress = {
  stage: AcademyStage;
  mode: AcademyMode;
  diagnostic: string[][];
  diagnosticStep: number;
  pathReady: boolean;
  lessonsDone: string[];
  termsSeen: string[];
  questionsAsked: number;
  completed: boolean;
};

export const ACADEMY_DEFAULTS: AcademyProgress = {
  stage: 'landing',
  mode: 'beginner',
  diagnostic: [[], [], [], [], []],
  diagnosticStep: 0,
  pathReady: false,
  lessonsDone: [],
  termsSeen: [],
  questionsAsked: 0,
  completed: false,
};

export async function getProgress(userId: string): Promise<AcademyProgress> {
  const [row] = await db
    .select()
    .from(schema.academyProgress)
    .where(eq(schema.academyProgress.userId, userId))
    .limit(1);

  if (!row) return ACADEMY_DEFAULTS;

  return {
    stage: row.stage as AcademyStage,
    mode: row.mode as AcademyMode,
    diagnostic: row.diagnostic ?? ACADEMY_DEFAULTS.diagnostic,
    diagnosticStep: row.diagnosticStep,
    pathReady: row.pathReady,
    lessonsDone: row.lessonsDone ?? [],
    termsSeen: row.termsSeen ?? [],
    questionsAsked: row.questionsAsked,
    completed: row.completed,
  };
}

export async function saveProgress(
  userId: string,
  patch: Partial<AcademyProgress>
): Promise<void> {
  const current = await getProgress(userId);
  const next = { ...current, ...patch };

  await db
    .insert(schema.academyProgress)
    .values({
      id: randomUUID(),
      userId,
      stage: next.stage,
      mode: next.mode,
      diagnostic: next.diagnostic,
      diagnosticStep: next.diagnosticStep,
      pathReady: next.pathReady,
      lessonsDone: next.lessonsDone,
      termsSeen: next.termsSeen,
      questionsAsked: next.questionsAsked,
      completed: next.completed,
    })
    .onConflictDoUpdate({
      target: schema.academyProgress.userId,
      set: {
        stage: next.stage,
        mode: next.mode,
        diagnostic: next.diagnostic,
        diagnosticStep: next.diagnosticStep,
        pathReady: next.pathReady,
        lessonsDone: next.lessonsDone,
        termsSeen: next.termsSeen,
        questionsAsked: next.questionsAsked,
        completed: next.completed,
        updatedAt: new Date(),
      },
    });

  // The diagnostic is the one place that learns someone's level; the rest of the
  // product reads it from the profile rather than reaching into Academy tables.
  if (patch.mode && patch.mode !== current.mode) {
    await updateProfile(userId, { experience: patch.mode });
  }
}

export async function completeLesson(userId: string, slug: string, title: string): Promise<void> {
  const current = await getProgress(userId);
  if (current.lessonsDone.includes(slug)) return;

  await saveProgress(userId, { lessonsDone: [...current.lessonsDone, slug] });
  await recordActivity({
    userId,
    type: 'learned',
    title: `Completed: ${title}`,
    kind: 'lesson',
    ref: slug,
  });
}

/**
 * Folds a browser draft into the account on sign-in.
 *
 * Merges rather than replaces, and takes the further of the two everywhere: a
 * person who studied on their phone and then signed in on a laptop should end up
 * with both, never with whichever device happened to sync last.
 */
export async function importLocalProgress(
  userId: string,
  local: Partial<AcademyProgress>
): Promise<void> {
  const current = await getProgress(userId);

  await saveProgress(userId, {
    stage: local.stage && current.stage === 'landing' ? local.stage : current.stage,
    mode: current.mode === 'beginner' && local.mode ? local.mode : current.mode,
    diagnostic:
      current.diagnosticStep >= (local.diagnosticStep ?? 0)
        ? current.diagnostic
        : (local.diagnostic ?? current.diagnostic),
    diagnosticStep: Math.max(current.diagnosticStep, local.diagnosticStep ?? 0),
    pathReady: current.pathReady || Boolean(local.pathReady),
    lessonsDone: Array.from(new Set([...current.lessonsDone, ...(local.lessonsDone ?? [])])),
    termsSeen: Array.from(new Set([...current.termsSeen, ...(local.termsSeen ?? [])])),
    questionsAsked: Math.max(current.questionsAsked, local.questionsAsked ?? 0),
    completed: current.completed || Boolean(local.completed),
  });
}
