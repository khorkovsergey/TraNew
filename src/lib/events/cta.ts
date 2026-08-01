import type { EventStatus, PriceType, RegistrationStatus } from './types';

/**
 * What the main button on an event says and does.
 *
 * One pure function, because this is the decision most likely to be got subtly
 * wrong: a cancelled event that still offers Register, a full one that takes a
 * registration it cannot honour, an external one that pretends TradingNew handles
 * the ticket. Every one of those is a promise the product cannot keep, so the
 * rule lives here where it can be tested against every combination rather than
 * being spread across a component tree.
 */

export type CtaKind =
  | 'register'
  | 'registered'
  | 'waitlist'
  | 'on_waitlist'
  | 'join'
  | 'external'
  | 'closed'
  | 'cancelled'
  | 'completed'
  | 'unavailable';

export type CtaState = {
  kind: CtaKind;
  label: string;
  /** False when the button is present for explanation rather than for pressing. */
  enabled: boolean;
  /** Shown under the button — the reason, when there is one worth giving. */
  note: string | null;
  tone: 'primary' | 'dark' | 'success' | 'outline' | 'muted';
};

export type CtaInput = {
  status: EventStatus;
  priceType: PriceType;
  sourceType: 'tradingnew' | 'community' | 'external';
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  capacity: number | null;
  registrationCount: number;
  waitlistEnabled: boolean;
  format: 'in_person' | 'online' | 'hybrid';
  externalDomain: string | null;
  /** The viewer's own registration, if any. */
  registration: RegistrationStatus | null;
  now: Date;
};

/** An online event opens its room shortly before the start, not on the hour. */
export const JOIN_WINDOW_MINUTES = 15;

export function isFull(input: Pick<CtaInput, 'capacity' | 'registrationCount'>): boolean {
  return input.capacity !== null && input.registrationCount >= input.capacity;
}

export function spotsLeft(input: Pick<CtaInput, 'capacity' | 'registrationCount'>): number | null {
  if (input.capacity === null) return null;
  return Math.max(0, input.capacity - input.registrationCount);
}

export function ctaFor(input: CtaInput): CtaState {
  const now = input.now.getTime();
  const starts = Date.parse(input.startsAt);
  const ends = Date.parse(input.endsAt);

  // Terminal states first: nothing below them can be true at the same time.
  if (input.status === 'cancelled') {
    return {
      kind: 'cancelled',
      label: 'Event cancelled',
      enabled: false,
      note: 'This event will not take place. Registrations have been cancelled.',
      tone: 'muted',
    };
  }

  if (input.status === 'completed' || (Number.isFinite(ends) && ends < now)) {
    return {
      kind: 'completed',
      label: 'This event has ended',
      enabled: false,
      note: input.registration === 'registered' || input.registration === 'attended'
        ? 'You attended this event.'
        : null,
      tone: 'muted',
    };
  }

  if (input.status !== 'published') {
    return {
      kind: 'unavailable',
      label: 'Not available',
      enabled: false,
      note: 'This event is not published.',
      tone: 'muted',
    };
  }

  // TradingNew never takes the money or the registration for someone else's event.
  if (input.sourceType === 'external' || input.priceType === 'external') {
    return {
      kind: 'external',
      label: 'Go to event website',
      enabled: true,
      note: input.externalDomain
        ? `Registration is handled by ${input.externalDomain}.`
        : 'Registration is handled outside TradingNew.',
      tone: 'outline',
    };
  }

  if (input.registration === 'waitlisted') {
    return {
      kind: 'on_waitlist',
      label: "You're on the waitlist",
      enabled: true,
      note: 'We will let you know if a place opens up.',
      tone: 'success',
    };
  }

  if (input.registration === 'registered' || input.registration === 'attended') {
    const joinable =
      input.format !== 'in_person' && now >= starts - JOIN_WINDOW_MINUTES * 60_000 && now <= ends;

    if (joinable) {
      return {
        kind: 'join',
        label: 'Join event',
        enabled: true,
        note: 'The room is open.',
        tone: 'success',
      };
    }

    return {
      kind: 'registered',
      label: "You're registered",
      enabled: true,
      note: null,
      tone: 'success',
    };
  }

  const deadline = input.registrationDeadline ? Date.parse(input.registrationDeadline) : null;
  if (deadline !== null && Number.isFinite(deadline) && deadline < now) {
    return {
      kind: 'closed',
      label: 'Registration closed',
      enabled: false,
      note: 'The registration deadline has passed.',
      tone: 'muted',
    };
  }

  if (isFull(input)) {
    if (!input.waitlistEnabled) {
      return {
        kind: 'closed',
        label: 'Sold out',
        enabled: false,
        note: 'This event is at capacity.',
        tone: 'muted',
      };
    }

    return {
      kind: 'waitlist',
      label: 'Join waitlist',
      enabled: true,
      note: 'You will be offered a place if one frees up.',
      tone: 'dark',
    };
  }

  return {
    kind: 'register',
    label: 'Register',
    enabled: true,
    note: null,
    tone: 'primary',
  };
}

/** The availability line on a card: "18 of 40 spots left", "Sold out", "34 going". */
export function availabilityLabel(input: {
  capacity: number | null;
  registrationCount: number;
  status: EventStatus;
  waitlistEnabled: boolean;
}): string | null {
  if (input.status === 'cancelled') return 'Cancelled';
  if (input.capacity === null) {
    return input.registrationCount > 0
      ? `${input.registrationCount.toLocaleString('en-GB')} registered`
      : null;
  }

  const left = Math.max(0, input.capacity - input.registrationCount);
  if (left === 0) return input.waitlistEnabled ? 'Waitlist open' : 'Sold out';
  return `${left} of ${input.capacity} spots left`;
}

export function priceLabel(input: {
  priceType: PriceType;
  priceAmount: number | null;
  currency: string | null;
}): string {
  if (input.priceType === 'free') return 'Free';
  if (input.priceAmount === null) return 'See website';

  const symbol = CURRENCY_SYMBOL[input.currency ?? 'EUR'] ?? `${input.currency} `;
  const amount = Number.isInteger(input.priceAmount)
    ? String(input.priceAmount)
    : input.priceAmount.toFixed(2);

  return `${symbol}${amount}`;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
};
