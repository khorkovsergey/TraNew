import type { Localized } from './types';

/**
 * Credential status is stated honestly and never softened. "Verified" is reserved
 * for a credential actually checked against a regulator's registry.
 */
export type CredentialStatus =
  | 'verified'
  | 'verification_pending'
  | 'self_declared'
  | 'not_applicable'
  | 'demo';

export type Expert = {
  id: string;
  initials: string;
  name: string;
  provider: Localized;
  credential: CredentialStatus;
  /**
   * Marketplace task ids this expert actually takes on.
   *
   * A hard constraint when matching: an adviser who does not do tax cannot do
   * tax, and ranking them lower instead of excluding them is how somebody books
   * the wrong person. `band` above is the old static badge — it says nothing
   * about any particular request and the brief-driven matching ignores it.
   */
  services: string[];
  jurisdiction: Localized;
  /**
   * Where they actually sit, which is not the same question as which rules they
   * are licensed under. The card shows the city because "Cyprus / EU" answers
   * the regulator's question and not the "can I meet them" one.
   */
  city: Localized;
  /** Years in the work. Stated on the profile, never used to rank. */
  years: number;
  /** Whether they take remote consultations at all. */
  remote: boolean;
  languages: string;
  rating: string;
  consultations: number;
  price: string;
  duration: Localized;
  availability: Localized;
  tile: string;
  color: string;
  reasons: Localized[];
  about: Localized;
  suited: Localized;
  expertise: Localized[];
  credentials: Array<{ k: Localized; v: Localized }>;
  packages: Array<{ id: string; label: Localized; price: string }>;
  reviews: Array<{ rating: string; text: Localized; meta: Localized }>;
  disclosures: Localized[];
};

