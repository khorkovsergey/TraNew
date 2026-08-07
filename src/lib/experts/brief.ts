/**
 * The request Voyager builds from a conversation, and how it finds experts.
 *
 * The old flow asked everyone the same eleven questions whichever of the four
 * services they picked, then showed a directory. The brief replaces the
 * questionnaire: the person says what they are trying to achieve, and this is
 * the structured thing that comes out of it.
 *
 * Most fields are optional on purpose. A brief that demands a budget before it
 * will look for anybody is the questionnaire again with a chat bubble on it.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`.
 */

export type Engagement = 'consultation' | 'project' | 'ongoing' | 'unsure';
export type Urgency = 'asap' | 'days' | 'weeks' | 'flexible';

export type ExpertBrief = {
  /** The person's words, shortened. Not a paraphrase — they have to recognise it. */
  title: string;
  /** What they want to be true afterwards. The one field worth insisting on. */
  goal: string;
  /** Services asked for, as marketplace task ids: strategy | review | finances | tax. */
  services: string[];
  /** Specialisations Voyager inferred. Softer than services, used for ranking. */
  specializations: string[];
  country?: string;
  city?: string;
  /** False only when somebody said they want to meet in person. */
  remoteAccepted: boolean;
  languages: string[];
  currency?: string;
  engagement?: Engagement;
  urgency?: Urgency;
  constraints: string[];
  notes?: string;
  /** Which of the four doors they came through. Context, never a filter. */
  initialCategory?: string;
  updatedAt?: string;
};

export const EMPTY_BRIEF: ExpertBrief = {
  title: '',
  goal: '',
  services: [],
  specializations: [],
  remoteAccepted: true,
  languages: [],
  constraints: [],
};

/**
 * Whether there is enough to look for somebody.
 *
 * A goal and one service. Not a budget, not a country, not a timeline — those
 * narrow a search that has not happened yet, and the brief exists to get
 * somebody to a shortlist, not to a complete profile of themselves.
 */
export function readyToMatch(brief: ExpertBrief): boolean {
  return brief.goal.trim().length > 0 && brief.services.length > 0;
}

/** What Voyager still has no answer for, in the order worth asking. */
export function missingFrom(brief: ExpertBrief): string[] {
  const missing: string[] = [];
  if (!brief.goal.trim()) missing.push('goal');
  if (brief.services.length === 0) missing.push('services');
  // Asked only once there is something to search, because they refine a
  // shortlist rather than decide whether one exists.
  if (readyToMatch(brief)) {
    if (!brief.country) missing.push('location');
    if (brief.languages.length === 0) missing.push('language');
    if (!brief.engagement) missing.push('engagement');
  }
  return missing;
}

/**
 * The stage to show, so the conversation has a visible end.
 *
 * Semantic rather than "question 3 of 12": a counter promises a length nobody
 * committed to, and an adaptive interview cannot honour it.
 */
export type BriefStage = 'understanding' | 'clarifying' | 'ready';

export function stageOf(brief: ExpertBrief): BriefStage {
  if (!readyToMatch(brief)) return 'understanding';
  return missingFrom(brief).length > 0 ? 'clarifying' : 'ready';
}

export const STAGE_LABEL: Record<BriefStage, string> = {
  understanding: 'Understanding your goal',
  clarifying: 'Clarifying preferences',
  ready: 'Ready to find experts',
};

/* ------------------------------------------------------------- The matching */

export type MatchTier = 'best' | 'strong' | 'relevant';

export type ExpertLike = {
  id: string;
  name: string;
  /** Marketplace task ids this expert actually takes on. */
  services?: string[];
  jurisdiction?: string;
  languages?: string;
  remote?: boolean;
  currency?: string;
};

export type Match = {
  expert: ExpertLike;
  tier: MatchTier;
  /** Why this one, computed from the brief. Never more than four. */
  reasons: string[];
};

/**
 * Which constraints a person actually stated, and which are preferences.
 *
 * A hard filter on everything returns nobody, and a search that silently drops
 * a stated requirement is worse than one that returns nothing — the person
 * books somebody who cannot do the thing they asked for.
 *
 * So: the service is hard, because an adviser who does not do tax cannot do
 * tax. A language is hard, because a consultation neither party can hold is not
 * a consultation. Everything else ranks.
 */
export function matchesHardConstraints(expert: ExpertLike, brief: ExpertBrief): boolean {
  if (brief.services.length > 0) {
    const offered = expert.services ?? [];
    if (!brief.services.some((service) => offered.includes(service))) return false;
  }

  if (brief.languages.length > 0 && expert.languages) {
    const spoken = expert.languages.toLowerCase();
    if (!brief.languages.some((language) => spoken.includes(language.toLowerCase()))) return false;
  }

  // Somebody who said they want to meet in person cannot be matched to a
  // remote-only adviser.
  if (!brief.remoteAccepted && expert.remote === true && !expert.jurisdiction) return false;

  return true;
}

