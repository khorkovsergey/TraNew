import type { SVGProps } from 'react';

/**
 * Lucide-style inline icons (stroke 1.7–2.5, round caps) — the handoff ships no
 * external image assets, so every glyph in the portal comes from here.
 */
const PATHS = {
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35',
  arrowRight: 'M5 12h14M13 5l7 7-7 7',
  arrowUpRight: 'M7 17 17 7M7 7h10v10',
  check: 'M20 6 9 17l-5-5',
  grad: 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z',
  bars: 'M4 20V10M10 20V4M16 20v-7M22 20v-3',
  chart: 'M3 3v18h18M7 15l4-5 3 3 5-7',
  star: 'M12 2.5 15 9l7 .9-5 4.7 1.3 6.9-6.3-3.4-6.3 3.4L8 14.6 3 9.9 10 9l2-6.5Z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  pie: 'M21.2 15.9A9 9 0 1 1 8.1 2.8M22 12A10 10 0 0 0 12 2v10h10Z',
  bubble:
    'M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.2-.5L3 21l1.6-4.4A8.4 8.4 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  chevronDown: 'm6 9 6 6 6-6',
  close: 'M18 6 6 18M6 6l12 12',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',

  /*
   * Drawing tools. Each glyph is the shape the tool makes, with its handles
   * shown as small circles — the rail is a row of near-identical buttons
   * otherwise, and a tooltip you have to hover to read is not a label.
   */
  toolTrendLine: 'M4 18 20 6M4.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M19.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  toolHorizontalLine: 'M3 12h18M5.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M18.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  toolVerticalLine: 'M12 3v18M13.5 5.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0M13.5 18.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0',
  toolRectangle: 'M4 6h16v12H4zM5.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M18.5 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  toolText: 'M5 6V4h14v2M12 4v16M9 20h6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
