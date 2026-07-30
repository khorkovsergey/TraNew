import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EXPERTS } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/marketplace/experts/compare',
    locale,
    title: t('expertsCompare.title'),
    description: t('expertsCompare.subtitle'),
  });
}

export default async function ExpertsComparePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  const rows: Array<{ key: string; value: (expert: (typeof EXPERTS)[number]) => string }> = [
    { key: 'provider', value: (expert) => pick(expert.provider, locale) },
    { key: 'jurisdiction', value: (expert) => pick(expert.jurisdiction, locale) },
    { key: 'credentials', value: (expert) => t(`credential.${expert.credential}`) },
    { key: 'suited', value: (expert) => pick(expert.suited, locale) },
    { key: 'languages', value: (expert) => expert.languages },
    { key: 'duration', value: (expert) => pick(expert.duration, locale) },
    { key: 'price', value: (expert) => expert.price },
    { key: 'availability', value: (expert) => pick(expert.availability, locale) },
    { key: 'rating', value: (expert) => `★ ${expert.rating}` },
    { key: 'consultations', value: (expert) => String(expert.consultations) },
  ];

  return (
    <div className={`${styles.wrap} ${styles.wrapWide}`}>
      <Link className={styles.backHome} href="/marketplace/experts/matches">
        {t('profile.backToMatches')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>{tScreens('expertsCompare.title')}</h1>
      <p className={styles.lead}>{tScreens('expertsCompare.subtitle')}</p>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              {EXPERTS.map((expert) => (
                <th key={expert.id}>{expert.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className={styles.rowKey}>{t(`compare.${row.key}`)}</td>
                {EXPERTS.map((expert) => (
                  <td key={expert.id} className={row.key === 'price' ? 'tn-num' : undefined}>
                    {row.value(expert)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI compares fit for one task; it never ranks people in the abstract. */}
      <div className={styles.aiNote}>{t('compare.note1')}</div>
      <div className={styles.aiNote}>{t('compare.note2')}</div>
      <p className={styles.disclaimer}>{t('compare.disclaimer')}</p>
    </div>
  );
}
