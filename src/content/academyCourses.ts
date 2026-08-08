import type { IconName } from '@/components/ui/Icon';

/**
 * Academy — the course catalogue.
 *
 * Academy is the paid half of learning: structured programmes from TradingNew
 * and from outside providers. Learn (`/academy`) stays free and stays where it
 * is; nothing here replaces it, and every screen in this section says so.
 *
 * A demonstration catalogue, and the screens say so rather than leaving it to
 * be discovered: no provider has published to TradingNew Academy yet, so these
 * twelve courses, their instructors and their reviews are sample content of the
 * same kind as `experts.ts` and `chartMarket.ts`. Presenting them as real
 * listings would be the interface lying about what the marketplace contains.
 *
 * It is a content file rather than a table because these are fixed products,
 * not user data — and because every number a course screen shows is *derived
 * from what is written here*. The lesson list is the real
 * lesson list: the duration, the lesson count and a person's progress are all
 * counted from it, so none of them can drift away from the curriculum on the
 * page. That is why lessons carry a time each instead of a course carrying a
 * headline "8h 45m".
 *
 * Scheduled cohorts hold a real date. They will age — a workshop in this file
 * with a date in the past is a workshop that happened, and the screens treat it
 * that way rather than pretending it is still ahead.
 */

export type CourseFormat = 'online' | 'live_online' | 'in_person' | 'hybrid';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
export type CourseBadge = 'Bestseller' | 'New' | 'Few seats left';
export type Currency = 'EUR' | 'GBP' | 'USD';

/** A single lesson. `time` is mm:ss, and it is the source of every duration. */
export type CourseLesson = {
  id: string;
  title: string;
  time: string;
  /** Watchable before buying. */
  free?: boolean;
};

export type CourseSection = {
  id: string;
  title: string;
  lessons: CourseLesson[];
};

export type Course = {
  slug: string;
  title: string;
  tagline: string;

  provider: string;
  /** Credentials checked by us. Absent is not an accusation — it is just absent. */
  providerVerified: boolean;
  providerType: 'tradingnew' | 'external';

  category: string;
  format: CourseFormat;
  level: CourseLevel;
  language: string;

  /** Major units. 0 is free, and free is shown as "Free", never as "€0". */
  price: number;
  /** What it costs when the launch discount ends. Omitted when there is none. */
  listPrice?: number;
  currency: Currency;

  badge?: CourseBadge;
  /** Basename under /redesign/courses. */
  image: string;

  rating?: {
    score: number;
    count: number;
    /** Share of reviews at 5,4,3,2,1 stars. */
    breakdown: [number, number, number, number, number];
  };

  /** Live cohorts and in-person workshops only. */
  schedule?: {
    /** ISO date of the first session — what decides whether it is still ahead. */
    startsAt: string;
    label: string;
    location?: string;
  };

  instructor: {
    name: string;
    credentials: string;
    bio: string;
    rating: number;
    students: string;
    courses: number;
  };

  outcomes: string[];
  sections: CourseSection[];
  includes: Array<{ label: string; icon: IconName }>;
  reviews: Array<{ name: string; when: string; text: string }>;
};

/** Shared boilerplate for what a self-paced video course ships with. */
const ON_DEMAND_INCLUDES: Course['includes'] = [
  { label: 'On-demand video, watch at your own pace', icon: 'play' },
  { label: 'Downloadable chart templates and worksheets', icon: 'layers' },
  { label: 'Certificate of completion', icon: 'book' },
  { label: 'Lifetime access on any device', icon: 'globe' },
];

const COHORT_INCLUDES: Course['includes'] = [
  { label: 'Live sessions with the instructor', icon: 'users' },
  { label: 'Recordings of every session', icon: 'play' },
  { label: 'Workbook and session notes', icon: 'book' },
  { label: 'Q&A time in each session', icon: 'chat' },
];

