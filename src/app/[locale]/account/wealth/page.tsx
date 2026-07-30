import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/screens/PlaceholderScreen';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/wealth',
    locale,
    title: "My Wealth",
    description: "A private model of your capital: assets, liabilities, goals and scenarios.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PlaceholderScreen
      title={"My Wealth"}
      subtitle={"A private model of your capital: assets, liabilities, goals and scenarios."}
    />
  );
}
