'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { VoyagerMark } from '@/components/voyager/VoyagerMark';
import { useRouter } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import { saveExpertBriefAction } from '@/app/actions/expertBrief';
import {
  EMPTY_BRIEF,
  EMPTY_BRIEF_NOTE,
  nextQuestion,
  readyToMatch,
  STAGE_LABEL,
  stageOf,
  type ExpertBrief,
} from '@/lib/experts/brief';
import styles from './Marketplace.module.css';

/**
 * Finding an expert by describing the problem, not by filling a form.
 *
 * What this replaces asked eleven fixed questions whichever of the four
 * services somebody picked — the category chose a heading and nothing else. The
 * conversation here reads the brief and asks for what is missing, so answering
 * the location means the location question does not come back.
 *
 * The brief beside it fills in as they talk, because the brief is the thing of
 * value: somebody who leaves after this should still have a professional
 * request they can use, whether or not they book anybody.
 *
 * The category arrives as context, never as a filter. Somebody who came through
 * the tax door and turns out to need a portfolio review should get the portfolio
 * specialist — the door was their guess about our taxonomy, not a requirement.
 */

const SERVICE_LABEL: Record<string, string> = {
  strategy: 'Building a strategy',
  review: 'Reviewing what I hold',
  finances: 'Planning my finances',
  tax: 'Tax and residency',
};

type Turn = { role: 'voyager' | 'you'; text: string };

function opening(category: string | null): string {
  const known = category && SERVICE_LABEL[category];
  return known
    ? `I see you are looking at ${SERVICE_LABEL[category!].toLowerCase()}. Tell me what you are actually trying to achieve — I will work out which specialist that needs, even if it turns out to be a different one.`
    : 'I can help you find the right specialist. Tell me what you are trying to achieve, or what problem you are facing.';
}

