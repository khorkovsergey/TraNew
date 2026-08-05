/**
 * The providers a Wealth Hub connection can be made to, as demo fixtures.
 *
 * Taken verbatim from the design handoff rather than retyped: the scope lists
 * and the caveats are the part of this screen that has to be exactly right, and
 * a scope that drifts from the reference is a promise nobody checked.
 *
 * Nothing here implies a partnership. There is no aggregator, no OAuth, no
 * credentials and no live data — the names exist to make the demo legible.
 *
 * Import-free, so the harness compiles it alone.
 */

export type ProviderCategory = 'bank' | 'broker' | 'exchange';

export type DiscoveredAccount = {
  id: string;
  name: string;
  sub: string;
  /** Formatted for display; `amount` is what the arithmetic uses. */
  value: string;
  /** Negative for a liability — a mortgage arriving as a mortgage, not as an asset. */
  amount: number;
  /** Whether it starts ticked. Duplicates and demo accounts start unticked. */
  checked: boolean;
  /** Why it starts unticked, where it does. Shown beside the row. */
  note?: string;
};

export type ConnectionProvider = {
  id: string;
  name: string;
  sub: string;
  /** The chip on the row: Bank, Broker, Exchange. */
  tag: string;
  kind: ProviderCategory;
  /** One or two initials for the square mark. */
  mark: string;
  color: string;
  /** What this provider lets TradingNew read. Per provider, and always read-only. */
  scopes: string[];
  accounts: DiscoveredAccount[];
  /**
   * The provider-specific warning shown above the import total.
   *
   * Named after what it usually is — a duplicate holding — but it also carries
   * the leverage and volatility notes. Every one of them exists because the
   * naive import would be wrong in a way somebody would only find later.
   */
  duplicate?: string;
};

export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  { id: 'revolut', name: 'Revolut', sub: 'Current accounts, savings, crypto · EU', tag: 'Bank', kind: 'bank', mark: 'R', color: '#131722',
    scopes: ['Read your account balances and currency', 'Read transaction history for the last 24 months', 'Read savings vaults and crypto balances', 'Refresh these balances automatically once a day'],
    accounts: [
      { id: 'r-eur', name: 'Current account · EUR', sub: 'Available instantly', value: '€8,420', amount: 8420, checked: true },
      { id: 'r-usd', name: 'Current account · USD', sub: 'Converted at 1.09', value: '€3,180', amount: 3180, checked: true },
      { id: 'r-sav', name: 'Savings vault · 2.4%', sub: 'Flexible withdrawal', value: '€14,000', amount: 14000, checked: true },
      { id: 'r-btc', name: 'Crypto · 0.12 BTC', sub: 'Price from Revolut', value: '€11,640', amount: 11640, checked: false },
    ],
    duplicate: 'Your manual asset “Cash — Bank of Cyprus (EUR)” looks similar to the EUR current account. Both were kept — merge them later from Assets if they are the same money.' },
  { id: 'fxpro', name: 'FxPro', sub: 'CFD and FX trading accounts', tag: 'Broker', kind: 'broker', mark: 'FX', color: '#1c3f94',
    scopes: ['Read open positions and account equity', 'Read realised and unrealised P&L', 'Read margin level and free margin', 'Refresh positions every 15 minutes'],
    accounts: [
      { id: 'f-live', name: 'Live account · EUR', sub: 'Equity, 3 open positions', value: '€21,400', amount: 21400, checked: true },
      { id: 'f-demo', name: 'Demo account', sub: 'Excluded from net wealth by default', value: '€50,000', amount: 0, checked: false },
    ],
    duplicate: 'Leveraged positions are reported at equity, not notional value. Your Wealth Record will show €21,400, not the size of the underlying exposure.' },
  { id: 'ibkr', name: 'Interactive Brokers', sub: 'Stocks, ETFs, options · global', tag: 'Broker', kind: 'broker', mark: 'IB', color: '#c8462b',
    scopes: ['Read holdings and cost basis', 'Read cash balances per currency', 'Read dividend and interest income', 'Refresh positions at market close'],
    accounts: [
      { id: 'i-main', name: 'Individual account · USD', sub: '14 positions', value: '€96,300', amount: 96300, checked: true },
      { id: 'i-cash', name: 'Cash balance · USD', sub: 'Uninvested', value: '€4,120', amount: 4120, checked: true },
      /*
       * The row the caveat is about.
       *
       * The handoff's note says this holding "has been unticked for you", but
       * its shortened account list had no such row — so the warning described
       * something the screen never showed. Added, unticked, with the reason on
       * the row itself: the rule is that a duplicate is flagged before import,
       * and a rule with nothing to point at is not enforced.
       */
      {
        id: 'i-voo',
        name: 'Vanguard S&P 500 ETF · VOO',
        sub: 'Already arriving through NorthBridge Securities',
        value: '€85,000',
        amount: 85000,
        checked: false,
        note: 'Unticked to avoid double-counting.',
      },
    ],
    duplicate: 'Vanguard S&P 500 ETF is already connected through NorthBridge Securities. Importing it again would double-count €85,000 — it has been unticked for you.' },
  { id: 'boc', name: 'Bank of Cyprus', sub: 'Accounts, deposits, mortgage', tag: 'Bank', kind: 'bank', mark: 'BC', color: '#1a6b4a',
    scopes: ['Read account balances', 'Read term deposit rate and maturity date', 'Read outstanding mortgage balance', 'Refresh balances once a day'],
    accounts: [
      { id: 'b-cur', name: 'Current account · EUR', sub: 'Available instantly', value: '€52,000', amount: 52000, checked: true },
      { id: 'b-dep', name: 'Term deposit · 3.1%', sub: 'Matures Sep 15, 2026', value: '€150,000', amount: 150000, checked: true },
      { id: 'b-mor', name: 'Mortgage', sub: 'Imported as a liability', value: '−€430,000', amount: -430000, checked: true },
    ],
    duplicate: 'Two of your manual assets match this bank. Connecting replaces manual entry with live balances and keeps your edit history.' },
  { id: 'binance', name: 'Binance', sub: 'Spot and earn balances', tag: 'Exchange', kind: 'exchange', mark: 'B', color: '#b7860b',
    scopes: ['Read spot wallet balances', 'Read earn and staking positions', 'Read trade history for tax reporting', 'Refresh balances every hour'],
    accounts: [
      { id: 'bi-spot', name: 'Spot wallet', sub: '4 assets', value: '€6,830', amount: 6830, checked: true },
      { id: 'bi-earn', name: 'Earn · flexible', sub: 'Average 4.1% APR', value: '€2,200', amount: 2200, checked: true },
    ],
    duplicate: 'Crypto valuations move continuously. Your Wealth Record stores the value at the last sync, with its timestamp.' },
  { id: 'ing', name: 'ING', sub: 'Accounts and savings · EU', tag: 'Bank', kind: 'bank', mark: 'IN', color: '#d4620a',
    scopes: ['Read account balances', 'Read savings balances', 'Refresh balances once a day'],
    accounts: [{ id: 'n-cur', name: 'Current account · EUR', sub: 'Available instantly', value: '€2,940', amount: 2940, checked: true }],
    duplicate: 'No overlap with your existing assets was detected.' },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'bank', label: 'Banks' },
  { id: 'broker', label: 'Brokers' },
  { id: 'exchange', label: 'Crypto' },
];

