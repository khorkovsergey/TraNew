'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { SLOTS, type Expert } from '@/content/experts';
import { pick } from '@/content/types';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useExpertFlow } from '@/lib/expertFlow';
import { track } from '@/lib/events/analytics';
import { TIER_LABEL, type Match, type MatchTier } from '@/lib/experts/brief';
import styles from './Marketplace.module.css';

/**
 * One expert, and the grid of them.
 *
 * Shared by the shortlist and the full catalogue on purpose. They were two card
 * designs for the same object — the catalogue's carried a "Best match" badge
 * that came off the expert record, so it said the same thing to everybody and
 * meant nothing about anyone's request. One card now, and the ranking it shows
 * is either computed for a brief or absent.
 *
 * The difference between the two surfaces is exactly that:
 *   - with a brief, a tier badge and reasons about *your* request;
 *   - without one, the credential and what the expert works on, stated as a
 *     description rather than as a recommendation nobody made.
 */

const TIER_BADGE: Record<MatchTier, string> = {
  best: styles.tierBest,
  strong: styles.tierStrong,
  relevant: styles.tierRelevant,
};

const CRED_CLASS: Record<Expert['credential'], string> = {
  verified: styles.credVerified,
  verification_pending: styles.credSelf,
  self_declared: styles.credSelf,
  not_applicable: styles.credNone,
  demo: styles.credNone,
};

