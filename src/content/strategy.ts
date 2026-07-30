import type { Localized } from './types';

export type StrategyStep = {
  id: string;
  title: Localized;
  sub?: Localized;
  multi: boolean;
  options: Array<{ id: string; label: Localized }>;
};

export const STRATEGY_STEPS: StrategyStep[] = [
  {
    id: 'amount',
    title: { en: 'Current situation' },
    sub: {
      en: 'Approximate investable amount',
    },
    multi: false,
    options: [
      { id: 'u5', label: { en: 'Under $5,000' } },
      { id: '5to25', label: { en: '$5,000 – $25,000' } },
      { id: '25to100', label: { en: '$25,000 – $100,000' } },
      { id: '100to500', label: { en: '$100,000 – $500,000' } },
      { id: 'o500', label: { en: 'Over $500,000' } },
    ],
  },
  {
    id: 'goals',
    title: { en: 'Goals' },
    sub: { en: 'Choose as many as apply' },
    multi: true,
    options: [
      { id: 'preserve', label: { en: 'Preserve capital' } },
      { id: 'inflation', label: { en: 'Beat inflation' } },
      { id: 'income', label: { en: 'Generate income' } },
      { id: 'growth', label: { en: 'Grow wealth' } },
      {
        id: 'purchase',
        label: { en: 'Save for a major purchase' },
      },
      { id: 'retirement', label: { en: 'Retirement' } },
      { id: 'reserve', label: { en: 'Emergency reserve' } },
    ],
  },
  {
    id: 'horizon',
    title: { en: 'Time horizon' },
    sub: {
      en: 'When will you likely need this money?',
    },
    multi: false,
    options: [
      { id: 'u1', label: { en: 'Less than 1 year' } },
      { id: '1to3', label: { en: '1–3 years' } },
      { id: '3to5', label: { en: '3–5 years' } },
      { id: '5to10', label: { en: '5–10 years' } },
      { id: 'o10', label: { en: 'More than 10 years' } },
    ],
  },
  {
    id: 'liquidity',
    title: { en: 'Liquidity' },
    sub: {
      en: 'How accessible should it stay?',
    },
    multi: false,
    options: [
      {
        id: 'any',
        label: {
          en: 'I may need access at any time',
        },
      },
      {
        id: 'partial',
        label: { en: 'I can lock part of the money' },
      },
      {
        id: 'none',
        label: {
          en: 'I do not expect to use it soon',
        },
      },
    ],
  },
  {
    id: 'risk',
    title: { en: 'Risk response' },
    sub: {
      en: 'Markets fall 20% in a month. What do you do?',
    },
    multi: false,
    options: [
      {
        id: 'sell',
        label: {
          en: 'Sell to protect what is left',
        },
      },
      { id: 'hold', label: { en: 'Wait it out' } },
      {
        id: 'buy',
        label: { en: 'Buy more while it is cheaper' },
      },
    ],
  },
  {
    id: 'experience',
    title: { en: 'Experience' },
    sub: {
      en: 'How much have you invested before?',
    },
    multi: false,
    options: [
      { id: 'none', label: { en: 'None' } },
      { id: 'basic', label: { en: 'Basic' } },
      { id: 'occasional', label: { en: 'Occasional investor' } },
      { id: 'experienced', label: { en: 'Experienced' } },
    ],
  },
  {
    id: 'restrictions',
    title: {
      en: 'Preferences and restrictions',
    },
    sub: { en: 'Choose any that apply' },
    multi: true,
    options: [
      { id: 'nocrypto', label: { en: 'No crypto' } },
      { id: 'esg', label: { en: 'ESG focus' } },
      {
        id: 'industries',
        label: { en: 'Avoid certain industries' },
      },
      { id: 'currency', label: { en: 'Home currency only' } },
      { id: 'none', label: { en: 'No restrictions' } },
    ],
  },
];

export type AllocationBand = {
  id: string;
  label: Localized;
  from: number;
  to: number;
  color: string;
};

/**
 * Ranges, not targets. The plan deliberately never produces a single number —
 * that would read as a regulated recommendation rather than a research starting point.
 */
export const ALLOCATION_BANDS: AllocationBand[] = [
  {
    id: 'equity',
    label: { en: 'Broad equity ETFs' },
    from: 35,
    to: 55,
    color: 'var(--tn-blue)',
  },
  {
    id: 'bonds',
    label: { en: 'Bonds & cash' },
    from: 20,
    to: 40,
    color: 'var(--tn-green)',
  },
  {
    id: 'stocks',
    label: { en: 'Single stocks' },
    from: 5,
    to: 15,
    color: 'var(--tn-purple)',
  },
  {
    id: 'alts',
    label: { en: 'Alternatives' },
    from: 0,
    to: 10,
    color: 'var(--tn-orange)',
  },
];
