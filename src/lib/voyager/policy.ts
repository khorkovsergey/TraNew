import 'server-only';
import { getConsent } from '@/lib/consent';
import { hasPlan, type AuthedUser } from '@/lib/session';
import type {
  VoyagerContext,
  VoyagerSource,
  VoyagerTier,
  VoyagerUpgrade,
} from './types';

/**
 * Policy layer — what Voyager is allowed to see, ask and offer.
 *
 * Everything here is decided on the server. The widget reports which sources the
 * person switched off, but it does not get to say which tier it is or which
 * sources exist: a client that could claim `private` would be claiming access to
 * the wealth record.
 *
 * The upgrade card lives here too rather than in the model. Whether someone
 * should be offered a paid tier is an entitlement fact, not something a language
 * model should improvise mid-answer.
 */

export function tierFor(user: AuthedUser | null): VoyagerTier {
  if (!user) return 'basic';
  return hasPlan(user, 'ai_private') ? 'private' : 'personal';
}

export const TIER_LABEL: Record<VoyagerTier, string> = {
  basic: 'Voyager Basic',
  personal: 'Voyager Personal',
  private: 'Voyager Private',
};

/** Shown under the input. Product units, deliberately not token counts. */
export const TIER_LIMITS: Record<VoyagerTier, string> = {
  basic: 'Basic: limited questions per day, public data only',
  personal: 'Personal: history saved · limited deep analysis',
  private: 'Private AI: extended analysis, documents, portfolio',
};

/** Questions per day. Reaching it opens an upgrade card, never a wall. */
export const TIER_QUOTA: Record<VoyagerTier, number | null> = {
  basic: 3,
  personal: 40,
  private: null,
};

/**
 * The context sources for a page at a tier.
 *
 * Sources grow with the tier: Basic sees the page, Personal adds what the person
 * told us about themselves, Private adds the wealth record — and that last one
 * only ever appears with a consent record behind it.
 */
export async function sourcesFor(
  context: VoyagerContext,
  tier: VoyagerTier,
  user: AuthedUser | null,
  personalization: boolean
): Promise<VoyagerSource[]> {
  const sources: VoyagerSource[] = [
    { id: 'page', label: pageSourceLabel(context) },
  ];

  // Market data is only claimed where the page is actually about markets. A generic
  // page listing it would overstate what the answer rests on.
  const marketPages = ['chart', 'symbol', 'economy', 'indicator', 'news', 'portfolio', 'wealth'];
  if (marketPages.includes(context.screen)) {
    sources.push({ id: 'market', label: 'Market data & news' });
  }

  if (tier !== 'basic' && personalization) {
    sources.push({ id: 'profile', label: 'Your watchlist & interests' });
  }

  if (tier === 'private' && user) {
    // The wealth record is never implied by the plan alone — a separate, revocable
    // consent has to exist, and it is listed so the person can switch it off here.
    const consent = await getConsent(user.id, 'voyager_context');
    if (consent.granted) {
      sources.push({
        id: 'wealth',
        label: 'Portfolio & risk profile',
        requiresConsent: true,
      });
      sources.push({ id: 'memory', label: 'Conversation memory' });
    }
  }

  return sources;
}

function pageSourceLabel(context: VoyagerContext): string {
  switch (context.screen) {
    case 'chart':
      return `Current chart: ${context.subject}`;
    case 'wealth':
      return 'Wealth Profile (with your permission)';
    case 'academy':
      return 'Current lesson & your progress';
    case 'events':
      return 'Upcoming events & your location';
    case 'strategy':
      return 'Your interview answers';
    case 'generic':
      return 'Current page';
    default:
      return `Current page: ${context.subject}`;
  }
}

/** The "Using: …" summary line, built from whatever survived the toggles. */
export function usingLine(sources: VoyagerSource[], disabled: string[]): string {
  const active = sources.filter((source) => !disabled.includes(source.id));
  if (active.length === 0) return 'No context — general answers only';
  return active.map((source) => source.label.split(':')[0].split(' (')[0]).join(' + ');
}

/**
 * The contextual upgrade card, or nothing.
 *
 * Two cases only: the person ran out of questions, or the page is one where a
 * higher tier would genuinely answer better. Anything else would be an ad.
 */
export function upgradeFor(
  tier: VoyagerTier,
  context: VoyagerContext,
  quotaReached: boolean,
  signedIn: boolean
): VoyagerUpgrade | undefined {
  if (quotaReached) {
    return {
      text: signedIn
        ? 'Voyager Private can also analyze your portfolio and documents, and remembers your context between sessions.'
        : 'Voyager Personal saves history and uses your watchlist. Voyager Private can also analyze your portfolio and documents.',
      cta: signedIn ? 'Unlock Voyager Private' : 'Create free account',
      intent: signedIn ? 'unlock_private' : 'sign_up',
    };
  }

  if (tier === 'private') return undefined;

  const portfolioRelevant =
    context.screen === 'symbol' ||
    context.screen === 'chart' ||
    context.screen === 'portfolio' ||
    context.screen === 'indicator';

  if (tier === 'basic' && portfolioRelevant) {
    return {
      text: 'Voyager Private could also check how this move affects your actual portfolio.',
      cta: 'Analyze my portfolio',
      intent: signedIn ? 'unlock_private' : 'sign_up',
    };
  }

  if (tier === 'personal' && context.screen === 'wealth') {
    return {
      text: 'Voyager Private can read your Wealth Profile and answer with your own figures.',
      cta: 'Unlock Voyager Private',
      intent: 'unlock_private',
    };
  }

  return undefined;
}
