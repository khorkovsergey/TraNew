import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/screens/PlaceholderScreen';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/activity',
    locale,
    title: "Activity",
    description: "A private timeline of what you did on TradingNew.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PlaceholderScreen
      title={"Activity"}
      subtitle={"A private timeline of what you did on TradingNew."}
    />
  );
}
