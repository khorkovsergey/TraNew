import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { NextStepRouter } from '@/components/start/NextStepRouter';
import type { Locale } from '@/i18n/routing';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * Find my next step.
 *
 * A product router, not a questionnaire. Two questions — sometimes a third —
 * and the answer is a place in TradingNew or TradingView, never an instrument,
 * an allocation or a label for the person who answered.
 *
 * This replaced "Start investing with clarity", which asked about goals,
 * horizon and risk comfort and ended in "Your profile". That flow read as a
 * suitability test the product is not qualified to give, and it ended in a
 * document rather than a destination.
 *
 * The whole thing works without an account. The one screen that mentions one is
 * the Wealth Hub result, and it explains the hub before it asks.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/start',
    locale,
    title: 'Find your next step',
    description:
      'Tell TradingNew what you want to do and get a direct route to the most useful markets, learning, tools, experts, events or AI experience.',
  });
}

export default async function StartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  /*
   * Read on the server so the Wealth Hub result renders the right version in the
   * first paint. A client-side flag would flash the guest gate at somebody who
   * is already signed in, which is the one place on this screen where being
   * wrong for 200 ms asks for an account that already exists.
   */
  const session = await getSession();

  return (
    <>
      <SpaceBackdrop tone={2} />
      <NextStepRouter
        authed={Boolean(session?.user)}
        wealthEnabled={FEATURE_FLAGS.wealthHubEnabled}
      />
    </>
  );
}
