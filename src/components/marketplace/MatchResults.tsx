'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { VoyagerMark } from '@/components/voyager/VoyagerMark';
import { EXPERTS } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { ExpertGrid } from './ExpertGrid';
import {
  matchExperts,
  relaxations,
  SERVICE_LABEL,
  type ExpertBrief,
} from '@/lib/experts/brief';
import styles from './Marketplace.module.css';

/**
 * The shortlist, on the same page as the conversation that produced it.
 *
 * Sending somebody to another route to see their matches loses the request they
 * are looking at — so "edit" becomes a page load, and the brief they are judging
 * the experts against is no longer on screen. Both stay here.
 *
 * Nothing on a card is a property of the expert alone. The tier and the reasons
 * are answers about *this* request, computed from the brief; the alternative,
 * which this replaces, shipped a fixed "Best match" badge on the expert record,
 * so every visitor saw the same ranking whatever they had asked for.
 */

/**
 * One removable constraint, as the "matched on" row shows it.
 *
 * Only the ones that can empty a shortlist are removable — a service is what
 * the person came for, and offering to drop it is offering to search for
 * something else.
 */
type Chip = { label: string; remove?: () => void };

/** Everything the matcher needs, flattened out of the marketplace record. */
export function searchable(locale: Locale) {
  return EXPERTS.map((expert) => ({
    id: expert.id,
    name: expert.name,
    services: expert.services,
    jurisdiction: pick(expert.jurisdiction, locale),
    city: pick(expert.city, locale),
    languages: expert.languages,
    remote: expert.remote,
  }));
}

