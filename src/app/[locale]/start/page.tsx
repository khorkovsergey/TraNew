import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { StartWizard } from '@/components/start/StartWizard';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Start Investing.
 *
 * "Get started" for an anonymous visitor lands here — on four questions and a
 * result, not on a pricing table. Registration is asked for at the end, and only
 * to save something that already exists on screen.
 *
 * The five-link menu this page used to be is not lost: each of those
 * destinations is in Explore, Learn or the footer, which is where they belong
 * once there is a funnel to arrive through.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/start',
    locale,
    title: t('start.title'),
    description: t('start.subtitle'),
  });
}

export default async function StartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={2} />
      <StartWizard />
    </>
  );
}
