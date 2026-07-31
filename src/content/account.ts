/**
 * My TradingNew demo data. Components never import this directly — they go through
 * `lib/accountService`, so swapping mocks for a real backend is one adapter change.
 */

export type User = {
  name: string;
  shortName: string;
  email: string;
  plan: string;
  initial: string;
};

export const USER: User = {
  name: 'Sergey Khorkov',
  shortName: 'Sergey K.',
  email: 'sergey@example.com',
  plan: 'Free plan',
  initial: 'S',
};

export const ACCOUNT_TABS = [
  { id: 'overview', label: 'Overview', href: '/account' },
  { id: 'workspace', label: 'My Workspace', href: '/account/workspace' },
  { id: 'voyager', label: 'Voyager', href: '/account/voyager' },
  { id: 'activity', label: 'Activity', href: '/account/activity' },
  { id: 'academy', label: 'Academy', href: '/account/academy' },
  { id: 'purchases', label: 'Purchases', href: '/account/purchases' },
  { id: 'settings', label: 'Settings & Billing', href: '/account/settings' },
] as const;

export type Notification = {
  id: string;
  title: string;
  message: string;
  meta: string;
};

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'gold',
    title: 'Gold crossed $2,980',
    message: 'Your price alert triggered at 09:20 UTC.',
    meta: 'Markets · 25 min ago',
  },
  {
    id: 'consult',
    title: 'Consultation tomorrow',
    message: 'Anna Keller · Thu, Jul 31 · 14:00. Context package is ready.',
    meta: 'Experts · 1 h ago',
  },
  {
    id: 'insight',
    title: 'New Voyager insight',
    message: 'US CPI came in above expectations — affects your saved bonds theme.',
    meta: 'Voyager · 2 h ago',
  },
  {
    id: 'lesson',
    title: 'Lesson reminder',
    message: 'Inflation and purchasing power is 8 minutes — finish Stage 1.',
    meta: 'Academy · yesterday',
  },
];

/** An alert is a rule you set; a notification is a message that rule produced. */
export const NOTIFICATION_NOTE =
  'Alerts are your rules; notifications are the messages they produce.';

export const CONTINUE_ITEMS = [
  { type: 'CHART', title: 'S&P 500 · 1M view', meta: 'Viewed 2 hours ago' },
  { type: 'COURSE', title: 'Why people invest', meta: 'Lesson 1 · in progress' },
  { type: 'VOYAGER', title: '“Why is gold rising today?”', meta: 'Yesterday · 6 messages' },
];

/** Each insight explains why it is being shown — no unexplained recommendations. */
export const VOYAGER_INSIGHTS = [
  {
    title: 'NVIDIA — saved company',
    body: 'Cloud capex guidance was raised; demand visibility extends into 2027.',
    cta: 'Open NVIDIA',
  },
  {
    title: 'CPI above expectations',
    body: 'Affects your saved “Gold vs bonds” research theme.',
    cta: 'See indicator',
  },
  {
    title: 'Create an alert?',
    body: 'You check Gold daily — an alert at $3,000 would save you time.',
    cta: 'Review alerts',
  },
];

export const WORKSPACE_TABS = [
  { id: 'collections', label: 'Collections' },
  { id: 'saved', label: 'Saved Items' },
  { id: 'views', label: 'Saved Views' },
  { id: 'research', label: 'Research' },
  { id: 'reports', label: 'Reports' },
  { id: 'alerts', label: 'Alerts' },
] as const;

export const COLLECTIONS = [
  { name: 'Companies I follow', meta: '6 items · updated today · Private' },
  { name: 'Dividend ideas', meta: '4 items · updated Mon · Private' },
  { name: 'Research for later', meta: '4 items · updated yesterday · Private' },
];

export const COLLECTIONS_NOTE =
  'Collections hold anything on the platform — companies, countries, research, charts and experts — and later Wealth Hub assets.';

export const SAVED_FILTERS = ['All', 'Company', 'Country', 'News', 'Research', 'Chart', 'Expert'];