/** The four things the sync screen ticks off, in order. */
export const CONNECTION_SYNC_STEPS: string[] = ['Authorising with the provider', 'Reading account list', 'Reading balances and positions', 'Checking for duplicates'];

/**
 * What no connection can ever do.
 *
 * Fixed for every provider, and the reason the consent screen is acceptable at
 * all. It is a constant rather than per-provider data so that adding a provider
 * cannot quietly ship a shorter version of it.
 */
export const NEVER_ABLE_TO: string[] = [
  'Move, transfer or withdraw money',
  'Place, modify or cancel orders',
  'See your login credentials',
];

export const CONSENT_NOTE =
  'Consent lasts 90 days, as required by PSD2, and can be revoked at any time from this page.';

export const READ_ONLY_NOTE =
  'Connections are read-only and handled by a regulated open-banking provider. TradingNew never sees your login details and cannot move money.';

/**
 * Voyager consent is a second decision, not part of the first.
 *
 * Connecting an account and feeding it to the assistant are different things,
 * and withdrawing the second must not break the first — which is why this copy
 * says so on the checkbox rather than in a policy nobody opens.
 */
export const VOYAGER_CONSENT_NOTE =
  'Let Voyager use these balances as private context. You can withdraw this separately, without disconnecting the account.';

/* ------------------------------------------------------------- Arithmetic */

/** What ticking these rows would add to net wealth. Negative is possible. */
export function importTotal(
  provider: ConnectionProvider,
  selection: Record<string, boolean>
): number {
  return provider.accounts
    .filter((account) => selection[account.id])
    .reduce((total, account) => total + account.amount, 0);
}

/** How many rows are ticked, for the button that says how many it will import. */
export function selectedCount(
  provider: ConnectionProvider,
  selection: Record<string, boolean>
): number {
  return provider.accounts.filter((account) => selection[account.id]).length;
}

/**
 * The starting ticks for a provider.
 *
 * Built from the fixtures rather than defaulting to all-on: a duplicate holding
 * and a demo account start unticked, and the note beside them says why. Silently
 * double-counting somebody's ETF is the failure this screen exists to avoid.
 */
export function defaultSelection(provider: ConnectionProvider): Record<string, boolean> {
  return Object.fromEntries(provider.accounts.map((account) => [account.id, account.checked]));
}

/** Formatted with a sign, because a negative total is a real outcome here. */
export function formatSigned(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}€${Math.abs(rounded).toLocaleString('en-US')}`;
}

export function providerById(id: string): ConnectionProvider | null {
  return CONNECTION_PROVIDERS.find((provider) => provider.id === id) ?? null;
}
