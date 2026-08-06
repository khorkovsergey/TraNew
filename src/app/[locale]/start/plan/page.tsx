import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { loadStartPlan } from '@/app/actions/startPlan';
import { PlanResult } from '@/components/start/PlanResult';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * The plan a diagnostic produced.
 *
 * A route of its own rather than the last screen of the wizard, so it can be
 * returned to, linked to, and landed on after signing up. It renders nothing
 * generic: without answers the client sends you back to the questions.
 */

export const dynamic = 'force-dynamic';

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

  /*
   * The saved plan, when there is a session. Read on the server so a person
   * arriving on a second device sees their plan in the first render rather than
   * the empty state their browser would otherwise report.
   */
  const session = await getSession();
  const stored = session?.user?.id ? await loadStartPlan(session.user.id).catch(() => null) : null;

  return (
    <>
      <SpaceBackdrop tone={2} />
      <PlanResult stored={stored} />
    </>
  );
}