export function rank(expert: ExpertLike, brief: ExpertBrief): Match | null {
  if (!matchesHardConstraints(expert, brief)) return null;

  const reasons: string[] = [];
  let score = 0;

  const offered = expert.services ?? [];
  const overlap = brief.services.filter((service) => offered.includes(service));
  if (overlap.length > 0) {
    score += overlap.length * 2;
    reasons.push(`Takes on ${overlap.length === 1 ? 'the service' : 'the services'} you asked for`);
  }

  if (brief.country && expert.jurisdiction?.toLowerCase().includes(brief.country.toLowerCase())) {
    score += 2;
    reasons.push(`Based in ${brief.country}`);
  } else if (brief.remoteAccepted) {
    // Not a reason to prefer somebody, but worth saying when the country did
    // not match — otherwise the card looks like it ignored the preference.
    reasons.push('Works remotely');
  }

  if (brief.languages.length > 0 && expert.languages) {
    const spoken = expert.languages.toLowerCase();
    const shared = brief.languages.filter((language) => spoken.includes(language.toLowerCase()));
    if (shared.length > 0) {
      score += 1;
      reasons.push(`Speaks ${shared.join(', ')}`);
    }
  }

  if (brief.currency && expert.currency === brief.currency) {
    score += 1;
    reasons.push(`Charges in ${brief.currency}`);
  }

  const tier: MatchTier = score >= 5 ? 'best' : score >= 3 ? 'strong' : 'relevant';

  // Four is the ceiling. A card listing eight reasons is a card nobody reads,
  // and the fifth is never the one that decides anything.
  return { expert, tier, reasons: reasons.slice(0, 4) };
}

export const TIER_LABEL: Record<MatchTier, string> = {
  best: 'Best match',
  strong: 'Strong match',
  relevant: 'Relevant',
};

/**
 * The shortlist, best first.
 *
 * No percentages. A number like "97.4% match" is precision this has no model
 * to support, and the reasons say more than a score ever could.
 */
export function matchExperts(experts: ExpertLike[], brief: ExpertBrief): Match[] {
  const order: Record<MatchTier, number> = { best: 0, strong: 1, relevant: 2 };

  return experts
    .map((expert) => rank(expert, brief))
    .filter((match): match is Match => match !== null)
    .sort((a, b) => order[a.tier] - order[b.tier] || a.expert.name.localeCompare(b.expert.name));
}

/**
 * What to offer when nothing matched, and which constraint caused it.
 *
 * "No experts found" is a dead end. Naming the constraint that emptied the list
 * is the difference between a wall and a next step — and the constraint is
 * never relaxed silently, because somebody stated it on purpose.
 */
export function relaxations(experts: ExpertLike[], brief: ExpertBrief): string[] {
  if (matchExperts(experts, brief).length > 0) return [];

  const offers: string[] = [];
  const without = (patch: Partial<ExpertBrief>) =>
    matchExperts(experts, { ...brief, ...patch }).length > 0;

  if (brief.languages.length > 0 && without({ languages: [] })) {
    offers.push('Include experts who do not list your language');
  }
  if (brief.country && without({ country: undefined })) {
    offers.push('Look beyond your country');
  }
  if (!brief.remoteAccepted && without({ remoteAccepted: true })) {
    offers.push('Include remote specialists');
  }
  if (brief.services.length > 1 && without({ services: brief.services.slice(0, 1) })) {
    offers.push('Search for one service at a time');
  }

  return offers;
}

/* ------------------------------------------------------- The next question */

/**
 * What to ask next, chosen from what the brief still lacks.
 *
 * Adaptive because it reads the brief rather than walking a list: answer the
 * location and the location question does not come back. That is the whole
 * difference from the questionnaire this replaces, which asked eleven fixed
 * questions whichever of the four services somebody picked.
 *
 * Returns null when there is enough — the interview has to end on its own, or
 * it is a form with better manners.
 */
export function nextQuestion(brief: ExpertBrief): { field: string; ask: string } | null {
  const [missing] = missingFrom(brief);
  if (!missing) return null;

  switch (missing) {
    case 'goal':
      return {
        field: 'goal',
        ask: 'What are you trying to achieve? Describe it the way you would to a colleague — I will work out which specialist that needs.',
      };
    case 'services':
      return {
        field: 'services',
        ask: 'Is this mainly about building a strategy, reviewing what you already hold, planning your finances, or the tax side of it? More than one is fine.',
      };
    case 'location':
      return {
        field: 'location',
        ask: 'Which country are you in? It decides which rules apply to your situation, not just who is nearby.',
      };
    case 'language':
      return {
        field: 'language',
        ask: 'Which language would you like the consultation in?',
      };
    case 'engagement':
      return {
        field: 'engagement',
        ask: 'Are you after a one-off consultation, a piece of work with an end, or someone ongoing?',
      };
    default:
      return null;
  }
}

/**
 * Answers worth offering as buttons, per question.
 *
 * The mockup's click-through is "answer with the suggested replies (or type
 * freely)", and the reason is that some of these are our vocabulary, not the
 * person's: nobody guesses that "review" is the word this marketplace files
 * portfolio work under. Offering the words removes a guessing game without
 * taking the text box away.
 *
 * The open questions — the goal, the country — have none, because suggesting
 * answers to those would be putting words in somebody's mouth about their own
 * situation.
 */
export const SUGGESTED: Record<string, string[]> = {
  services: [
    'Building a strategy',
    'Reviewing what I hold',
    'Planning my finances',
    'Tax and residency',
  ],
  language: ['English', 'Greek', 'Russian'],
  engagement: ['A one-off consultation', 'A project with an end', 'Someone ongoing'],
};

/** A short line for the brief panel before anything has been said. */
export const EMPTY_BRIEF_NOTE = 'Voyager will build your request here as you talk.';
