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
    href: '/community',
    locale,
    title: t('community.title'),
    description: t('community.subtitle'),
  });
}

const ROWS = [
  { labelKey: 'ideas.title', href: '/ideas' as const },
  { labelKey: 'experts.title', href: '/marketplace/experts' as const },
  { labelKey: 'academy.title', href: '/academy' as const },
  { labelKey: 'marketplace.title', href: '/marketplace' as const },
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LinkHub screenKey="community" rows={ROWS} />;
}
