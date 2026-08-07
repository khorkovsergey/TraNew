import { findAnswer } from '../../explore/answers';
import type { VoyagerPlan } from './contract';
import {
  BEGINNER,
  CHART,
  COMPARE,
  GOLD,
  MONITOR,
  PINE,
  PORTFOLIO,
  SCREEN,
  SELLOFF,
} from './scenarioData';

/**
 * Scripted responses, behind the structured contract.
 *
 * Two reasons these exist rather than a model call. The product has to
 * demonstrate with no `ANTHROPIC_API_KEY`, like the rest of Voyager. And a
 * scripted response proves the boundary is real *before* anything unpredictable
 * is on the other side of it: these go through `parsePlan` exactly as a model
 * response would, so a scenario that forgets a source or invents a module kind
 * is refused here, in a test, rather than in production.
 *
 * When the model layer lands it produces the same object and nothing
 * downstream changes. That is what the boundary is for.
 *
 * Import-free beyond the contract, so the harness compiles it alone.
 */

const NOW = '2026-08-03T09:15:00Z';

/** Routed on keywords, as the prototype does. Narrow and honest about it. */
export function scenarioFor(question: string): string | null {
  const q = question.toLowerCase();

  /*
   * Order matters, and the specific tests come first.
   *
   * "Create a Pine Script indicator" and "Build a Tesla chart with RSI" both
   * read as building; "What are the risks in my portfolio" and "Find companies
   * with growing revenue" both read as searching. Whichever test runs first
   * wins, so the narrowest go at the top and the market summary is the fallback
   * rather than a match.
   */
  /*
   * Matched on whole words through a padded string rather than with regular
   * expressions.
   *
   * Two reasons. Substring matching sends the wrong request to the wrong
   * scenario in ways that are hard to spot: "vs" lives inside "investing"
   * and "risk" inside "brisk", so a beginner asking about investing would
   * have been handed a comparison. And the escaping is a trap on its own —
   * the first version of this went in with real control characters where
   * the word boundaries were meant, so every question routed to the market
   * summary and the only thing that noticed was a test.
   */
  const padded = ` ${q.replace(/[^a-z]+/g, " ").trim()} `;
  const has = (...words: string[]) => words.some((word) => padded.includes(` ${word} `));

  /*
   * A question about what something *is* comes first.
   *
   * It has to, because the concept words collide with almost every other test:
   * "What are the risks of bonds" would have gone to the portfolio scenario and
   * "What is the difference between ETFs and stocks" to the comparison. Both
   * are somebody asking to be taught, and answering either with a portfolio
   * review is the failure this branch exists to stop — before it existed, every
   * such question fell through to the market summary and got told where the S&P
   * closed.
   */
  // An exact match against a question the product offers wins outright: those
  // have answers written for them, and no keyword rule should be able to send
  // one somewhere else.
  if (findAnswer(question)) return 'explain';

  if (asksForAnExplanation(padded) && conceptIn(padded)) return 'explain';

  if (has('pine', 'script', 'indicator')) return 'pine';
  if (has('beginner') || padded.includes(' every month ')) return 'beginner';
  if (has('monitor', 'alert') || padded.includes(' tell me if ')) return 'monitor';
  if (has('portfolio', 'risk', 'risks')) return 'portfolio';
  if (has('screen', 'screener') || (has('find') && has('companies', 'company'))) return 'screen';
  if (has('compare', 'versus', 'vs')) return 'compare';
  if (has('chart', 'rsi', 'support')) return 'chart';
  if (has('gold')) return 'gold';
  if (padded.includes(' technology stocks ') || has('falling', 'fell', 'selloff')) return 'selloff';

  /*
   * Nothing else claimed it. If it was still a question about what something
   * *is*, answering with today's index levels is the original failure — the
   * explanation scenario admits it has no written answer, which is the honest
   * end of this branch. Questions about today are excluded by name, because
   * "what is happening today" opens exactly like a definition question.
   */
  if (asksForAnExplanation(padded) && !has('today', 'now', 'happening', 'market', 'markets')) {
    return 'explain';
  }

  /*
   * The market summary is no longer the fallback.
   *
   * It used to be, and that is how "What can you help me with?" was answered
   * with where the S&P closed: a question none of the eleven scripted analyses
   * recognised got the one that happened to sit at the end of the list. A
   * dashboard is an answer to a question about the market, not a shrug.
   *
   * `null` means "no built analysis covers this" — the caller asks the model.
   */
  if (has('market', 'markets', 'today', 'session', 'indices', 'sectors')) return 'market';

  return null;
}



