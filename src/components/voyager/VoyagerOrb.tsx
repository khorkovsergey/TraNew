/**
 * The Voyager orb — the assistant's identity, per Brand Kit section 07.
 *
 * A soft white sphere with two gradient "smiling eyes". Friendly and calm, never
 * anthropomorphised past the eyes: no mouth, no limbs, no emotion beyond attentive
 * warmth.
 *
 * The body is CSS rather than SVG — a radial highlight plus two inset shadows,
 * which is what gives it the matte-ceramic read at any size without a filter. Only
 * the eyes are SVG, because they carry a gradient across both arcs and need round
 * caps.
 *
 * Everything scales from one number. The shadow offsets are authored against a
 * 26px orb (the size used in the widget) and scale proportionally, so a 88px orb
 * in marketing has the same weight of shading rather than a hairline.
 */

/** The size the shadow values were authored against. */
const BASE_SIZE = 26;

/**
 * Eye box as a fraction of the diameter, and the stroke that makes the rendered
 * line land on the brand's 10%-of-diameter rule.
 *
 *   stroke_px = STROKE_UNITS × (size × EYE_RATIO) / 22  ≈ 0.10 × size
 */
const EYE_RATIO = 0.62;
const STROKE_UNITS = 3.55;

export function VoyagerOrb({
  size = 26,
  title,
  className,
}: {
  size?: number;
  /** Give this only where the orb is the sole label; otherwise it stays decorative. */
  title?: string;
  className?: string;
}) {
  const scale = size / BASE_SIZE;
  const px = (value: number) => `${(value * scale).toFixed(2)}px`;
  const eyeWidth = size * EYE_RATIO;

  return (
    <span
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #f2f3f8 55%, #dde1ec 100%)',
        boxShadow: [
          // Shade at the lower right and light at the upper left: the two together
          // are what turn a flat circle into a sphere.
          `inset ${px(-2)} ${px(-3)} ${px(5)} rgba(120,130,160,0.28)`,
          `inset ${px(2)} ${px(3)} ${px(5)} rgba(255,255,255,0.9)`,
          `0 ${px(2)} ${px(6)} rgba(19,23,34,0.22)`,
        ].join(', '),
      }}
    >
      <svg width={eyeWidth} height={eyeWidth / 2} viewBox="0 0 22 11" fill="none" aria-hidden="true">
        <defs>
          {/* One gradient across both eyes — left violet, right blue — so the pair
              reads as a single glance rather than two separate marks. */}
          <linearGradient id={`voyager-eyes-${size}`} x1="0" y1="0" x2="22" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#2962ff" />
          </linearGradient>
        </defs>
        <g
          stroke={`url(#voyager-eyes-${size})`}
          strokeWidth={STROKE_UNITS}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M3 8.5a3 3 0 0 1 6 0" />
          <path d="M13 8.5a3 3 0 0 1 6 0" />
        </g>
      </svg>
    </span>
  );
}

/**
 * The Voyager wordmark: the name in the brand gradient.
 *
 * Kept beside the orb rather than inside it so the two can be sized independently
 * — the peek header uses a smaller orb than the panel, but the name stays put.
 */
export function VoyagerWordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontWeight: 800,
        backgroundImage: 'linear-gradient(90deg, #8b5cf6, #2962ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
      }}
    >
      Voyager
    </span>
  );
}
