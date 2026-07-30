import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/screens/PlaceholderScreen';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account',
    locale,
    title: "My TradingNew",
    description: "Your personal space: workspace, Copilot, learning and purchases.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PlaceholderScreen
      title={"My TradingNew"}
      subtitle={"Your personal space: workspace, Copilot, learning and purchases."}
    />
  );
}
