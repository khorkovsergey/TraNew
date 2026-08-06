import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { PlanResult } from '@/components/start/PlanResult';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * The plan a diagnostic produced.
 *
 * A route of its own rather than the last screen of the wizard, so it can be
 * returned to, linked to, and landed on after signing up. It renders nothing
 * generic: without answers the client sends you back to the questions.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    ...pageMetadata({
      href: '/start/plan',
      locale,
      title: 'Your plan is ready',
      description: 'The starting path your four answers produced, and why each step is on it.',
    }),
    // Personal to whoever answered, and empty for everybody else.
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={2} />
      <PlanResult />
    </>
  );
}