export const EXPERTS: Expert[] = [
  {
    id: 'ak',
    initials: 'AK',
    name: 'Anna Keller',
    provider: {
      en: 'Regulated investment adviser',
    },
    credential: 'verified',
    services: ['strategy', 'review'],
    jurisdiction: { en: 'Cyprus / EU' },
    city: { en: 'Limassol, Cyprus' },
    years: 12,
    remote: true,
    languages: 'English · Russian',
    rating: '4.9',
    consultations: 214,
    price: '€120',
    duration: { en: '60 min' },
    availability: { en: 'Tomorrow, 14:00' },
    tile: 'var(--tn-blue-tint)',
    color: 'var(--tn-blue)',
    reasons: [
      { en: 'Works with first-time investors' },
      {
        en: 'Licensed for clients in your jurisdiction',
      },
      {
        en: 'Specialises in long-term portfolio construction',
      },
      { en: 'Consults in Russian and English' },
    ],
    about: {
      en: 'Independent adviser focused on long-term, low-cost portfolios. Starts every engagement from goals and risk capacity, not from products.',
    },
    suited: {
      en: 'First-time investors and professionals with idle capital who want a clear, diversified starting plan.',
    },
    expertise: [
      { en: 'Financial planning' },
      { en: 'Long-term investing' },
      { en: 'Portfolio review' },
      { en: 'ETFs' },
      { en: 'Fixed income' },
      { en: 'Retirement planning' },
    ],
    credentials: [
      {
        k: { en: 'Provider type' },
        v: { en: 'Regulated investment adviser' },
      },
      { k: { en: 'Regulator' }, v: { en: 'CySEC' } },
      { k: { en: 'Jurisdiction' }, v: { en: 'Cyprus / EU' } },
      {
        k: { en: 'Licence' },
        v: { en: 'CIF 214/13 · registry link' },
      },
      {
        k: { en: 'Last verified' },
        v: { en: 'Jul 12, 2026' },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '30-minute introductory call' },
        price: '€60',
      },
      {
        id: 'full',
        label: { en: '60-minute consultation' },
        price: '€120',
      },
      {
        id: 'written',
        label: { en: 'Written portfolio review' },
        price: '€90',
      },
    ],
    reviews: [
      {
        rating: '5.0',
        text: {
          en: '“Clear plan and honest about risks. Exactly what I needed to start.”',
        },
        meta: { en: 'Verified client · Jun 2026' },
      },
      {
        rating: '4.8',
        text: {
          en: '“Explained allocation trade-offs in plain language.”',
        },
        meta: { en: 'Verified client · May 2026' },
      },
    ],
    disclosures: [
      {
        en: 'No commissions from products discussed',
      },
      { en: 'Not affiliated with any broker' },
      { en: 'Not a sponsored placement' },
      { en: 'Serves EU residents only' },
    ],
  },

  {
    id: 'mo',
    initials: 'MO',
    name: 'Marcus Okafor',
    provider: { en: 'Financial planner' },
    credential: 'self_declared',
    services: ['finances', 'strategy'],
    jurisdiction: { en: 'United Kingdom' },
    city: { en: 'London, United Kingdom' },
    years: 9,
    remote: true,
    languages: 'English · French',
    rating: '4.8',
    consultations: 167,
    price: '€95',
    duration: { en: '60 min' },
    availability: { en: 'Fri, 10:00' },
    tile: 'var(--tn-green-tint)',
    color: 'var(--tn-green)',
    reasons: [
      {
        en: 'Specialises in multi-asset portfolio reviews',
      },
      { en: 'Strong focus on risk analysis' },
      {
        en: 'Experience with cross-border situations',
      },
    ],
    about: {
      en: 'Financial planner working with households and expats. Builds full financial pictures: cash flow, goals, existing portfolios and pensions.',
    },
    suited: {
      en: 'People who already invest and want an independent, structured second opinion on their portfolio.',
    },
    expertise: [
      { en: 'Portfolio review' },
      { en: 'Risk analysis' },
      { en: 'Budgeting' },
      { en: 'Pensions' },
      { en: 'Multi-asset allocation' },
    ],
    credentials: [
      {
        k: { en: 'Provider type' },
        v: { en: 'Financial planner' },
      },
      {
        k: { en: 'Status' },
        v: {
          en: 'Self-declared, verification pending',
        },
      },
      {
        k: { en: 'Jurisdiction' },
        v: { en: 'United Kingdom' },
      },
      {
        k: { en: 'Membership' },
        v: { en: 'CISI (declared)' },
      },
      {
        k: { en: 'Last check' },
        v: {
          en: 'Not yet verified against registry',
        },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '30-minute introductory call' },
        price: '€45',
      },
      {
        id: 'full',
        label: { en: '60-minute consultation' },
        price: '€95',
      },
      {
        id: 'written',
        label: { en: 'Written portfolio review' },
        price: '€75',
      },
    ],
    reviews: [
      {
        rating: '4.9',
        text: {
          en: '“Found two concentration risks I had completely missed.”',
        },
        meta: { en: 'Verified client · Jul 2026' },
      },
    ],
    disclosures: [
      { en: 'Accepts no product commissions' },
      {
        en: 'Independent — no broker affiliation',
      },
      { en: 'Not a sponsored placement' },
    ],
  },

  {
    id: 'sl',
    initials: 'SL',
    name: 'Sofia Lindqvist',
    provider: {
      en: 'TradingNew platform specialist',
    },
    credential: 'not_applicable',
    services: ['review'],
    jurisdiction: { en: 'Sweden / EU' },
    city: { en: 'Stockholm, Sweden' },
    years: 6,
    remote: true,
    languages: 'English · Swedish',
    rating: '5.0',
    consultations: 98,
    price: '€40',
    duration: { en: '45 min' },
    availability: { en: 'Mon, 09:30' },
    tile: 'var(--tn-purple-tint)',
    color: 'var(--tn-purple)',
    reasons: [
      {
        en: 'Helps set up screeners, watchlists and alerts',
      },
      {
        en: 'Ideal for getting productive with TradingNew tools',
      },
      {
        en: 'Not an investment adviser — platform guidance only',
      },
    ],
    about: {
      en: 'Platform specialist helping users get the most out of TradingNew: charts, screeners, alerts, portfolios and research workflows.',
    },
    suited: {
      en: 'Users who want to master the platform itself, not receive financial advice.',
    },
    expertise: [
      { en: 'Supercharts' },
      { en: 'Screeners' },
      { en: 'Alerts & watchlists' },
      { en: 'Portfolio tools' },
      { en: 'Research workflow' },
    ],
    credentials: [
      {
        k: { en: 'Provider type' },
        v: { en: 'Platform specialist' },
      },
      {
        k: { en: 'Status' },
        v: {
          en: 'No licence required for this service',
        },
      },
      { k: { en: 'Jurisdiction' }, v: { en: 'EU' } },
      {
        k: { en: 'Employer' },
        v: { en: 'TradingNew certified partner' },
      },
      {
        k: { en: 'Last verified' },
        v: { en: 'Jun 30, 2026' },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '45-minute platform session' },
        price: '€40',
      },
      {
        id: 'full',
        label: { en: '90-minute deep dive' },
        price: '€70',
      },
      {
        id: 'written',
        label: { en: 'Written setup review' },
        price: '€35',
      },
    ],
    reviews: [
      {
        rating: '5.0',
        text: {
          en: '“Set up my entire research workflow in one session.”',
        },
        meta: { en: 'Verified client · Jun 2026' },
      },
    ],
    disclosures: [
      {
        en: 'Does not provide investment advice',
      },
      { en: 'TradingNew certified partner' },
      { en: 'Not a sponsored placement' },
    ],
  },

  /*
   * Tax and wealth planning had no provider at all.
   *
   * Two of the four doors on the discovery screen led to an empty shortlist
   * every time, and an empty shortlist reads as a broken marketplace rather
   * than as an honest "nobody here does that" — the person never learns which
   * it was. These two cover the gap, and the tax adviser is deliberately not
   * an investment adviser: bundling both into one profile would let a single
   * booking imply advice the person is not licensed to give.
   */
  {
    id: 'ep',
    initials: 'EP',
    name: 'Elena Papadopoulou',
    provider: { en: 'Tax adviser and legal consultant' },
    credential: 'verified',
    services: ['tax'],
    jurisdiction: { en: 'Cyprus / EU' },
    city: { en: 'Nicosia, Cyprus' },
    years: 14,
    remote: true,
    languages: 'English · Greek · Russian',
    rating: '4.8',
    consultations: 96,
    price: '€110',
    duration: { en: '60 min' },
    availability: { en: 'Thu, 09:30' },
    tile: 'var(--tn-orange-tint)',
    color: 'var(--tn-orange)',
    reasons: [
      { en: 'Cyprus tax residency and non-dom status' },
      { en: 'Works with people who have just relocated' },
      { en: 'Coordinates with your investment adviser' },
    ],
    about: {
      en: 'Licensed tax adviser working with individuals who have moved jurisdiction. Explains what your residency actually changes — reporting duties, treaty relief, and what the first tax year looks like in practice.',
    },
    suited: {
      en: 'People who have relocated, or are about to, and need the tax picture settled before they restructure anything.',
    },
    expertise: [
      { en: 'Tax residency' },
      { en: 'Non-dom status' },
      { en: 'Double taxation treaties' },
      { en: 'Cross-border reporting' },
      { en: 'Company structuring' },
    ],
    credentials: [
      {
        k: { en: 'Provider type' },
        v: { en: 'Tax adviser and legal consultant' },
      },
      { k: { en: 'Regulator' }, v: { en: 'ICPAC' } },
      { k: { en: 'Jurisdiction' }, v: { en: 'Cyprus / EU' } },
      {
        k: { en: 'Licence' },
        v: { en: 'ICPAC 4471 · registry link' },
      },
      {
        k: { en: 'Last verified' },
        v: { en: 'Jun 30, 2026' },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '30-minute residency question' },
        price: '€55',
      },
      {
        id: 'full',
        label: { en: '60-minute consultation' },
        price: '€110',
      },
      {
        id: 'written',
        label: { en: 'Written tax position note' },
        price: '€180',
      },
    ],
    reviews: [
      {
        rating: '5.0',
        text: {
          en: '“Explained the first tax year after moving without making it frightening.”',
        },
        meta: { en: 'Verified client · Jun 2026' },
      },
      {
        rating: '4.7',
        text: {
          en: '“Told me plainly which parts she could not answer and who could.”',
        },
        meta: { en: 'Verified client · Apr 2026' },
      },
    ],
    disclosures: [
      { en: 'Tax and legal guidance only — not investment advice' },
      { en: 'No commissions from any product or provider' },
      { en: 'Not a sponsored placement' },
      { en: 'Advises on Cypriot and EU law only' },
    ],
  },

  {
    id: 'ac',
    initials: 'AC',
    name: 'Andreas Christou',
    provider: { en: 'Wealth planner and portfolio adviser' },
    credential: 'verified',
    services: ['finances', 'strategy', 'review'],
    jurisdiction: { en: 'Cyprus / EU' },
    city: { en: 'Limassol, Cyprus' },
    years: 11,
    remote: true,
    languages: 'English · Greek',
    rating: '4.9',
    consultations: 143,
    price: '€130',
    duration: { en: '60 min' },
    availability: { en: 'Wed, 11:00' },
    tile: 'var(--tn-mint-tint)',
    color: 'var(--tn-mint)',
    reasons: [
      { en: 'Long-horizon wealth plans, not product selection' },
      { en: 'Regularly works with relocating investors' },
      { en: 'Coordinates with a tax adviser where needed' },
    ],
    about: {
      en: 'Builds long-horizon plans for households and relocating professionals: what the money is for, when it is needed, and the allocation that follows from those two answers. Sessions end in a written plan you keep.',
    },
    suited: {
      en: 'People with a life change in progress — a move, a sale, an inheritance — who want the whole picture structured rather than one holding reviewed.',
    },
    expertise: [
      { en: 'Wealth planning' },
      { en: 'Portfolio structuring' },
      { en: 'Relocating investors' },
      { en: 'ETF portfolios' },
      { en: 'Goal and horizon mapping' },
    ],
    credentials: [
      {
        k: { en: 'Provider type' },
        v: { en: 'Regulated investment adviser' },
      },
      { k: { en: 'Regulator' }, v: { en: 'CySEC' } },
      { k: { en: 'Jurisdiction' }, v: { en: 'Cyprus / EU' } },
      {
        k: { en: 'Licence' },
        v: { en: 'CIF 189/12 · registry link' },
      },
      {
        k: { en: 'Last verified' },
        v: { en: 'Jul 2, 2026' },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '30-minute introductory call' },
        price: '€65',
      },
      {
        id: 'full',
        label: { en: '60-minute consultation' },
        price: '€130',
      },
      {
        id: 'written',
        label: { en: 'Written wealth plan' },
        price: '€210',
      },
    ],
    reviews: [
      {
        rating: '5.0',
        text: {
          en: '“Read the brief before we met. We spent the hour on decisions, not background.”',
        },
        meta: { en: 'Verified client · Jul 2026' },
      },
      {
        rating: '4.9',
        text: {
          en: '“Said outright which parts needed a tax adviser instead of guessing.”',
        },
        meta: { en: 'Verified client · May 2026' },
      },
    ],
    disclosures: [
      { en: 'No commissions from products discussed' },
      { en: 'Not affiliated with any broker' },
      { en: 'Not a sponsored placement' },
      { en: 'Serves EU residents only' },
    ],
  },
];

