import type { IconName } from '@/components/ui/Icon';

/**
 * The asset classes, and the one matrix that compares them.
 *
 * Everything about a class lives here: the short prose the Explore column
 * shows, the longer prose its own page shows, the six axes it is rated on, the
 * questions it is asked, and which two classes it is worth comparing against.
 *
 * One module, because the alternative was four. The comparison used to be
 * hard-coded in the Explore column for three classes only, the descriptions
 * were written twice, and a seventh tab existed that was not an asset class at
 * all. A reader who taps Bonds and gets a comparison that does not contain
 * bonds has been shown a table about somebody else.
 *
 * The ratings are ordinal, coarse, and about a whole category rather than any
 * instrument in it. They are not scores and every screen that renders them says
 * so.
 */

export type AssetAccent = 'green' | 'blue' | 'purple' | 'amber' | 'orange' | 'rose';

export type AssetClassKey = 'stocks' | 'etfs' | 'bonds' | 'cash' | 'crypto' | 'property';

/**
 * The six axes that are rated. Order is meaningful — it is the order they are
 * read in.
 *
 * "Minimum amount" used to be one of them and is text now: a dot scale claiming
 * that one share is a lower number than any amount was comparing two things
 * that are not on the same line. Complexity took the sixth slot instead, which
 * is the axis somebody choosing between property and a fund actually needs.
 */
export const COMPARE_AXES = [
  'Risk',
  'Growth potential',
  'Stability',
  'Ease of selling',
  'Costs',
  'Complexity',
] as const;

export type CompareAxis = (typeof COMPARE_AXES)[number];

/** Five steps. Enough to rank six things, too few to imply a measurement. */
export const DOT_SCALE = 5;

/** 1–5, in order. The word carries the value; the dots only repeat it. */
export const SCALE_WORDS = ['Very low', 'Low', 'Medium', 'High', 'Very high'] as const;

/**
 * The axes where more is worse.
 *
 * On these three a high rating is a warning rather than a score, so the dots
 * turn amber at 4 instead of staying mint. Everywhere else the colour is the
 * class's own accent and means nothing but "this many".
 */
export const CAUTION_AXES: readonly CompareAxis[] = ['Risk', 'Costs', 'Complexity'];

/** The word for a level. Derived, never stored — the two cannot disagree. */
export function ratingWord(level: number): string {
  return SCALE_WORDS[Math.min(Math.max(level, 1), DOT_SCALE) - 1];
}

/** The four tiles above the prose. Labels live in the UI, values here. */
export type AssetFacts = {
  risk: string;
  horizon: string;
  liquidity: string;
  entry: string;
};

export type StartingPoint = {
  title: string;
  sub: string;
};

export type AssetClass = {
  key: AssetClassKey;
  /** Plural, as a heading: "ETFs". */
  name: string;
  /** Grammatically singular subject: "an ETF", "cash". Used in sentences. */
  subject: string;
  /** Whether `subject` takes a singular verb — "an ETF works", "stocks work". */
  singular: boolean;
  icon: IconName;
  accent: AssetAccent;
  tagline: string;

  /** The four beginner questions, short — the Explore column. */
  what: string;
  why: string;
  risks: string;
  suit: string;

  /** The same four, extended — the class's own page. One paragraph each. */
  longWhat: string;
  longWhy: string;
  longRisks: string;
  longSuit: string;

  /** The four tiles: risk, horizon, liquidity, entry size. */
  facts: AssetFacts;
  /** Three things worth knowing that the prose above does not say. */
  goodToKnow: string[];
  /** The one mistake people actually make with this category. */
  watchOut: string;
  /** How people usually begin. Examples, and labelled as examples. */
  starts: StartingPoint[];
  /** The lesson this category leads to, by title. */
  lesson: string;
  /** How this category is named when pointing at the live market. */
  marketLabel: string;

  ratings: Record<CompareAxis, number>;
  /** What it takes to start, in words rather than on a scale. */
  minimum: string;
  /** What the category is usually held for. */
  useCase: string;
  /** The two classes worth putting beside it. */
  alternatives: AssetClassKey[];
  /** What people ask about it. Answered by the Voyager library. */
  questions: string[];
};

