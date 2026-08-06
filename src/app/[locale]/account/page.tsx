import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { loadStartPlan } from '@/app/actions/startPlan';
import { AccountOverview, ResumePlan } from '@/components/account/AccountSections';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account',
    locale,
    title: "My TradingNew",
    description: "Your personal space: workspace, Voyager, learning and purchases.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser();
  const stored = await loadStartPlan(user.id).catch(() => null);

  return (
    <AccountLayout>
      {/* Above everything else: it is the thing they were in the middle of. */}
      <ResumePlan stored={stored} />
      <AccountOverview />
    </AccountLayout>
  );
}
