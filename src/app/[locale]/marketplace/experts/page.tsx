import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExpertConsultation } from '@/components/marketplace/ExpertConsultation';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/marketplace/experts',
    locale,
    title: t('experts.title'),
    description: t('experts.subtitle'),
  });
}

/**
 * Expert Services: one screen, not a funnel of four.
 *
 * What was here listed four task cards, each of which led to a separate intake
 * page, which led to a separate results page. Three page loads before anybody
 * saw a single expert, and every one of them threw away what had been said on
 * the last. The doors are now tabs above the conversation, and the shortlist
 * appears under the brief that produced it.
 *
 * `/marketplace/experts/matches` is still the full catalogue for anyone who
 * would rather browse, and `/marketplace/experts/intake` still opens this
 * screen for the links and bookmarks that point at it.
 */
export default async function ExpertServicesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  /*
   * The door somebody came through, as context. Never a filter: it was their
   * guess about our taxonomy, and Voyager may find the request needs a
   * different specialist entirely.
   */
  const { task } = await searchParams;
  const category = typeof task === 'string' && task !== 'other' ? task : null;

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  return (
    <div className={`${styles.wrap} ${styles.wrapWide}`}>
      <VoyagerPageContext context={buildContext('experts')} />
      <Link className={styles.backHome} href="/marketplace">
        ← {tScreens('marketplace.title')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      {/* The heading is passed in rather than rendered above, so it can sit on
          the same row as the progress tracker, whose state lives on the client. */}
      <ExpertConsultation
        category={category}
        heading={
          <div>
            <h1 className={styles.h1}>{tScreens('experts.title')}</h1>
            <p className={styles.lead}>{t('landing.sub')}</p>
          </div>
        }
      />
    </div>
  );
}
