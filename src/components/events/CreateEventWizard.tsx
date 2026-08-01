'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  loadDraftAction,
  saveDraftAction,
  submitEventAction,
  type DraftPayload,
  type SubmitProblem,
} from '@/app/actions/eventDrafts';
import { track } from '@/lib/events/analytics';
import { checkExternalUrl, URL_REJECTION_MESSAGE } from '@/lib/events/externalUrl';
import { COMMON_TIMEZONES } from '@/lib/events/time';
import {
  EVENT_KIND_LABEL,
  EXPERIENCE_LABEL,
  LANGUAGES,
  ORGANIZER_DECLARATIONS,
  TOPICS,
  type EventKind,
  type ExperienceLevel,
} from '@/lib/events/types';
import styles from './Events.module.css';

/**
 * The five-step create form.
 *
 * Two things make it survivable. Everything is autosaved as a draft, on a debounce
 * and on every step change, so closing the tab three steps in does not throw the
 * work away. And moving backwards never clears anything — the whole payload lives
 * in one object and steps are views onto it, rather than each step owning its own
 * state and forgetting it when unmounted.
 *
 * Validation here is for guidance. The server validates again and is the one that
 * decides, because this file can be bypassed entirely.
 */

const STEPS = ['Basics', 'Date & format', 'Agenda & speakers', 'Registration', 'Review & submit'];

const EMPTY: DraftPayload = {
  title: '',
  shortDescription: '',
  description: '',
  topics: [],
  experienceLevel: 'all_levels',
  language: ['EN'],
  eventType: 'meetup',
  format: 'online',
  startsAt: '',
  endsAt: '',
  timezone: 'Europe/Nicosia',
  country: '',
  city: '',
  venueName: '',
  venueAddress: '',
  onlineMeetingUrl: '',
  learningOutcomes: ['', '', ''],
  intendedAudience: '',
  agenda: [{ time: '', title: '', speaker: '', kind: '' }],
  speakers: [{ name: '', role: '', company: '' }],
  registrationModel: 'tradingnew',
  externalUrl: '',
  capacity: '',
  waitlistEnabled: true,
  priceType: 'free',
  priceAmount: '',
  currency: 'EUR',
  coverGradient: 'linear-gradient(135deg,#2962ff,#8b5cf6)',
  declarations: ORGANIZER_DECLARATIONS.map(() => false),
};

const GRADIENTS = [
  'linear-gradient(135deg,#2962ff,#8b5cf6)',
  'linear-gradient(135deg,#1aa966,#2962ff)',
  'linear-gradient(135deg,#f4a71f,#e0492f)',
  'linear-gradient(135deg,#8b5cf6,#e0492f)',
  'linear-gradient(135deg,#131722,#2962ff)',
];

