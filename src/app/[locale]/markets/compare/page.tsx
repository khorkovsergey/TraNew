import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { CompareAssets } from '@/components/markets/CompareAssets';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { COMPARE_SETS, parseSymbols } from '@/lib/market/compare';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Compare assets.
 *
 * A static child of `/markets`, which is why it wins over `[market]` and is
 * never mistaken for a market whose slug happens to be "compare".
 *
 * The instruments arrive in the URL so a comparison is a thing you can send
 * somebody: `?symbols=NVDA,AMD,AVGO`. It is parsed rather than trusted — a
 * query string is written by anybody — and a request that names nothing usable
 * opens the stocks preset instead of an empty table.
 */

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ symbols?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { symbols } = await searchParams;
  const parsed = parseSymbols(symbols);

  const headline = parsed ? parsed.symbols.join(' vs ') : COMPARE_SETS.stocks.base.join(' vs ');

  return pageMetadata({
    href: '/markets/compare',
    locale,
    title: `Compare ${headline}`,
    description:
      'Put two to four instruments of the same type side by side: performance, volatility, cost and size, with a plain-language read of what the numbers mean.',
  });
}

export default async function CompareAssetsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { symbols } = await searchParams;
  const parsed = parseSymbols(symbols) ?? { kind: 'stocks' as const, symbols: COMPARE_SETS.stocks.base };

  return (
    <>
      <SpaceBackdrop tone={2} />
      <CompareAssets initialKind={parsed.kind} initialSymbols={parsed.symbols} />
    </>
  );
}
