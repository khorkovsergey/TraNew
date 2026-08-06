import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExploreHub } from '@/components/explore/ExploreHub';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Explore — where Market, Symbols and Economy now live.
 *
 * The old page was a directory of tools. This one starts from the question a
 * beginner actually arrives with — what are the options and what do they cost
 * me — and keeps the directory in the sub-nav, where somebody who wanted a
 * screener still finds one.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/explore',
    locale,
    title: t('explore.title'),
    description: t('explore.subtitle'),
  });
}

export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={4} />
      <ExploreHub />
    </>
  );
}