export function CreateEventWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DraftPayload>(EMPTY);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [problems, setProblems] = useState<SubmitProblem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = useRef(false);

  const set = <K extends keyof DraftPayload>(key: K, value: DraftPayload[K]) => {
    dirty.current = true;
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Pick up where the last session stopped.
  useEffect(() => {
    void loadDraftAction().then((draft) => {
      if (!draft) return;
      const { draftId: id, step: savedStep, ...payload } = draft;
      setDraftId(id);
      setStep(savedStep);
      setForm({ ...EMPTY, ...payload });
    });
  }, []);

  const save = useCallback(
    (atStep: number, payload: DraftPayload) => {
      startTransition(async () => {
        const result = await saveDraftAction({ draftId, step: atStep, payload });
        if (result.status === 'ok') {
          setDraftId(result.data.draftId);
          setSavedAt(result.data.savedAt);
          dirty.current = false;
        }
      });
    },
    [draftId]
  );

  // Debounced autosave. Two seconds is long enough not to write on every
  // keystroke and short enough that a closed tab loses at most a sentence.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => save(step, form), 2000);
    return () => clearTimeout(timer);
  }, [form, step, save]);

  // The browser's own warning is the only one that fires on a real tab close.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const go = (next: number) => {
    const target = Math.max(0, Math.min(STEPS.length - 1, next));
    save(target, form);
    track({ name: 'event_creation_step_completed', step });
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = () => {
    setError(null);
    setProblems([]);

    startTransition(async () => {
      // Flush the latest edits first, so what is validated is what is on screen.
      const saved = await saveDraftAction({ draftId, step, payload: form });
      if (saved.status !== 'ok') {
        setError(saved.status === 'sign_in_required' ? 'Sign in to submit an event.' : saved.message);
        return;
      }

      const result = await submitEventAction({ draftId: saved.data.draftId });

      if (result.status === 'ok') {
        track({ name: 'event_creation_submitted', eventId: result.data.slug });
        dirty.current = false;
        router.push('/events/manage');
        return;
      }

      if (result.problems?.length) setProblems(result.problems);
      setError(result.status === 'sign_in_required' ? 'Sign in to submit an event.' : result.message);
    });
  };

  const problemFor = (field: string) => problems.find((problem) => problem.field === field)?.message;
  const declarationsOk = form.declarations.every(Boolean);

  return (
    <>
      <ol className={styles.steps}>
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`${styles.step} ${index === step ? styles.stepOn : index < step ? styles.stepDone : ''}`}
          >
            <span className={styles.stepNum}>{index < step ? '✓' : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className={styles.panelCard}>
        {step === 0 && (
          <fieldset>
            <legend className={styles.panelTitle}>Basics</legend>

            <Field label="Event title" htmlFor="w-title" error={problemFor('title')} required>
              <input
                id="w-title"
                className={styles.input}
                maxLength={120}
                value={form.title}
                onChange={(event) => set('title', event.target.value)}
              />
            </Field>

            <Field
              label="One-line summary"
              htmlFor="w-summary"
              hint={`${form.shortDescription.length}/200`}
              error={problemFor('shortDescription')}
              required
            >
              <input
                id="w-summary"
                className={styles.input}
                maxLength={200}
                value={form.shortDescription}
                onChange={(event) => set('shortDescription', event.target.value)}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="w-description"
              hint="Plain text. Leave a blank line between paragraphs."
              error={problemFor('description')}
              required
            >
              <textarea
                id="w-description"
                className={styles.input}
                rows={8}
                maxLength={6000}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </Field>

            <Field label="Topics" htmlFor="w-topics" error={problemFor('topics')} required>
              <div className={styles.groupOptions} id="w-topics">
                {TOPICS.map((topic) => (
                  <Toggle
                    key={topic}
                    on={form.topics.includes(topic)}
                    onClick={() =>
                      set(
                        'topics',
                        form.topics.includes(topic)
                          ? form.topics.filter((value) => value !== topic)
                          : [...form.topics, topic].slice(0, 5)
                      )
                    }
                  >
                    {topic}
                  </Toggle>
                ))}
              </div>
            </Field>

            <div className={styles.fieldRow}>
              <Field label="Experience level" htmlFor="w-level">
                <select
                  id="w-level"
                  className={styles.input}
                  value={form.experienceLevel}
                  onChange={(event) => set('experienceLevel', event.target.value)}
                >
                  {(Object.keys(EXPERIENCE_LABEL) as ExperienceLevel[]).map((level) => (
                    <option key={level} value={level}>
                      {EXPERIENCE_LABEL[level]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Event type" htmlFor="w-type">
                <select
                  id="w-type"
                  className={styles.input}
                  value={form.eventType}
                  onChange={(event) => set('eventType', event.target.value)}
                >
                  {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {EVENT_KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Language" htmlFor="w-lang">
              <div className={styles.groupOptions} id="w-lang">
                {LANGUAGES.map((language) => (
                  <Toggle
                    key={language}
                    on={form.language.includes(language)}
                    onClick={() =>
                      set(
                        'language',
                        form.language.includes(language)
                          ? form.language.filter((value) => value !== language)
                          : [...form.language, language]
                      )
                    }
                  >
                    {language}
                  </Toggle>
                ))}
              </div>
            </Field>

            <Field label="Cover" htmlFor="w-cover" hint="Image upload is not available yet.">
              <div className={styles.groupOptions} id="w-cover">
                {GRADIENTS.map((gradient) => (
                  <button
                    key={gradient}
                    type="button"
                    aria-label="Choose this cover"
                    aria-pressed={form.coverGradient === gradient}
                    onClick={() => set('coverGradient', gradient)}
                    style={{
                      width: 76,
                      height: 40,
                      borderRadius: 10,
                      background: gradient,
                      border:
                        form.coverGradient === gradient
                          ? '2px solid var(--tn-purple)'
                          : '1px solid var(--tn-border-input)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </Field>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className={styles.panelTitle}>Date and format</legend>

            <div className={styles.fieldRow}>
              <Field label="Starts" htmlFor="w-start" error={problemFor('startsAt')} required>
                <input
                  id="w-start"
                  type="datetime-local"
                  className={styles.input}
                  value={form.startsAt}
                  onChange={(event) => set('startsAt', event.target.value)}
                />
              </Field>

              <Field label="Ends" htmlFor="w-end" error={problemFor('endsAt')} required>
                <input
                  id="w-end"
                  type="datetime-local"
                  className={styles.input}
                  value={form.endsAt}
                  onChange={(event) => set('endsAt', event.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Timezone"
              htmlFor="w-tz"
              hint="The zone the event actually runs in. Attendees see their own time as well."
              error={problemFor('timezone')}
            >
              <select
                id="w-tz"
                className={styles.input}
                value={form.timezone}
                onChange={(event) => set('timezone', event.target.value)}
              >
                {COMMON_TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Format" htmlFor="w-format">
              <div className={styles.groupOptions} id="w-format">
                {(['in_person', 'online', 'hybrid'] as const).map((format) => (
                  <Toggle
                    key={format}
                    on={form.format === format}
                    onClick={() => set('format', format)}
                  >
                    {format === 'in_person' ? 'In person' : format === 'online' ? 'Online' : 'Hybrid'}
                  </Toggle>
                ))}
              </div>
            </Field>

            {form.format !== 'online' && (
              <>
                <div className={styles.fieldRow}>
                  <Field label="City" htmlFor="w-city" error={problemFor('city')} required>
                    <input
                      id="w-city"
                      className={styles.input}
                      value={form.city}
                      onChange={(event) => set('city', event.target.value)}
                    />
                  </Field>

                  <Field label="Country" htmlFor="w-country">
                    <input
                      id="w-country"
                      className={styles.input}
                      value={form.country}
                      onChange={(event) => set('country', event.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Venue" htmlFor="w-venue" error={problemFor('venueName')} required>
                  <input
                    id="w-venue"
                    className={styles.input}
                    value={form.venueName}
                    onChange={(event) => set('venueName', event.target.value)}
                  />
                </Field>

                <Field label="Address" htmlFor="w-address">
                  <input
                    id="w-address"
                    className={styles.input}
                    value={form.venueAddress}
                    onChange={(event) => set('venueAddress', event.target.value)}
                  />
                </Field>
              </>
            )}

            {form.format !== 'in_person' && (
              <Field
                label="Joining link"
                htmlFor="w-meeting"
                hint="Shown only to people who registered, and never written into a calendar file."
              >
                <input
                  id="w-meeting"
                  className={styles.input}
                  value={form.onlineMeetingUrl}
                  onChange={(event) => set('onlineMeetingUrl', event.target.value)}
                />
              </Field>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend className={styles.panelTitle}>Agenda and speakers</legend>

            <Field label="What people will take away" htmlFor="w-outcomes">
              <div id="w-outcomes">
                {form.learningOutcomes.map((outcome, index) => (
                  <input
                    key={index}
                    className={styles.input}
                    style={{ marginBottom: 8 }}
                    maxLength={160}
                    placeholder={`Outcome ${index + 1}`}
                    value={outcome}
                    onChange={(event) => {
                      const next = [...form.learningOutcomes];
                      next[index] = event.target.value;
                      set('learningOutcomes', next);
                    }}
                  />
                ))}
              </div>
            </Field>

            <Field label="Who it is for" htmlFor="w-audience">
              <textarea
                id="w-audience"
                className={styles.input}
                rows={3}
                maxLength={600}
                value={form.intendedAudience}
                onChange={(event) => set('intendedAudience', event.target.value)}
              />
            </Field>

            <p className={styles.fieldLabel}>Agenda</p>
            {form.agenda.map((item, index) => (
              <div className={styles.fieldRow} key={index}>
                <input
                  className={styles.input}
                  placeholder="18:00"
                  aria-label={`Agenda item ${index + 1} time`}
                  value={item.time}
                  onChange={(event) => {
                    const next = [...form.agenda];
                    next[index] = { ...item, time: event.target.value };
                    set('agenda', next);
                  }}
                />
                <input
                  className={styles.input}
                  placeholder="What happens"
                  aria-label={`Agenda item ${index + 1} title`}
                  value={item.title}
                  onChange={(event) => {
                    const next = [...form.agenda];
                    next[index] = { ...item, title: event.target.value };
                    set('agenda', next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => set('agenda', [...form.agenda, { time: '', title: '', speaker: '', kind: '' }])}
            >
              + Add agenda item
            </button>

            <p className={styles.fieldLabel} style={{ marginTop: 20 }}>
              Speakers
            </p>
            {form.speakers.map((speaker, index) => (
              <div className={styles.fieldRow} key={index}>
                <input
                  className={styles.input}
                  placeholder="Name"
                  aria-label={`Speaker ${index + 1} name`}
                  value={speaker.name}
                  onChange={(event) => {
                    const next = [...form.speakers];
                    next[index] = { ...speaker, name: event.target.value };
                    set('speakers', next);
                  }}
                />
                <input
                  className={styles.input}
                  placeholder="Role"
                  aria-label={`Speaker ${index + 1} role`}
                  value={speaker.role}
                  onChange={(event) => {
                    const next = [...form.speakers];
                    next[index] = { ...speaker, role: event.target.value };
                    set('speakers', next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => set('speakers', [...form.speakers, { name: '', role: '', company: '' }])}
            >
              + Add speaker
            </button>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend className={styles.panelTitle}>Registration</legend>

            <div className={styles.choiceRow}>
              <Choice
                on={form.registrationModel === 'tradingnew'}
                onClick={() => set('registrationModel', 'tradingnew')}
                title="Register on TradingNew"
                text="Free registration handled here. Attendees appear in your dashboard and get reminders."
              />
              <Choice
                on={form.registrationModel === 'external'}
                onClick={() => set('registrationModel', 'external')}
                title="Register on my own site"
                text="We show the price and send people to your page. TradingNew never takes payment."
              />
            </div>

            {form.registrationModel === 'external' ? (
              <Field
                label="Event page address"
                htmlFor="w-external"
                hint="https only. The domain is shown to attendees before they leave."
                error={problemFor('externalUrl') ?? liveUrlError(form.externalUrl)}
                required
              >
                <input
                  id="w-external"
                  className={styles.input}
                  value={form.externalUrl}
                  onChange={(event) => set('externalUrl', event.target.value)}
                  placeholder="https://"
                />
              </Field>
            ) : (
              <>
                <div className={styles.fieldRow}>
                  <Field label="Capacity" htmlFor="w-capacity" hint="Leave empty for unlimited." error={problemFor('capacity')}>
                    <input
                      id="w-capacity"
                      className={styles.input}
                      inputMode="numeric"
                      value={form.capacity}
                      onChange={(event) => set('capacity', event.target.value)}
                    />
                  </Field>

                  <Field label="Price" htmlFor="w-price" error={problemFor('priceAmount')}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className={styles.input}
                        aria-label="Price type"
                        value={form.priceType}
                        onChange={(event) => set('priceType', event.target.value as 'free' | 'paid')}
                      >
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                      </select>
                      {form.priceType === 'paid' && (
                        <input
                          id="w-price"
                          className={styles.input}
                          inputMode="numeric"
                          placeholder="45"
                          value={form.priceAmount}
                          onChange={(event) => set('priceAmount', event.target.value)}
                        />
                      )}
                    </div>
                  </Field>
                </div>

                {form.priceType === 'paid' && (
                  <div className={`${styles.notice} ${styles.noticeInfo}`}>
                    <p style={{ margin: 0 }}>
                      TradingNew does not process ticket payments in this release. Paid events show
                      the price and collect registrations; you take payment yourself.
                    </p>
                  </div>
                )}

                <label className={styles.check} style={{ marginTop: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.waitlistEnabled}
                    onChange={(event) => set('waitlistEnabled', event.target.checked)}
                  />
                  <span>Keep a waitlist when the event is full</span>
                </label>
              </>
            )}
          </fieldset>
        )}

        {step === 4 && (
          <fieldset>
            <legend className={styles.panelTitle}>Review and submit</legend>

            <div className={styles.reviewCover} style={{ background: form.coverGradient }} />
            <h3 style={{ margin: '14px 0 4px', fontSize: 22, fontWeight: 800 }}>
              {form.title || 'Untitled event'}
            </h3>
            <p className={styles.cardSummary}>{form.shortDescription}</p>

            <div className={styles.cardChips} style={{ marginBottom: 20 }}>
              {form.topics.map((topic) => (
                <span className={styles.chip} key={topic}>
                  {topic}
                </span>
              ))}
            </div>

            <p className={styles.fieldLabel}>Before this can be published</p>
            {ORGANIZER_DECLARATIONS.map((declaration, index) => (
              <label className={styles.check} key={declaration}>
                <input
                  type="checkbox"
                  checked={form.declarations[index] ?? false}
                  onChange={(event) => {
                    const next = [...form.declarations];
                    next[index] = event.target.checked;
                    set('declarations', next);
                  }}
                />
                <span>{declaration}</span>
              </label>
            ))}

            {problemFor('declarations') && (
              <p className={styles.fieldError} role="alert">
                {problemFor('declarations')}
              </p>
            )}

            <div className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 16 }}>
              <p style={{ margin: 0 }}>
                Submitting sends the event for moderation. A person reads it before it appears in
                the catalogue — typically within a day. You can track its status in your dashboard.
              </p>
            </div>

            {problems.length > 0 && (
              <div className={styles.panelCard} style={{ marginTop: 16 }}>
                <p className={styles.fieldError} role="alert" style={{ marginTop: 0 }}>
                  {problems.length} thing{problems.length === 1 ? '' : 's'} still need attention:
                </p>
                <ul className={styles.bullets}>
                  {problems.map((problem) => (
                    <li key={problem.field}>{problem.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </fieldset>
        )}
      </div>

      {error && !problems.length && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.wizardFoot}>
        <span className={styles.saveState} aria-live="polite">
          {pending ? 'Saving…' : savedAt ? 'Draft saved' : 'Not saved yet'}
        </span>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className={styles.secondary} onClick={() => go(step - 1)} disabled={step === 0}>
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button type="button" className={styles.primary} onClick={() => go(step + 1)}>
              Continue
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              onClick={submit}
              disabled={pending || !declarationsOk}
            >
              {pending ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** Immediate feedback on the URL, using the same checker the server runs. */
function liveUrlError(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const check = checkExternalUrl(value);
  return check.ok ? undefined : URL_REJECTION_MESSAGE[check.reason];
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className={styles.fieldHint}>{hint}</p>}
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.option} ${on ? styles.optionOn : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Choice({
  on,
  onClick,
  title,
  text,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${on ? styles.choiceOn : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className={styles.choiceTitle}>{title}</span>
      <span className={styles.choiceText}>{text}</span>
    </button>
  );
}
