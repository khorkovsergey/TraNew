'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { SLOTS, type Expert } from '@/content/experts';
import { pick } from '@/content/types';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useExpertFlow } from '@/lib/expertFlow';
import { track } from '@/lib/events/analytics';
import { rank, type ExpertBrief, type Match } from '@/lib/experts/brief';
import styles from './Marketplace.module.css';

/**
 * The two things on this page that depend on who is reading it.
 *
 * Everything else about an expert is the same for everybody. These are not:
 * why *this* person was recommended is an answer about the request they made,
 * and it is read from the brief they built rather than from a field on the
 * expert record — which is what the old "Best match" badge was, identical for
 * every visitor whatever they had asked for.
 *
 * Somebody arriving without a brief — from a search result, or a shared link —
 * gets no recommendation block at all, because nothing recommended them.
 */

function readBrief(): ExpertBrief | null {
  try {
    const raw = sessionStorage.getItem('tn_expert_brief_v1');
    return raw ? (JSON.parse(raw) as ExpertBrief) : null;
  } catch {
    return null;
  }
}

export function WhyRecommended({ expert }: { expert: Expert }) {
  const locale = useLocale() as Locale;
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const brief = readBrief();
    if (!brief?.goal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatch(
      rank(
        {
          id: expert.id,
          name: expert.name,
          services: expert.services,
          jurisdiction: pick(expert.jurisdiction, locale),
          city: pick(expert.city, locale),
          languages: expert.languages,
          remote: expert.remote,
        },
        brief
      )
    );
  }, [expert, locale]);

  if (!match || match.reasons.length === 0) return null;

  return (
    <section className={styles.whyRecommended}>
      <h2 className={styles.whyRecommendedTitle}>Why this expert was recommended</h2>
      <div className={styles.whyRecommendedGrid}>
        {match.reasons.map((reason) => (
          <div className={styles.reason} key={reason}>
            <Icon name="check" size={15} strokeWidth={2.6} />
            <span>{reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Picking a time, and deciding whether the brief goes with it.
 *
 * The consent is asked here rather than assumed, and it is one consent about
 * one thing: the brief. Everything else the account holds stays off, and the
 * sharing screen further on is where the rest can be turned on deliberately.
 *
 * This does not book anything. It carries a time and a consent into the flow
 * that does — the one with the four separate consents and the payment — and the
 * button says as much, because a green "Book consultation" that turns out to be
 * step one of four is a promise the screen did not keep.
 */
export function ProfileBooking({ expert }: { expert: Expert }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { update } = useExpertFlow();
  const [slot, setSlot] = useState<string | null>(null);
  const [shareBrief, setShareBrief] = useState(true);
  const [hasBrief, setHasBrief] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasBrief(Boolean(readBrief()?.goal));
  }, []);

  const proceed = () => {
    if (!slot) return;
    update({ expertId: expert.id, slot, shares: { brief: hasBrief && shareBrief } });
    track({ name: 'expert_selected', expertId: expert.id, tier: 'profile' });
    router.push({
      pathname: '/marketplace/experts/[id]/booking',
      params: { id: expert.id },
    });
  };

  return (
    <>
      <section className={styles.bookingRail}>
        <div className={styles.railPrice}>
          <span className="tn-num">{expert.price}</span>
          <span className={styles.railDuration}>{pick(expert.duration, locale)} session</span>
        </div>
        <div className={styles.railNext}>
          Next available: {pick(expert.availability, locale)}
        </div>
        <div className={styles.bookPanelHead} style={{ marginTop: 12 }}>
          Pick a time · Europe/Nicosia
        </div>

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

        {/* Offered only when there is a brief to share. A consent checkbox for
            a document that does not exist teaches people to tick without
            reading. */}
        {hasBrief && (
          <label className={`${styles.shareRow} ${styles.shareRowBoxed}`}>
            <input
              type="checkbox"
              checked={shareBrief}
              onChange={(event) => setShareBrief(event.target.checked)}
            />
            <span>
              Share my brief so {expert.name.split(' ')[0]} arrives prepared. Your conversation
              with Voyager stays private.
            </span>
          </label>
        )}

        <button className={styles.briefCta} disabled={!slot} onClick={proceed}>
          {slot ? `Continue with ${slot}` : 'Choose a time to continue'}
        </button>
        <p className={styles.bookNote}>
          Nothing is booked yet — the next step is the consents and payment.
        </p>
        {/* The rest of what an account holds — portfolio, goals, documents — is
            still off, and this is where somebody turns any of it on. Not a step
            in the path, because most bookings need none of it. */}
        <Link
          className={styles.railLink}
          href={{ pathname: '/marketplace/experts/[id]/sharing', params: { id: expert.id } }}
        >
          Choose what else to share →
        </Link>
      </section>

      <section className={styles.assuranceCard}>
        <Icon name="shieldCheck" size={19} strokeWidth={1.9} />
        <p>
          Education and guidance, not investment advice or product sales. No commissions. You
          receive a written summary after the session, and the expert confirms it before it is
          filed.
        </p>
      </section>
    </>
  );
}