/**
 * The doors on the discovery screen.
 *
 * Named after the specialism somebody is looking for rather than after the
 * sentence they would say — the tabs sit above a conversation that asks for the
 * sentence, so repeating it in the tab wastes the row. Each maps to exactly one
 * service id, and the fifth deliberately maps to none: "not sure" is the honest
 * answer for most people arriving here, and pretending it is a category would
 * file them under a guess.
 */
export const EXPERT_CATEGORIES: Array<{
  id: string;
  /** The service id this door corresponds to. Null for "not sure". */
  service: string | null;
  title: Localized;
  icon: 'pie' | 'trendUp' | 'scale' | 'shield' | 'help';
  color: string;
}> = [
  {
    id: 'review',
    service: 'review',
    title: { en: 'Portfolio review' },
    icon: 'pie',
    color: 'var(--tn-mint)',
  },
  {
    id: 'strategy',
    service: 'strategy',
    title: { en: 'Investment advisory' },
    icon: 'trendUp',
    color: 'var(--tn-blue)',
  },
  {
    id: 'tax',
    service: 'tax',
    title: { en: 'Tax and legal' },
    icon: 'scale',
    color: 'var(--tn-orange-star)',
  },
  {
    id: 'finances',
    service: 'finances',
    title: { en: 'Wealth planning' },
    icon: 'shield',
    color: 'var(--tn-purple)',
  },
  {
    id: 'unsure',
    service: null,
    title: { en: 'Not sure where to start?' },
    icon: 'help',
    color: 'var(--tn-text-soft)',
  },
];

