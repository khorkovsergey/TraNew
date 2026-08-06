import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { GuestWorkspace } from '@/components/start/GuestWorkspace';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * The guest's temporary workspace.
 *
 * Everything a person can hold without an account, with the fact that it is
 * temporary stated at the top rather than discovered by losing something.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    ...pageMetadata({
      href: '/workspace',
      locale,
      title: 'Your workspace',
      description: 'The plan, lessons and comparisons you can keep without an account.',
    }),
    // Personal to one browser, and empty for everybody else.
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={2} />
      <GuestWorkspace />
    </>
  );
}
