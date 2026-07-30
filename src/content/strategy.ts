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
    title: { en: 'Current situation', ru: 'Текущая ситуация' },
    sub: {
      en: 'Approximate investable amount',
      ru: 'Примерная сумма для инвестирования',
    },
    multi: false,
    options: [
      { id: 'u5', label: { en: 'Under $5,000', ru: 'Менее $5 000' } },
      { id: '5to25', label: { en: '$5,000 – $25,000', ru: '$5 000 – $25 000' } },
      { id: '25to100', label: { en: '$25,000 – $100,000', ru: '$25 000 – $100 000' } },
      { id: '100to500', label: { en: '$100,000 – $500,000', ru: '$100 000 – $500 000' } },
      { id: 'o500', label: { en: 'Over $500,000', ru: 'Более $500 000' } },
    ],
  },
  {
    id: 'goals',
    title: { en: 'Goals', ru: 'Цели' },
    sub: { en: 'Choose as many as apply', ru: 'Выберите всё, что подходит' },
    multi: true,
    options: [
      { id: 'preserve', label: { en: 'Preserve capital', ru: 'Сохранить капитал' } },
      { id: 'inflation', label: { en: 'Beat inflation', ru: 'Обогнать инфляцию' } },
      { id: 'income', label: { en: 'Generate income', ru: 'Получать доход' } },
      { id: 'growth', label: { en: 'Grow wealth', ru: 'Нарастить капитал' } },
      {
        id: 'purchase',
        label: { en: 'Save for a major purchase', ru: 'Накопить на крупную покупку' },
      },
      { id: 'retirement', label: { en: 'Retirement', ru: 'Пенсия' } },
      { id: 'reserve', label: { en: 'Emergency reserve', ru: 'Резервный фонд' } },
    ],
  },
  {
    id: 'horizon',
    title: { en: 'Time horizon', ru: 'Горизонт' },
    sub: {
      en: 'When will you likely need this money?',
      ru: 'Когда вам, скорее всего, понадобятся эти деньги?',
    },
    multi: false,
    options: [
      { id: 'u1', label: { en: 'Less than 1 year', ru: 'Менее 1 года' } },
      { id: '1to3', label: { en: '1–3 years', ru: '1–3 года' } },
      { id: '3to5', label: { en: '3–5 years', ru: '3–5 лет' } },
      { id: '5to10', label: { en: '5–10 years', ru: '5–10 лет' } },
      { id: 'o10', label: { en: 'More than 10 years', ru: 'Более 10 лет' } },
    ],
  },
  {
    id: 'liquidity',
    title: { en: 'Liquidity', ru: 'Ликвидность' },
    sub: {
      en: 'How accessible should it stay?',
      ru: 'Насколько доступными должны оставаться деньги?',
    },
    multi: false,
    options: [
      {
        id: 'any',
        label: {
          en: 'I may need access at any time',
          ru: 'Доступ может понадобиться в любой момент',
        },
      },
      {
        id: 'partial',
        label: { en: 'I can lock part of the money', ru: 'Часть денег могу заморозить' },
      },
      {
        id: 'none',
        label: {
          en: 'I do not expect to use it soon',
          ru: 'В ближайшее время не планирую их трогать',
        },
      },
    ],
  },
  {
    id: 'risk',
    title: { en: 'Risk response', ru: 'Реакция на риск' },
    sub: {
      en: 'Markets fall 20% in a month. What do you do?',
      ru: 'Рынок падает на 20% за месяц. Что вы сделаете?',
    },
    multi: false,
    options: [
      {
        id: 'sell',
        label: {
          en: 'Sell to protect what is left',
          ru: 'Продам, чтобы сохранить остаток',
        },
      },
      { id: 'hold', label: { en: 'Wait it out', ru: 'Пережду' } },
      {
        id: 'buy',
        label: { en: 'Buy more while it is cheaper', ru: 'Докуплю, пока дешевле' },
      },
    ],
  },
  {
    id: 'experience',
    title: { en: 'Experience', ru: 'Опыт' },
    sub: {
      en: 'How much have you invested before?',
      ru: 'Сколько вы инвестировали раньше?',
    },
    multi: false,
    options: [
      { id: 'none', label: { en: 'None', ru: 'Не инвестировал(а)' } },
      { id: 'basic', label: { en: 'Basic', ru: 'Базовый' } },
      { id: 'occasional', label: { en: 'Occasional investor', ru: 'Инвестирую иногда' } },
      { id: 'experienced', label: { en: 'Experienced', ru: 'Опытный' } },
    ],
  },
  {
    id: 'restrictions',
    title: {
      en: 'Preferences and restrictions',
      ru: 'Предпочтения и ограничения',
    },
    sub: { en: 'Choose any that apply', ru: 'Выберите всё, что подходит' },
    multi: true,
    options: [
      { id: 'nocrypto', label: { en: 'No crypto', ru: 'Без криптовалют' } },
      { id: 'esg', label: { en: 'ESG focus', ru: 'Фокус на ESG' } },
      {
        id: 'industries',
        label: { en: 'Avoid certain industries', ru: 'Избегать некоторых отраслей' },
      },
      { id: 'currency', label: { en: 'Home currency only', ru: 'Только домашняя валюта' } },
      { id: 'none', label: { en: 'No restrictions', ru: 'Без ограничений' } },
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
    label: { en: 'Broad equity ETFs', ru: 'Широкие ETF на акции' },
    from: 35,
    to: 55,
    color: 'var(--tn-blue)',
  },
  {
    id: 'bonds',
    label: { en: 'Bonds & cash', ru: 'Облигации и наличные' },
    from: 20,
    to: 40,
    color: 'var(--tn-green)',
  },
  {
    id: 'stocks',
    label: { en: 'Single stocks', ru: 'Отдельные акции' },
    from: 5,
    to: 15,
    color: 'var(--tn-purple)',
  },
  {
    id: 'alts',
    label: { en: 'Alternatives', ru: 'Альтернативные активы' },
    from: 0,
    to: 10,
    color: 'var(--tn-orange)',
  },
];
