import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Subscriptions } from '@/components/marketplace/Subscriptions';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Marketplace → Subscriptions.
 *
 * A presentation page for the four Voyager plans: Free, Plus, Pro, Private. No
 * checkout, no billing provider and no entitlement gating — the prices are
 * placeholders and the page says so on itself rather than leaving it to be
 * discovered. What it has to be judgeable on is the product argument: does the
 * range read as depth of intelligence rather than as unlocked pages.
 *
 * Tone 4, the Marketplace sky, which the approved handoff also uses.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    locale,
    href: '/marketplace/subscriptions',
    title: 'Subscriptions — how much Voyager does for you',
    description:
      'TradingNew is the platform; Voyager is the intelligence you upgrade. Compare Free, Plus, Pro and Private on depth of analysis, reach of research and private context.',
  });
}

export default async function SubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={4} />
      <Subscriptions />
    </>
  );
}
