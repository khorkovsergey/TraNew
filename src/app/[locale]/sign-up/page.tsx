import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SignUpForm } from '@/components/auth/AuthForms';
import { AuthShell } from '@/components/auth/AuthShell';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import type { Locale } from '@/i18n/routing';
import { configuredSocialProviders } from '@/lib/authProviders';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/auth/Auth.module.css';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    ...pageMetadata({
      href: '/sign-up',
      locale,
      title: "Create your account",
      description: "Create a free TradingNew account.",
    }),
    // Sign-in surfaces have nothing to index and should not appear in results.
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const search = await searchParams;
  const providers = configuredSocialProviders();

  return (
    <>
      <SpaceBackdrop tone={3} />
      <AuthShell mode="up">
        <div className={styles.wrap}>
          <SignUpForm providers={providers} />
        </div>
      </AuthShell>
    </>
  );
}
