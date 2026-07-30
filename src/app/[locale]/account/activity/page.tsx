import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccessLog } from '@/components/account/AccessLog';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountActivity } from '@/components/account/AccountSections';
import { listAccessLog } from '@/lib/audit';
import styles from '@/components/account/Account.module.css';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/activity',
    locale,
    title: "Activity",
    description: "A private timeline of what you did on TradingNew.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser('/account/activity');
  const entries = await listAccessLog(user.id, 50);

  return (
    <AccountLayout>
      <AccountActivity />

      {/* Kept separate from the general timeline, as the design requires. */}
      <h2 className={styles.sectionTitle}>Financial data access log</h2>
      <AccessLog
        entries={entries.map((entry) => ({
          id: entry.id,
          action: entry.action,
          resource: entry.resource,
          actor: entry.actor,
          ipAddress: entry.ipAddress,
          createdAt: entry.createdAt,
        }))}
      />
    </AccountLayout>
  );
}