export const SAVED_ITEMS = [
  { type: 'Company', title: 'NVIDIA', meta: 'Saved today' },
  { type: 'Country', title: 'United States', meta: 'Saved 2 days ago' },
  { type: 'News', title: 'S&P 500 futures rise ahead of inflation data', meta: 'Saved yesterday' },
  { type: 'Research', title: 'Gold vs bonds as an inflation hedge', meta: 'Saved 3 days ago' },
  { type: 'Chart', title: 'SPX · 1M layout', meta: 'Saved Mon' },
  { type: 'Expert', title: 'Anna Keller', meta: 'Saved Jul 28' },
];

export const SAVED_VIEWS = [
  { name: 'SPX with 3 indicators', meta: 'Chart layout · edited today' },
  { name: 'Dividend quality screen', meta: 'Screener filters · edited Mon' },
  { name: 'US vs Eurozone', meta: 'Country comparison · edited Jul 25' },
];

export const RESEARCH_ITEMS = [
  {
    tag: 'Note',
    tone: 'blue' as const,
    title: 'ETF shortlist for the core portfolio',
    meta: 'Edited yesterday · tags: etf, core',
  },
  {
    tag: 'AI summary',
    tone: 'purple' as const,
    title: 'US inflation cluster — key facts and interpretation',
    meta: 'Saved from Economy · Jul 30',
  },
  {
    tag: 'Document',
    tone: 'grey' as const,
    title: 'Broker statement Q2.pdf',
    meta: 'Uploaded Jul 12',
  },
];

export const REPORTS = [
  { title: 'Rate-cut scenario for my watchlist', meta: 'Voyager report · Jul 29' },
  {
    title: 'Consultation summary — Anna Keller',
    meta: 'Expert report · pending session #TN-8347',
  },
];

export const ALERTS = [
  { id: 'g', name: 'Gold above $3,000', meta: 'Price alert · checks every 5 min · In-app + email' },
  { id: 'c', name: 'US CPI release', meta: 'Economy alert · Thu 12:30 UTC · Push' },
  { id: 't', name: 'TSLA falls 5% in a day', meta: 'Price alert · In-app' },
];

export const VOYAGER_TABS = [
  { id: 'conversations', label: 'Conversations' },
  { id: 'insights', label: 'Saved Insights' },
  { id: 'memory', label: 'Memory' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'usage', label: 'Usage' },
] as const;

export const CONVERSATIONS = [
  {
    pinned: true,
    title: 'Why is gold rising today?',
    badges: ['Gold', 'Current page'],
    meta: 'Yesterday',
  },
  {
    pinned: false,
    title: 'Compare the US and Eurozone economies',
    badges: ['Economy', 'Country: US'],
    meta: 'Jul 28',
  },
  {
    pinned: false,
    title: 'Explain the yield curve in simple terms',
    badges: ['Academy'],
    meta: 'Jul 25',
  },
];

export const SAVED_INSIGHTS = [
  {
    title: 'Gold vs bonds — when each hedge works',
    body: 'Gold responds to real yields and central-bank demand; bonds hedge growth shocks but suffer in inflation surprises.',
    meta: 'Saved from conversation · Jul 29 · linked: Gold',
  },
  {
    title: 'Concentration warning explained',
    body: 'A single position above 30% of a portfolio dominates its risk regardless of the rest.',
    meta: 'Saved from lesson Q&A · Jul 27',
  },
];

/** Everything Voyager remembers — nothing hidden, everything editable. */
export const MEMORY = [
  { id: 'm1', k: 'Experience level', v: 'Beginner — learning', src: 'Source: Academy diagnostic · Jul 30' },
  { id: 'm2', k: 'Interests', v: 'ETFs, gold, US tech', src: 'Source: browsing activity · updating' },
  { id: 'm3', k: 'Base currency', v: 'EUR', src: 'Source: profile · Jul 30' },
  { id: 'm4', k: 'Risk preference', v: 'Cautious', src: 'Source: strategy interview · Jul 30' },
];

export const MEMORY_NOTE =
  'Everything Voyager remembers about you — nothing hidden, everything editable.';

