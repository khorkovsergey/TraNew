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
    href: '/guidance',
    locale,
    title: t('guidance.title'),
    description: t('guidance.subtitle'),
  });
}

const ROWS = [
  { labelKey: 'strategy.title', href: '/strategy' as const },
  { labelKey: 'academy.title', href: '/academy' as const },
  { labelKey: 'experts.title', href: '/marketplace/experts' as const },
  { labelKey: 'portfolio.title', href: '/portfolio' as const },
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LinkHub screenKey="guidance" rows={ROWS} />;
}
