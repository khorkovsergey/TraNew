'use server';

import { revalidatePath } from 'next/cache';
import { DIAGNOSTIC } from '@/content/academy';
import { STRATEGY_STEPS } from '@/content/strategy';
import { save } from '@/lib/data/savedObjects';
import { getSession } from '@/lib/session';

/**
 * Keeping a research plan.
 *
 * The client sends the answers and nothing else — never a user id. Who is
 * saving is read from the session on the server, because a form field naming an
 * account would be an invitation to write into someone else's.
 *
 * The answers describe how much money someone has, how long they can leave it
 * and what losing it would do to them. That is why what gets stored is the
 * option ids the interview offered, validated against the interview itself, and
 * why an id that is not in the list is dropped rather than written through: this
 * ends up in a row attached to a person, and a free-text field reaching it from
 * a browser is a field somebody will eventually put something else in.
 */

export type SavePlanResult =
  | { status: 'saved' }
  | { status: 'sign_in_required' }
  | { status: 'invalid' };

/** The interview's own options are the allowlist. */
function clean(answers: unknown): string[][] | null {
  if (!Array.isArray(answers) || answers.length !== STRATEGY_STEPS.length) return null;

  const out: string[][] = [];

  for (let index = 0; index < STRATEGY_STEPS.length; index += 1) {
    const given = answers[index];
    if (!Array.isArray(given)) return null;

    const allowed = new Set(STRATEGY_STEPS[index].options.map((option) => option.id));
    const kept = given.filter((id): id is string => typeof id === 'string' && allowed.has(id));

    // An unanswered step means this is not a finished plan, and a half-finished
    // one is not what the person was offered to keep.
    if (kept.length === 0) return null;
    out.push(kept);
  }

  return out;
}

export async function savePlanAction(input: { answers: unknown }): Promise<SavePlanResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const answers = clean(input.answers);
  if (!answers) return { status: 'invalid' };

  /*
   * One plan per person, replaced rather than accumulated.
   *
   * The row is unique on (user, kind, ref), so a fixed ref means redoing
   * the interview updates the plan instead of leaving a row per attempt — which
   * is what someone means by "my plan".
   */
  await save({
    userId: session.user.id,
    kind: 'research',
    ref: 'strategy-plan',
    title: 'My research plan',
    subtitle: answers.flat().slice(0, 4).join(' · '),
  });

  revalidatePath('/en/account/workspace');

  return { status: 'saved' };
}

/**
 * Keeping a learning path.
 *
 * The path is derived from one answer — the level someone placed themselves at —
 * so that is all that crosses the wire, and it is checked against the options
 * the diagnostic actually offers rather than against a list written here. A
 * hand-written allowlist is a second copy of the truth, and this one already
 * drifted once during implementation.
 */
export async function saveLearningPathAction(input: {
  level: unknown;
}): Promise<SavePlanResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const levelStep = DIAGNOSTIC.find((step) => step.id === 'level');
  const allowed = new Set((levelStep?.options ?? []).map((option) => option.id));

  if (typeof input.level !== 'string' || !allowed.has(input.level)) {
    return { status: 'invalid' };
  }

  const option = levelStep?.options.find((candidate) => candidate.id === input.level);

  await save({
    userId: session.user.id,
    kind: 'lesson',
    ref: 'learning-path',
    title: 'My learning path',
    subtitle: option?.label.en,
  });

  revalidatePath('/en/account/workspace');
  revalidatePath('/en/account/academy');

  return { status: 'saved' };
}
