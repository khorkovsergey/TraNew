import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { VoyagerWorkspace } from '@/components/voyager/workspace/VoyagerWorkspace';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * The research workspace — question → evidence → conclusion.
 *
 * This is the three-zone canvas that used to be `/voyager`: a conversation
 * rail, a canvas of validated modules, and an inspector holding the sources,
 * the assumptions, the Wealth Hub grant and the record of every change made
 * from here.
 *
 * It moved because it was answering a different question from the one people
 * arrive with. Voyager is a dialogue; this is a session somebody sits in.
 * Merging them meant the page could only be one of the two at a time, and it
 * was always the wrong one for whoever had just opened it. "Turn this answer
 * into research" is the door between them, and it arrives here with the
 * question already in hand.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale }>;
  /** `?q=` — the answer being turned into a research session. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    locale,
    href: '/voyager/research',
    title: 'Research workspace — evidence, sources and what changed',
    description:
      'A structured research session: the question, the analysis it produced, every source behind it, and a record of anything it changed.',
  });
}

export default async function VoyagerResearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  const query = await searchParams;

  const raw = query.q;
  const seed = typeof raw === 'string' ? raw.slice(0, 400).trim() : '';
  const context = typeof query.context === 'string' ? query.context.slice(0, 64) : null;
  const personName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  return (
    <VoyagerWorkspace personName={personName} seedQuestion={seed || null} pageContext={context} />
  );
}
