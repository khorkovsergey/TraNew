import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Subscriptions } from '@/components/marketplace/Subscriptions';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Marketplace → Subscriptions.
 *
 * A presentation page: five plans, a billing toggle and the comparison. No
 * checkout, no billing provider, no entitlement gating — and the capabilities
 * listed under the private tier are plan contents rather than features that
 * exist, which the page says on itself rather than leaving to be discovered.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    locale,
    href: '/marketplace/subscriptions',
    title: 'Subscriptions — plans for every level of market ambition',
    description:
      'Compare TradingNew plans. Every plan includes Voyager AI; higher plans unlock deeper analysis, longer context and more advanced research.',
  });
}

export default async function SubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <Subscriptions />;
}
