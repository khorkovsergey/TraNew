/**
 * Written answers to the questions the Explore tabs offer.
 *
 * Every question in "Try asking", on every tab, has an answer here. The tabs
 * were offering eighteen questions and the assistant could answer none of them
 * — each one produced the market summary, which is how somebody asking whether
 * ETFs suit a beginner was told where the S&P closed.
 *
 * A written table, not a generator. These are claims about how money works,
 * made to somebody who came to be taught. Two of them deliberately refuse to
 * answer the question as put — the tax one, because the honest answer depends
 * on a jurisdiction nobody told us, and "how much crypto", because a number
 * there would be advice.
 *
 * Dependency-free, so the routing can be tested without a browser.
 */

export type Answer = {
  /** The question, exactly as the UI offers it. Matching is on this, normalised. */
  question: string;
  answer: string;
};

export const EXPLORE_ANSWERS: Answer[] = [
  /* ---- Stocks ---- */
  {
    question: 'Are single stocks risky for beginners?',
    answer:
      'Riskier than a fund holding the same kind of companies, yes — not because beginners choose badly, but because one company can lose most of its value for reasons no amount of research would have caught. The risk is concentration rather than inexperience. Holding one company means that company decides your result; holding a broad fund means no single one of them can.',
  },
  {
    question: 'How many stocks would I need to own?',
    answer:
      'Most of the benefit of spreading arrives by about twenty holdings, provided they are not all in the same industry — twenty banks is one bet written twenty times. Below ten, a single company still moves your total noticeably. A broad fund gets you past that threshold in one purchase, which is why it is the usual answer for somebody who does not want to research twenty businesses.',
  },
  {
    question: 'Stocks or ETFs — where would I start?',
    answer:
      'A broad ETF, for almost anyone starting out. It answers the question a beginner actually has, which is not "which company" but "how do I stop it mattering which company". Single stocks are worth owning once you want to act on a view about a specific business and can afford to be wrong about it.',
  },

  /* ---- ETFs ---- */
  {
    question: 'What is the difference between an ETF and a stock?',
    answer:
      'A stock is a share in one company. An ETF is one thing you buy that holds many of them — often every company in an index. Both trade on an exchange and both take the same click to buy. The difference is what happens when one business fails: in a stock it is your whole holding, in a broad ETF it is a fraction of a per cent.',
  },
  {
    question: 'Are ETFs suitable for beginners?',
    answer:
      'A broad, low-cost one usually is, and it is the most common starting point for that reason. But "ETF" describes a wrapper, not a level of risk — a fund holding one country’s smallest companies, or one industry, is not a safe investment because it is a fund. The two things worth checking are what it holds and what it charges each year.',
  },
  {
    question: 'How are ETFs taxed where I live?',
    answer:
      'That depends on where you are tax-resident, and this demo does not know that — so rather than invent a rate, here is what generally decides it: whether the fund pays income out or reinvests it, where the fund is domiciled, how long you hold it, and whether your country taxes gains on sale or on an assumed yearly return. Those four questions are what a local tax guide or an accountant will ask you. This is not tax advice and cannot be.',
  },

  /* ---- Bonds ---- */
  {
    question: 'How does a bond actually pay interest?',
    answer:
      'On a schedule fixed when the bond is issued — typically twice a year, as a percentage of the original amount rather than of what you paid. At the end of the term the original amount comes back. That is why the yield you actually get depends on the price you bought at: the payments do not change, so paying less for the same stream means earning more from it.',
  },
  {
    question: 'What happens to my bonds when rates rise?',
    answer:
      'The price of the ones you already hold falls. A new bond paying more makes an old one paying less worth less to anybody buying it today. If you hold to maturity you still receive the payments and the original amount; the loss is only real if you sell early. The longer the remaining term, the further the price moves.',
  },
  {
    question: 'Government or corporate — what is the difference?',
    answer:
      'Who owes you the money, and how likely they are to pay. A government borrowing in its own currency is the least likely borrower to default and pays the least for it. A company pays more because it can fail. The extra yield is the price of that risk, and in a bad year it is not free money — it is the year the risk shows up.',
  },

  /* ---- Cash ---- */
  {
    question: 'How much cash should I keep aside?',
    answer:
      'The common rule is three to six months of essential spending, and the useful version of it is narrower: enough that an unexpected bill does not force you to sell an investment at whatever price the market happens to be offering that week. That is the job cash is doing. The right number depends on how steady your income is and on what you would otherwise have to sell.',
  },
  {
    question: 'What is a high-yield savings account?',
    answer:
      'An ordinary deposit account paying a rate closer to the central bank’s than a current account does. The money is not invested and the number does not fall. Two things to check: whether the headline rate is an introductory one that drops after a few months, and whether the balance is inside your country’s deposit guarantee.',
  },
  {
    question: 'Does inflation really eat my savings?',
    answer:
      'Yes, and the mechanism is easy to miss because the number never falls. At 3% a year, money left alone buys roughly a quarter less after ten years. Cash cannot lose value and can still leave you worse off — which is why "safe" and "no risk" are not the same thing, and why a reserve is the right size rather than as large as possible.',
  },

  /* ---- Crypto ---- */
  {
    question: 'Is crypto too risky for someone starting out?',
    answer:
      'Falls of 70% or more have happened repeatedly and taken years to recover, when they recovered at all. There is no earnings figure underneath the price to anchor a valuation to, so there is no level at which it is obviously cheap. That does not make it unownable; it makes it the last thing to add rather than the first, and only in an amount that losing entirely would not change any plan you have.',
  },
  {
    question: 'What is Bitcoin, in plain terms?',
    answer:
      'A digital record of who owns what, kept by a network of computers rather than a bank, with a supply limited by its own rules. It pays no interest and produces nothing; its price is entirely what buyers and sellers agree on. People hold it for scarcity and for its independence from any government — those are the arguments, and neither is a guarantee.',
  },
  {
    question: 'How much of a portfolio would be sensible?',
    answer:
      'This demo will not name a number, because the honest one depends on your circumstances and a figure from a page that has never met you is advice dressed as information. The test worth applying instead: pick an amount you could watch fall by 80% without changing anything else you had planned. If no such amount exists, the answer for now is none.',
  },

  /* ---- Property ---- */
  {
    question: 'What is a REIT?',
    answer:
      'A listed company that owns income-producing buildings and is required to hand most of its rental profit to shareholders. It gives you property exposure at the price of a share rather than the price of a building, and you can sell it in a day. The trade-off is that the price moves daily like a share, including on days when nothing about the buildings changed.',
  },
  {
    question: 'Property or an ETF, over ten years?',
    answer:
      'They are not really rivals — one is a category, the other a wrapper, and you can hold property inside an ETF. The real difference is leverage and liquidity: direct property is usually bought with a mortgage, which magnifies both outcomes, and it takes months to sell. A broad ETF magnifies nothing and sells in a day. Which suits you depends far more on those two facts than on any expected return.',
  },
  {
    question: 'How much would I need to start?',
    answer:
      'Directly, a deposit plus the costs of buying — which in most markets is several per cent of the price and takes years of rent to recover. Through a listed fund, the price of one share. That gap is the main reason listed property exists, and it is why the same asset can be either the largest commitment somebody makes or a routine purchase.',
  },
];

/** Normalised for matching: case, punctuation and spacing all discarded. */
function normalise(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const BY_QUESTION = new Map(EXPLORE_ANSWERS.map((entry) => [normalise(entry.question), entry]));

/** The written answer to this exact question, or null when there is none. */
export function findAnswer(question: string): Answer | null {
  return BY_QUESTION.get(normalise(question)) ?? null;
}

/**
 * The answer text, for a question that came from the UI's own list.
 *
 * Throws nothing and invents nothing: an unknown question returns a line that
 * says so, which is the right thing to render in a FAQ that was assembled from
 * a list somebody edited without adding the answer.
 */
export function answerFor(question: string): string {
  return (
    findAnswer(question)?.answer ??
    'This one does not have a written answer yet. Ask Voyager and it will say the same rather than improvise.'
  );
}

/** Every question the library can answer, for the tests that walk them all. */
export const ANSWERED_QUESTIONS = EXPLORE_ANSWERS.map((entry) => entry.question);
