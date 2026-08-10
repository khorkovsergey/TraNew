import { NextResponse, type NextRequest } from 'next/server';
import { recordAccess } from '@/lib/audit';
import { getConsent } from '@/lib/consent';
import { getSession, type AuthedUser, type PlanId } from '@/lib/session';
import { askVoyager, isModelConfigured } from '@/lib/voyager/orchestrator';
import {
  quotaFor,
  sourcesFor,
  tierFor,
  TIER_LABEL,
  TIER_LIMITS,
  upgradeFor,
} from '@/lib/voyager/policy';
import { quotaAnswer } from '@/lib/voyager/scenarios';
import { quotaDelta } from '@/lib/voyager/quota';
import { consumeQuestion, peekUsage, releaseQuestion } from '@/lib/voyager/usage';
import { clampFacts } from '@/lib/voyager/pages';
import { isVoyagerScreen } from '@/lib/voyager/screens';
import type { VoyagerRequest, VoyagerResponse } from '@/lib/voyager/types';

/**
 * The one entry point Voyager answers through.
 *
 * The order matters: identity → entitlements → quota → context → model → audit.
 * Tier is read from the session, never from the request body — a widget that could
 * name its own tier could name `private` and ask about a wealth record it has no
 * claim to.
 *
 * What this route accepts is `screens.ts`, not a list written out here again.
 * The copy that used to live in this file was missing `market` and `events`,
 * both of which the chat could legitimately send and the policy layer already
 * understood — so a question asked from a comparison, an Explore page or an
 * event came back 400 and the chat showed the card it shows when the network is
 * down. Nothing was down.
 */

export const dynamic = 'force-dynamic';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * One chip per source, whatever named it.
 *
 * The model's prose line often repeats what the policy layer already listed —
 * "Current page" beside "Current page" reads as two pieces of evidence where
 * there is one, which is the opposite of what a source list is for. The first
 * mention wins, because it is the server's own record rather than the model's
 * account of it.
 */
function dedupe(citations: { label: string; detail?: string }[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = citation.label.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const screen = request.nextUrl.searchParams.get('screen');
  const subject = request.nextUrl.searchParams.get('subject') ?? '';

  if (!isVoyagerScreen(screen)) {
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
  const usage = await peekUsage(user?.id ?? null, quotaFor(user));

  return NextResponse.json({
    tier,
    tierLabel: TIER_LABEL[tier],
    limits: TIER_LIMITS[tier],
    sources,
    remaining: usage.remaining,
    /* The counter the composer shows before anything is asked. */
    used: usage.used,
    total: usage.total,
    signedIn: Boolean(user),
    /** null until the person has answered the personalization question. */
    personalization: user ? personalization : null,
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

  const rawContext = body.context;
  if (!rawContext || !isVoyagerScreen(rawContext.screen)) {
    return badRequest('A valid page context is required.');
  }

  /*
   * The facts a page may state, and nothing else.
   *
   * `facts` was an open map, so anything that could reach this route could put
   * whatever it liked in front of the model. Each screen names its own keys in
   * the capability registry and the rest are dropped here, on the server, where
   * the client cannot argue with it. What Voyager is allowed to see stays
   * reviewable, which is the promise the structured context package exists to
   * keep.
   */
  const context = {
    ...rawContext,
    facts: clampFacts(rawContext.screen, rawContext.facts),
  };

  const user = await currentUser();
  const tier = tierFor(user);

  /*
   * One intentional question costs one unit, whatever it takes to answer it.
   *
   * Counted here, before the model runs, so a slow answer cannot be replayed
   * for free — and counted exactly once, outside everything that follows. The
   * tool loop inside `askVoyager` may make six calls or none; it never reaches
   * this line. Nothing under `lib/voyager/tools/` imports this module, and the
   * unit suite asserts that it stays that way.
   *
   * What is given back is anything that did not buy an answer: see the two
   * `releaseQuestion` calls below.
   */
  const quota = quotaFor(user);
  let usage = await consumeQuestion(user?.id ?? null, quota);

  if (usage.quotaReached) {
    /*
     * Refused, so refunded. The increment is the check — it has to be, or two
     * requests arriving together would both read the same count and both pass
     * — but a refusal that keeps the charge makes the row climb for as long as
     * somebody keeps asking, and the counter they are shown stops meaning
     * anything.
     */
    usage = await releaseQuestion(user?.id ?? null, quota);

    const response: VoyagerResponse = {
      answer: {
        ...quotaAnswer(),
        upgrade: upgradeFor(tier, context, true, Boolean(user)),
      },
      tier,
      remaining: 0,
      used: usage.used,
      total: usage.total,
      quotaReached: true,
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

  /*
   * The chart the last answer drew, by name.
   *
   * Passed through unvalidated on purpose: `recallChart` is the gate, and it
   * accepts nothing but an identifier this process minted. There is no shape a
   * browser can send here that becomes data — the worst case is a lookup that
   * misses and a question answered by fetching, which is what every question
   * did before artifacts existed.
   */
  const answer = await askVoyager({
    question,
    context,
    tier,
    sources: active,
    history,
    artifact: body.artifact,
  });

  /*
   * Nothing was answered, so nothing is charged.
   *
   * `simulated` is set only by the scripted layer, which speaks in exactly two
   * situations: no model is configured here, and the model call failed. Either
   * way the person did not get an answer to their question — they got this
   * platform's written background, labelled as such — and the outage card next
   * to it invites them to press *Retry now*. Charging each of those attempts is
   * how one question becomes five, and it is the likeliest reading of a live
   * counter that moved by five while the client sent one request.
   */
  const decision = quotaDelta({
    before: usage.used - 1,
    quota,
    answered: answer.simulated !== true,
  });

  if (!decision.charged) {
    usage = await releaseQuestion(user?.id ?? null, quota);
  }

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

  /*
   * The chips under an answer, built from what this request was actually given.
   *
   * The model writes a prose `sources` line and it is kept, but it is the
   * model's account of itself. These come from the policy layer — the sources
   * the server put in front of it — and from the search results, which are a
   * record rather than a claim. The prose line goes last, labelled as the
   * model's own note.
   */
  const citations = dedupe([
    ...active.map((source) => ({ label: source.label })),
    ...(answer.citations ?? []),
    ...(answer.sources && answer.sources !== 'General knowledge'
      ? [{ label: answer.sources, detail: 'Stated by Voyager' }]
      : []),
  ]).slice(0, 6);

  const response: VoyagerResponse = {
    answer: {
      ...answer,
      citations,
      upgrade: upgradeFor(tier, context, false, Boolean(user)),
    },
    tier,
    remaining: usage.remaining,
    used: usage.used,
    total: usage.total,
    quotaReached: false,
  };

  return NextResponse.json(response);
}
