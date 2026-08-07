'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { EXPERTS, type CredentialStatus, type MatchBand } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useExpertFlow } from '@/lib/expertFlow';
import {
  matchExperts,
  relaxations,
  TIER_LABEL,
  type ExpertBrief,
  type MatchTier,
} from '@/lib/experts/brief';
import styles from './Marketplace.module.css';

const BAND_CLASS: Record<MatchBand, string> = {
  best: styles.bandBest,
  strong: styles.bandStrong,
  suitable: styles.bandSuitable,
};

const BAND_CARD: Record<MatchBand, string> = {
  best: styles.matchCardBest,
  strong: styles.matchCardStrong,
  suitable: '',
};

const CRED_CLASS: Record<CredentialStatus, string> = {
  verified: styles.credVerified,
  verification_pending: styles.credSelf,
  self_declared: styles.credSelf,
  not_applicable: styles.credNone,
  demo: styles.credNone,
};

const BAND_KEY: Record<MatchBand, 'bandBest' | 'bandStrong' | 'bandSuitable'> = {
  best: 'bandBest',
  strong: 'bandStrong',
  suitable: 'bandSuitable',
};

/** The brief-driven tiers, mapped onto the badge classes that already exist. */
const TIER_CARD: Record<MatchTier, string> = {
  best: styles.matchCardBest,
  strong: styles.matchCardStrong,
  relevant: '',
};

const TIER_BADGE: Record<MatchTier, string> = {
  best: styles.bandBest,
  strong: styles.bandStrong,
  relevant: styles.bandSuitable,
};

export function Matches() {
  const t = useTranslations('marketplace');
  const locale = useLocale() as Locale;
  const { state, update } = useExpertFlow();

  /*
   * The brief Voyager built, read once on arrival.
   *
   * From session storage rather than the URL: a brief holds what somebody is
   * trying to do with their money, and §34 is explicit that it must not travel
   * in a query string where it lands in history and server logs.
   *
   * Null means somebody came here directly — a bookmark, or the "browse all"
   * link — and the full list is the right answer for them.
   */
  const [brief, setBrief] = useState<ExpertBrief | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tn_expert_brief_v1');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setBrief(JSON.parse(raw) as ExpertBrief);
    } catch {
      /* Unreadable storage means the unfiltered list, which still works. */
    }
  }, []);

  /*
   * Computed from the request, not read off the expert.
   *
   * `band` and `reasons` ship on the expert record, so every visitor saw the
   * same "Best match" and the same three bullets whatever they had asked for.
   * Those are properties of the expert; these are answers about this request.
   */
  /*
   * Flattened for the matcher, which takes plain strings.
   *
   * The matcher lives in `lib` and knows nothing about `Localized` or about the
   * marketplace's record shape — that is what lets it be tested without either.
   */
  const searchable = EXPERTS.map((expert) => ({
    id: expert.id,
    name: expert.name,
    services: expert.services,
    jurisdiction: pick(expert.jurisdiction, locale),
    languages: expert.languages,
  }));

  const matches = brief ? matchExperts(searchable, brief) : null;
  const shown = matches ? matches.map((match) => match.expert.id) : EXPERTS.map((e) => e.id);
  const byId = new Map((matches ?? []).map((match) => [match.expert.id, match]));
  const offers = brief ? relaxations(searchable, brief) : [];

  const saved = state?.saved ?? [];

  const toggleSave = (id: string) => {
    update({
      saved: saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id],
    });
  };

  return (
    <>
      {brief && (
        <div className={styles.briefStrip}>
          <div className={styles.briefChips}>
            {[brief.goal, brief.country, ...brief.languages].filter(Boolean).map((chip) => (
              <span className={styles.briefChip} key={chip}>
                {chip}
              </span>
            ))}
          </div>
          <Link className={styles.editRequest} href="/marketplace/experts/intake">
            Edit request
          </Link>
        </div>
      )}

      {matches?.length === 0 && (
        /*
         * Not "no experts found". Naming the constraint that emptied the list
         * is the difference between a wall and a next step — and it is never
         * relaxed silently, because somebody stated it on purpose.
         */
        <div className={styles.noMatches}>
          <h2 className={styles.noMatchesHead}>We could not find an exact match yet</h2>
          <p className={styles.briefNote}>
            Your request is narrow enough that nobody on the marketplace meets all of it. You can
            widen it here, or change the request itself.
          </p>
          <ul className={styles.relaxList}>
            {offers.map((offer) => (
              <li key={offer}>{offer}</li>
            ))}
          </ul>
          <Link className={styles.editRequest} href="/marketplace/experts/intake">
            Edit request
          </Link>
        </div>
      )}

      <div className={styles.matchList}>
        {EXPERTS.filter((expert) => shown.includes(expert.id)).map((expert) => (
          <article
            className={`${styles.matchCard} ${
              byId.get(expert.id) ? TIER_CARD[byId.get(expert.id)!.tier] : BAND_CARD[expert.band]
            }`}
            key={expert.id}
          >
            <div className={styles.matchHead}>
              <div className={styles.identity}>
                <div
                  className={styles.avatar}
                  style={{ background: expert.tile, color: expert.color }}
                  aria-hidden="true"
                >
                  {expert.initials}
                </div>
                <div>
                  <div className={styles.name}>{expert.name}</div>
                  <div className={styles.provider}>{pick(expert.provider, locale)}</div>
                </div>
              </div>
              <div className={styles.priceBlock}>
                <div className={`${styles.price} tn-num`}>{expert.price}</div>
                <div className={styles.priceMeta}>
                  {pick(expert.duration, locale)} · ★ {expert.rating}
                </div>
              </div>
            </div>

            <div className={styles.badges}>
              <span className={`${styles.band} ${BAND_CLASS[expert.band]}`}>
                {t(`matches.${BAND_KEY[expert.band]}`)}
              </span>
              <span className={`${styles.band} ${CRED_CLASS[expert.credential]}`}>
                {t(`credential.${expert.credential}`)}
              </span>
              <span className={`${styles.band} ${styles.bandSuitable}`}>
                {pick(expert.jurisdiction, locale)}
              </span>
              <span className={`${styles.band} ${styles.bandSuitable}`}>{expert.languages}</span>
            </div>

            <div className={styles.whyTitle}>{t('matches.why')}</div>
            <div className={styles.reasons}>
              {(byId.get(expert.id)?.reasons ?? expert.reasons.map((r) => pick(r, locale))).map(
                (reason) => (
                  <div className={styles.reason} key={reason}>
                    <Icon name="check" size={15} strokeWidth={2.5} />
                    {reason}
                  </div>
                )
              )}
            </div>

            <div className={styles.matchActions}>
              <Link
                className={styles.primary}
                href={{ pathname: '/marketplace/experts/[id]', params: { id: expert.id } }}
                onClick={() => update({ expertId: expert.id })}
              >
                {t('matches.view')}
              </Link>
              <Link className={styles.ghost} href="/marketplace/experts/compare">
                {t('matches.compare')}
              </Link>
              <button
                className={`${styles.saveButton} ${
                  saved.includes(expert.id) ? styles.saveButtonActive : ''
                }`}
                onClick={() => toggleSave(expert.id)}
              >
                {saved.includes(expert.id) ? t('matches.saved') : t('matches.save')}
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className={styles.disclaimer}>{t('matches.noPercentages')}</p>
    </>
  );
}
