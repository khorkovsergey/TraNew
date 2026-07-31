import { NextResponse, type NextRequest } from 'next/server';
import { recordAccess } from '@/lib/audit';
import { getConsent } from '@/lib/consent';
import { getPreferences } from '@/lib/data/profile';
import { getSession, type AuthedUser, type PlanId } from '@/lib/session';
import { askVoyager, isModelConfigured } from '@/lib/voyager/orchestrator';
import {
  sourcesFor,
  tierFor,
  TIER_LABEL,
  TIER_LIMITS,
  upgradeFor,
} from '@/lib/voyager/policy';
import { quotaAnswer } from '@/lib/voyager/scenarios';
import { consumeQuestion, peekUsage } from '@/lib/voyager/usage';
import type { VoyagerRequest, VoyagerResponse, VoyagerScreen } from '@/lib/voyager/types';

/**
 * The one entry point Voyager answers through.
 *
 * The order matters: identity → entitlements → quota → context → model → audit.
 * Tier is read from the session, never from the request body — a widget that could
 * name its own tier could name `private` and ask about a wealth record it has no
 * claim to.
 */

export const dynamic = 'force-dynamic';

const SCREENS: VoyagerScreen[] = [
  'chart',
  'symbol',
  'economy',
  'indicator',
  'wealth',
  'academy',
  'experts',
  'news',
  'portfolio',
  'strategy',
  'generic',
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function currentUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    plan: ((session.user as { plan?: unknown }).plan as PlanId) ?? 'free',
  };
}

/**
 * What the widget needs before anyone asks anything: which tier this visitor is,
 * which sources are on the table, and how many questions are left today. All of it
 * is derived from the session here rather than guessed on the client.
 */
export async function GET(request: NextRequest) {
  const screen = request.nextUrl.searchParams.get('screen') as VoyagerScreen | null;
  const subject = request.nextUrl.searchParams.get('subject') ?? '';

  if (!screen || !SCREENS.includes(screen)) {
    return badRequest('A valid screen is required.');
  }

  const user = await currentUser();
  const tier = tierFor(user);
  const personalization = user
    ? (await getConsent(user.id, 'ai_processing')).granted
    : false;

  const sources = await sourcesFor(
    { screen, subject, prompt: '', quick: [] },
    tier,
    user,
    personalization
  );
  const usage = await peekUsage(user?.id ?? null, tier);
  // Carried so a second device does not replay the introduction. The client still
  // decides from localStorage first — this only fills the gap for a new browser.
  const introSeen = user ? (await getPreferences(user.id))['voyager.intro_seen'] === true : false;

  return NextResponse.json({
    tier,
    tierLabel: TIER_LABEL[tier],
    limits: TIER_LIMITS[tier],
    sources,
    remaining: usage.remaining,
    signedIn: Boolean(user),
    /** null until the person has answered the personalization question. */
    personalization: user ? personalization : null,
    introSeen,
    modelConfigured: isModelConfigured(),
  });
}

export async function POST(request: NextRequest) {
  let body: VoyagerRequest;
  try {
    body = (await request.json()) as VoyagerRequest;
  } catch {
    return badRequest('Expected a JSON body.');
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return badRequest('A question is required.');
  if (question.length > 2000) return badRequest('That question is too long.');

  const context = body.context;
  if (!context || !SCREENS.includes(context.screen)) {
    return badRequest('A valid page context is required.');
  }

  const user = await currentUser();
  const tier = tierFor(user);

  // Counted before the model runs, so a slow or failing answer cannot be replayed
  // for free.
  const usage = await consumeQuestion(user?.id ?? null, tier);

  if (usage.quotaReached) {
    const response: VoyagerResponse = {
      answer: {
        ...quotaAnswer(),
        upgrade: upgradeFor(tier, context, true, Boolean(user)),
      },
      tier,
      remaining: 0,
    };
    return NextResponse.json(response);
  }

  // Personalization is a stored decision, not a widget toggle: if it was never
  // granted, the profile source is simply absent from what the model is shown.
  const personalization = user ? (await getConsent(user.id, 'ai_processing')).granted : false;

  const available = await sourcesFor(context, tier, user, personalization);
  const disabled = Array.isArray(body.disabledSources) ? body.disabledSources : [];
  const active = available.filter((source) => !disabled.includes(source.id));

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (turn): turn is { role: 'user' | 'assistant'; text: string } =>
            !!turn &&
            (turn.role === 'user' || turn.role === 'assistant') &&
            typeof turn.text === 'string'
        )
        .slice(-8)
    : [];

  const answer = await askVoyager({ question, context, tier, sources: active, history });

  /*
   * A question answered with the wealth record is a read of financial data and is
   * logged as one — the log records that it happened and which sources were in
   * play, never the question text or any figure from the answer.
   */
  if (user && active.some((source) => source.id === 'wealth')) {
    await recordAccess({
      userId: user.id,
      action: 'read',
      resource: 'wealth_overview',
      actor: 'voyager',
      context: { screen: context.screen, sources: active.map((s) => s.id).join(',') },
    });
  }

  const response: VoyagerResponse = {
    answer: {
      ...answer,
      upgrade: upgradeFor(tier, context, false, Boolean(user)),
    },
    tier,
    remaining: usage.remaining,
  };

  return NextResponse.json(response);
}