export const ASSET_CLASSES: AssetClass[] = [
  {
    key: 'stocks',
    name: 'Stocks',
    subject: 'stocks',
    singular: false,
    icon: 'trendUp',
    accent: 'green',
    tagline: 'Shares of ownership in individual companies.',
    what: 'A stock is a small ownership share in one company that trades on an exchange.',
    why: 'Potential for long-term growth, and a share of profits where a company pays dividends.',
    risks: 'A single company can fall sharply. Far less diversified than a fund.',
    suit: 'People comfortable researching companies and holding through swings.',
    longWhat:
      'A stock is a small ownership share in one company. Owning it makes you a part-owner of that business: you have a claim on its profits, and its price moves with what buyers and sellers think those profits will be. Shares trade on an exchange, which is what makes them easy to buy and easy to sell — and also what makes the price move every day, whether or not anything about the business changed.',
    longWhy:
      'Over long periods, owning productive businesses has been one of the few things that outgrew inflation. Some companies also hand a share of profit back as a dividend. And unlike a fund, a single stock lets you act on a view about one specific business — which is the appeal and, in the same breath, the risk.',
    longRisks:
      'One company can lose most of its value and not recover. That is not a rare event and no amount of research reliably prevents it, because the causes are often outside the business entirely. Holding a handful of stocks means a bad outcome in one of them shows up in your total; holding one means it decides your total.',
    longSuit:
      'People who will read about a business before buying it, who can leave the money alone for years, and for whom a 40% fall in one holding would be disappointing rather than damaging. For most people starting out, a fund is the same exposure without the concentration.',
    facts: {
      risk: 'Higher',
      horizon: '5+ years',
      liquidity: 'High',
      entry: 'One share',
    },
    goodToKnow: [
      'Returns are not smooth: a single company can fall sharply even in a rising market.',
      'Owning 20 companies behaves very differently from owning two — spread matters more than picking.',
      'Dividends are optional for the company and can be cut at any time.',
    ],
    watchOut:
      'Concentration is the most common mistake. A portfolio built from a handful of familiar names carries far more single-company risk than most people assume.',
    starts: [
      {
        title: 'Start with a broad index fund',
        sub: 'Own hundreds of companies at once instead of choosing between them.',
      },
      {
        title: 'Add individual names slowly',
        sub: 'Keep single positions small while you learn how they behave.',
      },
      {
        title: 'Set a schedule, not a moment',
        sub: 'Investing monthly removes the pressure to time an entry.',
      },
    ],
    lesson: 'How shares actually make money',
    marketLabel: 'stocks',
    ratings: {
      Risk: 4,
      'Growth potential': 5,
      Stability: 2,
      'Ease of selling': 5,
      Costs: 2,
      Complexity: 3,
    },
    minimum: 'Price of one share',
    useCase: 'Long-term growth',
    alternatives: ['etfs', 'bonds'],
    questions: [
      'Are single stocks risky for beginners?',
      'How many stocks would I need to own?',
      'Stocks or ETFs — where would I start?',
    ],
  },
  {
    key: 'etfs',
    name: 'ETFs',
    subject: 'an ETF',
    singular: true,
    icon: 'layers',
    accent: 'blue',
    tagline: 'Baskets of investments you can buy in one go.',
    what: 'A collection of stocks, bonds or other assets that trades on an exchange like a share.',
    why: 'Diversification in a single purchase, simple to buy, and often low-cost.',
    risks: 'The whole market can fall, and a cheap fund is still exposed to what it holds.',
    suit: 'Beginners and long-horizon investors who want spread without picking.',
    longWhat:
      'An ETF is one thing you buy that holds many other things — often every company in an index. It trades on an exchange like an ordinary share, so buying it takes the same click as buying a stock, and one purchase spreads your money across hundreds of businesses at once.',
    longWhy:
      'It solves the problem most beginners actually have, which is not "which company" but "how do I avoid it mattering which company". A broad ETF makes any single business too small to sink you. The cheapest of them charge a fraction of a per cent a year, which over decades is the difference between two very different outcomes.',
    longRisks:
      'It spreads company risk, not market risk. When the whole market falls, a fund that holds the whole market falls with it — diversification narrows what can happen to you, it does not remove the bad end. The fee is charged every year whether the fund rose or fell. And "ETF" describes a wrapper, not a level of risk: a fund holding one country’s smallest companies is not a safe investment because it is a fund.',
    longSuit:
      'Almost anyone starting out, and plenty of people who are not. It is the default answer for money that can be left alone for years and that you would rather not have to think about weekly.',
    facts: {
      risk: 'Medium',
      horizon: '3–10 years',
      liquidity: 'High',
      entry: 'One unit',
    },
    goodToKnow: [
      'The index a fund tracks matters more than the fund’s brand name.',
      'Costs compound: a 0.20% fee is roughly double a 0.09% one over decades.',
      'Two “diversified” ETFs can hold largely the same top ten companies.',
    ],
    watchOut:
      'Broad does not mean safe. A world equity ETF still falls in a global sell-off — diversification spreads company risk, not market risk.',
    starts: [
      {
        title: 'One world equity fund',
        sub: 'The simplest single-fund core many people begin with.',
      },
      {
        title: 'Core plus a theme',
        sub: 'A broad fund as the base, a small satellite for conviction.',
      },
      {
        title: 'Check overlap before adding',
        sub: 'See what a second fund actually adds to the first.',
      },
    ],
    lesson: 'How index funds work',
    marketLabel: 'ETFs',
    ratings: {
      Risk: 3,
      'Growth potential': 4,
      Stability: 3,
      'Ease of selling': 5,
      Costs: 1,
      Complexity: 2,
    },
    minimum: 'Price of one unit',
    useCase: 'Diversified core',
    alternatives: ['stocks', 'bonds'],
    questions: [
      'What is the difference between an ETF and a stock?',
      'Are ETFs suitable for beginners?',
      'How are ETFs taxed where I live?',
    ],
  },
  {
    key: 'bonds',
    name: 'Bonds',
    subject: 'a bond',
    singular: true,
    icon: 'shieldCheck',
    accent: 'purple',
    tagline: 'Loans to governments or companies that pay interest.',
    what: 'You lend money for a fixed period and receive regular interest payments.',
    why: 'Steadier income and smaller swings than shares, in most conditions.',
    risks: 'Rising rates push bond prices down, and an issuer can default.',
    suit: 'People who want income and would rather not watch a value move much.',
    longWhat:
      'A bond is a loan. You lend money to a government or a company for a fixed period, they pay you interest on a schedule, and they return the original amount at the end. That schedule is the whole appeal: you know what is meant to arrive and when, which is something no share can offer.',
    longWhy:
      'Income you can plan around, and a value that usually moves far less than shares do. Bonds also tend not to fall at the same time or for the same reasons as shares, which is why holding both makes a portfolio behave differently from either.',
    longRisks:
      'Two things break the schedule. If interest rates rise, the price of a bond you already hold falls — you can hold it to maturity and still get your money, but selling early may lose some. And the borrower can fail to pay: a government bond and a struggling company’s bond are the same instrument only in name.',
    longSuit:
      'People who want a return without watching a number move much, and anyone whose horizon is short enough that a sharp fall would force them to sell at the wrong time.',
    facts: {
      risk: 'Lower',
      horizon: '1–10 years',
      liquidity: 'Medium',
      entry: 'Fund or €1,000+',
    },
    goodToKnow: [
      'When interest rates rise, existing bond prices fall — longer bonds fall further.',
      'Government and corporate bonds carry very different credit risk.',
      'A bond fund never “matures” the way a single bond does.',
    ],
    watchOut:
      'Bonds are not automatically the safe part of a portfolio. Long-duration funds can lose double digits in a fast rate cycle.',
    starts: [
      {
        title: 'Short-duration government bonds',
        sub: 'Least sensitive to rate moves while you learn the mechanics.',
      },
      {
        title: 'A broad aggregate bond fund',
        sub: 'Government and corporate exposure in one holding.',
      },
      {
        title: 'Match maturity to the goal',
        sub: 'Money needed in three years should not sit in 20-year duration.',
      },
    ],
    lesson: 'Why bond prices move opposite to yields',
    marketLabel: 'bonds',
    ratings: {
      Risk: 2,
      'Growth potential': 2,
      Stability: 4,
      'Ease of selling': 3,
      Costs: 2,
      Complexity: 3,
    },
    minimum: 'Fund unit or €1,000+',
    useCase: 'Income and ballast',
    alternatives: ['etfs', 'cash'],
    questions: [
      'How does a bond actually pay interest?',
      'What happens to my bonds when rates rise?',
      'Government or corporate — what is the difference?',
    ],
  },
  {
    key: 'cash',
    name: 'Cash & Deposits',
    subject: 'cash',
    singular: true,
    icon: 'wallet',
    accent: 'amber',
    tagline: 'Savings accounts and deposits with easy access.',
    what: 'Money held in a savings account, a term deposit or a money-market fund.',
    why: 'Safety and access — the base every other decision is built on.',
    risks: 'Inflation erodes what it buys, quietly, and a rate can be cut.',
    suit: 'An emergency fund, and any goal close enough that a fall would matter.',
    longWhat:
      'Cash here means money in a savings account, a fixed-term deposit or a money-market fund. The number does not fall. It is the only category on this page about which that can be said, and it is the reason every sensible plan starts here rather than ending here.',
    longWhy:
      'Because the first job of money is to be available when something goes wrong. A reserve you can reach in a day is what stops a broken car from becoming a sold investment at the worst possible moment. It is also the right home for anything you will need within a year or two.',
    longRisks:
      'Inflation. Cash cannot fall in value and can still leave you worse off, quietly, over a long enough period — at 3% a year it buys roughly a quarter less after ten years. That is a real cost and it appears on no statement. A headline rate can also be cut the month after you open the account.',
    longSuit:
      'Everyone, for part of their money. An emergency fund, and any goal close enough that a 20% fall would change what you can do.',
    facts: {
      risk: 'Lowest',
      horizon: '0–2 years',
      liquidity: 'Immediate',
      entry: 'Any amount',
    },
    goodToKnow: [
      'Inflation is the real risk: 3% inflation against a 2% rate is a quiet annual loss.',
      'Deposit protection limits are per bank, per person — worth checking above them.',
      'Money-market funds are not deposits, even though they behave similarly.',
    ],
    watchOut:
      'Holding a large cash balance “until things calm down” is the most expensive form of waiting in most historical periods.',
    starts: [
      {
        title: 'Build the buffer first',
        sub: 'Three to six months of expenses before anything is invested.',
      },
      {
        title: 'Separate the buffer from the plan',
        sub: 'Different accounts stop one goal from eating the other.',
      },
      {
        title: 'Compare the real rate',
        sub: 'Rate minus inflation is the number that matters.',
      },
    ],
    lesson: 'What inflation does to savings',
    marketLabel: 'rates',
    ratings: {
      Risk: 1,
      'Growth potential': 1,
      Stability: 5,
      'Ease of selling': 5,
      Costs: 1,
      Complexity: 1,
    },
    minimum: 'Any amount',
    useCase: 'Buffer and short goals',
    alternatives: ['bonds', 'etfs'],
    questions: [
      'How much cash should I keep aside?',
      'What is a high-yield savings account?',
      'Does inflation really eat my savings?',
    ],
  },
  {
    key: 'crypto',
    name: 'Crypto',
    subject: 'crypto',
    singular: true,
    icon: 'coins',
    accent: 'orange',
    tagline: 'Digital assets with large and frequent price swings.',
    what: 'Currencies and tokens recorded on public blockchains, traded around the clock.',
    why: 'Some hold a small slice for growth potential and for its different behaviour.',
    risks: 'Extreme volatility. Values can fall a long way, quickly, and stay there.',
    suit: 'People risking only what losing entirely would not change.',
    longWhat:
      'Crypto assets are currencies and tokens recorded on public blockchains, traded continuously and issued by no government. Their price is set entirely by what buyers and sellers agree on, with no earnings, rent or interest underneath it.',
    longWhy:
      'Some people hold a small slice for its growth potential and because it has behaved differently from shares in some periods. That is the honest version of the case, and it is a case for a small slice rather than a position.',
    longRisks:
      'Falls of 70% or more have happened repeatedly and taken years to recover, when they recovered. There is no earnings figure to anchor a valuation to, custody mistakes are permanent, and a platform failing has cost people everything they held on it. Nothing here is protected by a deposit guarantee.',
    longSuit:
      'People who can lose the entire amount without it changing anything they had planned — and only after a reserve and the rest of a plan already exist.',
    facts: {
      risk: 'Highest',
      horizon: 'Undefined',
      liquidity: 'High, uneven',
      entry: 'Any amount',
    },
    goodToKnow: [
      'Drawdowns of 50–70% have happened repeatedly, including in the largest assets.',
      'Custody is a real decision: exchange, wallet or regulated product each behave differently.',
      'Regulation and tax treatment vary sharply by country.',
    ],
    watchOut:
      'Position sizing matters more here than in any other option. Most damage comes from an allocation that was never survivable at a −60% move.',
    starts: [
      {
        title: 'Size it as a satellite',
        sub: 'A small share of a portfolio, decided before you buy.',
      },
      {
        title: 'Majors before anything else',
        sub: 'Liquidity and history differ enormously below the top assets.',
      },
      {
        title: 'Understand custody first',
        sub: 'Know exactly who holds the asset and what happens if they fail.',
      },
    ],
    lesson: 'What actually backs a crypto asset',
    marketLabel: 'crypto',
    ratings: {
      Risk: 5,
      'Growth potential': 5,
      Stability: 1,
      'Ease of selling': 4,
      Costs: 3,
      Complexity: 4,
    },
    minimum: 'Any amount',
    useCase: 'Small satellite',
    alternatives: ['stocks', 'etfs'],
    questions: [
      'Is crypto too risky for someone starting out?',
      'What is Bitcoin, in plain terms?',
      'How much of a portfolio would be sensible?',
    ],
  },
  {
    key: 'property',
    name: 'Property',
    subject: 'property',
    singular: true,
    icon: 'building',
    accent: 'rose',
    tagline: 'Real estate, held directly or through listed funds.',
    what: 'Physical property, or shares in funds that own income-producing buildings.',
    why: 'Rent, long-run appreciation, and behaviour that differs from shares.',
    risks: 'Hard to sell quickly, expensive to enter, and markets move in long cycles.',
    suit: 'Long horizons, and people who will not need the money back at short notice.',
    longWhat:
      'Property means either a building you own directly or shares in a listed fund that owns income-producing buildings — a REIT. The two are the same asset in very different wrappers: one takes a mortgage, a solicitor and months; the other takes a click.',
    longWhy:
      'Rent is income that does not depend on a company’s profits, and property has historically kept pace with inflation over long periods. Held directly, it is also the only category here that most people can borrow against on reasonable terms.',
    longRisks:
      'Direct property is hard to sell quickly and expensive to enter and exit — the costs of buying and selling can take years of rent to recover. Markets move in long cycles rather than daily wiggles, which hides risk rather than removing it. And a single building is a single, undiversified holding in one street.',
    longSuit:
      'Long horizons and people who will not need the money back at short notice. A REIT gives most of the exposure without the illiquidity, at the cost of a price that moves daily like a share.',
    facts: {
      risk: 'Medium',
      horizon: '10+ years',
      liquidity: 'Low (direct)',
      entry: 'Large or fund',
    },
    goodToKnow: [
      'Direct property is a business: maintenance, vacancy, tenants and paperwork are part of the return.',
      'Leverage cuts both ways — a mortgage amplifies gains and losses alike.',
      'Listed real-estate funds trade like shares and move with rates, not with your street.',
    ],
    watchOut:
      'Illiquidity is the defining constraint. Selling takes months, and costs on entry and exit are far higher than for listed assets.',
    starts: [
      {
        title: 'Listed real estate first',
        sub: 'Exposure without a mortgage or a tenant.',
      },
      {
        title: 'Model the full cost',
        sub: 'Taxes, fees, vacancy and maintenance before the headline yield.',
      },
      {
        title: 'Treat your home separately',
        sub: 'A place to live is not the same asset as an investment.',
      },
    ],
    lesson: 'Direct property vs REITs',
    marketLabel: 'real estate',
    ratings: {
      Risk: 3,
      'Growth potential': 3,
      Stability: 3,
      'Ease of selling': 1,
      Costs: 5,
      Complexity: 5,
    },
    minimum: 'Deposit or fund unit',
    useCase: 'Long-horizon asset',
    alternatives: ['etfs', 'bonds'],
    questions: [
      'What is a REIT?',
      'Property or an ETF, over ten years?',
      'How much would I need to start?',
    ],
  },
];