/**
 * What a beginner asks about, and the plain answer to each.
 *
 * A closed table rather than a generator. Everything here is a claim about how
 * money works, made to somebody who came to be taught, and a sentence assembled
 * at runtime is a sentence nobody checked. When a question names a concept that
 * is not on this list, the scenario says so instead of improvising — see
 * `explainFor`.
 */
type Concept = {
  words: string[];
  title: string;
  /** What it is, in one paragraph, no jargon. */
  body: string;
  /** The part people are not told, which is usually the part that costs them. */
  catch: string;
  next: string[];
};

/*
 * Order is behaviour, not taste. `conceptFor` returns the first entry whose
 * words appear, so a phrase has to sit above the general word inside it —
 * "price to earnings" before "earnings", or the ratio is answered with the
 * definition of profit.
 *
 * Some words are deliberately absent. `risk`, `market` and `today` belong to
 * other branches of the router, which runs the educational check first: a
 * concept claiming `risk` would answer "what are the main risks in my
 * portfolio" with a definition instead of looking at the portfolio.
 */
export const CONCEPTS: Concept[] = [
  {
    words: ['etf', 'etfs', 'fund', 'funds'],
    title: 'What an ETF is',
    body:
      'An ETF is a single thing you buy that holds many other things — often every company in an index. One purchase spreads your money across hundreds of businesses, so no single one of them can sink you, and it trades on an exchange like an ordinary share.',
    catch:
      'It spreads company risk, not market risk. When the whole market falls, an ETF that holds the whole market falls with it. The fee is small and it is charged every year, whether the fund rose or fell.',
    next: [
      'Compare a broad ETF against a deposit over ten years',
      'Read what an index actually is',
      'See what the annual fee costs over a long horizon',
    ],
  },
  {
    words: ['bond', 'bonds'],
    title: 'What a bond is',
    body:
      'A bond is a loan. You lend money to a government or a company for a fixed period, they pay you interest along the way, and they return the amount at the end. That schedule is the whole appeal: you know what is meant to arrive and when.',
    catch:
      'Two things can break the schedule. If interest rates rise, the price of a bond you already hold falls — you can still hold it to the end, but selling early may lose money. And the borrower can fail to pay, which is why a government bond and a struggling company\u2019s bond are not the same instrument.',
    next: [
      'Compare government and corporate bonds',
      'See what happens to bond prices when rates move',
      'Read how bonds and shares behave differently',
    ],
  },
  {
    words: ['inflation'],
    title: 'What inflation does to money',
    body:
      'Inflation is prices rising over time, which is the same thing as money buying less. Cash that sits still does not lose a number — it loses what the number can buy. At 3% a year, money left alone buys roughly a quarter less after ten years.',
    catch:
      'It is the reason "safe" is not the same as "no risk". A deposit cannot fall in value and can still leave you worse off, quietly, over a long enough period. That is a real cost and it does not appear on any statement.',
    next: [
      'See what inflation did to savings over the last decade',
      'Compare a deposit rate against the inflation rate',
      'Read why a cash reserve is still worth holding',
    ],
  },
  {
    words: ['diversification', 'diversify', 'diversified'],
    title: 'What diversification does',
    body:
      'Diversification is holding things that do not all fall together. It does not raise your expected return — it narrows the range of what can happen to you, which matters most when you cannot afford the bad end of that range.',
    catch:
      'It works on the risk of being wrong about one company. It does not work on the risk of a whole market falling, because in a bad enough month most things fall at once. Holding twenty companies in one industry is not diversification.',
    next: [
      'See how a single stock and a broad fund behave in the same year',
      'Read what correlation means, in plain terms',
      'Try a practice portfolio with two very different holdings',
    ],
  },
  {
    words: ['dividend', 'dividends'],
    title: 'What a dividend is',
    body:
      'A dividend is a company handing part of its profit to the people who own it. It arrives as cash, usually a few times a year, and it is one of the two ways a share can pay you — the other being the price going up.',
    catch:
      'A dividend is not free money: the share price drops by roughly the amount paid out on the day it is paid. And a high dividend yield is sometimes a falling price rather than a generous company, which is the opposite of what it looks like.',
    next: [
      'Compare a dividend fund against a broad market fund',
      'Read why a high yield can be a warning',
      'See how dividends are taxed where you live',
    ],
  },

  /* ---------------------------------------- Phrases, before the words in them */

  {
    words: ['price to earnings', 'p e ratio', 'pe ratio', 'earnings ratio'],
    title: 'What the price-to-earnings ratio says',
    body:
      'The price-to-earnings ratio is the share price divided by the profit earned per share. Read it as years: a P/E of 20 means the price is twenty times one year of current profit.',
    catch:
      'A low number is not automatically cheap and a high one is not automatically expensive. The market may be pricing in profits that have not happened yet, or a decline that has. Comparing the ratio across different industries usually compares nothing.',
    next: [
      'Compare the ratio across companies in one industry',
      'See what the number has been for this company historically',
      'Read what earnings are, and what they leave out',
    ],
  },
  {
    words: ['market cap', 'capitalisation', 'capitalization'],
    title: 'What market capitalisation measures',
    body:
      'Market capitalisation is the share price multiplied by the number of shares in issue. It is what the market currently says the whole company is worth, and it is how companies are sorted into large, medium and small.',
    catch:
      'It is not what the company owns and not what it earns. A price can double without anything inside the business changing, and the capitalisation doubles with it. It is the market’s opinion, priced.',
    next: [
      'Compare capitalisation against revenue for the same company',
      'See how large, medium and small companies behaved differently',
      'Read what the price-to-earnings ratio adds to this',
    ],
  },
  {
    words: ['total return'],
    title: 'What total return counts',
    body:
      'Total return counts the price change and the income together, with dividends treated as reinvested. It is the honest answer to what an investment actually returned over a period.',
    catch:
      'A price chart on its own understates anything that pays an income, sometimes badly over long periods. Before comparing two things, check that both are measured the same way — a price line against a total-return line is not a comparison.',
    next: [
      'Compare price return and total return over ten years',
      'Read what a dividend is',
      'See what fees take out of a total return',
    ],
  },
  {
    words: ['free cash flow', 'cash flow'],
    title: 'What free cash flow shows',
    body:
      'Free cash flow is the cash a company has left after paying to run and maintain itself. It is what can actually fund a dividend, repay debt or buy back shares — money that exists rather than money that has been recognised.',
    catch:
      'It is harder to flatter than profit, which is why it is worth reading, but it swings from year to year. One bad year caused by heavy investment is not the same as a business that cannot generate cash, and the statement does not tell you which you are looking at.',
    next: [
      'Compare cash flow against reported profit for one company',
      'Read why profit and cash are not the same number',
      'See which companies fund dividends out of cash flow',
    ],
  },
  {
    words: ['analyst rating', 'analyst ratings', 'price target', 'price targets'],
    title: 'What an analyst rating is',
    body:
      'An analyst rating is one firm’s published opinion — buy, hold or sell — usually attached to a target price. An average rating is a count of those opinions, not a measurement of the company.',
    catch:
      'The distribution is heavily skewed towards buy, and targets are revised to follow prices at least as often as prices move towards targets. It is a signal about what other people are saying, which is a different thing from what is true.',
    next: [
      'See how the rating changed before and after the last results',
      'Read what earnings estimates are',
      'Compare the target against where the price has actually been',
    ],
  },
  {
    words: ['dollar cost averaging', 'averaging', 'regular investing'],
    title: 'What investing on a schedule does',
    body:
      'Investing a fixed amount at fixed intervals, whatever the price is that day. The same money buys more units when prices are low and fewer when they are high, and the decision of when disappears.',
    catch:
      'It is a way of removing a decision, not a way of improving returns — putting a lump sum in sooner has done better on average, because time in the market is what compounds. What a schedule reliably reduces is the chance of committing everything on the worst possible day, and the chance of never starting.',
    next: [
      'Compare a monthly schedule against a single lump sum',
      'Read what compounding does over a long horizon',
      'Set up a plan with a monthly amount',
    ],
  },
  {
    words: ['limit order', 'market order', 'order type', 'order types'],
    title: 'What the order types do',
    body:
      'A market order says fill this now, at whatever the price is. A limit order says fill this only at my price or better, and may never fill at all. Everything else is a variation on those two.',
    catch:
      'Market orders are the ones that surprise people. In a fast or thinly traded market, "now" can be a noticeably worse price than the one on screen a second earlier, and the difference is yours.',
    next: [
      'Read what liquidity has to do with the price you get',
      'See how wide the gap between buy and sell prices is',
      'Practise both order types in a sample portfolio',
    ],
  },
  {
    words: ['net asset value', 'nav'],
    title: 'What net asset value means for a fund',
    body:
      'Net asset value is what one unit of a fund is worth, based on what the fund holds. An ETF also has a market price, and the two are not always identical — the gap is called a premium or a discount.',
    catch:
      'The gap is normally tiny and normally closes. It widens exactly when markets are disorderly, so the moment you most want to sell can be the moment the price sits furthest from the value.',
    next: [
      'See how closely an ETF has tracked its net asset value',
      'Read what an ETF is',
      'Compare two funds holding the same index',
    ],
  },
  {
    words: ['assets under management', 'aum'],
    title: 'What assets under management tells you',
    body:
      'Assets under management is the total value of everything a fund holds on behalf of everyone invested in it. It is the usual measure of a fund’s size.',
    catch:
      'Size is not quality. A large fund is usually cheaper to run and easier to trade, but a very small one can be closed or merged away — which forces a sale on a date somebody else chose.',
    next: [
      'Compare the size and the fee of two similar funds',
      'Read what an expense ratio costs over time',
      'See how long the fund has existed',
    ],
  },

  /* ------------------------------------------------------------ Single words */

  {
    words: ['index'],
    title: 'What an index is',
    body:
      'An index is a list of companies plus a rule for how much each one counts. The S&P 500 is the 500 largest listed companies in the United States, weighted by size. Nobody buys an index — it is a measuring stick, and funds exist that try to hold whatever it measures.',
    catch:
      'A size-weighted index is less spread out than the number of names suggests. When a handful of very large companies dominate it, "500 companies" can behave a great deal like a bet on ten of them.',
    next: [
      'See what the largest holdings of a broad index are',
      'Compare an index fund against a single company',
      'Read how an ETF tracks an index',
    ],
  },
  {
    words: ['stock', 'stocks', 'share', 'shares', 'equity', 'equities'],
    title: 'What a share is',
    body:
      'A share is a slice of ownership in one company. It entitles you to part of what that business earns — paid out as dividends, or left in to raise the value of what you own — and to a vote you will probably never use.',
    catch:
      'A single company can go to zero while the market it sits in rises. That is the difference a fund spreads and one share does not, and it is why "I picked a good company" and "I invested well" are separate claims.',
    next: [
      'Compare one company against a broad fund over ten years',
      'Read what diversification does',
      'See how a share and a bond behave differently',
    ],
  },
  {
    words: ['compounding', 'compound'],
    title: 'What compounding does',
    body:
      'Compounding is returns earning returns. Money left in place grows on a base that keeps getting larger, so the same percentage adds more each year than it did the year before. Most of what a long horizon does happens in its final third.',
    catch:
      'It runs in both directions, and it needs time far more than it needs cleverness. Money taken out along the way, or a percent a year in fees, removes the part of the base that would have done the heaviest work later.',
    next: [
      'See what the same amount became over ten and thirty years',
      'Compare two fee levels over a long horizon',
      'Read why starting earlier beats starting larger',
    ],
  },
  {
    words: ['volatility', 'volatile'],
    title: 'What volatility measures',
    body:
      'Volatility is how much a price moves around over a period. It says nothing about direction: a price that swings hard and ends where it began is volatile, and one that drifts steadily downwards is not.',
    catch:
      'It is routinely used as a stand-in for risk and it is not the same thing. What costs most people money is not a bumpy line — it is needing the money on a day the line happens to be low.',
    next: [
      'Compare how far two holdings moved in the same year',
      'Read what a drawdown shows that volatility does not',
      'See which asset classes moved least',
    ],
  },
  {
    words: ['yield', 'yields'],
    title: 'What a yield is',
    body:
      'Yield is what something pays out over a year as a percentage of its price. A bond paying 40 a year on a price of 1,000 yields 4%. A share paying 2 in dividends on a price of 50 yields the same.',
    catch:
      'Yield moves when the price moves, and it moves the opposite way. A yield that has climbed sharply is very often a price that has fallen sharply — a warning wearing the clothes of an opportunity.',
    next: [
      'Compare the yield on cash, bonds and dividend shares',
      'Read why a high yield can be a warning',
      'See what the yield was before the price moved',
    ],
  },
  {
    words: ['expense ratio', 'fee', 'fees', 'ongoing charge'],
    title: 'What a fund fee costs',
    body:
      'A fund’s expense ratio is what it deducts each year for running itself. It is taken out of the fund rather than billed to you, so it never appears as a payment. At 0.2% that is 2 a year per 1,000 invested; at 1.5% it is fifteen.',
    catch:
      'It is charged whether the fund rose or fell, and it compounds against you exactly as returns compound for you. Across thirty years the gap between 0.2% and 1.5% takes a large fraction of the final amount.',
    next: [
      'Compare two funds holding the same index at different fees',
      'See what a fee costs over a thirty-year horizon',
      'Read what an ETF is',
    ],
  },
  {
    words: ['liquidity', 'liquid'],
    title: 'What liquidity means',
    body:
      'Liquidity is how easily something turns into cash at close to the price you can see. A large listed share is liquid; a flat is not; a small fund sits somewhere between.',
    catch:
      'Liquidity is most abundant when nobody needs it and thinnest when everybody wants it at once. Something priced every day is not the same as something you can sell every day at that price.',
    next: [
      'See how much of a holding trades on a normal day',
      'Read what the gap between buy and sell prices costs',
      'Compare a broad fund against a narrow one',
    ],
  },
  {
    words: ['volume'],
    title: 'What volume shows',
    body:
      'Volume is how much changed hands over a period. It measures activity, not agreement — every unit sold was also bought by somebody who took the other view.',
    catch:
      'A move on thin volume is weaker evidence than the same move on heavy volume, and neither is evidence about what happens next. Volume describes what has already been decided.',
    next: [
      'See how volume behaved around the last results',
      'Read what liquidity means for the price you get',
      'Compare volume across two similar companies',
    ],
  },
  {
    words: ['earnings', 'eps', 'profit', 'profits'],
    title: 'What earnings are',
    body:
      'Earnings are what a company kept after paying everything — costs, interest and tax. Earnings per share divides that by the number of shares, so it is the slice belonging to one share you own.',
    catch:
      'Earnings are an accounting figure rather than money in the bank, and the rules leave real room for judgement. A company can report a profit while burning cash, which is precisely why the cash-flow statement exists alongside it.',
    next: [
      'Compare earnings against free cash flow',
      'Read what the price-to-earnings ratio says',
      'See how estimates compared with what arrived',
    ],
  },
  {
    words: ['revenue', 'turnover', 'top line'],
    title: 'What revenue is, and is not',
    body:
      'Revenue is everything a company took in before any cost is subtracted. It is the top line. Profit is whatever survives the journey to the bottom one.',
    catch:
      'Revenue growing with no route to profit is a business getting bigger without getting better. Two companies reporting identical revenue can be in entirely different health, and the difference is invisible from this number alone.',
    next: [
      'Compare revenue growth against profit growth',
      'Read what earnings are',
      'See where the revenue comes from by country',
    ],
  },
  {
    words: ['beta'],
    title: 'What beta measures',
    body:
      'Beta describes how much something has moved relative to a wider market. A beta of 1 moved with it, 1.5 moved half again as much in both directions, and below 1 moved less.',
    catch:
      'It is a description of the past, measured against one index. A low beta does not mean safe — it means it did not follow that particular market closely, which can be its own kind of exposure.',
    next: [
      'Compare how two holdings moved against the same index',
      'Read what correlation means',
      'See what a drawdown adds to this picture',
    ],
  },
  {
    words: ['correlation', 'correlated'],
    title: 'What correlation means',
    body:
      'Correlation is whether two things tend to move together. It runs from +1, always the same direction, through 0, no relationship, to −1, reliably opposite. It is the number sitting underneath diversification.',
    catch:
      'Correlations are not fixed. Things that behaved independently for years have a habit of moving together in the worst month — which is exactly the month the separation was supposed to help.',
    next: [
      'See how two holdings moved in the same bad year',
      'Read what diversification does',
      'Compare assets that historically moved apart',
    ],
  },
  {
    words: ['drawdown'],
    title: 'What a drawdown shows',
    body:
      'A drawdown is the fall from a peak to the low that followed it, as a percentage. Maximum drawdown is the worst one over a period — the deepest hole somebody holding it had to sit through.',
    catch:
      'It is worth reading before any return figure, because it is the number that decides whether a person sells. Recovering from a 50% fall needs a 100% rise, and the arithmetic is not symmetrical.',
    next: [
      'See the worst fall this holding has had',
      'Compare drawdowns across asset classes',
      'Read what volatility measures instead',
    ],
  },
  {
    words: ['rebalancing', 'rebalance'],
    title: 'What rebalancing is for',
    body:
      'Rebalancing is trimming what has grown and topping up what has not, so a portfolio returns to the proportions you chose. It is the mechanism by which a plan stays the plan rather than drifting into whatever did best.',
    catch:
      'It means selling the thing that is doing well, which feels wrong and is the entire point. It also costs something in fees and possibly tax, so doing it constantly is a different mistake from never doing it.',
    next: [
      'See how a portfolio drifts when nothing is rebalanced',
      'Read what diversification does',
      'Try it in a practice portfolio',
    ],
  },
  {
    words: ['broker', 'brokers', 'brokerage'],
    title: 'What a broker does',
    body:
      'A broker holds your account and places your orders on an exchange. You do not deal with the exchange yourself, which is why the choice of broker is a decision rather than a formality.',
    catch:
      'Fees are the smallest part of what separates them. What matters when something goes wrong is where the assets are held, whose name they are held in, and which protection scheme covers them — questions worth asking before there is a problem.',
    next: [
      'Read what to check before opening an account',
      'Compare how costs are charged, not just how large they are',
      'See what happens to holdings if a broker fails',
    ],
  },
  {
    words: ['ticker'],
    title: 'What a ticker is',
    body:
      'A ticker is the short code identifying an instrument on a specific exchange — AAPL on Nasdaq. Prices are always quoted per exchange, which is why the exchange belongs in the name rather than beside it.',
    catch:
      'One company can trade under different tickers in different places and currencies, and those prices will not match exactly. Similar codes belonging to unrelated companies is a real mix-up, and an expensive one.',
    next: [
      'Search for a company and see its listings',
      'Compare the same company on two exchanges',
      'Read what an exchange actually does',
    ],
  },
  {
    words: ['coupon', 'maturity'],
    title: 'What a coupon and a maturity date are',
    body:
      'A coupon is the fixed interest a bond pays each year, set when it was issued. Maturity is the date the borrowed amount is due back. Together they are the schedule you are buying.',
    catch:
      'The coupon is fixed; the yield is not, because the price moves underneath it. And the further away the maturity date, the more the price swings when interest rates change — a long bond is a more volatile holding than its fixed schedule suggests.',
    next: [
      'Compare short and long bonds when rates moved',
      'Read what a bond is',
      'See what a yield is',
    ],
  },
];

