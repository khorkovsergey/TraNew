import { VOYAGER_ACTION_SPECS, type VoyagerActionId } from './actions';

/**
 * What this portal contains, read off the portal.
 *
 * Voyager has to answer questions about TradingNew itself — where the paid
 * courses are, what the difference between Learn and Academy is, whether
 * something exists yet. The tempting way to do that is a paragraph in the
 * system prompt, and it is the wrong way twice over: it cannot be tested, and
 * it goes stale the day a section ships or moves. What it produces is an
 * assistant confidently recommending a screen that was renamed last month.
 *
 * So this derives from two things that are already true:
 *
 * - **The header menus**, which the shell section maintains and which carry the
 *   real availability. Their own rule is that a row is either a link or marked
 *   `Coming soon`, never both — an announced-but-unbuilt row is `inert` and does
 *   not click. That distinction is exactly the one Voyager must not blur, and
 *   reading it from the menu means it cannot drift out of step with what a
 *   person sees in the header.
 * - **The action registry**, which is the only way Voyager navigates anywhere.
 *   A destination Voyager can name is a destination it can also open.
 *
 * The descriptions are Voyager's own, because a menu row's `sub` is written to
 * be read beside its label rather than to answer "what is this for". They are
 * the one hand-written thing here, and they describe sections rather than
 * routes, so a moved page does not falsify them.
 *
 * **This reads shell's data and never writes it.** If the menu needs a new row,
 * that is a request to the shell section, not an edit from here — and the menu
 * arrives as an argument rather than an import, so this table stays pure and
 * testable while the coupling lives in one thin module beside it.
 */

/** The shape this needs from the header menu, and nothing more of it. */
export type MenuRow = { label: string; kind: string };

export type SectionStatus = 'available' | 'coming_soon';

export type PortalSection = {
  id: string;
  label: string;
  /** What it is for, in one line, in the reader's terms. */
  purpose: string;
  status: SectionStatus;
  /** How Voyager opens it, when it can. */
  action?: VoyagerActionId;
  /** Distinctions people actually ask about. */
  notToBeConfusedWith?: string;
};

/**
 * The sections Voyager is asked about, with the action that opens each.
 *
 * Availability is not written here — it is looked up in the menu below, so a
 * row that the shell section marks `Coming soon` is reported as coming soon
 * without anybody remembering to change this file.
 */
const SECTIONS: Omit<PortalSection, 'status'>[] = [
  {
    id: 'academy',
    label: 'Academy',
    purpose:
      'Structured courses that build up over time, including the paid catalogue in the marketplace.',
    action: 'open_academy',
    notToBeConfusedWith:
      'Learn is the free explanatory material you read once; Academy is a course you work through.',
  },
  {
    id: 'learn',
    label: 'Learn',
    purpose: 'Free explanations of concepts and terms, read in any order.',
    action: 'open_academy',
    notToBeConfusedWith:
      'Academy is the structured, sometimes paid course catalogue; Learn is the free reference beside it.',
  },
  {
    id: 'experts',
    label: 'Expert Services',
    purpose: 'People you can hire — advisers, analysts, tax specialists — and a way to brief them.',
    action: 'open_experts',
  },
  {
    id: 'explore',
    label: 'Explore',
    purpose: 'What each asset class is and what it risks, without prices.',
    action: 'open_explore',
    notToBeConfusedWith:
      'Compare assets is for named instruments side by side; Explore is for deciding which kind of thing to hold at all.',
  },
  {
    id: 'markets',
    label: 'Market Overview',
    purpose: 'Live prices, movers and market hours — the screen with numbers on it.',
    action: 'open_explore',
    notToBeConfusedWith:
      'Explore teaches what an asset class is; Market Overview shows what it is doing today.',
  },
  {
    id: 'supercharts',
    label: 'Supercharts',
    purpose: 'The full chart workspace: studies, drawings, layouts and Pine.',
    action: 'open_chart',
  },
  {
    id: 'compare',
    label: 'Compare assets',
    purpose: 'Two to five instruments side by side over one period, rebased so they read together.',
    action: 'open_market_compare',
    notToBeConfusedWith:
      'Explore compares kinds of investment — what a bond is against what an ETF is. Compare assets puts named instruments next to each other.',
  },
  {
    id: 'news',
    label: 'News',
    purpose: 'What happened, and what it did to prices.',
    action: 'open_news',
  },
  {
    id: 'economy',
    label: 'Economy',
    purpose: 'Macro indicators, their releases and what moves with them.',
    action: 'open_economy',
  },
  {
    id: 'events',
    label: 'Events',
    purpose: 'Talks, workshops and sessions, online and in person.',
    action: 'open_events',
  },
  {
    id: 'ideas',
    label: 'Ideas',
    purpose: 'Published arguments about instruments, with the reasoning shown.',
    action: 'open_explore',
  },
  {
    id: 'practice',
    label: 'Practice portfolio',
    purpose: 'A portfolio with simulated money and real prices.',
    action: 'open_practice',
  },
  {
    id: 'workspace',
    label: 'My Workspace',
    purpose: 'What you saved: symbols, research, alert drafts.',
    action: 'open_watchlist',
  },
  {
    id: 'wealth',
    label: 'Wealth Hub',
    purpose: 'Your own holdings and what they add up to, on the plan that reads them.',
    action: 'open_wealth',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    purpose: 'Questions that turn into a plan.',
    action: 'open_strategy',
  },
  {
    id: 'research',
    label: 'Research workspace',
    purpose: 'A saved session: question, evidence, conclusion.',
    action: 'open_research',
  },
];

