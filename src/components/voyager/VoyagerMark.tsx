/**
 * The Voyager mark — a pearl orb with two arched eyes.
 *
 * Replaces the gradient tile and white star. The brand gradient stays exactly
 * where it was (135° #7c4dff → #2962ff), but it now runs through the eyes rather
 * than filling the whole tile: the orb reads as a face, and the gradient becomes
 * the thing it looks at you with.
 *
 * Two constraints shaped the drawing:
 *
 * - **It sits on white and on near-black.** So the orb's volume comes from its own
 *   shading — a highlight at the upper left, a crescent of shade at the lower
 *   right — rather than from a halo. An outer glow was tried and cut: as a
 *   gradient ring it reads as a soft bloom on white and as a dirty grey donut on
 *   the dark pill, and an inline SVG cannot know which surface it is on.
 * - **In the product it is only ever 26–28px.** Detail below `DETAIL_FROM` is
 *   dropped rather than drawn too small to see, and the eye stroke thickens so the
 *   face still reads at pill size.
 */

/** Below this pixel size the fine detail is dropped rather than drawn too small. */
const DETAIL_FROM = 34;

export function VoyagerMark({
  size = 26,
  title,
  className,
}: {
  size?: number;
  /** Give this only where the mark is the sole label; otherwise it stays decorative. */
  title?: string;
  className?: string;
}) {
  const detailed = size >= DETAIL_FROM;
  // Ids must be unique per rendered size or a second mark on the page reuses the
  // first one's gradients — which silently breaks whichever renders later.
  const uid = `voyager-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {/* Body: lit from the upper left, shading to a cool grey at the lower right. */}
        <radialGradient id={`${uid}-body`} cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="48%" stopColor="#f6f8fc" />
          <stop offset="100%" stopColor="#d8dded" />
        </radialGradient>

        {/* The crescent that makes a disc read as a sphere. */}
        <radialGradient id={`${uid}-shade`} cx="32%" cy="24%" r="76%">
          <stop offset="70%" stopColor="#131722" stopOpacity="0" />
          <stop offset="100%" stopColor="#131722" stopOpacity="0.16" />
        </radialGradient>

        {/* The eyes carry the brand gradient, left purple to right blue. */}
        <linearGradient id={`${uid}-eyes`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c4dff" />
          <stop offset="100%" stopColor="#2962ff" />
        </linearGradient>
      </defs>

      <circle cx="20" cy="20" r="15" fill={`url(#${uid}-body)`} />
      <circle cx="20" cy="20" r="15" fill={`url(#${uid}-shade)`} />

      {detailed && (
        <>
          {/*
           * Meridians hugging the silhouette. Inset by a hair from the edge so they
           * read as the sphere turning away, not as brackets drawn beside it.
           */}
          <path
            d="M9.5 10.4a15 15 0 0 0 0 19.2"
            stroke="#2962ff"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.38"
          />
          <path
            d="M30.5 10.4a15 15 0 0 1 0 19.2"
            stroke="#2962ff"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.38"
          />
        </>
      )}

      {/* A whisper of an edge, so a near-white orb still has a boundary on white. */}
      <circle cx="20" cy="20" r="15" fill="none" stroke="#aeb6cb" strokeWidth="0.4" opacity="0.45" />

      {/*
       * Eyes: two arches, the shape of a face pleased to see you.
       *
       * Geometry taken from the reference at hero size and then checked at 26px:
       * each arch spans ~23% of the diameter, the gap between them ~13%, and the
       * pair sits centred on the orb rather than below it. The stroke is the one
       * thing that cannot scale faithfully — 4% of the diameter is elegant at
       * 300px and disappears at 26px, so small sizes get a heavier line.
       */}
      <g
        stroke={`url(#${uid}-eyes)`}
        strokeWidth={detailed ? 2.4 : 3.1}
        strokeLinecap="round"
        fill="none"
      >
        <path d="M11.4 21.2a3.4 3 0 0 1 6.8 0" />
        <path d="M21.8 21.2a3.4 3 0 0 1 6.8 0" />
      </g>
    </svg>
  );
}
