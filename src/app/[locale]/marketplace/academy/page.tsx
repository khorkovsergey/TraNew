import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CourseCatalog } from '@/components/academy/CourseCatalog';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import type { Locale } from '@/i18n/routing';
import { enrolledSlugs } from '@/lib/academy/enrolment';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * Academy — the course catalogue.
 *
 * Dynamic, because the cards say "In your library" for courses somebody already
 * owns, and a prerendered page would tell everybody one person's answer. The
 * catalogue itself is public: nothing here asks for an account.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/marketplace/academy',
    locale,
    title: 'Academy — trading and investing courses',
    description:
      'Structured courses from TradingNew and checked providers: technical analysis, risk, options, crypto and more. Free explainers stay in Learn.',
  });
}

export default async function AcademyMarketplacePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  const owned = session?.user ? await enrolledSlugs(session.user.id) : new Set<string>();

  return (
    <>
      <SpaceBackdrop tone={4} />
      <CourseCatalog enrolledSlugs={[...owned]} />
    </>
  );
}