/** Everything a consultation could expose. All default to off, without exception. */
export const SHARING_ITEMS = [
  { id: 'brief', label: { en: 'Consultation brief' } },
  { id: 'portfolio', label: { en: 'Portfolio overview' } },
  { id: 'holdings', label: { en: 'Individual holdings' } },
  { id: 'goals', label: { en: 'Goals and risk profile' } },
  { id: 'research', label: { en: 'Saved research' } },
  { id: 'voyager', label: { en: 'Voyager thread' } },
  { id: 'documents', label: { en: 'Uploaded documents' } },
];

export const NEVER_SHARED = [
  { en: 'Your login credentials' },
  { en: 'Transaction history' },
  { en: 'Voyager threads you did not select' },
  { en: 'Payment details' },
];

/** Four separate consents — bundling them would make any single one unprovable. */
export const CONSENTS = [
  {
    id: 'ai',
    label: {
      en: 'I agree that AI may process my brief to prepare this consultation.',
    },
  },
  {
    id: 'sharing',
    label: {
      en: 'I agree to share the data I selected with this expert.',
    },
  },
  {
    id: 'terms',
    label: {
      en: 'I accept the Marketplace terms of service.',
    },
  },
  {
    id: 'cancellation',
    label: {
      en: 'I have read the cancellation and refund policy.',
    },
  },
];