export function ExpertGrid({
  experts,
  matches,
  /** Save and compare, which only the browsable catalogue offers. */
  catalogue = false,
}: {
  experts: Expert[];
  /** Empty when nobody asked for anything — browsing is not a search. */
  matches?: Map<string, Match>;
  catalogue?: boolean;
}) {
  const t = useTranslations('marketplace');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, update } = useExpertFlow();

  /** Which card has its booking panel open, and what has been chosen in it. */
  const [booking, setBooking] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [shareBrief, setShareBrief] = useState(true);
  const [hasBrief, setHasBrief] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tn_expert_brief_v1');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasBrief(Boolean(raw && (JSON.parse(raw) as { goal?: string })?.goal));
    } catch {
      /* No brief. The booking still works; there is just nothing to share. */
    }
  }, []);

  const saved = state?.saved ?? [];

  const toggleSave = (id: string) => {
    update({
      saved: saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id],
    });
  };

  /**
   * Into the real booking, carrying what was chosen here.
   *
   * The slot and the brief-sharing consent are written to the booking state, so
   * the next screen opens on them rather than asking again. It still ends in
   * consents and payment: this panel picks a time, it does not book anything,
   * and the button says so.
   */
  const continueToBooking = (expert: Expert, tier: MatchTier | 'browse') => {
    if (!slot) return;
    update({ expertId: expert.id, slot, shares: { brief: hasBrief && shareBrief } });
    track({ name: 'expert_selected', expertId: expert.id, tier });
    router.push({ pathname: '/marketplace/experts/[id]/booking', params: { id: expert.id } });
  };

  return (
    <div className={styles.resultGrid}>
      {experts.map((expert) => {
        const match = matches?.get(expert.id) ?? null;
        const open = booking === expert.id;
        const credentialLabel = t(`credential.${expert.credential}`);

        return (
          <article
            className={`${styles.resultCard} ${match?.tier === 'best' ? styles.resultCardBest : ''}`}
            key={expert.id}
          >
            <div className={styles.resultTop}>
              {match ? (
                <span className={`${styles.tierBadge} ${TIER_BADGE[match.tier]}`}>
                  <Icon name="star" size={12} strokeWidth={2} />
                  {TIER_LABEL[match.tier]}
                </span>
              ) : (
                /* Nothing ranked this, so nothing here claims to have. The
                   credential is the fact worth leading with when browsing. */
                <span className={`${styles.tierBadge} ${CRED_CLASS[expert.credential]}`}>
                  <Icon
                    name={expert.credential === 'verified' ? 'shieldCheck' : 'info'}
                    size={12}
                    strokeWidth={2}
                  />
                  {credentialLabel}
                </span>
              )}
              <span className={styles.resultPrice}>
                From <b className="tn-num">{expert.price}</b>
              </span>
            </div>

            <div className={styles.resultIdentity}>
              <span
                className={styles.resultAvatar}
                style={{ background: expert.tile, color: expert.color }}
                aria-hidden="true"
              >
                {expert.initials}
              </span>
              <div className={styles.resultWho}>
                <div className={styles.resultName}>
                  {expert.name}
                  {/* The tick means a credential checked against a regulator's
                      registry, and nothing else. Everybody who has not had that
                      gets the honest label instead — a marketplace that
                      decorates every profile has made the tick meaningless. */}
                  {expert.credential === 'verified' && (
                    <span className={styles.verifiedTick} title={credentialLabel}>
                      <Icon name="checkCircle" size={14} strokeWidth={2.2} />
                    </span>
                  )}
                </div>
                <div className={styles.resultRole}>{pick(expert.provider, locale)}</div>
                <div className={styles.resultWhere}>
                  <Icon name="pin" size={12} strokeWidth={2} />
                  {pick(expert.city, locale)} · {expert.languages}
                </div>
              </div>
            </div>

            {match && expert.credential !== 'verified' && (
              <span className={styles.credNote}>{credentialLabel}</span>
            )}

            <div className={styles.whyBox}>
              <div className={styles.whyBoxTitle}>
                {match ? t('matches.why') : t('matches.whatTheyDo')}
              </div>
              {(match ? match.reasons : expert.reasons.map((reason) => pick(reason, locale))).map(
                (reason) => (
                  <div className={styles.reason} key={reason}>
                    <Icon name="check" size={13} strokeWidth={2.8} />
                    <span>{reason}</span>
                  </div>
                )
              )}
            </div>

            <div className={styles.resultMeta}>
              <Icon name="calendar" size={13} strokeWidth={2} />
              Next available <b>{pick(expert.availability, locale)}</b>
              <span className={styles.metaDot}>·</span>
              <Icon name="star" size={12} strokeWidth={2} />
              <b className="tn-num">{expert.rating}</b> ({expert.consultations})
            </div>

            <div className={styles.resultActions}>
              <Link
                className={styles.viewProfile}
                href={{ pathname: '/marketplace/experts/[id]', params: { id: expert.id } }}
              >
                {t('matches.view')}
              </Link>
              <button
                className={`${styles.bookButton} ${open ? styles.bookButtonOpen : ''}`}
                onClick={() => {
                  setBooking(open ? null : expert.id);
                  setSlot(null);
                }}
                aria-expanded={open}
              >
                <Icon name="calendar" size={14} strokeWidth={2.2} />
                {open ? 'Close' : t('profile.book')}
              </button>
            </div>

            {catalogue && (
              <div className={styles.cardMinorActions}>
                <button
                  className={`${styles.minorAction} ${
                    saved.includes(expert.id) ? styles.minorActionOn : ''
                  }`}
                  onClick={() => toggleSave(expert.id)}
                >
                  <Icon name="bookmark" size={13} strokeWidth={2} />
                  {saved.includes(expert.id) ? t('matches.saved') : t('matches.save')}
                </button>
                <Link className={styles.minorAction} href="/marketplace/experts/compare">
                  <Icon name="venn" size={13} strokeWidth={2} />
                  {t('matches.compare')}
                </Link>
              </div>
            )}

            {open && (
              <div className={styles.bookPanel}>
                <div className={styles.bookPanelHead}>Pick a time · Europe/Nicosia</div>
                <div className={styles.bookSlots}>
                  {SLOTS.map((option) => {
                    const label = pick(option, locale);
                    return (
                      <button
                        key={label}
                        className={`${styles.bookSlot} ${slot === label ? styles.bookSlotOn : ''}`}
                        onClick={() => setSlot(label)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Offered only when there is a brief to share. A consent
                    checkbox for a document that does not exist teaches people
                    to tick without reading. */}
                {hasBrief && (
                  <label className={styles.shareRow}>
                    <input
                      type="checkbox"
                      checked={shareBrief}
                      onChange={(event) => setShareBrief(event.target.checked)}
                    />
                    <span>
                      Share this brief so they arrive prepared. Your conversation with Voyager
                      stays private.
                    </span>
                  </label>
                )}

                <button
                  className={styles.briefCta}
                  disabled={!slot}
                  onClick={() => continueToBooking(expert, match?.tier ?? 'browse')}
                >
                  {slot ? `Continue with ${slot}` : 'Choose a time to continue'}
                </button>
                {/* Said before the click, not after it. */}
                <p className={styles.bookNote}>
                  Nothing is booked yet — the next step is the consents and payment.
                </p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
