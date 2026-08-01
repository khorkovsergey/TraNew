import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { CreateEventWizard } from '@/components/events/CreateEventWizard';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';
import styles from '@/components/events/Events.module.css';

/**
 * Create an event.
 *
 * Behind `requireUser`, not behind a hidden button — the wizard writes drafts
 * against an account, and an anonymous visitor reaching this URL directly needs
 * the same answer as one who clicked.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    ...pageMetadata({
      href: '/events/create',
      locale,
      title: 'Create an event',
      description: 'Publish a financial event to the TradingNew community.',
    }),
    robots: { index: false, follow: false },
  };
}

export default async function CreateEventPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser('/events/create');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/events">
        ← All events
      </Link>

      <h1 className={styles.h1} style={{ fontSize: 34 }}>
        Create an event
      </h1>
      <p className={styles.lede}>
        Finance and investing events only. Everything is checked by a moderator before it appears
        in the catalogue.
      </p>

      <CreateEventWizard />
    </div>
  );
}
