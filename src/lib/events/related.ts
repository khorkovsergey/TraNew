/**
 * The seam between Events and the rest of the product.
 *
 * Events is only worth having if it is connected to everything else — an event
 * page that suggests the lesson explaining it, a lesson that suggests the webinar
 * going deeper, a symbol page that knows there is a session about it on Thursday.
 * This module owns those mappings so each side imports one small thing rather
 * than knowing about the other's data model.
 *
 * Pure and table-driven on purpose. A similarity score would be less accurate and
 * impossible to correct when it was wrong.
 */

export type LessonLink = { slug: string; title: string };

/** Academy lessons that prepare someone for an event on a given topic. */
const TOPIC_TO_LESSONS: Record<string, LessonLink[]> = {
  'Investing basics': [
    { slug: 'why-people-invest', title: 'Why people invest' },
    { slug: 'what-is-a-stock', title: 'What is a stock' },
  ],
  Macroeconomics: [
    { slug: 'inflation-explained', title: 'Inflation, explained' },
    { slug: 'interest-rates', title: 'How interest rates move markets' },
  ],
  ETFs: [{ slug: 'what-is-an-etf', title: 'What is an ETF' }],
  Stocks: [{ slug: 'what-is-a-stock', title: 'What is a stock' }],
  'Portfolio construction': [
    { slug: 'diversification', title: 'Diversification without the jargon' },
  ],
  'Risk management': [{ slug: 'risk-and-return', title: 'Risk and return' }],
  'Technical analysis': [{ slug: 'reading-a-chart', title: 'Reading a chart' }],
  'Options and derivatives': [{ slug: 'what-is-an-option', title: 'What is an option' }],
  'Personal finance': [{ slug: 'building-a-buffer', title: 'Building a cash buffer' }],
  'Crypto and digital assets': [{ slug: 'digital-assets', title: 'Digital assets, soberly' }],
};

export function relatedLessons(topics: string[]): LessonLink[] {
  const seen = new Map<string, LessonLink>();

  for (const topic of topics) {
    for (const lesson of TOPIC_TO_LESSONS[topic] ?? []) {
      if (!seen.has(lesson.slug)) seen.set(lesson.slug, lesson);
    }
  }

  return [...seen.values()].slice(0, 3);
}

/** The reverse: which event topics follow on from a lesson someone finished. */
export function topicsForLesson(slug: string): string[] {
  const topics: string[] = [];

  for (const [topic, lessons] of Object.entries(TOPIC_TO_LESSONS)) {
    if (lessons.some((lesson) => lesson.slug === slug)) topics.push(topic);
  }

  return topics;
}

/**
 * Which event topics a symbol belongs to, so a symbol page can offer the
 * sessions that are actually about it.
 */
export function topicsForSymbol(ticker: string): string[] {
  const upper = ticker.toUpperCase();

  if (['BTC', 'ETH', 'SOL'].includes(upper)) return ['Crypto and digital assets'];
  if (['SPX', 'NDX', 'DAX', 'VOO', 'SPY'].includes(upper)) return ['ETFs', 'Macroeconomics'];
  if (['GOLD', 'XAU', 'OIL'].includes(upper)) return ['Macroeconomics'];
  return ['Stocks', 'Investing basics'];
}
