/**
 * What a person has left, and what a plan changes.
 *
 * The rule that shapes all of it: **the first request is never blocked.** A
 * workspace that asks for a card before it has shown what it does is asking
 * somebody to buy something they have not seen. Limits exist and are stated
 * plainly, but they arrive after the demonstration rather than in place of it.
 *
 * The meter is honest in both directions. It turns amber before it runs out
 * rather than at zero, because a limit somebody discovers at the moment it
 * stops them is a limit that feels like a trick — and it never counts down
 * faster than the work actually spent.
 *
 * Import-free, so the harness compiles it alone.
 */

export type Plan = 'guest' | 'free' | 'pro' | 'private';

export type Allowance = {
  plan: Plan;
  /** Messages for a guest, tokens for an account: different units, stated. */
  unit: 'messages' | 'tokens';
  used: number;
  total: number;
};

/** A guest gets enough to see what this does before anything is asked of them. */
export const GUEST_MESSAGES = 100;

/** Signing up grants these, which is the whole offer on the landing. */
export const SIGNUP_TOKENS = 3000;

/** Amber at 85%, so the warning arrives while there is still room to act on it. */
export const SOFT_LIMIT = 0.85;

export function allowanceFor(plan: Plan, used: number): Allowance {
  if (plan === 'guest') {
    return { plan, unit: 'messages', used, total: GUEST_MESSAGES };
  }

  // Paid plans are not metered in this build; they report their own ceiling so
  // the meter never claims a number nobody is counting.
  const total = plan === 'free' ? SIGNUP_TOKENS : Number.POSITIVE_INFINITY;
  return { plan, unit: 'tokens', used, total };
}

export type MeterState = 'ok' | 'low' | 'spent' | 'unmetered';

export function meterState(allowance: Allowance): MeterState {
  if (!Number.isFinite(allowance.total)) return 'unmetered';
  if (allowance.used >= allowance.total) return 'spent';
  return allowance.used / allowance.total >= SOFT_LIMIT ? 'low' : 'ok';
}

/** The line under the composer. Says the unit, because the two are not the same. */
export function meterLabel(allowance: Allowance): string {
  if (!Number.isFinite(allowance.total)) {
    return allowance.plan === 'pro' ? 'Pro · no message limit' : 'Private AI · no message limit';
  }

  if (allowance.unit === 'messages') {
    return `${allowance.used} / ${allowance.total} free messages · Guest`;
  }

  const left = Math.max(0, allowance.total - allowance.used);
  return `${left.toLocaleString('en-US')} tokens left · Free account`;
}

/**
 * Whether a request can go ahead.
 *
 * The first request is never blocked, whatever the count says — somebody
 * arriving with a spent allowance from a previous session still gets to see
 * what this does before being asked for anything.
 */
export function canAsk(allowance: Allowance, isFirstRequest: boolean): boolean {
  if (isFirstRequest) return true;
  return meterState(allowance) !== 'spent';
}

export type Feature = 'screener' | 'pine' | 'wealth' | 'deep-research';

/**
 * Which plan a feature needs, and why.
 *
 * The reason is required by the type, and it is a reason about cost rather than
 * a sales line. "Because Pro" tells nobody anything; "each run reads four
 * thousand filings" is a fact somebody can weigh.
 */
export const FEATURE_PLAN: Record<Feature, { plan: Plan; because: string }> = {
  screener: {
    plan: 'pro',
    because: 'Each run reads the filings of four thousand companies, which is the expensive part.',
  },
  pine: {
    plan: 'pro',
    because: 'Generating and checking a script is several model passes over your source.',
  },
  wealth: {
    plan: 'pro',
    because:
      'Portfolio analysis reads your holdings and prices every one of them, which costs a request per position.',
  },
  'deep-research': {
    plan: 'pro',
    because: 'Deep research reads dozens of sources per question rather than one.',
  },
};

export type PlanOffer = {
  id: Plan;
  name: string;
  price: string;
  /** What it is for, in one line. Not a feature list. */
  summary: string;
  points: string[];
};

export const PLANS: PlanOffer[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'No card',
    summary: 'Enough to work with, and enough to decide whether the rest is worth it.',
    points: [
      `${SIGNUP_TOKENS.toLocaleString('en-US')} tokens on sign-up`,
      'Saved workspaces and monitoring that keeps running',
      'Charts, comparisons and market questions',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Paid',
    summary: 'For the work that reads a lot of data per question.',
    points: [
      'Screeners over the full filing set',
      'Pine Script generation and checking',
      'Portfolio analysis with your Wealth Hub',
      'Deep research across many sources',
    ],
  },
  {
    id: 'private',
    name: 'Private AI',
    price: 'Paid',
    summary: 'For people who need their data never to leave their own boundary.',
    points: [
      'Everything in Pro',
      'Analysis inside your own environment',
      'No content retained anywhere else',
    ],
  },
];

/** The perks the sign-up modal lists. Four, and each one a thing that happens. */
export const SIGNUP_PERKS = [
  `${SIGNUP_TOKENS.toLocaleString('en-US')} tokens, enough for roughly forty questions`,
  'Workspaces that are still there tomorrow',
  'Monitoring rules that keep running while you are away',
  'Your own data read only with permission, and only when you ask',
];