export const ACADEMY_COURSES: Course[] = [
  {
    slug: 'technical-analysis-masterclass',
    title: 'Technical Analysis Masterclass',
    tagline:
      'Read price action and market structure the way professional traders do — and turn it into a repeatable plan you can actually follow.',
    provider: 'TradingNew Academy',
    providerVerified: true,
    providerType: 'tradingnew',
    category: 'Technical Analysis',
    format: 'online',
    level: 'Intermediate',
    language: 'English',
    price: 199,
    listPrice: 299,
    currency: 'EUR',
    badge: 'Bestseller',
    image: 'technical-analysis',
    rating: { score: 4.9, count: 1214, breakdown: [88, 9, 2, 1, 0] },
    instructor: {
      name: 'James Whitfield',
      credentials: 'CMT® · Head of Market Research, TradingNew Academy',
      bio: 'Sixteen years reading order flow on institutional desks, now teaching the same market-structure framework in plain language. Known for stripping indicators back to what actually moves price.',
      rating: 4.9,
      students: '18,400',
      courses: 5,
    },
    outcomes: [
      'Identify support and resistance zones that actually hold',
      'Read market structure across multiple timeframes',
      'Recognise genuine breakouts and separate them from traps',
      'Place stops that survive normal market noise',
      'Size positions from risk, not from gut feeling',
      'Build a repeatable written trading plan you can follow',
    ],
    sections: [
      {
        id: 'structure',
        title: 'Market structure',
        lessons: [
          { id: 'what-price-says', title: 'What price is actually telling you', time: '06:12', free: true },
          { id: 'trend', title: 'Higher highs, lower lows — reading trend', time: '09:40' },
          { id: 'ranges', title: 'Ranges, expansions and contractions', time: '11:05' },
          { id: 'timeframes', title: 'Timeframe alignment', time: '08:22' },
          { id: 'marking-live', title: 'Marking structure on a live chart', time: '07:51' },
          { id: 'structure-recap', title: 'Section recap and exercise', time: '04:30' },
        ],
      },
      {
        id: 'levels',
        title: 'Support and resistance',
        lessons: [
          { id: 'why-levels', title: 'Why levels work — and when they do not', time: '10:18' },
          { id: 'zones', title: 'Drawing zones, not lines', time: '08:44' },
          { id: 'volume-at-price', title: 'Volume at price', time: '12:03' },
          { id: 'retests', title: 'Retests, and the ones worth waiting for', time: '09:16' },
          { id: 'levels-exercise', title: 'Exercise: mark a week of levels', time: '05:38' },
        ],
      },
      {
        id: 'entries',
        title: 'Entries and exits',
        lessons: [
          { id: 'entry-checklist', title: 'Building an entry checklist', time: '14:20' },
          { id: 'stops', title: 'Stop placement that survives noise', time: '11:37' },
          { id: 'scaling', title: 'Scaling out versus a single target', time: '09:55' },
          { id: 'when-not-to-trade', title: 'The setups worth skipping', time: '07:42' },
        ],
      },
      {
        id: 'risk',
        title: 'Risk and position sizing',
        lessons: [
          { id: 'sizing-formula', title: 'The only formula you need', time: '07:40' },
          { id: 'risk-per-day', title: 'Risk per trade versus risk per day', time: '10:12' },
          { id: 'drawdown', title: 'Drawdown, and what it does to decisions', time: '08:58' },
          { id: 'correlation', title: 'Two positions that are secretly one', time: '09:24' },
        ],
      },
      {
        id: 'plan',
        title: 'Building your trading plan',
        lessons: [
          { id: 'setups-to-plan', title: 'From setups to a written plan', time: '13:25' },
          { id: 'journal', title: 'Journalling that actually helps', time: '09:08' },
          { id: 'review-routine', title: 'The weekly review routine', time: '08:16' },
          { id: 'plan-template', title: 'Filling in the plan template', time: '06:44' },
        ],
      },
      {
        id: 'walkthroughs',
        title: 'Live chart walkthroughs',
        lessons: [
          { id: 'index-open', title: 'Walkthrough: index futures open', time: '08:14', free: true },
          { id: 'failed-breakout', title: 'Walkthrough: a failed breakout', time: '06:47' },
          { id: 'range-day', title: 'Walkthrough: a range day, start to finish', time: '09:33' },
          { id: 'earnings-gap', title: 'Walkthrough: trading around an earnings gap', time: '07:29' },
        ],
      },
    ],
    includes: ON_DEMAND_INCLUDES,
    reviews: [
      {
        name: 'Daniel R.',
        when: '2 weeks ago',
        text: 'The market-structure section alone changed how I look at a chart. No indicator soup, just what actually matters — and the walkthroughs show it on real price.',
      },
      {
        name: 'Priya S.',
        when: 'last month',
        text: 'I had taken two other TA courses and still felt lost. This one finally connected the pieces into a plan I use every morning.',
      },
    ],
  },

  {
    slug: 'market-psychology-and-trading-discipline',
    title: 'Market Psychology & Trading Discipline',
    tagline:
      'Two days on the part of trading that no indicator covers: what you do when a position goes against you, and why you do it.',
    provider: 'SMB Capital',
    providerVerified: true,
    providerType: 'external',
    category: 'Psychology',
    format: 'in_person',
    level: 'All Levels',
    language: 'English',
    price: 199,
    currency: 'EUR',
    badge: 'New',
    image: 'psychology',
    rating: { score: 4.8, count: 856, breakdown: [82, 13, 3, 1, 1] },
    schedule: { startsAt: '2026-09-24', label: 'Sep 24–25', location: 'London' },
    instructor: {
      name: 'Marcus Ellery',
      credentials: 'Trading coach, SMB Capital',
      bio: 'Spent eleven years on a proprietary desk and the last six coaching the traders on it. His interest is not motivation — it is the specific moments where a plan gets abandoned.',
      rating: 4.8,
      students: '6,900',
      courses: 2,
    },
    outcomes: [
      'Name the three moments where most plans get abandoned',
      'Build rules that hold when a position is losing',
      'Separate a bad decision from an unlucky outcome',
      'Keep a journal that shows patterns, not feelings',
      'Recover from a drawdown without doubling down',
    ],
    sections: [
      {
        id: 'day-one',
        title: 'Day one — where discipline breaks',
        lessons: [
          { id: 'anatomy', title: 'Anatomy of an abandoned plan', time: '48:00' },
          { id: 'loss-aversion', title: 'Loss aversion, in your own trades', time: '52:00' },
          { id: 'revenge', title: 'The revenge trade, and the hour before it', time: '45:00' },
          { id: 'workshop-one', title: 'Workshop: reviewing your worst month', time: '90:00' },
        ],
      },
      {
        id: 'day-two',
        title: 'Day two — building rules that hold',
        lessons: [
          { id: 'rules', title: 'Rules you will still follow when it hurts', time: '55:00' },
          { id: 'process-vs-outcome', title: 'Process versus outcome, scored honestly', time: '47:00' },
          { id: 'drawdown-protocol', title: 'A written drawdown protocol', time: '50:00' },
          { id: 'workshop-two', title: 'Workshop: writing yours', time: '85:00' },
        ],
      },
    ],
    includes: [
      { label: 'Two full days in the room', icon: 'users' },
      { label: 'Workbook and drawdown protocol template', icon: 'book' },
      { label: 'Lunch and refreshments', icon: 'star' },
      { label: 'Follow-up session four weeks later', icon: 'calendar' },
    ],
    reviews: [
      {
        name: 'Tomas H.',
        when: '3 weeks ago',
        text: 'I expected motivational talk. Instead we spent an afternoon dissecting my own trade log, which was uncomfortable and worth every hour.',
      },
      {
        name: 'Ana L.',
        when: '2 months ago',
        text: 'The drawdown protocol is now printed and taped next to my screen. First thing that has actually changed my behaviour.',
      },
    ],
  },

  {
    slug: 'cryptocurrency-investing-fundamentals',
    title: 'Cryptocurrency Investing Fundamentals',
    tagline:
      'What crypto assets are, how they differ from each other, and how to size a position in something this volatile.',
    provider: 'Blockchain Education',
    providerVerified: false,
    providerType: 'external',
    category: 'Crypto',
    format: 'online',
    level: 'Beginner',
    language: 'English',
    price: 249,
    currency: 'EUR',
    image: 'crypto',
    rating: { score: 4.7, count: 642, breakdown: [78, 15, 4, 2, 1] },
    instructor: {
      name: 'Sofia Bergmann',
      credentials: 'Digital asset researcher',
      bio: 'Covers digital assets for institutional clients. Teaches the subject the way she reports on it — mechanics first, price predictions never.',
      rating: 4.7,
      students: '9,100',
      courses: 3,
    },
    outcomes: [
      'Explain what a blockchain actually records',
      'Tell the main asset categories apart',
      'Read a token supply schedule',
      'Judge custody choices and their trade-offs',
      'Size a position in an asset that can halve',
    ],
    sections: [
      {
        id: 'mechanics',
        title: 'The mechanics',
        lessons: [
          { id: 'ledger', title: 'What a blockchain records', time: '11:20', free: true },
          { id: 'consensus', title: 'Consensus, in plain language', time: '13:05' },
          { id: 'wallets', title: 'Wallets, keys and what "self-custody" costs you', time: '14:40' },
        ],
      },
      {
        id: 'assets',
        title: 'The assets',
        lessons: [
          { id: 'categories', title: 'Coins, tokens, stablecoins — what differs', time: '12:55' },
          { id: 'supply', title: 'Reading a supply schedule', time: '10:18' },
          { id: 'valuation', title: 'Why traditional valuation does not transfer', time: '15:02' },
        ],
      },
      {
        id: 'risk',
        title: 'Risk and position sizing',
        lessons: [
          { id: 'volatility', title: 'Living with 60% drawdowns', time: '12:11' },
          { id: 'sizing', title: 'Sizing a position that can halve', time: '13:47' },
          { id: 'scams', title: 'The failure modes: exchanges, bridges, promises', time: '16:24' },
        ],
      },
    ],
    includes: ON_DEMAND_INCLUDES,
    reviews: [
      {
        name: 'Ruben K.',
        when: 'last month',
        text: 'Refreshingly free of price targets. The supply-schedule lesson is the one I keep coming back to.',
      },
      {
        name: 'Elena M.',
        when: '2 months ago',
        text: 'Beginner-friendly without being thin. The custody section talked me out of a mistake.',
      },
    ],
  },

  {
    slug: 'options-trading-strategy-bootcamp',
    title: 'Options Trading Strategy Bootcamp',
    tagline:
      'Two days of options mechanics and structure — pricing, greeks and the handful of spreads worth knowing properly.',
    provider: 'Options Institute',
    providerVerified: true,
    providerType: 'external',
    category: 'Options',
    format: 'in_person',
    level: 'Advanced',
    language: 'English',
    price: 399,
    currency: 'EUR',
    badge: 'Few seats left',
    image: 'options',
    rating: { score: 4.9, count: 1108, breakdown: [90, 7, 2, 1, 0] },
    schedule: { startsAt: '2026-10-07', label: 'Oct 7–8', location: 'Frankfurt' },
    instructor: {
      name: 'Henrik Nowak',
      credentials: 'Former market maker, Eurex options',
      bio: 'Quoted options on an exchange floor for nine years. Teaches the greeks as things that cost money on a specific day, not as calculus.',
      rating: 4.9,
      students: '4,300',
      courses: 4,
    },
    outcomes: [
      'Price an option and explain what each input does',
      'Read the greeks as daily profit and loss',
      'Choose between four core spreads for a given view',
      'Manage a position through expiry week',
      'Recognise the trades that only look cheap',
    ],
    sections: [
      {
        id: 'mechanics',
        title: 'Day one — mechanics and greeks',
        lessons: [
          { id: 'pricing', title: 'What an option price is made of', time: '55:00' },
          { id: 'greeks', title: 'The greeks as daily P&L', time: '65:00' },
          { id: 'vol', title: 'Implied volatility, and what it is quoting', time: '58:00' },
          { id: 'lab-one', title: 'Lab: pricing a live chain', time: '80:00' },
        ],
      },
      {
        id: 'structures',
        title: 'Day two — structures and management',
        lessons: [
          { id: 'spreads', title: 'Four spreads worth knowing properly', time: '70:00' },
          { id: 'expiry', title: 'Managing through expiry week', time: '52:00' },
          { id: 'assignment', title: 'Assignment, and how it surprises people', time: '41:00' },
          { id: 'lab-two', title: 'Lab: building and defending a position', time: '85:00' },
        ],
      },
    ],
    includes: [
      { label: 'Two days in a room of twenty', icon: 'users' },
      { label: 'Pricing workbook and spread templates', icon: 'book' },
      { label: 'Recordings of both days', icon: 'play' },
      { label: 'Certificate of completion', icon: 'checkCircle' },
    ],
    reviews: [
      {
        name: 'Grzegorz W.',
        when: '5 weeks ago',
        text: 'The greeks finally stopped being abstract. Seeing them as money per day is the framing I was missing.',
      },
      {
        name: 'Mira J.',
        when: '3 months ago',
        text: 'Advanced means advanced here — come with the basics or you will spend day one catching up.',
      },
    ],
  },

  {
    slug: 'advanced-risk-management',
    title: 'Advanced Risk Management',
    tagline:
      'Portfolio-level risk: correlation, tail events and the limits that stop one bad week becoming a bad year.',
    provider: 'RiskPro Academy',
    providerVerified: false,
    providerType: 'external',
    category: 'Risk Management',
    format: 'online',
    level: 'Advanced',
    language: 'English',
    price: 179,
    currency: 'EUR',
    image: 'risk-mgmt',
    rating: { score: 4.8, count: 512, breakdown: [84, 12, 2, 1, 1] },
    instructor: {
      name: 'Claire Dupont',
      credentials: 'FRM · former buy-side risk manager',
      bio: 'Ran risk for a multi-strategy fund for a decade. Her position is that most retail blow-ups are not bad trades but unmeasured concentration.',
      rating: 4.8,
      students: '5,600',
      courses: 3,
    },
    outcomes: [
      'Measure exposure across positions rather than one at a time',
      'Spot correlation that hides in a diversified-looking book',
      'Set daily, weekly and monthly loss limits that hold',
      'Stress a portfolio against real historical moves',
      'Decide when to cut size rather than cut positions',
    ],
    sections: [
      {
        id: 'measuring',
        title: 'Measuring what you actually hold',
        lessons: [
          { id: 'exposure', title: 'Exposure, gross and net', time: '13:30', free: true },
          { id: 'correlation', title: 'Correlation that hides in plain sight', time: '15:12' },
          { id: 'concentration', title: 'Concentration you did not choose', time: '11:48' },
        ],
      },
      {
        id: 'limits',
        title: 'Limits that survive contact',
        lessons: [
          { id: 'loss-limits', title: 'Daily, weekly and monthly limits', time: '12:20' },
          { id: 'sizing', title: 'Sizing from volatility, not conviction', time: '14:05' },
          { id: 'cut-size', title: 'Cutting size before cutting positions', time: '10:36' },
        ],
      },
      {
        id: 'stress',
        title: 'Stress testing',
        lessons: [
          { id: 'scenarios', title: 'Building scenarios from real history', time: '16:44' },
          { id: 'tails', title: 'Tails: what a 1% day does to your book', time: '13:58' },
          { id: 'liquidity', title: 'Liquidity, the risk nobody models', time: '12:07' },
        ],
      },
    ],
    includes: ON_DEMAND_INCLUDES,
    reviews: [
      {
        name: 'Peter S.',
        when: 'last month',
        text: 'The correlation section made me realise four of my six positions were the same trade.',
      },
      {
        name: 'Nadia F.',
        when: '2 months ago',
        text: 'Dense and worth it. The stress-test spreadsheet is now part of my monthly routine.',
      },
    ],
  },

  {
    slug: 'fundamental-analysis-deep-dive',
    title: 'Fundamental Analysis Deep Dive',
    tagline:
      'Read a set of financial statements properly, and know which numbers a valuation actually rests on.',
    provider: 'Value Investors Club',
    providerVerified: false,
    providerType: 'external',
    category: 'Fundamental Analysis',
    format: 'hybrid',
    level: 'Intermediate',
    language: 'English',
    price: 279,
    currency: 'EUR',
    image: 'fundamental',
    rating: { score: 4.7, count: 423, breakdown: [76, 17, 4, 2, 1] },
    schedule: { startsAt: '2026-09-19', label: 'Workshop day Sep 19', location: 'Amsterdam' },
    instructor: {
      name: 'Arun Mehta',
      credentials: 'CFA · equity analyst',
      bio: 'Fifteen years covering industrials. Teaches statement analysis by pulling apart companies that later disappointed, and showing where it was visible.',
      rating: 4.7,
      students: '7,200',
      courses: 2,
    },
    outcomes: [
      'Move confidently between the three statements',
      'Separate reported earnings from cash',
      'Build a simple valuation and know its weak point',
      'Read a footnote for what it is hiding',
      'Compare two companies without being fooled by accounting',
    ],
    sections: [
      {
        id: 'statements',
        title: 'The three statements',
        lessons: [
          { id: 'income', title: 'The income statement, top to bottom', time: '15:40', free: true },
          { id: 'balance', title: 'The balance sheet as a snapshot', time: '17:12' },
          { id: 'cashflow', title: 'Cash flow, and why it settles arguments', time: '16:28' },
          { id: 'linking', title: 'How the three connect', time: '12:50' },
        ],
      },
      {
        id: 'quality',
        title: 'Quality of earnings',
        lessons: [
          { id: 'accruals', title: 'Accruals and the gap from cash', time: '14:22' },
          { id: 'footnotes', title: 'Reading a footnote properly', time: '18:05' },
          { id: 'adjusted', title: 'Adjusted numbers, and who adjusted them', time: '11:33' },
        ],
      },
      {
        id: 'valuation',
        title: 'Valuation',
        lessons: [
          { id: 'multiples', title: 'Multiples, and what they assume', time: '13:47' },
          { id: 'dcf', title: 'A simple DCF and its weakest input', time: '19:16' },
          { id: 'comparison', title: 'Comparing two companies fairly', time: '15:09' },
        ],
      },
      {
        id: 'workshop',
        title: 'Live workshop day',
        lessons: [
          { id: 'teardown', title: 'Teardown: a company that later disappointed', time: '95:00' },
          { id: 'your-company', title: 'Working session: your own pick', time: '75:00' },
        ],
      },
    ],
    includes: [
      { label: 'Recorded lessons plus one live workshop day', icon: 'play' },
      { label: 'Statement analysis spreadsheet', icon: 'layers' },
      { label: 'Annotated annual reports', icon: 'book' },
      { label: 'Lifetime access to the recordings', icon: 'globe' },
    ],
    reviews: [
      {
        name: 'Lucia B.',
        when: '6 weeks ago',
        text: 'The teardown day is the reason to take this. Watching someone find the warning in a footnote is different from being told to look.',
      },
      {
        name: 'Karl-Heinz D.',
        when: '3 months ago',
        text: 'Solid, if dry in places. The cash-flow lessons alone justified it.',
      },
    ],
  },

  {
    slug: 'trading-live-markets-workshop',
    title: 'Trading Live Markets Workshop',
    tagline:
      'Six live sessions traded alongside the instructor, during market hours, on the days the market is open.',
    provider: 'London Trading Group',
    providerVerified: true,
    providerType: 'external',
    category: 'Trading',
    format: 'live_online',
    level: 'Intermediate',
    language: 'English',
    price: 149,
    currency: 'GBP',
    image: 'live-markets',
    rating: { score: 4.6, count: 311, breakdown: [72, 19, 5, 3, 1] },
    schedule: { startsAt: '2026-09-15', label: 'Sep 15–29 · Tue & Thu, 18:00 UTC' },
    instructor: {
      name: 'Owen Blackwood',
      credentials: 'Day trader, London Trading Group',
      bio: 'Trades index futures and talks through every decision as he makes it, including the ones that do not work.',
      rating: 4.6,
      students: '2,800',
      courses: 1,
    },
    outcomes: [
      'Prepare a session the way a full-time trader does',
      'Watch decisions being made in real time, with reasons',
      'Practise the same setups on your own screen',
      'Debrief a session honestly the same evening',
    ],
    sections: [
      {
        id: 'sessions',
        title: 'The six sessions',
        lessons: [
          { id: 's1', title: 'Session 1 — preparation and the plan for the day', time: '75:00' },
          { id: 's2', title: 'Session 2 — the open, traded live', time: '80:00' },
          { id: 's3', title: 'Session 3 — ranges and patience', time: '75:00' },
          { id: 's4', title: 'Session 4 — a day that does not cooperate', time: '80:00' },
          { id: 's5', title: 'Session 5 — your trades, reviewed', time: '85:00' },
          { id: 's6', title: 'Session 6 — building your own routine', time: '70:00' },
        ],
      },
    ],
    includes: COHORT_INCLUDES,
    reviews: [
      {
        name: 'Sam O.',
        when: '2 months ago',
        text: 'Watching someone size down mid-session and say why was worth more than any recorded course.',
      },
      {
        name: 'Bea T.',
        when: '4 months ago',
        text: 'Times suit Europe well. Sessions run long when the market is interesting, which I did not mind.',
      },
    ],
  },

  {
    slug: 'ai-in-trading-tools-and-strategies',
    title: 'AI in Trading: Tools & Strategies',
    tagline:
      'Where machine learning genuinely helps in a trading workflow, and the far longer list of places it does not.',
    provider: 'Future Traders',
    providerVerified: false,
    providerType: 'external',
    category: 'AI in Finance',
    format: 'online',
    level: 'Intermediate',
    language: 'English',
    price: 229,
    currency: 'USD',
    image: 'ai-trading',
    rating: { score: 4.8, count: 289, breakdown: [83, 12, 3, 1, 1] },
    instructor: {
      name: 'Dr. Iris Cheng',
      credentials: 'Quantitative researcher',
      bio: 'Builds models for a systematic fund and spends most of her teaching time explaining why a backtest looked so good.',
      rating: 4.8,
      students: '3,400',
      courses: 2,
    },
    outcomes: [
      'Tell a useful model from an overfitted one',
      'Set up a backtest that does not lie to you',
      'Use language models for research without trusting them blindly',
      'Automate the parts of a workflow worth automating',
      'Recognise the claims that should end a sales conversation',
    ],
    sections: [
      {
        id: 'foundations',
        title: 'Foundations',
        lessons: [
          { id: 'what-ml-does', title: 'What machine learning actually does with prices', time: '14:10', free: true },
          { id: 'features', title: 'Features, and where the signal usually is not', time: '16:22' },
          { id: 'overfitting', title: 'Overfitting, demonstrated', time: '13:44' },
        ],
      },
      {
        id: 'backtesting',
        title: 'Backtesting honestly',
        lessons: [
          { id: 'leakage', title: 'Look-ahead bias and how it sneaks in', time: '15:38' },
          { id: 'costs', title: 'Costs, slippage and the death of a strategy', time: '12:56' },
          { id: 'walk-forward', title: 'Walk-forward testing', time: '17:04' },
        ],
      },
      {
        id: 'workflow',
        title: 'Language models in a workflow',
        lessons: [
          { id: 'research', title: 'Research assistance that cites its sources', time: '13:19' },
          { id: 'limits', title: 'What a model cannot know about a market', time: '11:47' },
          { id: 'automation', title: 'Automating the boring parts safely', time: '14:33' },
        ],
      },
    ],
    includes: ON_DEMAND_INCLUDES,
    reviews: [
      {
        name: 'Viktor A.',
        when: '3 weeks ago',
        text: 'The overfitting demonstration should be mandatory before anyone is allowed near a backtester.',
      },
      {
        name: 'Hannah P.',
        when: '2 months ago',
        text: 'Honest about limits, which is rare for anything with AI in the title.',
      },
    ],
  },

  {
    slug: 'investing-foundations',
    title: 'Investing Foundations: Your First Portfolio',
    tagline:
      'The whole beginning, in one place: what to buy first, how much, and what to do when it falls.',
    provider: 'TradingNew Academy',
    providerVerified: true,
    providerType: 'tradingnew',
    category: 'Investing',
    format: 'online',
    level: 'Beginner',
    language: 'English',
    price: 0,
    currency: 'EUR',
    badge: 'New',
    image: 'investing-foundations',
    instructor: {
      name: 'Nora Fitzgerald',
      credentials: 'Head of Learning, TradingNew Academy',
      bio: 'Writes the beginner material for the portal. Rule she teaches by: if a sentence needs a glossary, rewrite the sentence.',
      rating: 4.9,
      students: '31,000',
      courses: 6,
    },
    outcomes: [
      'Decide what to hold before you decide what to buy',
      'Build a first portfolio out of three or four holdings',
      'Understand what a fund charges you each year',
      'Know what to do on the day the market drops',
      'Set up contributions you will not have to think about',
    ],
    sections: [
      {
        id: 'before',
        title: 'Before your first purchase',
        lessons: [
          { id: 'reserve', title: 'The cash reserve that comes first', time: '07:20', free: true },
          { id: 'horizon', title: 'How long is this money for?', time: '08:45', free: true },
          { id: 'risk-comfort', title: 'What you can actually sit through', time: '09:10' },
        ],
      },
      {
        id: 'building',
        title: 'Building the portfolio',
        lessons: [
          { id: 'etfs', title: 'One fund, many companies', time: '10:32' },
          { id: 'mix', title: 'A mix of three or four holdings', time: '11:18' },
          { id: 'costs', title: 'What it costs to hold, every year', time: '08:04' },
          { id: 'first-buy', title: 'Placing the first order', time: '09:47' },
        ],
      },
      {
        id: 'living',
        title: 'Living with it',
        lessons: [
          { id: 'drops', title: 'The day it falls 8%', time: '10:55' },
          { id: 'contributions', title: 'Contributions on autopilot', time: '07:36' },
          { id: 'review', title: 'The once-a-year review', time: '08:22' },
        ],
      },
    ],
    includes: [
      { label: 'On-demand video, watch at your own pace', icon: 'play' },
      { label: 'A one-page starting checklist', icon: 'book' },
      { label: 'Practice portfolio exercises', icon: 'flask' },
      { label: 'Free, and free permanently', icon: 'checkCircle' },
    ],
    reviews: [],
  },

  {
    slug: 'portfolio-management-for-professionals',
    title: 'Portfolio Management for Professionals',
    tagline:
      'Four live Monday sessions on construction, rebalancing and reporting for portfolios you manage on someone else’s behalf.',
    provider: 'TradingNew Academy',
    providerVerified: true,
    providerType: 'tradingnew',
    category: 'Portfolio Management',
    format: 'live_online',
    level: 'Advanced',
    language: 'English',
    price: 349,
    currency: 'EUR',
    image: 'portfolio-mgmt',
    rating: { score: 4.9, count: 388, breakdown: [89, 8, 2, 1, 0] },
    schedule: { startsAt: '2026-11-02', label: 'Nov 2–23 · Mondays, 17:00 UTC' },
    instructor: {
      name: 'Gabriel Sanz',
      credentials: 'CFA · former multi-asset portfolio manager',
      bio: 'Managed multi-asset mandates for two decades. Teaches the parts that are rarely written down: rebalancing discipline and explaining a bad quarter.',
      rating: 4.9,
      students: '1,900',
      courses: 3,
    },
    outcomes: [
      'Construct a portfolio from a written mandate',
      'Choose a rebalancing rule and defend it',
      'Attribute performance to decisions, not luck',
      'Report a bad quarter clearly and early',
      'Document a process someone else could follow',
    ],
    sections: [
      {
        id: 'construction',
        title: 'Session 1 — construction',
        lessons: [
          { id: 'mandate', title: 'From mandate to allocation', time: '70:00' },
          { id: 'constraints', title: 'Constraints, and what they cost', time: '45:00' },
        ],
      },
      {
        id: 'rebalancing',
        title: 'Session 2 — rebalancing',
        lessons: [
          { id: 'rules', title: 'Calendar, threshold, or both', time: '60:00' },
          { id: 'costs', title: 'What rebalancing costs, honestly', time: '50:00' },
        ],
      },
      {
        id: 'attribution',
        title: 'Session 3 — attribution',
        lessons: [
          { id: 'sources', title: 'Where the return came from', time: '65:00' },
          { id: 'luck', title: 'Separating skill from a good year', time: '55:00' },
        ],
      },
      {
        id: 'reporting',
        title: 'Session 4 — reporting',
        lessons: [
          { id: 'bad-quarter', title: 'Explaining a bad quarter', time: '60:00' },
          { id: 'process-doc', title: 'Writing the process document', time: '50:00' },
        ],
      },
    ],
    includes: COHORT_INCLUDES,
    reviews: [
      {
        name: 'Ingrid V.',
        when: 'last month',
        text: 'The reporting session is the one nobody else teaches, and it is the one my clients notice.',
      },
      {
        name: 'Felix R.',
        when: '3 months ago',
        text: 'Small cohort, real questions answered. Worth clearing four Mondays for.',
      },
    ],
  },

  {
    slug: 'forex-essentials',
    title: 'Forex Essentials',
    tagline: 'How currency pairs actually work — quoting, leverage, sessions and the cost of holding overnight.',
    provider: 'FX Trading School',
    providerVerified: false,
    providerType: 'external',
    category: 'Forex',
    format: 'online',
    level: 'Beginner',
    language: 'English',
    price: 129,
    currency: 'EUR',
    image: 'forex',
    rating: { score: 4.5, count: 204, breakdown: [68, 21, 6, 3, 2] },
    instructor: {
      name: 'Ken Adeyemi',
      credentials: 'Former interbank FX dealer',
      bio: 'Dealt spot FX for a bank for eight years. Spends the first lesson on leverage because that is what decides most outcomes.',
      rating: 4.5,
      students: '11,500',
      courses: 2,
    },
    outcomes: [
      'Read a currency quote without hesitating',
      'Understand what leverage does to a small account',
      'Know which session you are actually trading in',
      'Account for swap and spread before entering',
      'Size a trade in a pair you do not hold the currency of',
    ],
    sections: [
      {
        id: 'basics',
        title: 'The basics',
        lessons: [
          { id: 'quotes', title: 'Reading a quote, base and counter', time: '09:15', free: true },
          { id: 'pips', title: 'Pips, lots and what a move is worth', time: '11:02' },
          { id: 'leverage', title: 'Leverage, and the arithmetic of a small account', time: '13:28' },
        ],
      },
      {
        id: 'market',
        title: 'The market itself',
        lessons: [
          { id: 'sessions', title: 'Sessions, and when a pair actually moves', time: '10:44' },
          { id: 'drivers', title: 'What moves a currency', time: '12:36' },
          { id: 'costs', title: 'Spread, swap and holding overnight', time: '09:58' },
        ],
      },
    ],
    includes: ON_DEMAND_INCLUDES,
    reviews: [
      {
        name: 'Diego F.',
        when: '2 months ago',
        text: 'Straightforward and short. The leverage lesson is blunt in a way beginners need.',
      },
      {
        name: 'Sylwia N.',
        when: '4 months ago',
        text: 'Would have liked more on execution, but the fundamentals are covered well.',
      },
    ],
  },

  {
    slug: 'economics-for-investors',
    title: 'Economics for Investors',
    tagline:
      'Inflation, rates, growth and employment — what each one means for the things you hold.',
    provider: 'TradingNew Academy',
    providerVerified: true,
    providerType: 'tradingnew',
    category: 'Economics',
    format: 'online',
    level: 'All Levels',
    language: 'English',
    price: 159,
    currency: 'EUR',
    image: 'economics',
    rating: { score: 4.7, count: 467, breakdown: [79, 15, 4, 1, 1] },
    instructor: {
      name: 'Dr. Helena Marsh',
      credentials: 'Economist, TradingNew',
      bio: 'Writes the portal’s economy explainers. Teaches indicators in the order a person meets them in the news, not in the order a textbook lists them.',
      rating: 4.7,
      students: '14,700',
      courses: 4,
    },
    outcomes: [
      'Read an inflation print and know what matters in it',
      'Follow a central bank decision without the jargon',
      'Connect rates to bond, stock and cash returns',
      'Judge an employment report in context',
      'Ignore the indicators that rarely change anything',
    ],
    sections: [
      {
        id: 'prices',
        title: 'Prices and rates',
        lessons: [
          { id: 'inflation', title: 'What an inflation print contains', time: '12:40', free: true },
          { id: 'central-banks', title: 'How a rate decision is actually made', time: '14:52' },
          { id: 'transmission', title: 'From a rate to your holdings', time: '13:18' },
        ],
      },
      {
        id: 'growth',
        title: 'Growth and jobs',
        lessons: [
          { id: 'gdp', title: 'GDP, and what it misses', time: '11:26' },
          { id: 'employment', title: 'Reading an employment report', time: '12:55' },
          { id: 'cycles', title: 'Cycles, and why timing them fails', time: '13:41' },
        ],
      },
      {
        id: 'you',
        title: 'What it means for you',
        lessons: [
          { id: 'assets', title: 'Which assets react to what', time: '14:07' },
          { id: 'noise', title: 'The releases worth ignoring', time: '10:12' },
          { id: 'routine', title: 'A monthly routine that takes ten minutes', time: '09:33' },
        ],
      },
    ],
    includes: ON_DEMAND_INCLUDES,
    reviews: [
      {
        name: 'Marta C.',
        when: 'last month',
        text: 'Finally understand what people mean by "core" inflation and why the headline number is not the story.',
      },
      {
        name: 'Jonas E.',
        when: '3 months ago',
        text: 'The "releases worth ignoring" lesson saved me more time than the rest of the course combined.',
      },
    ],
  },
];

