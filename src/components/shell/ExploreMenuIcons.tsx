/**
 * The Explore menu's glyph set.
 *
 * A sprite rather than twenty inline copies: the panel draws each icon once as a
 * `<symbol>` and the rows reference it with `<use>`, so twenty rows cost twenty
 * short elements instead of twenty full drawings, and the markup stays readable
 * when someone opens the inspector on a row.
 *
 * It does not live in `Icon.tsx`, and that is deliberate. Every glyph there is a
 * single `d` string on purpose — the component renders exactly one `<path>`, so
 * an icon can never half-render because a second child went missing. These are
 * circles, rectangles and stacked strokes, which that shape cannot hold without
 * becoming a different component for everyone who already uses it.
 *
 * Ids carry the `tn-` prefix because `<use href="#…">` resolves against the whole
 * document: an unprefixed `#ic-map` would happily bind to anything a page below
 * happened to name the same.
 */
export const EXPLORE_ICON_IDS = [
  'overview',
  'stocks',
  'etfs',
  'indices',
  'crypto',
  'forex',
  'futures',
  'bonds',
  'search',
  'filter',
  'filterCrypto',
  'filterDoc',
  'popular',
  'world',
  'flag',
  'indicators',
  'calendar',
  'map',
  'yield',
  'compare',
] as const;

export type ExploreIconId = (typeof EXPLORE_ICON_IDS)[number];

const id = (name: ExploreIconId) => `tn-ic-${name}`;

/**
 * Drawn once per open panel, hidden from layout and from the accessibility tree.
 * The rows are the only readers.
 */
export function ExploreMenuSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <g id={id('overview')}>
          <path
            d="M3 18.5 L8.5 12 L12.5 15 L21 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 5.5H21V11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('stocks')}>
          <path
            d="M4 20V13M9.3 20V7M14.7 20V10M20 20V4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        <g id={id('etfs')}>
          <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 3.8V12h8.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        <g id={id('indices')}>
          <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3.6 12h16.8M12 3.6c2.4 2.6 3.6 5.4 3.6 8.4s-1.2 5.8-3.6 8.4c-2.4-2.6-3.6-5.4-3.6-8.4S9.6 6.2 12 3.6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </g>

        <g id={id('crypto')}>
          <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M9.6 8h4.1a2.2 2.2 0 0 1 0 4.4H9.6m0 0h4.5a2.2 2.2 0 0 1 0 4.4H9.6m0-8.8V16.4M11.4 6.2v1.8m0 8.4v1.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('forex')}>
          <path
            d="M4 8.5h11.5M11.5 5 15.5 8.5 11.5 12M20 15.5H8.5M12.5 12 8.5 15.5 12.5 19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('futures')}>
          <path
            d="M12 3.5c3.4 3.6 5.2 6.6 5.2 9.2A5.2 5.2 0 0 1 12 17.9a5.2 5.2 0 0 1-5.2-5.2c0-2.6 1.8-5.6 5.2-9.2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 20.5v-2.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        <g id={id('bonds')}>
          <path
            d="M3.6 9.6 12 4.4l8.4 5.2M5.6 10.6v7.6m4.2-7.6v7.6m4.4-7.6v7.6m4.2-7.6v7.6M3.4 19.6h17.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('search')}>
          <circle cx="10.8" cy="10.8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M15.6 15.6 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        <g id={id('filter')}>
          <path
            d="M3.8 5.4h16.4l-6.4 7.4v6l-3.6 1.8v-7.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('filterCrypto')}>
          <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9.8 8.4h3.6a2 2 0 0 1 0 4h-3.6m0 0h4a2 2 0 0 1 0 4h-4m0-8V16.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('filterDoc')}>
          <path
            d="M6 3.6h8.4L19 8.2v12.2H6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M14 3.8v4.6h4.6M9 13h6M9 16.4h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>

        <g id={id('popular')}>
          <path
            d="M12 3.4c2.8 3 4.2 5.6 4.2 7.8 0 1.5-.7 2.7-1.9 3.4.3-1.6-.4-3.1-2-4.6-.4 3-1.7 4.5-3.3 5.6a4.4 4.4 0 0 0 1.4 4.9 5.6 5.6 0 0 1-3.6-5.2c0-3.4 2.1-6.4 5.2-11.9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('world')}>
          <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3.6 12h16.8M12 3.6c2.4 2.6 3.6 5.4 3.6 8.4s-1.2 5.8-3.6 8.4c-2.4-2.6-3.6-5.4-3.6-8.4S9.6 6.2 12 3.6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </g>

        <g id={id('flag')}>
          <path
            d="M6 21V4m0 0h11l-2.2 3.6L17 11.2H6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('indicators')}>
          <path
            d="M3.6 19.2h16.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4.4 15.4 9 9.6l3.6 3.2L20 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('calendar')}>
          <rect
            x="3.8"
            y="5.2"
            width="16.4"
            height="15"
            rx="2.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3.8 9.8h16.4M8.4 3.4v3.4M15.6 3.4v3.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        <g id={id('map')}>
          <path
            d="M3.8 6.6 9.4 4.4v13l-5.6 2.2ZM9.4 4.4 14.6 6.6v13L9.4 17.4ZM14.6 6.6l5.6-2.2v13l-5.6 2.2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>

        <g id={id('yield')}>
          <path
            d="M3.6 19.2h16.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4.2 16.4c4-.4 6.6-3.4 8.6-6.4 1.8-2.6 3.8-4.2 7-4.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        {/* Two bars of different height with a dashed divider between them —
            the comparison, drawn rather than described. */}
        <g id={id('compare')}>
          <rect
            x="4.2"
            y="9.4"
            width="5.6"
            height="10.2"
            rx="1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="14.2"
            y="4.4"
            width="5.6"
            height="15.2"
            rx="1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 7.4v9.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 2.6"
          />
        </g>
      </defs>
    </svg>
  );
}

/** One row's glyph. Size comes from the row, which shrinks at every breakpoint. */
export function ExploreIcon({ name }: { name: ExploreIconId }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href={`#${id(name)}`} />
    </svg>
  );
}
