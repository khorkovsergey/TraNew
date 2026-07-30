import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AssetDetail } from '@/components/wealth/AssetDetail';
import { ASSET_DETAILS } from '@/content/wealth';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/wealth/Wealth.module.css';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    Object.keys(ASSET_DETAILS).map((id) => ({ locale, id }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const asset = ASSET_DETAILS[id];
  if (!asset) return {};

  return pageMetadata({
    href: { pathname: '/account/wealth/assets/[id]', params: { id } },
    locale,
    title: asset.name,
    description: asset.type,
  });
}

export default async function WealthAssetPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (!FEATURE_FLAGS.wealthHubEnabled) notFound();

  const asset = ASSET_DETAILS[id];
  if (!asset) notFound();

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/account/wealth">
        ← My Wealth
      </Link>

      <AssetDetail asset={asset} />
    </div>
  );
}