/** Category chips above the catalogue, in the order the design lists them. */
export const COURSE_CATEGORIES = [
  'Trading',
  'Investing',
  'Technical Analysis',
  'Fundamental Analysis',
  'Risk Management',
  'Options',
  'Crypto',
  'Psychology',
  'AI in Finance',
] as const;

/** The facet groups in the filter rail. */
export const COURSE_FACET_TYPES = [
  'Trading',
  'Investing',
  'Technical Analysis',
  'Fundamental Analysis',
  'Risk Management',
  'Psychology',
  'Crypto',
  'Options',
  'Economics',
  'Forex',
  'Portfolio Management',
  'AI in Finance',
] as const;

export const COURSE_SORTS = ['Popular', 'Highest rated', 'Newest', 'Price: low to high'] as const;
export type CourseSort = (typeof COURSE_SORTS)[number];

/** The promises at the foot of the catalogue. */
export const ACADEMY_GUARANTEES: Array<{ title: string; text: string; icon: IconName }> = [
  {
    title: 'Payments handled securely',
    text: 'Card details never reach TradingNew',
    icon: 'shieldCheck',
  },
  { title: '30-day money back', text: 'Not satisfied? Ask, and it is refunded', icon: 'refresh' },
  { title: 'Certificate of completion', text: 'Where the provider offers one', icon: 'book' },
  { title: 'Learn anywhere', text: 'Any device, and it remembers your place', icon: 'globe' },
];

export const ACADEMY_TRUST: Array<{ title: string; text: string; icon: IconName }> = [
  { title: 'Expert-led', text: 'Taught by people who did the job', icon: 'grad' },
  { title: 'Online & in person', text: 'Self-paced, live cohorts, workshops', icon: 'play' },
  { title: 'Providers checked', text: 'Verified credentials, open reviews', icon: 'shield' },
];

export function courseBySlug(slug: string): Course | undefined {
  return ACADEMY_COURSES.find((course) => course.slug === slug);
}
