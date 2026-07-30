import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlaceholderScreen } from '@/components/screens/PlaceholderScreen';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: Locale; ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ticker } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: { pathname: '/symbols/[ticker]', params: { ticker } },
    locale,
    title: t('symbol.title'),
    description: t('symbol.subtitle'),
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PlaceholderScreen screenKey="symbol" />;
}