/* ------------------------------------------------- Availability, from shell */

/**
 * Whether a labelled destination is built.
 *
 * The menu's own invariant does the work: a row that goes somewhere is
 * `kind: 'route'`, and a row that names something unbuilt is `inert` and marked
 * `Coming soon`. Anything the menu does not mention at all is judged by whether
 * Voyager has an action for it — every action in the registry resolves to a
 * route that exists.
 */
export function statusOf(label: string, hasAction: boolean, menu: MenuRow[]): SectionStatus {
  const needle = label.trim().toLowerCase();
  const matches = menu.filter((row) => row.label.trim().toLowerCase() === needle);

  if (matches.length > 0) {
    return matches.some((row) => row.kind === 'route') ? 'available' : 'coming_soon';
  }

  return hasAction ? 'available' : 'coming_soon';
}

/** Every section Voyager can talk about, with real availability attached. */
export function portalSections(menu: MenuRow[]): PortalSection[] {
  return SECTIONS.map((section) => ({
    ...section,
    status: statusOf(section.label, Boolean(section.action), menu),
  }));
}

/**
 * One section, or null.
 *
 * Matched on the id and the label rather than fuzzily: the planner picks from
 * the ids this module publishes, so there is nothing to guess at.
 */
export function portalSection(id: unknown, menu: MenuRow[]): PortalSection | null {
  if (typeof id !== 'string') return null;
  const needle = id.trim().toLowerCase();
  return (
    portalSections(menu).find(
      (section) => section.id === needle || section.label.toLowerCase() === needle
    ) ?? null
  );
}

export const PORTAL_SECTION_IDS = SECTIONS.map((section) => section.id);

/**
 * The sections as one line each, for the planner.
 *
 * Availability is stated on every row, because the failure this exists to
 * prevent is Voyager recommending something announced but unbuilt as though it
 * were a place somebody could go today.
 */
export function describeSections(sections: PortalSection[]): string {
  return sections
    .map((section) => {
      const where =
        section.status === 'available' && section.action
          ? `open with ${section.action}`
          : 'COMING SOON — announced, not built, do not offer it as somewhere to go';
      return `${section.label}: ${section.purpose} (${where})`;
    })
    .join('\n');
}

/** Which of Voyager's actions actually resolve to something built. */
export function availableActions(menu: MenuRow[]): VoyagerActionId[] {
  const sections = portalSections(menu);
  return (Object.keys(VOYAGER_ACTION_SPECS) as VoyagerActionId[]).filter((id) => {
    const section = sections.find((entry) => entry.action === id);
    return !section || section.status === 'available';
  });
}
