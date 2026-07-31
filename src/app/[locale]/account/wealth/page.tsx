import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { WealthScreen } from '@/components/wealth/WealthScreen';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getWealthRecord, type DataStatus as ServiceStatus } from '@/lib/data/wealth';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';
import styles from '@/components/wealth/Wealth.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/wealth',
    locale,
    title: 'My Wealth',
    description:
      'A private model of your capital: what you own, what you owe, what it means and what you could do about it.',
  });
}

export default async function WealthPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // With the flag off the hub does not exist as a route at all — the account still
  // renders in full and its menu entry reads "Soon".
  if (!FEATURE_FLAGS.wealthHubEnabled) notFound();

  const user = await requireUser('/account/wealth');
  // getWealthRecord logs the read itself — opening the hub is an access to
  // financial data and is recorded as one, once rather than per table.
  const record = await getWealthRecord(user.id);

  /*
   * The service and the screen name freshness differently. Mapping here rather
   * than renaming either side keeps the storage vocabulary ('live', 'stale') apart
   * from the one people read on screen.
   */
  const STATUS: Record<ServiceStatus, 'connected' | 'manual' | 'estimated' | 'outdated'> = {
    live: 'connected',
    manual: 'manual',
    estimated: 'estimated',
    stale: 'outdated',
  };

  const CATEGORY_LABEL: Record<string, string> = {
    property: 'Property',
    securities: 'Securities',
    cash: 'Cash & Deposits',
    deposit: 'Cash & Deposits',
    business: 'Business',
    crypto: 'Crypto',
    other: 'Other',
  };

  const assets = record.assets.map((asset) => ({
    id: asset.id,
    category: CATEGORY_LABEL[asset.category] ?? 'Other',
    name: asset.name,
    value:
      asset.value === null
        ? '—'
        : asset.value.toLocaleString('en-GB', { style: 'currency', currency: asset.currency }),
    currency: asset.currency,
    status: STATUS[asset.dataStatus],
    sub:
      asset.details ??
      [asset.country, asset.source, asset.valuedAt ? `valued ${asset.valuedAt.toLocaleDateString('en-GB')}` : null]
        .filter(Boolean)
        .join(' · '),
  }));

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('wealth')} />
      <Link className={styles.backHome} href="/account">
        ← My TradingNew
      </Link>

      <WealthScreen assets={assets} />
    </div>
  );
}
