import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LinkHub } from '@/components/content/LinkHub';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/market',
    locale,
    title: t('market.title'),
    description: t('market.subtitle'),
  });
}

const ROWS = [
  { labelKey: 'marketBrief.title', href: '/market/brief' as const },
  { labelKey: 'news.title', href: '/news' as const },
  { labelKey: 'ideas.title', href: '/ideas' as const },
  { labelKey: 'supercharts.title', href: '/supercharts' as const },
  { labelKey: 'explore.title', href: '/explore' as const },
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LinkHub screenKey="market" rows={ROWS} />;
}
