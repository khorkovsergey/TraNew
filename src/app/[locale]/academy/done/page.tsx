import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/ui/Icon';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/academy/Academy.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/academy/done',
    locale,
    title: t('academyDone.title'),
    description: t('academyDone.subtitle'),
  });
}

const COVERED = [1, 2, 3, 4, 5, 6, 7] as const;

const PATH_CARDS: Array<{ key: 'Strategy' | 'Explore' | 'Learn'; href: StaticPathname }> = [
  { key: 'Strategy', href: '/strategy' },
  { key: 'Explore', href: '/explore' },
  { key: 'Learn', href: '/academy/path' },
];

export default async function AcademyDonePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('academy.done');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1} style={{ marginTop: 0 }}>
        {tScreens('academyDone.title')}
      </h1>
      <p className={styles.lead}>{tScreens('academyDone.subtitle')}</p>

      <h2 className={styles.sectionTitle}>{t('coveredTitle')}</h2>
      <div className={styles.checklist}>
        {COVERED.map((index) => (
          <div className={styles.checkItem} key={index}>
            <Icon name="check" size={17} strokeWidth={2.5} />
            {t(`covered${index}`)}
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>{t('nextTitle')}</h2>
      <div className={styles.pathCards}>
        {PATH_CARDS.map((card) => (
          <Link className={styles.pathCard} href={card.href} key={card.key}>
            <div className={styles.pathCardTitle}>{t(`card${card.key}Title`)}</div>
            <div className={styles.pathCardText}>{t(`card${card.key}Text`)}</div>
          </Link>
        ))}
      </div>

      {/* The other half of the loop: a lesson finished is the moment a live
          session on the same topic is worth knowing about. */}
      <RelatedEvents topics={['Investing basics', 'Macroeconomics']} title="Take it further, live" />

      {/* Deliberately understated: an expert is an option, never the pushed next step. */}
      <Link className={styles.mutedLink} href="/marketplace/experts">
        {t('expertLink')}
      </Link>
    </div>
  );
}