export const SLOTS: Localized[] = [
  { en: 'Tomorrow, 14:00' },
  { en: 'Tomorrow, 16:30' },
  { en: 'Thu, 11:00' },
  { en: 'Fri, 09:30' },
];

export const BOOKING_REFERENCE = 'TN-8347';

/** The nine sections of the post-consultation summary. */
export const SUMMARY_SECTIONS: Array<{ id: string; title: Localized; body: Localized }> = [
  {
    id: 'question',
    title: { en: 'Your original question' },
    body: {
      en: 'How should I start investing €40,000 that is currently sitting in a savings account, with a horizon of about ten years?',
    },
  },
  {
    id: 'context',
    title: { en: 'Context reviewed' },
    body: {
      en: 'Consultation brief, goals and risk profile. No individual holdings or documents were shared for this session.',
    },
  },
  {
    id: 'observations',
    title: { en: 'Key observations' },
    body: {
      en: 'The full amount sits in one currency and one account. A ten-year horizon allows more equity exposure than currently held, but the absence of an emergency reserve is the more pressing gap.',
    },
  },
  {
    id: 'risks',
    title: { en: 'Risks' },
    body: {
      en: 'Concentration in a single currency; sensitivity of long-duration bonds to rate changes; behavioural risk of reacting to short-term drawdowns.',
    },
  },
  {
    id: 'options',
    title: { en: 'Options discussed' },
    body: {
      en: 'Phased entry over six to twelve months versus a single allocation; broad index funds versus a mixed core-satellite structure; holding three to six months of expenses in cash first.',
    },
  },
  {
    id: 'next',
    title: { en: 'Suggested next steps' },
    body: {
      en: 'These are research directions, not instructions to buy: size an emergency reserve, compare two broad index funds on cost and domicile, and decide on an entry schedule before choosing instruments.',
    },
  },
  {
    id: 'documents',
    title: { en: 'Documents' },
    body: {
      en: 'Allocation range worksheet (PDF) · Session notes (PDF)',
    },
  },
  {
    id: 'disclosures',
    title: { en: 'Expert disclosures' },
    body: {
      en: 'No commissions from any product discussed. Not affiliated with any broker. Not a sponsored placement.',
    },
  },
  {
    id: 'followup',
    title: { en: 'Follow-up' },
    body: {
      en: 'A follow-up session is optional. Book one when you have made the entry-schedule decision, not before.',
    },
  },
];

export function expertById(id: string): Expert | undefined {
  return EXPERTS.find((expert) => expert.id === id);
}
