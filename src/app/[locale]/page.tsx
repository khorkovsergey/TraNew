import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GoalCards } from '@/components/home/GoalCards';
import { HeroSearch } from '@/components/home/HeroSearch';
import { LoginBanner } from '@/components/home/LoginBanner';
import { QuickLinks } from '@/components/home/QuickLinks';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname, Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { wave } from '@/lib/wave';
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

const FEATURES: Array<{
  key: 'data' | 'explain' | 'guidance' | 'tools';
  href: StaticPathname;
  icon: IconName;
  color: string;
  tile: string;
}> = [
  {
    key: 'data',
    href: '/trust',
    icon: 'shield',
    color: 'var(--tn-purple)',
    tile: 'var(--tn-purple-tint)',
  },
  {
    key: 'explain',
    href: '/how-we-explain',
    icon: 'bubble',
    color: 'var(--tn-blue)',
    tile: 'var(--tn-blue-tint)',
  },
  {
    key: 'guidance',
    href: '/guidance',
    icon: 'user',
    color: 'var(--tn-green)',
    tile: 'var(--tn-green-tint)',
  },
  {
    key: 'tools',
    href: '/tools',
    icon: 'star',
    color: 'var(--tn-purple)',
    tile: 'var(--tn-purple-tint)',
  },
];

const SHOWCASE_ICONS: Array<{ icon: IconName; color: string }> = [
  { icon: 'user', color: 'var(--tn-blue)' },
  { icon: 'bars', color: 'var(--tn-purple)' },
  { icon: 'grad', color: 'var(--tn-green)' },
  { icon: 'star', color: 'var(--tn-orange)' },
];

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

      <section className={`${styles.section} ${styles.sectionQuick}`}>
        <h2 className={`${styles.h2} ${styles.h2Small}`}>{t('knowTitle')}</h2>
        <p className={`${styles.sectionSub} ${styles.sectionSubSmall}`}>{t('knowSub')}</p>
        <QuickLinks />
      </section>

      <section className={`${styles.section} ${styles.sectionShowcase}`}>
        <div className={styles.showcaseGrid}>
          <div className={`${styles.showcase} ${styles.showcaseCharts}`}>
            <h3 className={styles.showcaseTitle}>{t('showcase.chartsTitle')}</h3>
            <p className={styles.showcaseSub}>{t('showcase.chartsSub')}</p>
            <div className={styles.showcaseCtas}>
              <Link
                className={styles.showcaseFilled}
                href="/supercharts"
                style={{ background: 'var(--tn-blue)' }}
              >
                {t('showcase.chartsCta')}
              </Link>
              <Link
                className={styles.showcaseOutline}
                href="/tools"
                style={{ color: 'var(--tn-blue)' }}
              >
                {t('showcase.chartsCta')}
              </Link>
            </div>
            <svg viewBox="0 0 600 150" className={styles.showcaseChart} aria-hidden="true">
              <polyline
                points={wave(7, 60, 600, 150)}
                fill="none"
                stroke="var(--tn-blue)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            </svg>
          </div>

          <div className={`${styles.showcase} ${styles.showcaseMarket}`}>
            <h3 className={styles.showcaseTitle}>{t('showcase.marketTitle')}</h3>
            <p className={styles.showcaseSub}>{t('showcase.marketSub')}</p>
            <div className={styles.showcaseCtas}>
              <Link
                className={styles.showcaseFilled}
                href="/marketplace"
                style={{ background: 'var(--tn-purple)' }}
              >
                {t('showcase.marketCta')}
              </Link>
              <Link
                className={styles.showcaseOutline}
                href="/marketplace/experts"
                style={{ color: 'var(--tn-purple)' }}
              >
                {t('showcase.marketCta')}
              </Link>
            </div>
            <div className={styles.showcaseIcons}>
              {SHOWCASE_ICONS.map((item) => (
                <div className={styles.showcaseIcon} key={item.icon}>
                  <Icon name={item.icon} size={26} strokeWidth={1.9} style={{ color: item.color }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionFeatures}`}>
        <div className={styles.featureStrip}>
          {FEATURES.map((feature) => (
            <Link className={styles.feature} href={feature.href} key={feature.key}>
              <div className={styles.featureTile} style={{ background: feature.tile }}>
                <Icon
                  name={feature.icon}
                  size={24}
                  strokeWidth={1.9}
                  style={{ color: feature.color }}
                />
              </div>
              <div className={styles.featureTitle}>{t(`features.${feature.key}Title`)}</div>
              <div className={styles.featureText}>{t(`features.${feature.key}Text`)}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionBanner}`}>
        <LoginBanner />
      </section>
    </>
  );
}
