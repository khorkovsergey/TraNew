import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountWorkspace } from '@/components/account/AccountSections';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { getWorkspaceView } from '@/lib/data/accountView';
import { requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/workspace',
    locale,
    title: "My Workspace",
    description: "Collections, saved items, saved views, research, reports and alerts.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser();
  const data = await getWorkspaceView(user.id);

  return (
    <AccountLayout>
      <AccountWorkspace data={data} />
    </AccountLayout>
  );
}