export function assetClass(key: string): AssetClass | null {
  return ASSET_CLASSES.find((entry) => entry.key === key) ?? null;
}

export const ASSET_CLASS_KEYS = ASSET_CLASSES.map((entry) => entry.key);

/**
 * The classes to show side by side with this one.
 *
 * The selected class comes first, always. A comparison that opens without the
 * thing you were reading about is a table about somebody else.
 */
export function comparisonSet(key: AssetClassKey): AssetClass[] {
  const selected = assetClass(key);
  if (!selected) return ASSET_CLASSES.slice(0, 3);
  return [selected, ...selected.alternatives.map((alt) => assetClass(alt)!)];
}

/**
 * The pairs offered as chips beside a comparison.
 *
 * The first is the class's own two alternatives, so the chip row opens on the
 * comparison the page was already showing. The rest are other pairs, in the
 * order the classes are declared, and the selected class is never among them —
 * it is always the first column.
 */
export function rivalPairs(key: AssetClassKey, limit = 4): AssetClassKey[][] {
  const others = ASSET_CLASS_KEYS.filter((entry) => entry !== key);
  const pairs: AssetClassKey[][] = [];

  for (let i = 0; i < others.length; i += 1) {
    for (let j = i + 1; j < others.length; j += 1) pairs.push([others[i], others[j]]);
  }

  const preferred = assetClass(key)?.alternatives ?? others.slice(0, 2);
  const seen = new Set<string>();
  const out: AssetClassKey[][] = [];

  for (const pair of [preferred, ...pairs]) {
    const id = [...pair].sort().join(',');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(pair);
    if (out.length === limit) break;
  }

  return out;
}

/** How a pair of chips reads: "ETFs + Bonds". */
export function pairLabel(pair: AssetClassKey[]): string {
  return pair.map((entry) => assetClass(entry)?.name ?? entry).join(' + ');
}

/** How this class is described in a sentence: "an ETF works", "stocks work". */
export function verbFor(entry: AssetClass): string {
  return entry.singular ? 'works' : 'work';
}

export const RATING_NOTE =
  'These are general guides to a whole category, not measurements and not guarantees.';
