import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { VoyagerWorkspace } from '@/components/voyager/workspace/VoyagerWorkspace';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * The AI Voyager workspace.
 *
 * A server component that reads the session and hands down one thing: whether
 * there is a person and what they are called. The prototype had a New/Returning
 * switch for review; in the product the persona is who is signed in, and the
 * client never decides that for itself.
 *
 * Dynamic rather than prerendered, because the landing differs for a signed-in
 * person and a prerendered page would serve the guest version to everybody.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    locale,
    href: '/voyager',
    title: 'AI Voyager — ask, build, monitor',
    description:
      'Describe what you want to understand, build or monitor. Voyager assembles the analysis, shows the data it used, and asks before it changes anything.',
  });
}

export default async function VoyagerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();

  /*
   * The first name only. The greeting needs one word and the rest is personal
   * data with no reason to be in a client component.
   */
  const personName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  return <VoyagerWorkspace personName={personName} />;
}