export const PERMISSIONS = [
  'Use current page context',
  'Use browsing history inside TradingNew',
  'Use saved items and collections',
  'Use Academy progress',
  'Use Marketplace purchases',
  'Use uploaded documents',
  'Save conversations automatically',
];

export const USAGE = {
  used: 37,
  limit: 100,
  reset: 'Resets Aug 1',
  cta: 'Unlock more with AI Private',
};

export const ACTIVITY_FILTERS = [
  'All',
  'Viewed',
  'Saved',
  'Voyager',
  'Academy',
  'Alerts',
  'Marketplace',
];

export const ACTIVITY = [
  { type: 'Viewed', title: 'Tesla — Symbol Research Overview', time: '2 h ago' },
  { type: 'Voyager', title: 'Asked: Why is gold rising today?', time: 'Yesterday' },
  { type: 'Saved', title: 'Saved NVIDIA to Companies I follow', time: 'Yesterday' },
  { type: 'Academy', title: 'Completed: Why people invest', time: 'Jul 30' },
  { type: 'Alerts', title: 'Created alert: Gold above $3,000', time: 'Jul 29' },
  { type: 'Marketplace', title: 'Booked consultation with Anna Keller', time: 'Jul 29' },
];

export const ACTIVITY_NOTE =
  'This timeline is private to you. Sensitive Wealth Hub actions live in a separate audit log.';

export const PURCHASE_TABS = [
  { id: 'expert', label: 'Expert Services' },
  { id: 'tools', label: 'Tools & Data' },
  { id: 'learning', label: 'Learning & Events' },
  { id: 'merch', label: 'Merch' },
  { id: 'payments', label: 'Payments' },
] as const;

export const PURCHASES = {
  expert: {
    title: 'Consultation with Anna Keller',
    meta: 'Booking #TN-8347 · Thu, Jul 31 · 14:00 Europe/Nicosia · €125.00',
  },
  toolsEmpty:
    'No tools or data subscriptions yet. Indicators, screeners and data feeds bought in the Marketplace appear here with their renewal dates.',
  learning: { title: 'TradingNew Academy', meta: 'Free · Enrolled Jul 30' },
  merchEmpty: 'No merchandise orders yet. Anything you order ships with tracking shown here.',
  payment: {
    amount: '€125.00',
    method: 'Visa ···4821',
    date: 'Jul 29, 2026',
    receipt: 'Receipt',
  },
};

export const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'billing', label: 'Billing' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
] as const;

export const PROFILE_FIELDS = [
  { label: 'Display name', value: 'Sergey K.' },
  { label: 'Email', value: 'sergey@example.com' },
  { label: 'Country', value: 'Cyprus' },
  { label: 'Base currency', value: 'EUR' },
  { label: 'Timezone', value: 'Europe/Nicosia' },
  { label: 'Public username', value: 'Not set' },
];

export type SettingRow =
  | { kind: 'value'; k: string; v: string; sub?: string; tone?: 'plain' | 'link' | 'danger' | 'good' | 'muted' }
  | { kind: 'toggle'; k: string; id: string; on: boolean; sub?: string };

