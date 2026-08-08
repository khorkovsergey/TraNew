import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EXPERTS, expertById } from '@/content/experts';
import { pick } from '@/content/types';
import { Icon } from '@/components/ui/Icon';
import { ProfileBooking, WhyRecommended } from '@/components/marketplace/ProfileSidebar';
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

      <div className={styles.profileHead}>
        <div
          className={styles.profileAvatar}
          style={{ background: expert.tile, color: expert.color }}
          aria-hidden="true"
        >
          {expert.initials}
        </div>
        <div className={styles.profileWho}>
          <div className={styles.profileNameRow}>
            <h1 className={styles.profileName}>{expert.name}</h1>
            {/* The label is the honest one for this expert, not a decoration
                every profile wears. Only a credential checked against a
                regulator's registry gets the shield. */}
            <span
              className={`${styles.credentialChip} ${
                expert.credential === 'verified' ? styles.credentialChipOn : ''
              }`}
            >
              <Icon
                name={expert.credential === 'verified' ? 'shieldCheck' : 'info'}
                size={13}
                strokeWidth={2.2}
              />
              {t(`credential.${expert.credential}`)}
            </span>
          </div>
          <div className={styles.profileRole}>
            {pick(expert.provider, locale)} · {pick(expert.jurisdiction, locale)} ·{' '}
            {expert.years} years
          </div>
          <div className={styles.profileFacts}>
            <span>
              <Icon name="star" size={14} strokeWidth={2} />
              <b className="tn-num">{expert.rating}</b> ({expert.consultations} sessions)
            </span>
            <span>
              <Icon name="pin" size={14} strokeWidth={2} />
              {pick(expert.city, locale)}
            </span>
            <span>
              <Icon name="chat" size={14} strokeWidth={2} />
              {expert.languages}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.profileGrid}>
        <div className={styles.column}>
          <WhyRecommended expert={expert} />

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
          <ProfileBooking expert={expert} />

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
