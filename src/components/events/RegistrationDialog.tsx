'use client';

import { useState, useTransition } from 'react';
import type { RegistrationInput, RegistrationOutcome, ActionResult } from '@/app/actions/events';
import { EXPERIENCE_LABEL, type ExperienceLevel } from '@/lib/events/types';
import { Dialog } from './Dialog';
import styles from './Events.module.css';

/**
 * Registering for an event.
 *
 * Prefilled from the account, because asking someone to retype a name the
 * product already knows is friction with nothing on the other side of it. Still
 * editable — people register on behalf of colleagues, and the badge should say
 * who is actually coming.
 *
 * The two consents are separate and neither is pre-ticked. Bundling "I accept
 * the terms" with "send me updates" gets a higher opt-in rate and means nothing.
 */

export function RegistrationDialog({
  eventId,
  title,
  waitlist,
  viewer,
  onClose,
  onDone,
  register,
}: {
  eventId: string;
  title: string;
  waitlist: boolean;
  viewer: { name: string; email: string; level: ExperienceLevel | null } | null;
  onClose: () => void;
  onDone: (outcome: RegistrationOutcome) => void;
  register: (input: RegistrationInput) => Promise<ActionResult<RegistrationOutcome>>;
}) {
  const [name, setName] = useState(viewer?.name ?? '');
  const [email, setEmail] = useState(viewer?.email ?? '');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState<ExperienceLevel | ''>(viewer?.level ?? '');
  const [updates, setUpdates] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RegistrationOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!terms) {
      setError('Please accept the event terms to continue.');
      return;
    }

    startTransition(async () => {
      const result = await register({
        eventId,
        name,
        email,
        company: company || undefined,
        role: role || undefined,
        experienceLevel: level || undefined,
        eventUpdatesConsent: updates,
        termsAccepted: terms,
      });

      if (result.status === 'ok') {
        setDone(result.data);
        return;
      }

      setError(
        result.status === 'sign_in_required'
          ? 'Your session ended. Sign in again to register.'
          : result.message
      );
    });
  };

  if (done) {
    return (
      <Dialog
        title={done.status === 'waitlisted' ? "You're on the waitlist" : "You're registered"}
        onClose={() => {
          onDone(done);
          onClose();
        }}
        footer={
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              onDone(done);
              onClose();
            }}
          >
            Done
          </button>
        }
      >
        <p className={styles.dialogText} role="status">
          {done.status === 'waitlisted'
            ? `You are number ${done.waitlistPosition} on the waitlist for ${title}. We will email you the moment a place opens.`
            : `Your place at ${title} is confirmed. A confirmation is on its way to ${email}.`}
        </p>
        <p className={styles.dialogHint}>
          Add it to your calendar from the event page, and find it any time under My events.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={waitlist ? 'Join the waitlist' : 'Register for this event'}
      description={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="registration-form" className={styles.primary} disabled={pending}>
            {pending ? 'Submitting…' : waitlist ? 'Join waitlist' : 'Confirm registration'}
          </button>
        </>
      }
    >
      <form id="registration-form" onSubmit={submit} noValidate>
        <Field label="Name" htmlFor="reg-name" required>
          <input
            id="reg-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </Field>

        <Field label="Email" htmlFor="reg-email" required hint="Where the confirmation is sent.">
          <input
            id="reg-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <div className={styles.fieldRow}>
          <Field label="Company" htmlFor="reg-company" optional>
            <input
              id="reg-company"
              className={styles.input}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              autoComplete="organization"
            />
          </Field>

          <Field label="Role" htmlFor="reg-role" optional>
            <input
              id="reg-role"
              className={styles.input}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              autoComplete="organization-title"
            />
          </Field>
        </div>

        <Field
          label="Experience level"
          htmlFor="reg-level"
          optional
          hint="Helps the organizer pitch the session."
        >
          <select
            id="reg-level"
            className={styles.input}
            value={level}
            onChange={(event) => setLevel(event.target.value as ExperienceLevel | '')}
          >
            <option value="">Prefer not to say</option>
            {(Object.keys(EXPERIENCE_LABEL) as ExperienceLevel[]).map((value) => (
              <option key={value} value={value}>
                {EXPERIENCE_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={updates}
            onChange={(event) => setUpdates(event.target.checked)}
          />
          <span>Email me updates about this event from the organizer</span>
        </label>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            required
          />
          <span>
            I accept the event terms and understand that TradingNew is not the organizer of
            community events.
          </span>
        </label>

        {error && (
          <p className={styles.fieldError} role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {optional && <span className={styles.fieldOptional}> (optional)</span>}
      </label>
      {children}
      {hint && <p className={styles.fieldHint}>{hint}</p>}
    </div>
  );
}
