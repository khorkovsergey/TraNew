import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Ecosystem } from '@/components/home/Ecosystem';
import { GoalCards } from '@/components/home/GoalCards';
import { HeroSearch } from '@/components/home/HeroSearch';
import { LoginBanner } from '@/components/home/LoginBanner';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/home/Home.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return pageMetadata({
    href: '/',
    locale,
    title: t('homeTitle'),
    description: t('homeDescription'),
  });
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');

  return (
    <>
      <section className={styles.hero}>
        <Link className={styles.badge} href="/why">
          <Icon name="users" size={18} className={styles.badgeIcon} />
          {t('badge')}
        </Link>

        <h1 className={styles.h1}>
          {t('h1a')}
          <span className={styles.h1Gradient}>{t('h1b')}</span>
        </h1>

        <p className={styles.heroSub}>{t('sub')}</p>

        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} href="/start">
            {t('ctaPrimary')}
          </Link>
          <Link className={styles.ctaSecondary} href="/market/brief">
            {t('ctaSecondary')}
          </Link>
        </div>

        <HeroSearch />
      </section>

      <section className={`${styles.section} ${styles.sectionGoals}`}>
        <h2 className={styles.h2}>{t('goalsTitle')}</h2>
        <p className={styles.sectionSub}>{t('goalsSub')}</p>
        <GoalCards />
      </section>

      <div className={styles.divider}>
        <div className={styles.dividerLine} />
      </div>

      {/* Replaces the quick-link scenarios, the two product showcases and the strip
          of four principles. The principles still live on the Trust Center and the
          other information pages those tiles linked to — the routes stay. */}
      <Ecosystem />

      <section className={`${styles.section} ${styles.sectionBanner}`}>
        <LoginBanner />
      </section>
    </>
  );
}