export function MatchResults({
  brief,
  onBriefChange,
  onEditRequest,
}: {
  brief: ExpertBrief;
  onBriefChange: (brief: ExpertBrief) => void;
  onEditRequest: () => void;
}) {
  const t = useTranslations('marketplace');
  const locale = useLocale() as Locale;

  /** Voyager's answer about the shortlist, when one has been asked for. */
  const [answer, setAnswer] = useState<string | null>(null);

  const pool = searchable(locale);
  const matches = matchExperts(pool, brief);
  const offers = relaxations(pool, brief);
  const byId = new Map(matches.map((match) => [match.expert.id, match]));
  /* Built from the matcher's order rather than re-sorted here: one ordering,
     in one place, and nothing on this screen that can disagree with it. */
  const record = new Map(EXPERTS.map((expert) => [expert.id, expert]));
  const shortlist = matches.flatMap((match) => record.get(match.expert.id) ?? []);

  const chips: Chip[] = [
    ...brief.services.map((id) => ({ label: SERVICE_LABEL[id] ?? id })),
    ...(brief.country
      ? [{ label: brief.country, remove: () => onBriefChange({ ...brief, country: undefined }) }]
      : []),
    ...brief.languages.map((language) => ({
      label: language,
      remove: () =>
        onBriefChange({
          ...brief,
          languages: brief.languages.filter((item) => item !== language),
        }),
    })),
    ...(brief.remoteAccepted ? [{ label: 'Remote accepted' }] : []),
  ];

  /*
   * Questions about the shortlist, answered from the shortlist.
   *
   * The second one applies a constraint rather than describing what would
   * happen if it were applied — the point is that somebody sees the effect on
   * the list in front of them, and the way back out of it.
   */
  const askVoyager = (id: string) => {
    if (id === 'language') {
      /*
       * Replaced, not appended. The language list is read as "any of these
       * works for me", so adding Russian to it would widen the search — the
       * opposite of what somebody asking for a Russian-speaking expert means.
       * This makes it the requirement, and the chip takes it back off.
       */
      const wanted = 'Russian';
      setAnswer(
        `Applied — the consultation now has to be in ${wanted}. It is a hard filter rather than a preference, because a consultation neither of you can hold is not a consultation, so anybody who does not list it has dropped out. Take the chip off to go back to what you had.`
      );
      onBriefChange({ ...brief, languages: [wanted] });
      return;
    }

    if (id === 'ranking') {
      setAnswer(
        'Hard requirements first: they actually take on the service you asked for, and they speak your language. Everything after that is ordering, not filtering — being in your country, covering more of what you asked for, and how soon they are free. No numeric score, because I have nothing that would make one honest.'
      );
      return;
    }

    const taxPerson = shortlist.find((expert) => expert.services.includes('tax'));
    setAnswer(
      taxPerson
        ? `${taxPerson.name} is the one on this list who takes on tax and legal work. The others are investment-side — if you need both, most people book the investment consultation first and bring its written plan to the tax one.`
        : 'Nobody on this shortlist takes on tax and legal work. Add "Tax and legal" to your brief and I will search for it properly rather than stretching one of these profiles to cover it.'
    );
  };

  return (
    <section className={styles.results} aria-label="Matched experts">
      <div className={styles.resultsHead}>
        <h2 className={styles.resultsTitle}>
          <Icon name="sparkle" size={20} strokeWidth={1.9} />
          Experts matched to your request
          <span className={styles.resultsCount}>{matches.length} relevant</span>
        </h2>
        <div className={styles.resultsActions}>
          <button className={styles.editRequest} onClick={onEditRequest}>
            <Icon name="sliders" size={13} /> Edit request
          </button>
          <Link className={styles.viewAll} href="/marketplace/experts/matches">
            View all experts →
          </Link>
        </div>
      </div>

      <div className={styles.matchedRow}>
        <span className={styles.matchedOn}>Matched on</span>
        {chips.map((chip) => (
          <span
            className={`${styles.briefChip} ${chip.remove ? styles.briefChipOptional : ''}`}
            key={chip.label}
          >
            {chip.label}
            {chip.remove && (
              <button
                className={styles.chipRemove}
                onClick={chip.remove}
                aria-label={`Stop requiring ${chip.label}`}
              >
                <Icon name="close" size={11} strokeWidth={2.6} />
              </button>
            )}
          </span>
        ))}
      </div>

      {matches.length === 0 && (
        /*
         * Never "no experts found". The constraint that emptied the list is
         * named, because somebody stated it on purpose and it is never dropped
         * behind their back — a search that silently ignores a requirement
         * books them with somebody who cannot do the thing they asked for.
         */
        <div className={styles.noMatchesCard}>
          <span className={styles.noMatchesIcon}>
            <Icon name="alert" size={23} strokeWidth={1.9} />
          </span>
          <h3 className={styles.noMatchesHead}>We could not find an exact match yet</h3>
          <p className={styles.noMatchesText}>
            Everything you asked for together — {chips.map((chip) => chip.label).join(', ')} —
            narrows the marketplace to nobody. I can widen it without dropping what matters most.
          </p>
          <div className={styles.noMatchesActions}>
            {offers.map((offer) => (
              <button
                className={styles.widenButton}
                key={offer.label}
                onClick={() => onBriefChange({ ...brief, ...offer.patch })}
              >
                {offer.label}
              </button>
            ))}
            <button className={styles.editRequest} onClick={onEditRequest}>
              Edit request
            </button>
          </div>
        </div>
      )}

      <ExpertGrid experts={shortlist} matches={byId} />

      <div className={styles.askBar}>
        <VoyagerMark size={30} />
        <span className={styles.askBarTitle}>Ask Voyager about these experts</span>
        <button className={styles.askChip} onClick={() => askVoyager('tax')}>
          Who covers tax as well?
        </button>
        <button className={styles.askChip} onClick={() => askVoyager('language')}>
          What if I need Russian-speaking?
        </button>
        <button className={styles.askChip} onClick={() => askVoyager('ranking')}>
          How are these ranked?
        </button>
      </div>
      {answer && <p className={styles.askAnswer}>{answer}</p>}

      <p className={styles.disclaimer}>{t('matches.noPercentages')}</p>
    </section>
  );
}
