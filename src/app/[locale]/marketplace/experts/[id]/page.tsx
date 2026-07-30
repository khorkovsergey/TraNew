import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EXPERTS, expertById } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    EXPERTS.map((expert) => ({ locale, id: expert.id }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const expert = expertById(id);
  if (!expert) return {};

  return pageMetadata({
    href: { pathname: '/marketplace/experts/[id]', params: { id } },
    locale,
    title: `${expert.name} — ${pick(expert.provider, locale)}`,
    description: pick(expert.about, locale),
  });
}

export default async function ExpertProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const expert = expertById(id);
  if (!expert) notFound();

  const t = await getTranslations('marketplace');

  return (
    <div className={`${styles.wrap} ${styles.wrapWide}`}>
      <Link className={styles.backHome} href="/marketplace/experts/matches">
        {t('profile.backToMatches')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <div className={styles.matchHead} style={{ marginTop: 18 }}>
        <div className={styles.identity}>
          <div
            className={styles.avatar}
            style={{ background: expert.tile, color: expert.color, width: 64, height: 64 }}
            aria-hidden="true"
          >
            {expert.initials}
          </div>
          <div>
            <h1 className={styles.name} style={{ fontSize: 28 }}>
              {expert.name}
            </h1>
            <div className={styles.provider}>{pick(expert.provider, locale)}</div>
          </div>
        </div>
        <div className={styles.priceBlock}>
          <div className={`${styles.price} tn-num`}>{expert.price}</div>
          <div className={styles.priceMeta}>{pick(expert.duration, locale)}</div>
          <Link
            className={styles.primary}
            style={{ display: 'inline-block', marginTop: 12 }}
            href={{
              pathname: '/marketplace/experts/[id]/sharing',
              params: { id: expert.id },
            }}
          >
            {t('profile.book')}
          </Link>
        </div>
      </div>

      <div className={styles.profileGrid}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('profile.about')}</h2>
            <p className={styles.briefValue}>{pick(expert.about, locale)}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('profile.suited')}</h2>
            <p className={styles.briefValue}>{pick(expert.suited, locale)}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('profile.expertise')}</h2>
            <div className={styles.chips}>
              {expert.expertise.map((item) => (
                <span className={styles.chip} key={item.en}>
                  {pick(item, locale)}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('profile.reviews')}</h2>
            {/* Reviews are gated on a completed, paid consultation — stated, not implied. */}
            <p className={styles.disclaimer} style={{ marginTop: 6 }}>
              {t('profile.reviewsNote')}
            </p>
            <div style={{ marginTop: 14 }}>
              {expert.reviews.map((review) => (
                <div className={styles.review} key={review.text.en}>
                  <div className={`${styles.reviewRating} tn-num`}>★ {review.rating}</div>
                  <div className={styles.reviewText}>{pick(review.text, locale)}</div>
                  <div className={styles.reviewMeta}>{pick(review.meta, locale)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('profile.credentials')}</h2>
            <div style={{ marginTop: 12 }}>
              {expert.credentials.map((row) => (
                <div className={styles.kv} key={row.k.en}>
                  <span className={styles.kvKey}>{pick(row.k, locale)}</span>
                  <span className={styles.kvValue}>{pick(row.v, locale)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('profile.options')}</h2>
            <div style={{ marginTop: 12 }}>
              {expert.packages.map((item) => (
                <div className={styles.packageRow} key={item.id}>
                  <span>{pick(item.label, locale)}</span>
                  <span className="tn-num" style={{ fontWeight: 800 }}>
                    {item.price}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.disclosureCard}>
            <h2 className={styles.disclosureTitle}>{t('profile.disclosures')}</h2>
            <div className={styles.disclosureList}>
              {expert.disclosures.map((item) => (
                <div className={styles.disclosureItem} key={item.en}>
                  {pick(item, locale)}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
