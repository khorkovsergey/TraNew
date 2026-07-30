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
    href: '/how-we-explain',
    locale,
    title: t('howWeExplain.title'),
    description: t('howWeExplain.subtitle'),
  });
}

const ROWS = [
  { labelKey: 'trust.title', href: '/trust' as const },
  { labelKey: 'marketBrief.title', href: '/market/brief' as const },
  { labelKey: 'research.title', href: '/research' as const },
  { labelKey: 'news.title', href: '/news' as const },
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LinkHub screenKey="howWeExplain" rows={ROWS} />;
}
