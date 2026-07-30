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
    href: '/tools',
    locale,
    title: t('tools.title'),
    description: t('tools.subtitle'),
  });
}

const ROWS = [
  { labelKey: 'supercharts.title', href: '/supercharts' as const },
  { labelKey: 'explore.title', href: '/explore' as const },
  { labelKey: 'portfolio.title', href: '/portfolio' as const },
  { labelKey: 'research.title', href: '/research' as const },
];

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LinkHub screenKey="tools" rows={ROWS} />;
}
