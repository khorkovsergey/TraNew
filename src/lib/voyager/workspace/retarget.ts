/**
 * Plotting the instrument that was asked for.
 *
 * The build scenario is written about Tesla — its title, its work log and, most
 * importantly, its summary, which names prices: "fell from roughly 372 in
 * February to a low near 252 in late May". Asked for an Nvidia chart, it drew
 * Tesla and called it nothing else, so the answer was somebody else's stock
 * wearing the right question.
 *
 * Swapping the ticker alone would be worse, not better: Tesla's numbers under
 * Nvidia's name is a fabricated claim about a real company. So a retarget takes
 * the symbol *and* drops every sentence that asserted a price, leaving what is
 * still true — the interval, the studies, and that the levels were detected
 * rather than given.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`.
 */

/** What the scripted build scenario was written about. */
export const SCRIPTED_SYMBOL = 'TSLA';

/**
 * Companies somebody names in a sentence, and the ticker they mean.
 *
 * A short list on purpose. Guessing a ticker from a word is how "Could you
 * chart apple" becomes AAPL when somebody meant the fruit in a lesson about
 * commodities — every entry here has to be a name that only means the company.
 */
const NAMES: Record<string, string> = {
  nvidia: 'NVDA',
  tesla: 'TSLA',
  apple: 'AAPL',
  microsoft: 'MSFT',
  amazon: 'AMZN',
  netflix: 'NFLX',
  broadcom: 'AVGO',
  ericsson: 'ERIC',
  bitcoin: 'BTCUSD',
  ethereum: 'ETHUSD',
};

/** Tickers we will accept written directly, so "chart NVDA" works too. */
const TICKERS = new Set(Object.values(NAMES).concat(['AMD', 'LLY', 'SPX', 'NDX', 'DAX']));

/**
 * The instrument a question is about, or null when it does not name one.
 *
 * Names are matched before bare tickers: "chart Tesla" and "chart TSLA" are the
 * same request, and the name is what people actually type.
 */
export function symbolIn(question: string): string | null {
  const lower = question.toLowerCase();
  for (const [name, ticker] of Object.entries(NAMES)) {
    if (lower.includes(name)) return ticker;
  }

  for (const word of question.split(/[^A-Za-z]+/)) {
    if (word.length >= 2 && TICKERS.has(word.toUpperCase())) return word.toUpperCase();
  }

  return null;
}

type Module = {
  kind: string;
  title?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

type Plan = { modules: Module[]; work?: { label: string; [k: string]: unknown }[] };

/**
 * Points the scripted build answer at the instrument that was asked for.
 *
 * Returns the plan unchanged when the question names nothing, or names the one
 * the scenario was written about — there is nothing to correct then, and the
 * written prose is accurate.
 */
export function retargetChart<T extends Plan>(plan: T, question: string): T {
  const symbol = symbolIn(question);
  if (!symbol || symbol === SCRIPTED_SYMBOL) return plan;

  return {
    ...plan,
    work: plan.work?.map((step) => ({
      ...step,
      label: step.label.replace(/Tesla/gi, symbol),
    })),
    modules: plan.modules.map((module) => {
      if (module.kind !== 'chart') return module;

      return {
        ...module,
        title: `${symbol}, daily, with RSI and detected levels`,
        data: {
          ...module.data,
          symbol,
          /*
           * The price narrative goes, rather than being renamed. It described
           * Tesla's year, and there is no version of moving it to another
           * company that is not an invented claim about that company.
           */
          summary:
            `Daily bars for ${symbol} over the last year, with a 14-period RSI below and ` +
            `three horizontal levels the detector found. The series shown here is generated ` +
            `rather than a market feed, so read the shape and the levels, not the numbers.`,
        },
      };
    }),
  };
}
