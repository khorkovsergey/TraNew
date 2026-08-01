import type { StaticPathname } from '@/i18n/routing';

/**
 * The seven ways the platform works for someone — the carousel on the home page.
 *
 * Order is fixed and meaningful: it walks from the first question anyone asks
 * (Voyager) through research, analysis and planning, to managing everything they
 * own, and only then to learning and the marketplace. Reordering it changes the
 * story the page tells.
 */

export type EcosystemCard = {
  key: 'voyager' | 'market' | 'charts' | 'strategy' | 'wealth' | 'academy' | 'marketplace';
  label: string;
  title: string;
  value: string;
  cta: string;
  /** The CTA colour follows the product: purple for AI and learning, blue for research. */
  ctaBg: string;
  background: string;
  /** Where the CTA goes. Voyager has none — it opens the assistant in place. */
  href: StaticPathname | null;
};

export const ECOSYSTEM: EcosystemCard[] = [
  {
    key: 'voyager',
    label: 'AI Voyager',
    title: 'Your AI guide through markets and investing',
    value:
      'Understands the page you are on — a chart, a symbol or your wealth — and answers with sources.',
    cta: 'Ask AI Voyager',
    ctaBg: '#7c4dff',
    background: 'linear-gradient(180deg,#ece5fc,#f9f6ff)',
    href: null,
  },
  {
    key: 'market',
    label: 'Market Intelligence',
    title: 'Understand what is moving the markets — and why',
    value:
      'Markets, economy, news, screeners and ideas — every number with its reason attached.',
    cta: 'Explore markets',
    ctaBg: '#2962ff',
    background: 'linear-gradient(180deg,#e3ecfd,#f5f9ff)',
    href: '/explore',
  },
  {
    key: 'charts',
    label: 'Supercharts',
    title: 'Professional analysis without unnecessary complexity',
    value:
      'Indicators, comparison, drawing tools, alerts — with AI explaining what the chart shows.',
    cta: 'Open Supercharts',
    ctaBg: '#2962ff',
    background: 'linear-gradient(180deg,#e3ecfd,#f5f9ff)',
    href: '/supercharts',
  },
  {
    key: 'strategy',
    label: 'Strategy Builder',
    title: 'Turn your goals into a personalised investment strategy',
    value:
      'Capital, goals, horizon and risk — turned into a clear allocation model and next steps.',
    cta: 'Build my strategy',
    ctaBg: '#2962ff',
    background: 'linear-gradient(180deg,#e3f4ec,#f4fbf7)',
    href: '/strategy',
  },
  {
    key: 'wealth',
    label: 'Wealth Hub',
    title: 'See your entire financial life in one place',
    value:
      'Portfolios, property, business, deposits and debt — one living model of your capital.',
    cta: 'Open Wealth Hub',
    ctaBg: '#131722',
    background: 'linear-gradient(180deg,#eef1f8,#f9fafd)',
    href: '/account/wealth',
  },
  {
    key: 'academy',
    label: 'Academy',
    title: 'Learn only what you need, when you need it',
    value:
      'A personal learning path tied to what you actually do on the platform — not a course library.',
    cta: 'Start learning',
    ctaBg: '#7c4dff',
    background: 'linear-gradient(180deg,#ece5fc,#f9f6ff)',
    href: '/academy',
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    title: 'Experts, tools and services beyond your plan',
    value: 'Verified experts, premium tools and data, learning events and exclusive products.',
    cta: 'Explore Marketplace',
    ctaBg: '#7c4dff',
    background: 'linear-gradient(180deg,#fdeee3,#fef8f3)',
    href: '/marketplace',
  },
];
