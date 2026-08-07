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

/** Match quality is a band, never a percentage — a number would imply false precision. */
export type MatchBand = 'best' | 'strong' | 'suitable';

export type Expert = {
  id: string;
  initials: string;
  name: string;
  provider: Localized;
  credential: CredentialStatus;
  band: MatchBand;
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
    band: 'best',
    services: ['strategy', 'review'],
    jurisdiction: { en: 'Cyprus / EU' },
    languages: 'EN · RU',
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
    band: 'strong',
    services: ['finances', 'strategy'],
    jurisdiction: { en: 'United Kingdom' },
    languages: 'EN · FR',
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
    band: 'suitable',
    services: ['review'],
    jurisdiction: { en: 'Sweden / EU' },
    languages: 'EN · SV',
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
];

export const EXPERT_TASKS = [
  {
    id: 'strategy',
    title: { en: 'Build my investment strategy' },
    desc: {
      en: 'For users who have capital but are unsure how to allocate it.',
    },
  },
  {
    id: 'review',
    title: { en: 'Review my portfolio' },
    desc: {
      en: 'For users who already invest and want an independent professional perspective.',
    },
  },
  {
    id: 'finances',
    title: { en: 'Plan my finances' },
    desc: {
      en: 'For budgeting, financial planning, debt, savings and long-term goals.',
    },
  },
  {
    id: 'market',
    title: { en: 'Understand a market or asset' },
    desc: {
      en: 'For a focused consultation about an industry, market or asset class.',
    },
  },
];

export type IntakeQuestion = {
  key: string;
  question: Localized;
  hint?: Localized;
  options: Localized[];
};

export const INTAKE: IntakeQuestion[] = [
  {
    key: 'task',
    question: { en: 'What would you like help with?' },
    options: [
      ...EXPERT_TASKS.map((task) => task.title),
      { en: 'Something else' },
    ],
  },
  {
    key: 'outcome',
    question: {
      en: 'What outcome are you looking for?',
    },
    options: [
      { en: 'A clear plan I can follow' },
      { en: 'An independent second opinion' },
      { en: 'Understanding my options' },
      { en: 'Help with a specific question' },
    ],
  },
  {
    key: 'experience',
    question: { en: 'Have you invested before?' },
    options: [
      { en: 'No, never' },
      { en: 'A little' },
      { en: 'Regularly' },
    ],
  },
  {
    key: 'country',
    question: { en: 'Which country do you live in?' },
    options: [
      { en: 'Cyprus' },
      { en: 'Germany' },
      { en: 'United Kingdom' },
      { en: 'Other EU' },
    ],
  },
  {
    key: 'language',
    question: {
      en: 'Which language would you prefer?',
    },
    options: [
      { en: 'English' },
      { en: 'Russian' },
      { en: 'Both' },
    ],
  },
  {
    key: 'amount',
    question: {
      en: 'What approximate amount is relevant?',
    },
    hint: {
      en: 'Capital range helps us find experts who normally work with situations similar to yours. You do not need to share an exact amount.',
    },
    options: [
      { en: 'Under €10,000' },
      { en: '€10,000 – €50,000' },
      { en: '€50,000 – €250,000' },
      { en: 'Over €250,000' },
      { en: 'Prefer to skip' },
    ],
  },
  {
    key: 'format',
    question: {
      en: 'Would you like a video call, chat or written review?',
    },
    options: [
      { en: 'Video call' },
      { en: 'Chat' },
      { en: 'Written review' },
    ],
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
