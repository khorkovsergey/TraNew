import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { WealthScreen } from '@/components/wealth/WealthScreen';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { recordAccess } from '@/lib/audit';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';
import styles from '@/components/wealth/Wealth.module.css';

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
  // Opening the hub is itself an access to financial data and is logged as one.
  await recordAccess({ userId: user.id, action: 'read', resource: 'wealth_overview' });

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/account">
        ← My TradingNew
      </Link>

      <WealthScreen />
    </div>
  );
}
