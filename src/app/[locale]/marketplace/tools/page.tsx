import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { ToolsHub } from '@/components/marketplace/tools/ToolsHub';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Marketplace → Tools & Data.
 *
 * Static: the hub is the same page for everybody, and nothing on it depends on
 * a session. The two screens it opens are the ones that read who is looking.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/marketplace/tools',
    locale,
    title: 'Tools & Data — Pine Script tools and chart workspaces',
    description:
      'Chart Market for Pine Script indicators and strategies, and Supercharts for ready-made chart workspaces with Voyager built in.',
  });
}

export default async function ToolsHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={4} />
      <ToolsHub />
    </>
  );
}