/** "What is…", "how does…", "explain…", "what is the difference between…" */
function asksForAnExplanation(padded: string): boolean {
  const openers = [
    ' what is ',
    ' what are ',
    ' whats ',
    ' how does ',
    ' how do ',
    ' how is ',
    ' what does ',
  ];
  if (openers.some((opener) => padded.includes(opener))) return true;
  return [' explain ', ' difference ', ' means ', ' meaning '].some((word) =>
    padded.includes(word)
  );
}

function conceptFor(padded: string): Concept | null {
  return (
    CONCEPTS.find((concept) =>
      concept.words.some((word) => padded.includes(` ${word} `))
    ) ?? null
  );
}

function conceptIn(padded: string): boolean {
  return conceptFor(padded) !== null;
}

/**
 * The educational answer.
 *
 * Built from the table above, with the question repeated at the top: the person
 * has to be able to see what was asked on their behalf, especially when the
 * question arrived in a URL rather than from their keyboard.
 *
 * When the concept is not one this table covers, the scenario says so. A demo
 * that invents a definition of something it has never been taught is worse than
 * a demo that admits the gap.
 */
function explainFor(question: string): unknown {
  const padded = ` ${question.toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;

  /*
   * An exact match against a question the product itself offers comes first.
   *
   * Every "Try asking" chip on Explore is in that library with an answer
   * written for it. Falling through to the concept table would answer "Are ETFs
   * suitable for beginners?" with the definition of an ETF — related, and not
   * what was asked.
   */
  const written = findAnswer(question);
  if (written) {
    return {
      mode: 'learn',
      because: 'this is a question the product offers, and it has a written answer',
      steps: ['Read the request as a question about a concept', 'Find the written answer'],
      work: [{ id: 'w1', label: 'Finding the written answer', done: false }],
      sources: [
        {
          id: 'src_academy',
          kind: 'EDUCATIONAL',
          provider: 'TradingNew Learn',
          at: NOW,
          detail: 'Written lesson material, reviewed',
        },
      ],
      assumptions: [],
      modules: [
        {
          id: 'm_asked',
          kind: 'text-insight',
          title: 'You asked',
          provenance: ['educational'],
          sourceIds: [],
          data: { body: written.question },
          actions: [],
        },
        {
          id: 'm_answer',
          kind: 'text-insight',
          title: 'The short answer',
          provenance: ['educational'],
          sourceIds: ['src_academy'],
          data: { body: written.answer },
          actions: [{ id: 'save_workspace', label: 'Save this explanation', mutates: true }],
        },
      ],
    };
  }

  const concept = conceptFor(padded);

  if (!concept) {
    return {
      mode: 'learn',
      because: 'you asked to have something explained rather than analysed',
      steps: ['Read the request as a question about a concept', 'Look for a written explanation'],
      work: [{ id: 'w1', label: 'Looking for a written explanation', done: false }],
      sources: [],
      assumptions: [],
      modules: [
        {
          id: 'm_gap',
          kind: 'text-insight',
          title: 'I do not have a written explanation of that yet',
          provenance: ['educational'],
          sourceIds: [],
          data: {
            body:
              'This demo answers a fixed set of concepts — ETFs, bonds, inflation, diversification and dividends — from explanations that were written and checked. Rather than assemble a definition of something nobody has checked, it says so. The lessons cover more ground than this list does.',
          },
          actions: [],
        },
      ],
    };
  }

  return {
    mode: 'learn',
    because: 'you asked what something is rather than what the market did',
    steps: [
      'Read the request as a question about a concept',
      'Find the written explanation',
      'Add what the explanation usually leaves out',
    ],
    work: [
      { id: 'w1', label: 'Finding the written explanation', done: false },
      { id: 'w2', label: 'Adding the part that usually gets left out', done: false },
    ],
    sources: [
      {
        id: 'src_academy',
        kind: 'EDUCATIONAL',
        provider: 'TradingNew Learn',
        at: NOW,
        detail: 'Written lesson material, reviewed',
      },
    ],
    assumptions: [],
    modules: [
      {
        id: 'm_asked',
        kind: 'text-insight',
        title: 'You asked',
        provenance: ['educational'],
        sourceIds: [],
        data: { body: question.trim() },
        actions: [],
      },
      {
        id: 'm_explain',
        kind: 'text-insight',
        title: concept.title,
        provenance: ['educational'],
        sourceIds: ['src_academy'],
        data: { body: concept.body },
        /* An action the workspace actually knows. Inventing an id here would
           render a button that does nothing when pressed. */
        actions: [{ id: 'save_workspace', label: 'Save this explanation', mutates: true }],
      },
      {
        id: 'm_catch',
        kind: 'text-insight',
        /* The half that gets left out of most explanations, and the half that
           costs people money. It is a separate module so it cannot be skimmed
           past as a caveat at the end of a paragraph. */
        title: 'What that leaves out',
        provenance: ['educational'],
        sourceIds: ['src_academy'],
        data: { body: concept.catch },
        actions: [],
      },
      {
        id: 'm_next',
        kind: 'next-actions',
        title: 'Where to look next',
        provenance: ['educational'],
        sourceIds: [],
        data: { items: concept.next },
        actions: [],
      },
    ],
  };
}

/**
 * The market summary, written as the response a model would have to produce.
 *
 * Every claim carries a source with a provider and a timestamp, because the
 * contract refuses one that does not — including the ones written here. The
 * interpretation is labelled as interpretation and kept apart from the
 * measurement it rests on.
 */
const MARKET: unknown = {
  mode: 'analyse',
  because: 'you asked what the market did rather than what to do about it',
  steps: [
    'Read the request as a market summary',
    'Fetch index levels and sector moves',
    'Find the largest movers',
    'Write the summary with its sources',
  ],
  work: [
    { id: 'w1', label: 'Reading index levels', done: false },
    { id: 'w2', label: 'Comparing 11 sectors', done: false },
    { id: 'w3', label: 'Finding the largest movers', done: false },
  ],
  sources: [
    {
      id: 'src_quotes',
      kind: 'MARKET DATA',
      provider: 'Twelve Data',
      at: NOW,
      detail: 'Index and sector levels',
      delayed: true,
    },
    {
      id: 'src_macro',
      kind: 'ESTIMATES',
      provider: 'FRED',
      at: '2026-08-01T12:00:00Z',
      detail: 'CPI series, monthly',
    },
  ],
  assumptions: [
    { id: 'a_window', label: 'Window', value: 'Today’s session', editable: true },
    { id: 'a_universe', label: 'Universe', value: 'US large cap', editable: true },
  ],
  modules: [
    {
      id: 'm_headline',
      kind: 'metric-row',
      title: 'Where the US market closed',
      subtitle: 'Delayed by 15 minutes on this plan',
      provenance: ['market-data'],
      sourceIds: ['src_quotes'],
      data: {
        metrics: [
          { label: 'S&P 500', value: '5 412.30', sign: -1 },
          { label: 'Nasdaq 100', value: '18 902.10', sign: -1 },
          { label: 'Dow Jones', value: '39 118.40', sign: 1 },
          { label: 'VIX', value: '16.2', sign: 1 },
        ],
      },
      actions: [{ id: 'open_chart', label: 'Open in Supercharts', mutates: false }],
    },
    {
      id: 'm_movers',
      kind: 'ranked-rows',
      title: 'What moved most',
      provenance: ['market-data'],
      sourceIds: ['src_quotes'],
      data: {
        rows: [
          { name: 'NVDA', note: 'Semiconductors', value: '−4.1%', sign: -1 },
          { name: 'AVGO', note: 'Semiconductors', value: '−3.4%', sign: -1 },
          { name: 'XOM', note: 'Energy', value: '+2.2%', sign: 1 },
          { name: 'JNJ', note: 'Healthcare', value: '+1.4%', sign: 1 },
        ],
      },
      actions: [{ id: 'watchlist', label: 'Create a watchlist', mutates: true }],
    },
    {
      id: 'm_read',
      kind: 'text-insight',
      title: 'How to read this',
      /*
       * Interpretation, labelled as interpretation and separated from the
       * measurement above it. The two carry different provenance for exactly
       * this reason.
       */
      provenance: ['inference', 'educational'],
      sourceIds: ['src_macro'],
      data: {
        body:
          'The fall is concentrated in semiconductors rather than spread across technology, and the defensive sectors rose. That pattern is consistent with positioning moving out of one crowded trade rather than with a broad change in risk appetite — but this is a reading of one session, and one session is not a trend. Nothing here says what will happen next.',
      },
      actions: [],
    },
    {
      id: 'm_next',
      kind: 'next-actions',
      title: 'Where to look next',
      provenance: ['educational'],
      sourceIds: [],
      data: {
        items: [
          'Compare NVIDIA, AMD and Broadcom over three months',
          'Check whether the move shows up in volume as well as price',
          'Set a rule to watch semiconductors and tell you if it continues',
        ],
      },
      actions: [],
    },
  ],
};

const SCENARIOS: Record<string, unknown> = {
  market: MARKET,
  selloff: SELLOFF,
  compare: COMPARE,
  chart: CHART,
  screen: SCREEN,
  portfolio: PORTFOLIO,
  monitor: MONITOR,
  beginner: BEGINNER,
  gold: GOLD,
  pine: PINE,
};

/**
 * Every scenario the workspace can answer, for the tests that check them all.
 *
 * `explain` is listed by hand because it is not in `SCENARIOS` — it is built per
 * question rather than looked up, and a test that walked only the record would
 * have left the one branch a beginner is most likely to hit unchecked.
 */
export const SCENARIO_IDS = [...Object.keys(SCENARIOS), 'explain'];

/** The raw response for a question, or null where the scenario is not written yet. */
export function responseFor(question: string): unknown | null {
  const id = scenarioFor(question);
  if (!id) return null;
  // The explanation depends on which concept was named, so it is built rather
  // than looked up. Everything else is one fixed response per scenario.
  if (id === 'explain') return explainFor(question);
  return SCENARIOS[id] ?? null;
}

export type { VoyagerPlan };
