import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LearnLanding } from '@/components/academy/LearnLanding';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { BEGINNER_PATH } from '@/content/learn';
import type { Locale } from '@/i18n/routing';
import { learnSummary, type LearnSummary } from '@/lib/academy/summary';
import { getProgress } from '@/lib/data/academy';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * Learn — the Academy landing.
 *
 * Dynamic, because the hero card differs for somebody who has started and
 * somebody who has not, and a prerendered page would serve one of them the
 * other's version. The progress comes from the same table the Academy has always
 * written to; nothing underneath moved.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/academy',
    locale,
    title: t('academy.title'),
    description: t('academy.subtitle'),
  });
}

export default async function AcademyLandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  let summary: LearnSummary = { state: 'new', total: BEGINNER_PATH.length };

  if (session?.user?.id) {
    try {
      const progress = await getProgress(session.user.id);
      summary = learnSummary(progress.lessonsDone, BEGINNER_PATH);
    } catch {
      /*
       * A database that cannot be reached costs the ring, not the page. The
       * fallback is the honest one — no progress shown, rather than a number
       * invented to fill the space.
       */
    }
  }

  return (
    <>
      <SpaceBackdrop tone={2} />
      <LearnLanding summary={summary} />
    </>
  );
}
