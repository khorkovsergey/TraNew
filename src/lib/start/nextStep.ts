import type { ContextKind } from '@/lib/voyager/session';
import {
  CLARIFICATIONS,
  INTENT_ORDER_BEGINNER,
  INTENT_ORDER_EXPERIENCED,
  INTENT_SELF,
  LEVEL_PHRASE,
  LEVEL_SELF,
  RESULT_REASON,
  type ClarificationSpec,
  type NextStepAnswers,
  type NextStepIntent,
  type NextStepLevel,
  type NextStepResultKey,
} from '@/content/nextStep';

/**
 * Which door "Find my next step" opens.
 *
 * Everything here is a pure function of the answers. No React, no storage, no
 * `window` — which is what makes the routing table something you can read in one
 * sitting and test without a browser. The component decides when to ask; this
 * file decides only what the answers mean.
 *
 * The rule the whole table obeys: **an explicit intent always beats the level
 * that suggested it.** A professional who says they want an expert gets Expert
 * Services. Level orders the options and colours the explanation; it never
 * overrules what somebody actually pressed.
 */

/**
 * The context Voyager is opened with from this router.
 *
 * It should be `'start'`, labelled "Find my next step". `ContextKind` is
 * declared in `lib/voyager/session.ts`, which belongs to the Voyager section,
 * and a section does not edit another section's file — so this is `'home'` until
 * that two-line addition is made there. The stand-in is true rather than merely
 * harmless: this router is what the Home CTA opens, and the status strip saying
 * "Home" describes where the reader came from.
 *
 * One constant, so the swap is one line rather than a search.
 */
export const NEXT_STEP_VOYAGER_CONTEXT: ContextKind = 'home';

const EXPERIENCED: readonly NextStepLevel[] = ['investor', 'active', 'pro'];

export function isExperienced(level: NextStepLevel | null): boolean {
  return level !== null && EXPERIENCED.includes(level);
}

/** Everything that is not experienced, including "I'm not sure" and no answer at all. */
export function isBeginner(level: NextStepLevel | null): boolean {
  return !isExperienced(level);
}

export function intentOrder(level: NextStepLevel | null): NextStepIntent[] {
  return isExperienced(level) ? INTENT_ORDER_EXPERIENCED : INTENT_ORDER_BEGINNER;
}

/**
 * The clarifying question for an intent, or null when there is nothing worth
 * asking.
 *
 * Two intents bend with the level. `tools` asks nothing of somebody who already
 * trades — they answered it in step 1, and asking again would read as being told
 * they are not ready. `explore` keeps all three options either way and only
 * changes which is read first.
 */
export function clarificationFor(
  intent: NextStepIntent | null,
  level: NextStepLevel | null
): ClarificationSpec | null {
  if (intent === null) return null;
  if (intent === 'tools' && isExperienced(level)) return null;

  const spec = CLARIFICATIONS[intent];
  if (!spec) return null;

  if (intent === 'explore' && isExperienced(level)) {
    const by = (id: string) => spec.options.find((option) => option.id === id);
    const reordered = [by('ideas'), by('research'), by('understand')].filter(
      (option) => option !== undefined
    );
    return { ...spec, options: reordered };
  }

  return spec;
}

/** Whether this intent still has a question to ask before it can be answered. */
export function needsClarification(
  intent: NextStepIntent | null,
  level: NextStepLevel | null
): boolean {
  return clarificationFor(intent, level) !== null;
}

/**
 * The recommendation.
 *
 * Total: every combination of answers resolves, including the ones that skipped
 * a question. A router that can return nothing is a dead end, and a dead end is
 * the one outcome this screen exists to remove.
 */
export function resolve(answers: NextStepAnswers): NextStepResultKey {
  const { level, intent, clarification } = answers;

  // Named intents that route on their own. Checked before anything reads the
  // level, because this is where "intent wins" is actually enforced.
  if (intent === 'organize') return 'wealth';
  if (intent === 'expert') return 'experts';

  // No intent at all is the step-1 escape hatch, which lands in the same place
  // as saying so out loud.
  if (intent === null || intent === 'unsure') return 'voyagerCtx';

  if (intent === 'tools') {
    if (isExperienced(level)) return 'tradingview';
    if (clarification === 'ground') return 'learn';
    if (clarification === 'try') return 'practice';
    return 'tradingview';
  }

  if (intent === 'learn') {
    if (clarification === 'try') return 'practice';
    if (clarification === 'course') return 'academy';
    if (clarification === 'unsure') return 'learnDiag';
    return 'learn';
  }

  if (intent === 'explore') {
    if (clarification === 'ideas') return 'ideas';
    if (clarification === 'research') return 'voyager';
    return 'explore';
  }

  if (intent === 'improve') {
    // The one place the level changes a destination rather than an order:
    // "I want to understand it myself" means the ideas feed to somebody who
    // trades and the Explore overview to everybody else.
    if (clarification === 'self') return level === 'active' || level === 'pro' ? 'ideas' : 'explore';
    if (clarification === 'ai') return 'voyager';
    if (clarification === 'full') return 'wealth';
    if (clarification === 'person') return 'experts';
    return 'voyager';
  }

  // courses
  if (clarification === 'pace') return 'learn';
  if (clarification === 'online') return 'eventsOnline';
  if (clarification === 'near') return 'eventsNear';
  if (clarification === 'meet') return 'community';
  return 'academy';
}

/**
 * Why this destination, in one paragraph.
 *
 * Composed rather than stored per combination: the reason is the destination's,
 * and the level only decides how the sentence opens. Fourteen destinations times
 * six levels would be eighty-four paragraphs to keep in agreement with each
 * other, and they would not stay in agreement.
 */
export function reasonFor(key: NextStepResultKey, level: NextStepLevel | null): string {
  const reason = RESULT_REASON[key];
  if (!reason.withLevel) return reason.text;

  // Without a level the sentence still has to read as English, so it starts at
  // the destination rather than at a half-finished clause about the reader.
  const phrase = level ? LEVEL_PHRASE[level] : 'You’re still mapping out where you fit';
  return phrase + reason.tail;
}

/**
 * The question Voyager opens with.
 *
 * Built from what the router already knows so the conversation does not start by
 * asking it all again. The person's own words are appended by the caller and go
 * to Voyager through session storage — never through the URL, which is in the
 * history, in the next referrer and in every log along the way.
 */
export function voyagerPrompt(answers: NextStepAnswers, freeText?: string): string {
  const context = [
    answers.level ? LEVEL_SELF[answers.level] : null,
    answers.intent ? INTENT_SELF[answers.intent] : null,
  ]
    .filter((line): line is string => line !== null)
    .join(' ');

  const question = freeText?.trim();
  if (!question) return context || 'Help me work out where to start on TradingNew.';

  return context ? `${context}\nMy question: ${question}` : question;
}
