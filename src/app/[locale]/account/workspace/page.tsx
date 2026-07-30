import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountWorkspace } from '@/components/account/AccountSections';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

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

  return (
    <AccountLayout>
      <AccountWorkspace />
    </AccountLayout>
  );
}
