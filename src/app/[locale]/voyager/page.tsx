import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { VoyagerChat } from '@/components/voyager/chat/VoyagerChat';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { getSession, hasPlan, type PlanId } from '@/lib/session';

/**
 * Voyager — the dialogue agent.
 *
 * A server component that reads the session and hands down two facts: whether
 * there is a person and what they are called, and whether their plan has a
 * daily ceiling. Neither is something the client may decide for itself — a
 * browser that could name its own plan could name the unlimited one.
 *
 * Dynamic rather than prerendered, because the counter, the memory chip and the
 * guest gate all differ for somebody signed in, and a prerendered page would
 * serve the guest version to everybody.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale }>;
  /** `?q=` — a question carried in from a link; `?context=` — the page it came from. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    locale,
    href: '/voyager',
    title: 'Ask Voyager — a dialog agent for money and markets',
    description:
      'Ask anything about money, markets or investing. Voyager answers with the sources it used, shows the tools it ran, and asks before it changes anything.',
  });
}

export default async function VoyagerPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  const query = await searchParams;

  const raw = query.q;
  const seed = typeof raw === 'string' ? raw.slice(0, 400).trim() : '';

  /*
   * The page the question came from, as a name rather than its contents. It is
   * parsed against a closed set on the client — a status strip that echoes
   * whatever a link put in it is a strip that can be made to tell somebody
   * their private data is in the conversation.
   */
  const context = typeof query.context === 'string' ? query.context.slice(0, 64) : null;

  /*
   * The first name only. The avatar needs one letter and the greeting one word;
   * the rest is personal data with no reason to be in a client component.
   */
  const personName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  const plan = ((session?.user as { plan?: unknown } | undefined)?.plan as PlanId) ?? 'free';
  const unlimited = Boolean(session?.user) && hasPlan({ plan }, 'premium');

  return (
    <>
      {/* Voyager's sky, per the handoff's section map. */}
      <SpaceBackdrop tone={3} />
      <VoyagerChat
        personName={personName}
        unlimited={unlimited}
        seedQuestion={seed || null}
        pageContext={context}
      />
    </>
  );
}
