'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { EXPERTS } from '@/content/experts';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { ExpertGrid } from './ExpertGrid';
import { searchable } from './MatchResults';
import {
  matchExperts,
  relaxations,
  SERVICE_LABEL,
  type ExpertBrief,
} from '@/lib/experts/brief';
import styles from './Marketplace.module.css';

/**
 * The full catalogue — "view all experts" — and the same list filtered by a
 * brief for anyone who arrives here with one.
 *
 * Two things it must not do. It must not invent a ranking: somebody browsing
 * has asked for nothing, so no card claims to be a "best match" and the cards
 * describe rather than recommend. And it must not silently ignore a brief that
 * does exist — a bookmark opened after a conversation should show the same
 * shortlist that conversation produced, with the constraints visible.
 */
export function Matches() {
  const t = useTranslations('marketplace');
  const locale = useLocale() as Locale;

  /*
   * The brief Voyager built, read once on arrival.
   *
   * From session storage rather than the URL: a brief holds what somebody is
   * trying to do with their money, and it must not travel in a query string
   * where it lands in browser history and server logs.
   *
   * Null means somebody came here directly — a bookmark, or "view all experts"
   * — and the full list is the right answer for them.
   */
  const [brief, setBrief] = useState<ExpertBrief | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tn_expert_brief_v1');
      const stored = raw ? (JSON.parse(raw) as ExpertBrief) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored?.goal) setBrief(stored);
    } catch {
      /* Unreadable storage means the unfiltered list, which still works. */
    }
  }, []);

  const pool = searchable(locale);
  const matches = brief ? matchExperts(pool, brief) : null;
  const byId = matches ? new Map(matches.map((match) => [match.expert.id, match])) : undefined;
  const record = new Map(EXPERTS.map((expert) => [expert.id, expert]));
  const shown = matches ? matches.flatMap((match) => record.get(match.expert.id) ?? []) : EXPERTS;
  const offers = brief ? relaxations(pool, brief) : [];

  return (
    <>
      {brief && (
        <div className={styles.matchedRow}>
          {/*
            * "Matched on" — the chips are what the search used, not a
            * restatement of the goal. The goal is a paragraph and does not
            * belong in a row of chips; what belongs there is the handful of
            * things somebody can see were applied.
            */}
          <span className={styles.matchedOn}>Matched on</span>
          {[
            ...brief.services.map((id) => SERVICE_LABEL[id] ?? id),
            brief.country,
            ...brief.languages,
            brief.remoteAccepted ? 'Remote accepted' : null,
          ]
            .filter(Boolean)
            .map((chip) => (
              <span className={styles.briefChip} key={chip as string}>
                {chip}
              </span>
            ))}
          <Link className={styles.editRequest} href="/marketplace/experts">
            <Icon name="sliders" size={13} /> Edit request
          </Link>
        </div>
      )}

      {matches?.length === 0 && (
        <div className={styles.noMatchesCard}>
          <span className={styles.noMatchesIcon}>
            <Icon name="alert" size={23} strokeWidth={1.9} />
          </span>
          <h2 className={styles.noMatchesHead}>We could not find an exact match yet</h2>
          <p className={styles.noMatchesText}>
            Your request is narrow enough that nobody on the marketplace meets all of it. Widen it
            here, or change the request itself.
          </p>
          <div className={styles.noMatchesActions}>
            {offers.map((offer) => (
              <button
                className={styles.widenButton}
                key={offer.label}
                onClick={() => setBrief({ ...brief!, ...offer.patch })}
              >
                {offer.label}
              </button>
            ))}
            <Link className={styles.editRequest} href="/marketplace/experts">
              Edit request
            </Link>
          </div>
        </div>
      )}

      <ExpertGrid experts={shown} matches={byId} catalogue />

      <p className={styles.disclaimer}>
        {brief ? t('matches.noPercentages') : t('matches.browseNote')}
      </p>
    </>
  );
}
