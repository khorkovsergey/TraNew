import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/AuthForms';
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
      href: '/reset-password',
      locale,
      title: "Choose a new password",
      description: "Set a new password for your TradingNew account.",
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
    <div className={styles.wrap}>
      <ResetPasswordForm token={typeof search.token === "string" ? search.token : null} />
    </div>
  );
}