export function ExpertConsultation({ category }: { category: string | null }) {
  const router = useRouter();
  const [brief, setBrief] = useState<ExpertBrief>({
    ...EMPTY_BRIEF,
    initialCategory: category ?? undefined,
    /*
     * The category does not pre-fill the services, and that is not pedantry.
     * It was the person's guess about our taxonomy before they had described
     * anything, and filling the field from it means the question is never
     * asked — so their next sentence lands in whatever field came after, which
     * is how "review and tax" ended up recorded as a country.
     *
     * Voyager mentions the category in its opening line instead, and asks.
     */
  });
  const [turns, setTurns] = useState<Turn[]>([{ role: 'voyager', text: opening(category) }]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  /*
   * A brief already in progress is picked up rather than started over.
   *
   * "Edit request" on the results page comes back here, and it used to open a
   * blank conversation — so changing one word meant answering everything again.
   * §23 asks for the opposite: editing returns somebody to their request, not
   * to the beginning of it.
   */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tn_expert_brief_v1');
      if (!raw) return;
      const stored = JSON.parse(raw) as ExpertBrief;
      if (!stored?.goal) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBrief(stored);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTurns([
        {
          role: 'voyager',
          text: 'Here is the request we built. Change anything in it directly, or tell me what is wrong and I will adjust it.',
        },
      ]);
    } catch {
      /* Unreadable storage means a fresh conversation, which still works. */
    }
  }, []);

  const stage = stageOf(brief);
  const question = nextQuestion(brief);

  const send = () => {
    const said = draft.trim();
    if (!said) return;
    setDraft('');

    /*
     * The answer is filed against the question that was asked, rather than
     * parsed out of free text. Guessing a country from a sentence is how
     * somebody ends up matched to the wrong jurisdiction without being told —
     * and the brief is editable, so a wrong guess costs more than asking.
     */
    const next: ExpertBrief = { ...brief, updatedAt: new Date().toISOString() };
    switch (question?.field) {
      case 'goal':
        next.goal = said;
        next.title = said.length > 60 ? `${said.slice(0, 57).trim()}…` : said;
        break;
      case 'services':
        next.services = Object.keys(SERVICE_LABEL).filter((id) =>
          said.toLowerCase().includes(id) || said.toLowerCase().includes(SERVICE_LABEL[id].toLowerCase().split(' ')[0])
        );
        if (next.services.length === 0) next.services = brief.services;
        break;
      case 'location':
        next.country = said;
        break;
      case 'language':
        next.languages = said.split(/[,/]| and /).map((part) => part.trim()).filter(Boolean);
        break;
      case 'engagement':
        next.engagement = /ongoing/i.test(said)
          ? 'ongoing'
          : /project|piece/i.test(said)
            ? 'project'
            : 'consultation';
        break;
      default:
        next.notes = [brief.notes, said].filter(Boolean).join('\n');
    }

    const asked = nextQuestion(next);
    setBrief(next);
    setTurns((current) => [
      ...current,
      { role: 'you', text: said },
      {
        role: 'voyager',
        text:
          asked?.ask ??
          'I have enough to prepare your request. Have a look at the brief — change anything that is not right, then I will find specialists for it.',
      },
    ]);
    track({ name: 'voyager_message_sent', turns: turns.length + 1 });
  };

  const findExperts = () => {
    track({ name: 'expert_brief_saved', services: brief.services.join(',') });

    /*
     * Session storage first, always. It is what the next page reads, and it
     * works for a guest — who has nowhere else to keep a brief.
     */
    try {
      sessionStorage.setItem('tn_expert_brief_v1', JSON.stringify(brief));
    } catch {
      /* Private mode. The matches page falls back to an unfiltered list. */
    }

    /*
     * And to the account when there is one, fire-and-forget. Somebody signed in
     * closes the tab expecting their request to still exist; a guest is not
     * stopped to be told they cannot have that, because the button promises
     * experts and delivering them is the point.
     */
    void saveExpertBriefAction(brief).catch(() => null);

    router.push('/marketplace/experts/matches');
  };

  return (
    <div className={styles.consultation}>
      <section className={styles.dialogue} aria-label="Consultation">
        <div className={styles.stageRow}>
          {(['understanding', 'clarifying', 'ready'] as const).map((step) => (
            <span
              key={step}
              className={`${styles.stageStep} ${stage === step ? styles.stageOn : ''}`}
              aria-current={stage === step ? 'step' : undefined}
            >
              {STAGE_LABEL[step]}
            </span>
          ))}
        </div>

        <div className={styles.thread}>
          {turns.map((turn, index) => (
            <p
              key={index}
              className={turn.role === 'you' ? styles.youSaid : styles.voyagerSaid}
            >
              {turn.role === 'voyager' && <VoyagerMark size={18} />}
              <span>{turn.text}</span>
            </p>
          ))}
        </div>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            className={styles.composerInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tell Voyager what you need"
            aria-label="Tell Voyager what you need"
          />
          <button className={styles.composerSend} type="submit" disabled={!draft.trim()}>
            <Icon name="arrowRight" size={16} />
          </button>
        </form>
      </section>

      <aside className={styles.briefPanel} aria-label="Your brief">
        <h2 className={styles.briefHead}>Your brief</h2>

        {editing ? (
          /*
           * Editable fields, not another conversation.
           *
           * Somebody whose country was recorded wrong should be able to fix the
           * word, and making them talk Voyager round to it is worse than the
           * questionnaire this replaced — at least a form let you correct a
           * field. §14 asks for this, and it is right.
           */
          <div className={styles.editFields}>
            <label className={styles.editLabel}>
              Goal
              <textarea
                className={styles.editArea}
                value={brief.goal}
                rows={3}
                onChange={(event) => setBrief({ ...brief, goal: event.target.value })}
              />
            </label>

            <fieldset className={styles.editGroup}>
              <legend className={styles.editLabel}>Looking for</legend>
              {Object.entries(SERVICE_LABEL).map(([id, label]) => (
                <label className={styles.editCheck} key={id}>
                  <input
                    type="checkbox"
                    checked={brief.services.includes(id)}
                    onChange={(event) =>
                      setBrief({
                        ...brief,
                        services: event.target.checked
                          ? [...brief.services, id]
                          : brief.services.filter((service) => service !== id),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <label className={styles.editLabel}>
              Country
              <input
                className={styles.editInput}
                value={brief.country ?? ''}
                onChange={(event) => setBrief({ ...brief, country: event.target.value || undefined })}
              />
            </label>

            <label className={styles.editLabel}>
              Language
              <input
                className={styles.editInput}
                value={brief.languages.join(', ')}
                onChange={(event) =>
                  setBrief({
                    ...brief,
                    languages: event.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                  })
                }
              />
            </label>

            <label className={styles.editCheck}>
              <input
                type="checkbox"
                checked={brief.remoteAccepted}
                onChange={(event) => setBrief({ ...brief, remoteAccepted: event.target.checked })}
              />
              Remote specialists are fine
            </label>

            <div className={styles.editActions}>
              <button className={styles.briefCta} onClick={() => setEditing(false)}>
                Save changes
              </button>
            </div>
          </div>
        ) : !brief.goal ? (
          <p className={styles.briefNote}>{EMPTY_BRIEF_NOTE}</p>
        ) : (
          <dl className={styles.briefList}>
            <dt>Goal</dt>
            <dd>{brief.goal}</dd>

            {brief.services.length > 0 && (
              <>
                <dt>Looking for</dt>
                <dd>{brief.services.map((id) => SERVICE_LABEL[id] ?? id).join(' · ')}</dd>
              </>
            )}
            {brief.country && (
              <>
                <dt>Location</dt>
                <dd>
                  {brief.country}
                  {brief.remoteAccepted && ' · remote accepted'}
                </dd>
              </>
            )}
            {brief.languages.length > 0 && (
              <>
                <dt>Language</dt>
                <dd>{brief.languages.join(', ')}</dd>
              </>
            )}
            {brief.engagement && (
              <>
                <dt>Engagement</dt>
                <dd>{brief.engagement}</dd>
              </>
            )}
          </dl>
        )}

        {/*
          * Available as soon as there is something to search with, not only
          * when every field is filled. The remaining questions refine a
          * shortlist; waiting for them is the questionnaire's mistake.
          */}
        {brief.goal && !editing && (
          <button className={styles.editRequest} onClick={() => setEditing(true)}>
            Edit brief
          </button>
        )}

        <button
          className={styles.briefCta}
          onClick={findExperts}
          disabled={!readyToMatch(brief) || editing}
        >
          Save &amp; find experts
        </button>
        {!readyToMatch(brief) && (
          <p className={styles.briefNote}>
            Tell Voyager your goal and roughly what kind of help it needs, and this opens.
          </p>
        )}
      </aside>
    </div>
  );
}
