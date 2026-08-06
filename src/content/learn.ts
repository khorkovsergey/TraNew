import type { IconName } from '@/components/ui/Icon';
import type { AppPathname, StaticPathname } from '@/i18n/routing';
import type { LessonRef } from '@/lib/academy/summary';

/**
 * Learn — the Academy, under the name a beginner would look for.
 *
 * Nothing about the Academy changed underneath: the diagnostic, the path, the
 * lesson and the progress record are the same routes and the same table. This
 * file is the landing's copy and the order of its cards.
 */

export type LearnAccent = 'green' | 'mint' | 'blue' | 'purple' | 'cyan' | 'amber';

export const LEARN_CATEGORIES: Array<{
  name: string;
  text: string;
  icon: IconName;
  accent: LearnAccent;
  href: AppPathname;
  params?: Record<string, string>;
  soon?: boolean;
}> = [
  {
    name: 'Investing basics',
    text: 'Start the journey the right way round.',
    icon: 'book',
    accent: 'green',
    href: '/academy/path',
  },
  {
    name: 'Money basics',
    text: 'Habits first, instruments second.',
    icon: 'wallet',
    accent: 'mint',
    href: '/academy/setup',
  },
  {
    name: 'Markets',
    text: 'What actually moves a price.',
    icon: 'bars',
    accent: 'blue',
    href: '/markets/global',
  },
  {
    name: 'ETFs & funds',
    text: 'Owning many companies at once.',
    icon: 'layers',
    accent: 'purple',
    href: '/explore',
  },
  {
    name: 'Risk',
    text: 'What can go wrong, and how much.',
    icon: 'shieldCheck',
    accent: 'cyan',
    href: '/academy/path',
  },
  {
    name: 'Economy explained',
    text: 'Rates, inflation, and your money.',
    icon: 'globe',
    accent: 'amber',
    href: '/economy',
  },
];

/**
 * The beginner path.
 *
 * Lesson one is written. The other four are planned and say so — a card that
 * opens a page which then admits it is not built yet spends somebody's click to
 * tell them something the card could have.
 */
export const BEGINNER_PATH: Array<
  LessonRef & {
    minutes: number;
    text: string;
    accent: LearnAccent;
    built: boolean;
  }
> = [
  {
    slug: 'why-people-invest',
    title: 'Why people invest',
    minutes: 8,
    text: 'What investing is for, and what inflation has to do with it.',
    accent: 'green',
    built: true,
  },
  {
    slug: 'risk-and-return',
    title: 'Risk and return',
    minutes: 6,
    text: 'Why the two travel together, and what that means for you.',
    accent: 'blue',
    built: false,
  },
  {
    slug: 'diversification',
    title: 'Diversification',
    minutes: 6,
    text: 'How spreading money changes the odds — and what it cannot do.',
    accent: 'purple',
    built: false,
  },
  {
    slug: 'etfs-explained',
    title: 'ETFs explained',
    minutes: 6,
    text: 'One purchase, many companies. The trade-offs of doing it that way.',
    accent: 'mint',
    built: false,
  },
  {
    slug: 'first-plan',
    title: 'Building your first plan',
    minutes: 7,
    text: 'Turning what you have learned into something you can act on.',
    accent: 'amber',
    built: false,
  },
];

/** Learn from today — the bridge from the news to a concept. */
export const LEARN_ARTICLES: Array<{
  title: string;
  minutes: string;
  text: string;
  icon: IconName;
  accent: LearnAccent;
  href: StaticPathname;
}> = [
  {
    title: 'Why markets moved',
    minutes: '3 min read',
    text: 'A short take on what is driving prices right now.',
    icon: 'calendar',
    accent: 'green',
    href: '/news',
  },
  {
    title: 'Inflation explained',
    minutes: '4 min read',
    text: 'What it is, why it matters, and how to think about it.',
    icon: 'percent',
    accent: 'purple',
    href: '/economy',
  },
  {
    title: 'What rate changes mean',
    minutes: '3 min read',
    text: 'How a central bank decision reaches your savings account.',
    icon: 'building',
    accent: 'amber',
    href: '/economy',
  },
];

/** Practise as you learn. Every one of these is a screen that exists. */
export const PRACTICE_TILES: Array<{
  name: string;
  text: string;
  icon: IconName;
  accent: LearnAccent;
  href: AppPathname;
  params?: Record<string, string>;
  soon?: boolean;
}> = [
  {
    name: 'Quick check',
    text: 'Five questions on what you just read.',
    icon: 'checkCircle',
    accent: 'green',
    href: '/academy/lesson/[slug]',
    params: { slug: 'why-people-invest' },
  },
  {
    name: 'Glossary',
    text: 'Plain definitions, in context.',
    icon: 'book',
    accent: 'blue',
    href: '/academy/dashboard',
  },
  {
    name: 'Practice portfolio',
    text: 'Try a decision with virtual money.',
    icon: 'pie',
    accent: 'purple',
    href: '/portfolio',
  },
  {
    name: 'Ask Voyager',
    text: 'Have something explained a different way.',
    icon: 'sparkle',
    accent: 'cyan',
    href: '/voyager',
  },
];

export const LEARN_TRUST: Array<{ icon: IconName; accent: LearnAccent; label: string }> = [
  { icon: 'checkCircle', accent: 'mint', label: 'Plain language, no jargon' },
  { icon: 'clock', accent: 'blue', label: 'Short lessons you can finish' },
  { icon: 'shieldCheck', accent: 'green', label: 'Education, never a recommendation' },
];
