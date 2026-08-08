import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import {
  SuperchartCatalog,
  selectPresets,
  type SuperchartFilters,
} from '@/components/marketplace/tools/SuperchartCatalog';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import {
  ASSET_CLASSES,
  COMPLEXITIES,
  USE_CASES,
} from '@/content/superchartCatalog';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Marketplace → Tools & Data → Supercharts.
 *
 * A catalogue of starting points, not a chart. Public and the same for
 * everybody, so it renders from the query string alone.
 */

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/marketplace/tools/supercharts',
    locale,
    title: 'Supercharts — ready-made chart workspaces',
    description:
      'Open a chart that already has the right symbol, interval and studies on it, and ask Voyager to explain or extend what it shows.',
  });
}

/** A facet value that nobody offered selects nothing rather than everything. */
function pick(
  raw: string | string[] | undefined,
  allowed: readonly string[]
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

export default async function SuperchartCatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const raw = await searchParams;
  const filters: SuperchartFilters = {
    asset: pick(raw.asset, ASSET_CLASSES),
    use: pick(raw.use, USE_CASES),
    level: pick(raw.level, COMPLEXITIES),
  };

  return (
    <>
      <SpaceBackdrop tone={2} />
      <SuperchartCatalog filters={filters} presets={selectPresets(filters)} />
    </>
  );
}
