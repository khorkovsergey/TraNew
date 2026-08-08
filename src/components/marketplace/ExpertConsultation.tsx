'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Icon, type IconName } from '@/components/ui/Icon';
import { VoyagerMark } from '@/components/voyager/VoyagerMark';
import { EXPERT_CATEGORIES } from '@/content/experts';
import { pick } from '@/content/types';
import type { Locale } from '@/i18n/routing';
import { MatchResults } from './MatchResults';
import { track } from '@/lib/events/analytics';
import { saveExpertBriefAction } from '@/app/actions/expertBrief';
import {
  EMPTY_BRIEF,
  EMPTY_BRIEF_NOTE,
  ENGAGEMENT_LABEL,
  nextQuestion,
  readyToMatch,
  SERVICE_LABEL,
  servicesFromAnswer,
  SUGGESTED,
  urgencyFromAnswer,
  URGENCY_LABEL,
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

/** `at` is an ISO stamp, empty on the opening line — see `time` below. */
type Turn = { role: 'voyager' | 'you'; text: string; at: string };

/** Where somebody is in the flow, as the three dots across the top show it. */
const PHASES = [
  ['Understanding', 'your goal'],
  ['Preparing', 'your brief'],
  ['Finding', 'experts'],
] as const;

function Tracker({ at }: { at: number }) {
  return (
    <ol className={styles.tracker}>
      {PHASES.map(([first, second], index) => {
        const done = index < at;
        const current = index === at;
        return (
          <li className={styles.trackerStep} key={first}>
            <span
              className={`${styles.trackerDot} ${done ? styles.trackerDone : ''} ${
                current ? styles.trackerOn : ''
              }`}
            >
              {done ? <Icon name="check" size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={`${styles.trackerLabel} ${done || current ? styles.trackerLabelOn : ''}`}
            >
              {first}
              <br />
              {second}
            </span>
            {index < PHASES.length - 1 && (
              <span className={`${styles.trackerLine} ${done ? styles.trackerLineDone : ''}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The rows of the brief, in the order they are worth reading. */
type Row = {
  field: string;
  label: string;
  icon: IconName;
  /** Rendered as chips rather than a sentence. */
  chips?: string[];
  value: string;
};

function rowsOf(brief: ExpertBrief): Row[] {
  const rows: Row[] = [];
  if (brief.goal) rows.push({ field: 'goal', label: 'Goal', icon: 'target', value: brief.goal });
  if (brief.services.length > 0) {
    rows.push({
      field: 'services',
      label: 'Requested services',
      icon: 'users',
      chips: brief.services.map((id) => SERVICE_LABEL[id] ?? id),
      value: brief.services.map((id) => SERVICE_LABEL[id] ?? id).join(', '),
    });
  }
  if (brief.country) {
    rows.push({
      field: 'country',
      label: 'Location',
      icon: 'pin',
      value: `${brief.country}${brief.remoteAccepted ? ' · remote accepted' : ' · on-site only'}`,
    });
  }
  if (brief.languages.length > 0) {
    rows.push({
      field: 'languages',
      label: 'Language',
      icon: 'chat',
      value: brief.languages.join(', '),
    });
  }
  if (brief.engagement) {
    rows.push({
      field: 'engagement',
      label: 'Engagement',
      icon: 'fileSearch',
      value: ENGAGEMENT_LABEL[brief.engagement],
    });
  }
  if (brief.urgency) {
    rows.push({
      field: 'urgency',
      label: 'Timeline',
      icon: 'clock',
      value: URGENCY_LABEL[brief.urgency],
    });
  }
  if (brief.notes) {
    rows.push({ field: 'notes', label: 'Additional notes', icon: 'book', value: brief.notes });
  }
  return rows;
}

function opening(categoryId: string | null, locale: Locale): string {
  const category = EXPERT_CATEGORIES.find((item) => item.id === categoryId);
  return category && category.service
    ? `I see you are looking at ${pick(category.title, locale).toLowerCase()}. Tell me what you are actually trying to achieve — I will work out which specialist that needs, even if it turns out to be a different one.`
    : 'I can help you find the right specialist. Tell me what you are trying to achieve, or what problem you are facing — you do not need to know what kind of expert that is.';
}

export function ExpertConsultation({
  category,
  heading,
}: {
  category: string | null;
  /** The page's own title block, so it can share a row with the tracker. */
  heading?: React.ReactNode;
}) {
  const locale = useLocale() as Locale;

  /*
   * One screen with states, as the mockup has it, rather than a navigation.
   *
   * Sending somebody to another route to see the results loses the
   * conversation that produced them — so "Edit request" is a step back rather
   * than a page load. `/matches` stays a real route for anyone arriving with a
   * bookmark or following "view all experts".
   */
  const [phase, setPhase] = useState<'brief' | 'matching' | 'results'>('brief');
  const [categoryId, setCategoryId] = useState<string | null>(category ?? 'unsure');
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
  const [turns, setTurns] = useState<Turn[]>([
    { role: 'voyager', text: opening(category ?? 'unsure', locale), at: '' },
  ]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  /**
   * Which single line is being edited, and the text in it.
   *
   * Inline, with no separate editor page: a panel that turns into a form to
   * correct one word is the questionnaire this replaced. The rest of the brief
   * stays readable while one line changes — you are correcting a line against
   * the request it belongs to.
   */
  const [editing, setEditing] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState('');
  /* Times are rendered only after mount: the first turn exists during the
     server render too, and a clock is the one thing guaranteed to differ. */
  const [mounted, setMounted] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  /*
   * A brief already in progress is picked up rather than started over.
   *
   * "Edit request" comes back here, and it used to open a blank conversation —
   * so changing one word meant answering everything again. Editing returns
   * somebody to their request, not to the beginning of it.
   */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       session storage and the clock are both browser-only, so the state they
       produce cannot exist until after the first render. */
    setMounted(true);
    try {
      const raw = sessionStorage.getItem('tn_expert_brief_v1');
      if (!raw) return;
      const stored = JSON.parse(raw) as ExpertBrief;
      if (!stored?.goal) return;
      setBrief(stored);
      setTurns([
        {
          role: 'voyager',
          text: 'Here is the request we built. Change anything in it directly, or tell me what is wrong and I will adjust it.',
          at: new Date().toISOString(),
        },
      ]);
    } catch {
      /* Unreadable storage means a fresh conversation, which still works. */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /* The thread is a fixed-height window; a new message below the fold is a
     message nobody sees. */
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [turns, typing]);

  const question = nextQuestion(brief);
  const ready = readyToMatch(brief);
  const trackerAt = phase === 'results' || phase === 'matching' ? 2 : ready ? 1 : 0;

  const say = (turn: Turn) => setTurns((current) => [...current, turn]);

  const send = (value?: string) => {
    const said = (value ?? draft).trim();
    if (!said || typing) return;
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
      case 'services': {
        const found = servicesFromAnswer(said);
        next.services = found.length > 0 ? found : brief.services;
        break;
      }
      case 'location':
        next.country = said;
        next.remoteAccepted = !/in person|on.?site|face to face/i.test(said);
        break;
      case 'language':
        next.languages = said
          .split(/[,/]| and /)
          .map((part) => part.trim())
          .filter(Boolean);
        break;
      case 'engagement':
        next.engagement = /ongoing/i.test(said)
          ? 'ongoing'
          : /project|piece/i.test(said)
            ? 'project'
            : 'consultation';
        break;
      case 'timeline':
        next.urgency = urgencyFromAnswer(said) ?? 'flexible';
        break;
      default:
        next.notes = [brief.notes, said].filter(Boolean).join('\n');
    }

    const asked = nextQuestion(next);
    setBrief(next);
    say({ role: 'you', text: said, at: new Date().toISOString() });
    setTyping(true);
    track({ name: 'voyager_message_sent', turns: turns.length + 1 });

    /* A beat before the reply. Not decoration: an answer that appears in the
       same frame as the question reads as a form validating, not as somebody
       reading what you wrote. */
    window.setTimeout(() => {
      setTyping(false);
      say({
        role: 'voyager',
        text:
          asked?.ask ??
          'That is enough to search with. Have a look at the brief on the right — change anything that is not right, then I will find specialists for it.',
        at: new Date().toISOString(),
      });
    }, 650);
  };

  /**
   * Switching door mid-conversation.
   *
   * The mockup restarts on every tab. That is right for an empty conversation
   * and wrong once somebody has typed their situation into it — losing a
   * paragraph about your own money to a mis-click is not a category filter.
   * So: restart while there is nothing to lose, otherwise carry on and say so.
   */
  const pickCategory = (id: string) => {
    setCategoryId(id);
    if (brief.goal) {
      const label = pick(
        EXPERT_CATEGORIES.find((item) => item.id === id)?.title ?? { en: 'that' },
        locale
      );
      say({
        role: 'voyager',
        text: `Noted — ${label.toLowerCase()}. I have kept what you already told me; say what changes and I will update the brief.`,
        at: new Date().toISOString(),
      });
      return;
    }
    setBrief({ ...EMPTY_BRIEF, initialCategory: id === 'unsure' ? undefined : id });
    setTurns([{ role: 'voyager', text: opening(id, locale), at: new Date().toISOString() }]);
  };

  const findExperts = () => {
    track({ name: 'expert_brief_saved', services: brief.services.join(',') });

    /*
     * Session storage first, always. It is what the profile and the booking
     * read, and it works for a guest — who has nowhere else to keep a brief.
     */
    try {
      sessionStorage.setItem('tn_expert_brief_v1', JSON.stringify(brief));
    } catch {
      /* Private mode. The matching still runs; nothing downstream reads it. */
    }

    /*
     * And to the account when there is one, fire-and-forget. Somebody signed in
     * closes the tab expecting their request to still exist; a guest is not
     * stopped to be told they cannot have that, because the button promises
     * experts and delivering them is the point.
     */
    void saveExpertBriefAction(brief).catch(() => null);

    setPhase('matching');
    window.setTimeout(() => setPhase('results'), 900);
  };

  const startEdit = (row: Row) => {
    setEditing(row.field);
    setRowDraft(row.chips ? row.chips.join(', ') : row.value);
  };

  const commitEdit = (row: Row) => {
    const value = rowDraft.trim();
    setEditing(null);
    if (!value) return;

    switch (row.field) {
      case 'goal':
        setBrief({ ...brief, goal: value });
        break;
      case 'services': {
        // Typed back as labels, stored as ids — otherwise an edited row stops
        // matching anybody and the panel gives no clue why.
        const wanted = value.split(',').map((part) => part.trim().toLowerCase());
        const ids = Object.keys(SERVICE_LABEL).filter((id) =>
          wanted.some((word) => SERVICE_LABEL[id].toLowerCase().includes(word) || word === id)
        );
        setBrief({ ...brief, services: ids.length > 0 ? ids : brief.services });
        break;
      }
      case 'country':
        setBrief({ ...brief, country: value });
        break;
      case 'languages':
        setBrief({
          ...brief,
          languages: value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        });
        break;
      case 'notes':
        setBrief({ ...brief, notes: value });
        break;
      default:
        break;
    }
  };

  const rows = rowsOf(brief);
  /* Rendered only after mount. The opening turn exists during the server render
     too, and a clock is the one thing guaranteed to differ between the two. */
  const time = (at: string) =>
    mounted && at
      ? new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '';

  return (
    <>
      <div className={styles.servicesHead}>
        {heading}
        <Tracker at={trackerAt} />
      </div>

      {phase === 'brief' && (
        <div className={styles.consultation}>
          <section className={styles.dialogue} aria-label="Consultation with Voyager">
            <div className={styles.categoryTabs} role="group" aria-label="What you need help with">
              {EXPERT_CATEGORIES.map((item) => {
                const on = categoryId === item.id;
                return (
                  <button
                    className={`${styles.categoryTab} ${on ? styles.categoryTabOn : ''}`}
                    key={item.id}
                    onClick={() => pickCategory(item.id)}
                    aria-pressed={on}
                  >
                    <Icon
                      name={item.icon}
                      size={17}
                      strokeWidth={1.9}
                      style={{ color: on ? item.color : 'var(--tn-text-muted)' }}
                    />
                    {pick(item.title, locale)}
                    {on && (
                      <span className={styles.categoryTick}>
                        <Icon name="check" size={11} strokeWidth={3.4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className={styles.thread} ref={threadRef}>
              {turns.map((turn, index) => (
                <div
                  className={turn.role === 'you' ? styles.turnYou : styles.turnVoyager}
                  key={index}
                >
                  {turn.role === 'voyager' && <VoyagerMark size={30} />}
                  <span
                    className={turn.role === 'you' ? styles.bubbleYou : styles.bubbleVoyager}
                  >
                    {turn.text}
                  </span>
                  <span className={styles.turnTime}>{time(turn.at)}</span>
                </div>
              ))}
              {typing && (
                <div className={styles.turnVoyager}>
                  <VoyagerMark size={30} />
                  <span className={styles.typing} aria-label="Voyager is typing">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
            </div>

            <div className={styles.composerBlock}>
              {/*
                * The suggested answers, from the mockup's click-through. They
                * exist because some of these are our vocabulary rather than the
                * person's — nobody guesses that "review" is what this
                * marketplace calls portfolio work. The text box stays; this
                * removes a guessing game rather than a choice.
                */}
              {!typing && question && SUGGESTED[question.field] && (
                <div className={styles.suggestRow}>
                  {SUGGESTED[question.field].map((option) => (
                    <button className={styles.askChip} key={option} onClick={() => send(option)}>
                      {option}
                    </button>
                  ))}
                </div>
              )}

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
                  placeholder="Type a message to Voyager…"
                  aria-label="Message Voyager"
                />
                <button className={styles.composerSend} type="submit" disabled={!draft.trim()}>
                  <Icon name="send" size={16} strokeWidth={2.2} />
                </button>
              </form>

              <p className={styles.voyagerNote}>
                <Icon name="sparkle" size={13} strokeWidth={2} />
                Voyager clarifies your goal and matches you with experts whose credentials you can
                check. It never gives professional advice itself.
              </p>
            </div>
          </section>

          <aside
            className={`${styles.briefPanel} ${ready ? styles.briefPanelReady : ''}`}
            aria-label="Your brief"
          >
            <div className={styles.briefTitleRow}>
              <h2 className={styles.briefHead}>Your brief</h2>
              <span className={styles.briefBadge}>Built live from our conversation</span>
              {/* Only once there is something to have saved: a panel announcing
                  it saved nothing is worse than a silent one. */}
              {brief.goal && (
                <span className={styles.autoSaved}>
                  <Icon name="check" size={12} strokeWidth={3} /> Auto-saved
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <div className={styles.briefEmpty}>
                <span className={styles.briefEmptyIcon}>
                  <Icon name="fileSearch" size={24} strokeWidth={1.7} />
                </span>
                <div className={styles.briefEmptyHead}>Voyager will build your request here</div>
                <p className={styles.briefNote}>{EMPTY_BRIEF_NOTE}</p>
              </div>
            ) : (
              <div className={styles.briefRows}>
                {rows.map((row) => (
                  <div className={styles.briefRow} key={row.field}>
                    <Icon
                      className={styles.briefRowIcon}
                      name={row.icon}
                      size={16}
                      strokeWidth={1.9}
                    />
                    <span className={styles.briefRowLabel}>{row.label}</span>

                    {editing === row.field ? (
                      <>
                        <input
                          className={styles.briefRowInput}
                          value={rowDraft}
                          autoFocus
                          aria-label={`Edit ${row.label}`}
                          onChange={(event) => setRowDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitEdit(row);
                            if (event.key === 'Escape') setEditing(null);
                          }}
                        />
                        <button
                          className={styles.briefRowSave}
                          onClick={() => commitEdit(row)}
                          aria-label={`Save ${row.label}`}
                        >
                          <Icon name="check" size={14} strokeWidth={3} />
                        </button>
                      </>
                    ) : (
                      <>
                        {row.chips ? (
                          <span className={styles.briefRowChips}>
                            {row.chips.map((chip) => (
                              <span className={styles.serviceChip} key={chip}>
                                {chip}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className={styles.briefRowValue}>{row.value}</span>
                        )}
                        {/* Every line is editable, including the ones Voyager
                            inferred — an inference nobody can correct is a
                            decision made on somebody's behalf. */}
                        <button
                          className={styles.pencil}
                          onClick={() => startEdit(row)}
                          aria-label={`Edit ${row.label}`}
                        >
                          <Icon name="sliders" size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/*
              * Available as soon as there is something to search with, not only
              * when every field is filled. The remaining questions refine a
              * shortlist; waiting for them is the questionnaire's mistake.
              */}
            {ready ? (
              <div className={styles.briefActions}>
                <button
                  className={styles.briefEdit}
                  onClick={() => rows[0] && startEdit(rows[0])}
                  disabled={editing !== null}
                >
                  <Icon name="sliders" size={14} /> Edit brief
                </button>
                <button
                  className={styles.briefCta}
                  onClick={findExperts}
                  disabled={editing !== null}
                >
                  <Icon name="search" size={15} strokeWidth={2.4} /> Save and find experts
                </button>
              </div>
            ) : (
              <p className={styles.briefPending}>
                A couple more answers and your brief is ready to search with.
              </p>
            )}
          </aside>
        </div>
      )}

      {phase === 'matching' && (
        <div className={styles.matching}>
          <span className={styles.spinner} />
          Finding experts for your request…
        </div>
      )}

      {phase === 'results' && (
        <MatchResults
          brief={brief}
          onBriefChange={setBrief}
          onEditRequest={() => setPhase('brief')}
        />
      )}
    </>
  );
}
