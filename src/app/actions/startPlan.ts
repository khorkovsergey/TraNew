'use server';

import { revalidatePath } from 'next/cache';
import { listSaved, save } from '@/lib/data/savedObjects';
import { getSession } from '@/lib/session';
import { parseDraft, type StartAnswers } from '@/lib/start/path';
import { buildPlan, parseProgress, type PlanStepId } from '@/lib/start/plan';

/**
 * Moving a guest's plan into their account.
 *
 * The screen promises "nothing is lost either way" beside the sign-up button.
 * Until this existed that was untrue: a guest built a plan, pressed save,
 * registered, and came back to an empty account. A promise a product makes in
 * its own copy is the one thing that has to be kept.
 *
 * What crosses the wire is four preference ids and a list of step ids, both
 * checked against the diagnostic's own options rather than against a list
 * written here — a hand-written allowlist is a second copy of the truth, and
 * one in this repository already drifted once. Nothing free-text reaches the
 * database from a browser.
 *
 * It goes in the encrypted note field. These answers describe how long somebody
 * can leave money alone and what losing it would do to them; that is not
 * subtitle material.
 */

const REF = 'start-plan';

export type StoredPlan = { answers: StartAnswers; done: PlanStepId[] };

export type MigrateResult =
  | { status: 'saved'; steps: number }
  | { status: 'sign_in_required' }
  | { status: 'invalid' };

export async function saveStartPlanAction(input: {
  answers: unknown;
  done: unknown;
}): Promise<MigrateResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  // The interview's own options are the allowlist, via the same parser the
  // browser uses on the way back in.
  const answers = parseDraft(input.answers);
  if (!answers) return { status: 'invalid' };

  const steps = buildPlan(answers);
  const done = parseProgress(input.done, steps);

  await save({
    userId: session.user.id,
    kind: 'research',
    /*
     * One plan per person, replaced rather than accumulated. The row is unique
     * on (user, kind, ref), so redoing the diagnostic updates the plan instead
     * of leaving a row per attempt — which is what somebody means by "my plan".
     */
    ref: REF,
    title: 'My starting plan',
    subtitle: `${done.length} of ${steps.length} steps done`,
    note: JSON.stringify({ answers, done } satisfies StoredPlan),
  });

  revalidatePath('/en/account');
  revalidatePath('/en/start/plan');

  return { status: 'saved', steps: steps.length };
}

/**
 * The plan on the account, if there is one.
 *
 * Parsed on the way out as well as in. The note was written by this action, and
 * it is still read back through the same checks — a row is a thing that outlives
 * the code that wrote it, and a shape that changed once will change again.
 */
export async function loadStartPlan(userId: string): Promise<StoredPlan | null> {
  const rows = await listSaved(userId, 'research');
  const row = rows.find((entry) => entry.ref === REF);
  if (!row?.note) return null;

  try {
    const parsed = JSON.parse(row.note) as { answers?: unknown; done?: unknown };
    const answers = parseDraft(parsed.answers);
    if (!answers) return null;

    return { answers, done: parseProgress(parsed.done, buildPlan(answers)) };
  } catch {
    return null;
  }
}
