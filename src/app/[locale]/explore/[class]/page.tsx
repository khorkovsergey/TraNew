import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AssetClassPage } from '@/components/explore/AssetClassPage';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { ASSET_CLASS_KEYS, assetClass } from '@/content/assetClasses';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * One asset class per page, replacing the `/tool/{slug}` placeholder those six
 * links used to open. Prerendered — the content is written, not fetched.
 */

type Props = { params: Promise<{ locale: Locale; class: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ASSET_CLASS_KEYS.map((key) => ({ locale, class: key }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, class: slug } = await params;
  const entry = assetClass(slug);
  if (!entry) return {};

  return pageMetadata({
    href: { pathname: '/explore/[class]', params: { class: entry.key } },
    locale,
    title: `${entry.name} explained: risks, costs and who they suit`,
    description: `${entry.what} ${entry.risks} How ${entry.name} compare with the alternatives, in plain language.`,
  });
}

export default async function Page({ params }: Props) {
  const { locale, class: slug } = await params;
  setRequestLocale(locale);

  const entry = assetClass(slug);
  if (!entry) notFound();

  return (
    <>
      <SpaceBackdrop tone={4} />
      <AssetClassPage entry={entry} />
    </>
  );
}
