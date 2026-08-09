import { getMarket } from '@/content/markets';
import { sessionStatus, type SessionPhase } from '@/lib/markets/sessions';

/**
 * What the top of Market Overview says about right now.
 *
 * Derived, never written down. The prototype for this screen was drawn on a
 * Sunday and said "Markets closed · Weekend" in a string, which is correct for
 * about two sevenths of the week and confidently wrong for the rest — and a
 * market page that is wrong about whether the market is open has undermined
 * every number below it before the reader reaches them.
 *
 * The exchange is NYSE, taken from the global market's own list rather than
 * redeclared here, so the hours this reads are the same hours the market pages
 * print. It knows nothing about holidays, and `sessions.ts` says so for the same
 * reason this file exists: a stated limitation is smaller than a wrong answer.
 *
 * Computed on the server and passed down as strings. A clock that renders one
 * value on the server and another in the browser is a hydration mismatch, and
 * the value it disagrees about here is the one the page is least allowed to get
 * wrong.
 */

export type MarketSession = {
  phase: SessionPhase;
  /** Green only when something is actually trading. */
  tone: 'open' | 'edge' | 'closed';
  /** "Markets closed · Weekend" */
  line: string;
  /** "Sunday, 9 August · last close Friday · US opens Mon 09:30 ET" */
  dateLine: string;
  /** " on Friday", so the movers heading names the session it describes. */
  movedSuffix: string;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayAt(now: Date, timeZone: string): number {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  return SHORT.indexOf(day);
}

export function marketSession(now: Date): MarketSession {
  const global = getMarket('global');
  const exchange = global?.exchanges.find((entry) => entry.id === 'nyse') ?? global?.exchanges[0];

  // No exchange, no claim. The page renders without the line rather than
  // guessing, which is the same rule the rest of this file follows.
  if (!exchange) {
    return {
      phase: 'closed',
      tone: 'closed',
      line: 'Session status unavailable',
      dateLine: 'Market hours could not be read',
      movedSuffix: '',
    };
  }

  const status = sessionStatus(exchange, now);
  const weekday = weekdayAt(now, exchange.timeZone);
  const weekend = weekday === 0 || weekday === 6;

  const dateHere = new Intl.DateTimeFormat('en-GB', {
    timeZone: exchange.timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  const opensAt = exchange.segments[0].open;

  if (status.phase === 'open') {
    return {
      phase: status.phase,
      tone: 'open',
      line: 'Markets open · US session',
      dateLine: `${dateHere} · closes ${exchange.segments[0].close} ET`,
      movedSuffix: '',
    };
  }

  if (status.phase === 'pre-market' || status.phase === 'after-hours') {
    const label = status.phase === 'pre-market' ? 'Pre-market' : 'After hours';
    return {
      phase: status.phase,
      tone: 'edge',
      line: `Markets closed · ${label}`,
      dateLine: `${dateHere} · regular session ${status.regularSession} ET`,
      movedSuffix: '',
    };
  }

  /*
   * Closed. Which day the last session was is the part that matters, because
   * the movers list below is about that session and not about today — the
   * heading says so rather than leaving the reader to assume it is live.
   */
  if (weekend) {
    return {
      phase: status.phase,
      tone: 'closed',
      line: 'Markets closed · Weekend',
      dateLine: `${dateHere} · last close Friday · US opens Mon ${opensAt} ET`,
      movedSuffix: ' on Friday',
    };
  }

  // A weekday outside the session: the last close was today if we are past it,
  // and the previous weekday if the day has not opened yet.
  const past = status.nextTransition?.label !== 'Opens';
  const previous = weekday === 1 ? 5 : weekday - 1;

  return {
    phase: status.phase,
    tone: 'closed',
    line: 'Markets closed',
    dateLine: past
      ? `${dateHere} · closed at ${exchange.segments[0].close} ET · opens ${opensAt} ET`
      : `${dateHere} · last close ${DAYS[previous]} · opens ${opensAt} ET`,
    movedSuffix: past ? '' : ` on ${DAYS[previous]}`,
  };
}
