'use server';

import { listSaved, save } from '@/lib/data/savedObjects';
import { getSession } from '@/lib/session';
import { EMPTY_BRIEF, type ExpertBrief } from '@/lib/experts/brief';

/**
 * Keeping a brief past the tab it was written in.
 *
 * It lived in session storage, which is right for a guest — there is nowhere
 * else to put something with no owner — and wrong for somebody with an account,
 * who closes a tab expecting their request to still exist. Now the same brief
 * is written to the account when there is one.
 *
 * The encrypted note field, like the start plan. A brief says what somebody is
 * trying to do with their money, in their own words: that is not a subtitle,
 * and it should not be readable from a database dump.
 *
 * No new table. `savedObject` already holds exactly this shape — an owner, a
 * kind, a stable ref and an encrypted body — and a second table would be a
 * second thing to keep in step for no gain.
 */

const REF = 'expert-brief';

export type BriefResult =
  | { status: 'saved' }
  | { status: 'sign_in_required' }
  | { status: 'invalid' };

/**
 * Re-checked on the way in, field by field.
 *
 * What arrives is whatever a browser chose to send. The lists are bounded and
 * the free-text fields are capped — a goal is a sentence, not a payload.
 */
function clean(input: unknown): ExpertBrief | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;

  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.slice(0, max) : undefined;

  const list = (value: unknown, max: number) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, max)
      : [];

  const goal = text(raw.goal, 2000);
  if (!goal?.trim()) return null;

  return {
    ...EMPTY_BRIEF,
    title: text(raw.title, 200) ?? goal.slice(0, 60),
    goal,
    services: list(raw.services, 8),
    specializations: list(raw.specializations, 12),
    country: text(raw.country, 80),
    city: text(raw.city, 80),
    remoteAccepted: raw.remoteAccepted !== false,
    languages: list(raw.languages, 6),
    currency: text(raw.currency, 8),
    constraints: list(raw.constraints, 12),
    notes: text(raw.notes, 4000),
    initialCategory: text(raw.initialCategory, 40),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveExpertBriefAction(input: unknown): Promise<BriefResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const brief = clean(input);
  if (!brief) return { status: 'invalid' };

  await save({
    userId: session.user.id,
    kind: 'research',
    ref: REF,
    // The title is visible in listings; the body is not.
    title: 'Expert request',
    subtitle: brief.services.join(', ') || undefined,
    note: JSON.stringify(brief),
  });

  return { status: 'saved' };
}

export async function loadExpertBrief(): Promise<ExpertBrief | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const rows = await listSaved(session.user.id, 'research');
  const row = rows.find((item) => item.ref === REF);
  if (!row?.note) return null;

  try {
    return clean(JSON.parse(row.note));
  } catch {
    // A brief that will not parse is not a reason to lose the page.
    return null;
  }
}
