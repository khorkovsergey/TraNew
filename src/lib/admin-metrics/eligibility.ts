/**
 * The eligible portal session — one definition, in one place.
 *
 * Import-free, so the harness can check every exclusion without a database.
 *
 * This exists because a denominator that drifts between endpoints is worse than
 * a denominator that is wrong: two panels then disagree and nobody can tell
 * which is lying. Every Phase 2 metric takes its population from here, and the
 * exclusions are named values rather than SQL literals so the Metric Dictionary
 * can print the same list the query applied.
 *
 * The rule underneath all of it: **a session is eligible when a person could
 * plausibly have continued from it.** Not when telemetry happens to exist. A
 * crawler produced rows; so did the Observatory smoke test; so does a
 * sign-in redirect. None of those is a visit whose continuation a product
 * change could improve, and leaving them in makes every rate a measurement of
 * how much traffic is not people.
 */

/** Why a session was left out. Named so the dictionary and the tests agree. */
export const EXCLUSION_REASONS = [
  /** A crawler, a monitor, a headless browser. Dropped at ingest as well. */
  'automated',
  /** The Observatory itself. Our own smoke test is not product usage. */
  'observatory',
  /** Sign-in, sign-up, password reset — steps in somebody else's flow. */
  'auth_plumbing',
  /** Signed-in housekeeping; a visit here is not a landing. */
  'not_a_landing_surface',
  /** A route the surface catalogue does not recognise. */
  'unknown_surface',
  /** The landing surface is behind a flag that is off, or is inert. */
  'surface_not_live',
  /** Telemetry exists for the session but it never rendered a page. */
  'no_page_view',
  /** Nobody stayed long enough for continuation to have been possible. */
  'below_engagement_threshold',
] as const;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

/**
 * The engagement floor, in seconds.
 *
 * Three seconds, from the design handoff's stated PMCR eligibility — "landing
 * view + ≥3s engaged time" — adopted in the Phase 0 review and implemented
 * here rather than invented afresh. It removes the bounce that no product
 * change could have affected, which is the whole reason the definition is
 * better than "any session with a page view".
 *
 * `portal_engagement_checkpoint` fires at three seconds and only while the tab
 * is visible, so time on a page nobody is looking at does not qualify.
 */
export const ENGAGEMENT_THRESHOLD_SECONDS = 3;

/**
 * Surfaces that can never be an eligible landing, whatever the flags say.
 *
 * Kept beside the catalogue rather than inside it because these are a
 * measurement decision, not a fact about the product: `auth` and `account` are
 * perfectly real surfaces, they are simply not visits whose continuation means
 * anything. `observatory` is us.
 */
export const NEVER_ELIGIBLE_SURFACES: readonly string[] = ['observatory', 'auth', 'portal', 'unknown'];

export type SurfaceEligibility = {
  /** From the surface catalogue: is this a landing whose continuation counts. */
  pmcrEligible: boolean;
  /** Resolved at runtime from the flags: live | disabled | coming_soon | … */
  featureState: string;
};

/**
 * Whether a landing surface may put a session in the denominator.
 *
 * Returns the reason rather than a boolean, so the caller can report *why* a
 * session was dropped instead of quietly shrinking a number.
 */
export function surfaceExclusion(
  surface: string,
  lookup: (surface: string) => SurfaceEligibility | null
): ExclusionReason | null {
  if (NEVER_ELIGIBLE_SURFACES.includes(surface)) {
    return surface === 'observatory' ? 'observatory' : surface === 'auth' ? 'auth_plumbing' : 'unknown_surface';
  }

  const info = lookup(surface);
  if (!info) return 'unknown_surface';
  if (!info.pmcrEligible) return 'not_a_landing_surface';

  /*
   * A landing on a surface that is switched off should not be possible, and if
   * it happens the session is not evidence about the product. Excluded rather
   * than counted as a failure to continue — the alternative is a flag rollback
   * that looks like a drop in engagement.
   */
  if (info.featureState !== 'live') return 'surface_not_live';

  return null;
}
