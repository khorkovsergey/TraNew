import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountSettings } from '@/components/account/AccountSections';
import { SecuritySection, type DeviceSession } from '@/components/account/SecuritySection';
import type { Locale } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { pageMetadata } from '@/lib/metadata';
import { getSession, requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/settings',
    locale,
    title: 'Settings & Billing',
    description:
      'Profile, preferences, notifications, subscription, billing, integrations, security and privacy.',
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser('/account/settings');
  const current = await getSession();

  const raw = await auth.api.listSessions({ headers: await headers() });
  const sessions: DeviceSession[] = raw.map((item) => ({
    id: item.id,
    token: item.token,
    createdAt: item.createdAt.toISOString(),
    ipAddress: item.ipAddress ?? null,
    userAgent: item.userAgent ?? null,
    current: item.token === current?.session.token,
  }));

  return (
    <AccountLayout>
      <AccountSettings plan={user.plan} />
      <SecuritySection sessions={sessions} />
    </AccountLayout>
  );
}