export const SETTINGS_ROWS: Record<string, SettingRow[]> = {
  preferences: [
    { kind: 'value', k: 'Experience level', v: 'Beginner' },
    { kind: 'value', k: 'Preferred markets', v: 'US · EU' },
    { kind: 'value', k: 'Content language', v: 'English' },
    { kind: 'value', k: 'Theme', v: 'Light' },
    { kind: 'value', k: 'Density', v: 'Comfortable' },
    { kind: 'value', k: 'Default landing page', v: 'Home' },
  ],
  notifications: [
    { kind: 'toggle', k: 'Market alerts', id: 'n1', on: true, sub: 'In-app · Push · Email' },
    { kind: 'toggle', k: 'Voyager insights', id: 'n2', on: true, sub: 'In-app' },
    { kind: 'toggle', k: 'Academy reminders', id: 'n3', on: true, sub: 'Push' },
    { kind: 'toggle', k: 'Expert messages', id: 'n4', on: true, sub: 'In-app · Email' },
    { kind: 'toggle', k: 'Product news', id: 'n5', on: false, sub: 'Email' },
    { kind: 'toggle', k: 'Marketing', id: 'n6', on: false, sub: 'Email' },
  ],
  subscription: [
    {
      kind: 'value',
      k: 'Current plan',
      v: 'Free',
      sub: 'Core research tools, Academy, limited Voyager',
    },
    { kind: 'value', k: 'AI messages', v: '37 / 100 monthly' },
    { kind: 'value', k: 'Collections', v: '3 of 5' },
    { kind: 'value', k: 'Alerts', v: '3 of 5' },
    { kind: 'value', k: 'Compare plans', v: 'Premium · AI Private →', tone: 'link' },
  ],
  billing: [
    { kind: 'value', k: 'Payment method', v: 'Visa ···4821' },
    { kind: 'value', k: 'Billing country', v: 'Cyprus' },
    { kind: 'value', k: 'VAT details', v: 'Not set' },
    { kind: 'value', k: 'Invoices', v: '1 receipt →', tone: 'link' },
  ],
  integrations: [
    {
      kind: 'value',
      k: 'Google',
      v: 'Connected',
      sub: 'Sign-in · connected Jul 30',
      tone: 'good',
    },
    {
      kind: 'value',
      k: 'NorthBridge Securities',
      v: 'Connected',
      sub: 'Reads holdings · last sync 09:45',
      tone: 'good',
    },
    {
      kind: 'value',
      k: 'Bank accounts',
      v: 'Not connected',
      sub: 'For deposits and balances',
      tone: 'muted',
    },
    {
      kind: 'value',
      k: 'Calendar',
      v: 'Not connected',
      sub: 'Consultation reminders',
      tone: 'muted',
    },
  ],
  security: [
    {
      kind: 'toggle',
      k: 'Two-factor authentication',
      id: 's1',
      on: false,
      sub: 'Authenticator app',
    },
    { kind: 'toggle', k: 'Passkeys', id: 's2', on: false },
    {
      kind: 'value',
      k: 'Active sessions',
      v: '2 devices',
      sub: 'This browser · iPhone (Jul 29)',
    },
    { kind: 'value', k: 'Login history', v: 'View →', tone: 'link' },
    { kind: 'value', k: 'Log out from all devices', v: 'Log out →', tone: 'danger' },
  ],
  privacy: [
    {
      kind: 'toggle',
      k: 'Public profile',
      id: 'p1',
      on: false,
      sub: 'Off by default — nothing is public',
    },
    { kind: 'toggle', k: 'Show activity to followers', id: 'p2', on: false },
    {
      kind: 'toggle',
      k: 'Personalisation',
      id: 'p3',
      on: true,
      sub: 'Uses your on-platform activity',
    },
    { kind: 'value', k: 'Download my data', v: 'Export →', tone: 'link' },
    {
      kind: 'value',
      k: 'Delete account',
      v: 'Delete →',
      sub: 'Requires confirmation; consequences are explained first',
      tone: 'danger',
    },
  ],
};

export const SETTINGS_NOTES: Record<string, string> = {
  notifications: 'Security and billing notifications cannot be fully disabled.',
  privacy:
    'Voyager conversations, collections and history are private by default. Public profile is opt-in per block.',
  subscription:
    'Locked features stay visible with a short explanation — no aggressive paywalls.',
};

export const ACADEMY_SUMMARY = {
  level: 'Beginner',
  percent: 40,
  nextLesson: 'Inflation and purchasing power',
  /** Recommendations state their reason. */
  reason: 'Recommended because you recently explored bond yields.',
  counters: [
    { k: 'Lessons completed', v: '1' },
    { k: 'Practice watchlist', v: '1 asset' },
    { k: 'Questions asked', v: '4' },
  ],
};

export const WEALTH_PREVIEW = {
  enabled: {
    title: 'Wealth Hub',
    stats: 'Net Wealth €1.21M · Liquid €172K · 1 valuation needs updating',
    cta: 'Open →',
  },
  disabled: {
    title: 'Your complete financial picture',
    body: 'A private model of everything you own and owe, with scenarios for the decisions you are weighing.',
    cta: 'Join waitlist',
  },
};
