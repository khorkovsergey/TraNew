import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/screens/PlaceholderScreen';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/workspace',
    locale,
    title: "My Workspace",
    description: "Collections, saved items, saved views, research and alerts.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <PlaceholderScreen
      title={"My Workspace"}
      subtitle={"Collections, saved items, saved views, research and alerts."}
    />
  );
}
