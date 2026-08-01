'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import {
  cancelRegistrationAction,
  recordExternalClickAction,
  registerForEventAction,
} from '@/app/actions/events';
import { track } from '@/lib/events/analytics';
import { ctaFor, type CtaState } from '@/lib/events/cta';
import { EXTERNAL_LINK_ATTRS } from '@/lib/events/externalUrl';
import type { ExperienceLevel, RegistrationStatus } from '@/lib/events/types';
import { RegistrationDialog } from './RegistrationDialog';
import { LeavingDialog } from './LeavingDialog';
import styles from './Events.module.css';

/**
 * The one button that matters, and everything behind it.
 *
 * The state is computed by `ctaFor`, the same pure function the server uses
 * before it accepts a registration. Two implementations of "may this person
 * register" would eventually disagree, and the disagreement would show up as
 * either a button that does nothing or a room that is oversold.
 */

export type EventCtaProps = {
  eventId: string;
  slug: string;
  title: string;
  status: CtaInputShape['status'];
  priceType: CtaInputShape['priceType'];
  sourceType: CtaInputShape['sourceType'];
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  capacity: number | null;
  registrationCount: number;
  waitlistEnabled: boolean;
  format: CtaInputShape['format'];
  externalUrl: string | null;
  externalDomain: string | null;
  externalTrusted: boolean;
  onlineMeetingUrl: string | null;
  registration: RegistrationStatus | null;
  viewer: { name: string; email: string; level: ExperienceLevel | null } | null;
};

type CtaInputShape = Parameters<typeof ctaFor>[0];

const TONE_CLASS: Record<CtaState['tone'], string> = {
  primary: styles.ctaPrimary,
  dark: styles.ctaDark,
  success: styles.ctaSuccess,
  outline: styles.ctaOutline,
  muted: styles.ctaMuted,
};

export function EventCta(props: EventCtaProps) {
  const { openLogin, authed } = useLoginModal();
  const router = useRouter();
  const [registration, setRegistration] = useState(props.registration);
  const [dialog, setDialog] = useState<'register' | 'leaving' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const state = ctaFor({
    status: props.status,
    priceType: props.priceType,
    sourceType: props.sourceType,
    startsAt: props.startsAt,
    endsAt: props.endsAt,
    registrationDeadline: props.registrationDeadline,
    capacity: props.capacity,
    registrationCount: props.registrationCount,
    waitlistEnabled: props.waitlistEnabled,
    format: props.format,
    externalDomain: props.externalDomain,
    registration,
    now: new Date(),
  });

  const openExternal = () => {
    if (!props.externalUrl) return;

    track({
      name: 'event_external_link_clicked',
      eventId: props.eventId,
      domain: props.externalDomain ?? '',
      trusted: props.externalTrusted,
    });
    void recordExternalClickAction({ eventId: props.eventId });

    // An unvetted destination gets a confirmation first. A trusted one does not,
    // because a warning shown every time is a warning nobody reads.
    if (!props.externalTrusted) {
      setDialog('leaving');
      return;
    }

    window.open(props.externalUrl, EXTERNAL_LINK_ATTRS.target, 'noopener,noreferrer');
  };

  const press = () => {
    if (!state.enabled) return;

    switch (state.kind) {
      case 'external':
        openExternal();
        return;

      case 'join':
        if (props.onlineMeetingUrl) {
          window.open(props.onlineMeetingUrl, '_blank', 'noopener,noreferrer');
        } else {
          setMessage('The organizer has not published the joining link yet.');
        }
        return;

      case 'registered':
      case 'on_waitlist':
        router.push('/events/my');
        return;

      case 'register':
      case 'waitlist':
        if (!authed) {
          openLogin();
          return;
        }
        track({ name: 'event_registration_started', eventId: props.eventId });
        setDialog('register');
        return;

      default:
        return;
    }
  };

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelRegistrationAction({ eventId: props.eventId });
      if (result.status === 'ok') {
        setRegistration(null);
        setMessage('Your registration has been cancelled.');
        track({ name: 'event_registration_cancelled', eventId: props.eventId });
      } else if (result.status !== 'sign_in_required') {
        setMessage(result.message);
      }
    });
  };

  return (
    <div className={styles.ctaBlock}>
      <button
        type="button"
        className={`${styles.cta} ${TONE_CLASS[state.tone]}`}
        onClick={press}
        disabled={!state.enabled || pending}
        aria-describedby={state.note ? 'cta-note' : undefined}
      >
        {state.label}
        {state.kind === 'external' && <span aria-hidden="true"> ↗</span>}
      </button>

      {state.note && (
        <p className={styles.ctaNote} id="cta-note">
          {state.note}
        </p>
      )}

      {(state.kind === 'registered' || state.kind === 'on_waitlist' || state.kind === 'join') && (
        <button type="button" className={styles.linkButton} onClick={cancel} disabled={pending}>
          Cancel my registration
        </button>
      )}

      {/* Announced rather than only shown, so a screen reader hears the outcome
          of a button it just activated. */}
      <p className={styles.ctaStatus} role="status" aria-live="polite">
        {message ?? ''}
      </p>

      {dialog === 'register' && (
        <RegistrationDialog
          eventId={props.eventId}
          title={props.title}
          waitlist={state.kind === 'waitlist'}
          viewer={props.viewer}
          onClose={() => setDialog(null)}
          onDone={(outcome) => {
            setRegistration(outcome.status);
            setDialog(null);
            track({
              name: 'event_registration_completed',
              eventId: props.eventId,
              waitlisted: outcome.status === 'waitlisted',
            });
            if (outcome.status === 'waitlisted' && outcome.waitlistPosition) {
              track({
                name: 'event_waitlist_joined',
                eventId: props.eventId,
                position: outcome.waitlistPosition,
              });
            }
          }}
          register={registerForEventAction}
        />
      )}

      {dialog === 'leaving' && props.externalUrl && (
        <LeavingDialog
          domain={props.externalDomain ?? ''}
          url={props.externalUrl}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
