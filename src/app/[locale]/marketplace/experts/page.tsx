import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EXPERT_TASKS } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale }> };

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

export default async function ExpertsLandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('experts')} />
      <Link className={styles.backHome} href="/marketplace">
        ← {tScreens('marketplace.title')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>{tScreens('experts.title')}</h1>
      <p className={styles.lead}>{t('landing.sub')}</p>

      <div className={styles.ctaRow}>
        <Link className={styles.primary} href="/marketplace/experts/intake">
          {t('landing.find')}
        </Link>
        <Link className={styles.secondary} href="/marketplace/experts/matches">
          {t('landing.browse')}
        </Link>
      </div>

      {/* Task-first: people arrive with a problem, not with a provider in mind. */}
      <div className={styles.cardGrid}>
        {EXPERT_TASKS.map((task) => (
          <Link
            className={styles.taskCard}
            key={task.id}
            href={{ pathname: '/marketplace/experts/intake', query: { task: task.id } }}
          >
            <div className={styles.taskTitle}>{pick(task.title, locale)}</div>
            <div className={styles.taskDesc}>{pick(task.desc, locale)}</div>
          </Link>
        ))}
      </div>

      <Link
        className={styles.otherCard}
        href={{ pathname: '/marketplace/experts/intake', query: { task: 'other' } }}
      >
        <span className={styles.otherTitle}>{t('landing.otherTitle')}</span>
        <span className={styles.otherText}>{t('landing.otherText')}</span>
      </Link>
    </div>
  );
}
