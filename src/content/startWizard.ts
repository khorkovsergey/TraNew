import type { IconName } from '@/components/ui/Icon';
import type { Horizon, Knowledge, LearningStyle, Priority } from '@/lib/start/path';

/**
 * The four questions, as copy.
 *
 * The rules that turn answers into a suggestion live in `lib/start/path.ts` and
 * are tested there; this file only decides what the questions look like and what
 * they say. Nothing here computes anything.
 */

export type WizardOption<T extends string> = {
  key: T;
  title: string;
  text: string;
  icon: IconName;
  accent: 'green' | 'mint' | 'amber' | 'blue' | 'purple' | 'cyan' | 'lime';
};

export const STEP_META = [
  { number: 1, title: 'About you', sub: 'Tell us a bit about yourself' },
  { number: 2, title: 'What matters most', sub: 'Your priorities shape your path' },
  { number: 3, title: 'When you might need the money', sub: 'Your time horizon' },
  { number: 4, title: 'How you want to learn', sub: 'Your learning style' },
];

export const KNOWLEDGE_QUESTION = {
  heading: 'How much of this is new to you?',
  /* No wrong answer, and the copy says so — the point of asking is to pitch the
     path, not to grade anybody. */
  hint: 'There is no wrong answer. It only changes where your path starts.',
  options: [
    {
      key: 'new',
      title: 'All of it',
      text: 'I have not invested before and want to start from the beginning.',
      icon: 'bulb',
      accent: 'amber',
    },
    {
      key: 'basics',
      title: 'I know the basics',
      text: 'I understand the ideas but have not put much into practice.',
      icon: 'book',
      accent: 'lime',
    },
    {
      key: 'investing',
      title: 'I already invest',
      text: 'I hold something already and want to do it more deliberately.',
      icon: 'trendUp',
      accent: 'mint',
    },
  ] satisfies WizardOption<Knowledge>[],
};

export const PRIORITY_QUESTION = {
  heading: 'What matters most right now?',
  hint: 'Choose up to two.',
  options: [
    {
      key: 'safety',
      title: 'Safety',
      text: 'Protect my money and avoid big losses.',
      icon: 'shieldCheck',
      accent: 'green',
    },
    {
      key: 'growth',
      title: 'Growth',
      text: 'Grow my money over the long term.',
      icon: 'trendUp',
      accent: 'mint',
    },
    {
      key: 'income',
      title: 'Regular income',
      text: 'Earn steady income from my investments.',
      icon: 'coins',
      accent: 'amber',
    },
    {
      key: 'cash',
      title: 'Access to cash',
      text: 'Keep my money accessible when I need it.',
      icon: 'wallet',
      accent: 'blue',
    },
    {
      key: 'unsure',
      title: 'I am not sure',
      text: 'Help me figure out what is right for me.',
      icon: 'info',
      accent: 'purple',
    },
  ] satisfies WizardOption<Priority>[],
};

export const HORIZON_QUESTION = {
  heading: 'When might you need this money?',
  hint: 'A rough answer is enough. It changes what is sensible, not what is allowed.',
  options: [
    {
      key: 'short',
      title: 'Within a year',
      text: 'I may need it soon, or I do not know when.',
      icon: 'clock',
      accent: 'amber',
    },
    {
      key: 'medium',
      title: 'One to five years',
      text: 'There is something specific I am saving towards.',
      icon: 'calendar',
      accent: 'blue',
    },
    {
      key: 'long',
      title: 'More than five years',
      text: 'I can leave it alone for a long time.',
      icon: 'target',
      accent: 'mint',
    },
    {
      key: 'unsure',
      title: 'I am not sure yet',
      text: 'I have not decided what this money is for.',
      icon: 'compass',
      accent: 'purple',
    },
  ] satisfies WizardOption<Horizon>[],
};

export const LEARNING_QUESTION = {
  heading: 'How do you want to learn?',
  hint: 'This decides the shape of your path, not its content.',
  options: [
    {
      key: 'reading',
      title: 'Short reads',
      text: 'A few minutes at a time, in plain language.',
      icon: 'book',
      accent: 'lime',
    },
    {
      key: 'examples',
      title: 'Real examples',
      text: 'Show me what actually happened and explain it.',
      icon: 'fileSearch',
      accent: 'blue',
    },
    {
      key: 'practice',
      title: 'By doing',
      text: 'Let me try it with virtual money first.',
      icon: 'flask',
      accent: 'purple',
    },
    {
      key: 'questions',
      title: 'By asking',
      text: 'I would rather ask questions as they come up.',
      icon: 'chat',
      accent: 'cyan',
    },
  ] satisfies WizardOption<LearningStyle>[],
};

/** What an account adds — shown beside the wizard, never as a gate in front of it. */
export const UNLOCKS: Array<{ icon: IconName; accent: string; title: string; text: string }> = [
  {
    icon: 'layers',
    accent: 'green',
    title: 'Personalised learning path',
    text: 'Step-by-step guidance built for you.',
  },
  {
    icon: 'pie',
    accent: 'blue',
    title: 'Practice portfolio',
    text: 'Try strategies risk-free with virtual money.',
  },
  {
    icon: 'scale',
    accent: 'purple',
    title: 'Saved comparisons',
    text: 'Keep track of options that interest you.',
  },
  {
    icon: 'sparkle',
    accent: 'mint',
    title: 'Voyager guidance',
    text: 'Get answers and tips when you need them.',
  },
];

export const START_TRUST: Array<{ icon: IconName; accent: string; label: string }> = [
  { icon: 'shieldCheck', accent: 'mint', label: 'Education first, never a recommendation' },
  { icon: 'lock', accent: 'blue', label: 'Your answers stay in this browser until you save them' },
  { icon: 'checkCircle', accent: 'green', label: 'No spam. Ever.' },
];
