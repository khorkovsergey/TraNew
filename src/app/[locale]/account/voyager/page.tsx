import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountVoyager } from '@/components/account/AccountSections';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';
import { loadVoyagerSettings } from '@/app/actions/voyagerSettings';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/voyager',
    locale,
    title: "Voyager",
    description: "Conversations, saved insights, editable memory, permissions and usage.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  await requireUser();

  // Read on the server: a panel that flashes the defaults before the real
  // values land is a panel that appears to have forgotten them.
  const voyagerSettings = await loadVoyagerSettings();

  return (
    <AccountLayout>
      <AccountVoyager voyagerSettings={voyagerSettings} />
    </AccountLayout>
  );
}
