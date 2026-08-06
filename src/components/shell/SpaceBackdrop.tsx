/**
 * The space image behind a screen.
 *
 * Rendered by the page rather than the layout, because which sky a screen gets
 * is part of that screen's design and a layout in the App Router cannot see
 * which page it is wrapping. Doing it from a client hook would mean the first
 * paint carries the previous screen's image.
 *
 * The mapping is the handoff's: 1 Home/My TradingNew/Experts · 2 Start/Learn/
 * Supercharts · 3 Voyager/Sign in · 4 Explore/Events · 5 Compare/News/Practice ·
 * 6 ETF/Plans/My Money.
 */
export type SpaceTone = 1 | 2 | 3 | 4 | 5 | 6;

export function SpaceBackdrop({ tone }: { tone: SpaceTone }) {
  // Decoration with no meaning of its own — nothing here is worth announcing.
  return <div className={`tn-space tn-space-${tone}`} aria-hidden="true" />;
}
