import type { MarketExchange } from '../../content/markets';

/**
 * Is this exchange open, and when does that change?
 *
 * Computed from IANA time zones rather than a stored UTC offset, because an
 * offset is only true for part of the year. New York and London change clocks on
 * different dates, so for two weeks each spring the gap between them is an hour
 * different from the rest of the year — a fixed offset gets the London open
 * wrong for exactly those two weeks and is right the rest of the time, which is
 * the hardest kind of bug to notice.
 *
 * What this does not know is holidays. There is no holiday calendar in the
 * project, so rather than quietly reporting an exchange as open on Christmas
 * Day, every result carries `holidaysKnown: false` and the screens say so. A
 * limitation that is stated is a smaller problem than a wrong answer.
 */

export type SessionPhase = 'open' | 'closed' | 'pre-market' | 'after-hours';

export type SessionStatus = {
  exchangeId: string;
  phase: SessionPhase;
  /** Local wall-clock time at the exchange, "14:32". */
  localTime: string;
  /** The regular session, as a human string in exchange-local time. */
  regularSession: string;
  /** When the phase changes next, in exchange-local time, or null if unknown. */
  nextTransition: { label: string; at: string } | null;
  holidaysKnown: boolean;
};

/** Minutes past local midnight, for the instant `now` at the exchange. */
function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  // Midnight formats as "24" in some environments; both mean the same instant.
  return (hour % 24) * 60 + minute;
}

function localWeekday(now: Date, timeZone: string): number {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function toClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export function sessionStatus(exchange: MarketExchange, now: Date): SessionStatus {
  const minutes = localMinutes(now, exchange.timeZone);
  const weekday = localWeekday(now, exchange.timeZone);
  const weekend = weekday === 0 || weekday === 6;

  const first = exchange.segments[0];

  const regularSession = exchange.segments
    .map((segment) => `${segment.open}–${segment.close}`)
    .join(' and ');

  const base = {
    exchangeId: exchange.id,
    localTime: toClock(minutes),
    regularSession,
    holidaysKnown: false,
  };

  if (weekend) {
    return {
      ...base,
      phase: 'closed',
      nextTransition: {
        label: 'Opens Monday',
        at: first.open,
      },
    };
  }

  for (const segment of exchange.segments) {
    const open = toMinutes(segment.open);
    const close = toMinutes(segment.close);
    if (minutes >= open && minutes < close) {
      return { ...base, phase: 'open', nextTransition: { label: 'Closes', at: segment.close } };
    }
  }

  // Between two segments — the Tokyo and Hong Kong lunch break. Reported as
  // closed with the reopening time, not as open with nothing trading.
  for (let i = 0; i < exchange.segments.length - 1; i += 1) {
    const gapStart = toMinutes(exchange.segments[i].close);
    const gapEnd = toMinutes(exchange.segments[i + 1].open);
    if (minutes >= gapStart && minutes < gapEnd) {
      return {
        ...base,
        phase: 'closed',
        nextTransition: { label: 'Reopens after the break', at: exchange.segments[i + 1].open },
      };
    }
  }

  if (exchange.preMarket) {
    const open = toMinutes(exchange.preMarket.open);
    const close = toMinutes(exchange.preMarket.close);
    if (minutes >= open && minutes < close) {
      return { ...base, phase: 'pre-market', nextTransition: { label: 'Regular session opens', at: first.open } };
    }
  }

  if (exchange.afterHours) {
    const open = toMinutes(exchange.afterHours.open);
    const close = toMinutes(exchange.afterHours.close);
    if (minutes >= open && minutes < close) {
      return { ...base, phase: 'after-hours', nextTransition: { label: 'After-hours ends', at: exchange.afterHours.close } };
    }
  }

  const beforeOpen = minutes < toMinutes(exchange.preMarket?.open ?? first.open);
  return {
    ...base,
    phase: 'closed',
    nextTransition: beforeOpen
      ? { label: 'Opens', at: first.open }
      : { label: weekday === 5 ? 'Opens Monday' : 'Opens tomorrow', at: exchange.preMarket?.open ?? first.open },
  };
}

/** The label a person reads. Never colour alone — this is the text half. */
export const PHASE_LABEL: Record<SessionPhase, string> = {
  open: 'Open',
  closed: 'Closed',
  'pre-market': 'Pre-market',
  'after-hours': 'After hours',
};

/** The one-line form, for callers that only need the yes or no. */
export function isTradingNow(status: SessionStatus): boolean {
  return status.phase === 'open';
}
