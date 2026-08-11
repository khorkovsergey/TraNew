'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Route-aware portal chrome.
 *
 * The Observatory is a standalone console. The design handoff gives it the full
 * viewport, its own sticky header and its own dark ground, and the customer
 * Header, Footer and floating Voyager widget are visually incompatible with all
 * three — a marketing nav bar above a Grafana-density operations page is not a
 * smaller version of the design, it is a different page.
 *
 * ## Why it is done this way
 *
 * Next.js can only replace a layout at the *root*, so a route group under
 * `[locale]` would still nest inside the locale layout and inherit its chrome.
 * The remaining options were a client component that swaps on the pathname, or
 * CSS that hides parent DOM nodes from a descendant — and the second is exactly
 * the brittle selector the brief rules out: it survives only until somebody
 * renames a class in a file this section does not own.
 *
 * The chrome arrives as **props rather than imports**. `Header` and
 * `VoyagerWidget` are client components but `Footer` is a server component, and
 * importing it here would drag it across the boundary. Passed as elements, each
 * one keeps whatever it already was; this file only decides which to render.
 *
 * ## Ownership
 *
 * It lives under `admin-metrics/` rather than `components/shell/` deliberately:
 * `shell` is another section's tree under the tn-flow registry, and this is the
 * Observatory's requirement rather than a change to the shell's own behaviour.
 * The one edit outside this section is the four lines in `[locale]/layout.tsx`
 * that call it. Every other route renders exactly what it rendered before.
 */

/**
 * The routes that own their whole viewport.
 *
 * Matched on the path segment rather than a full string so it holds for every
 * locale prefix and for the unprefixed form, and anchored at a segment boundary
 * so a future `/admin_admin_metrics_archive` does not silently inherit this.
 */
export function isBareChromeRoute(pathname: string): boolean {
  return /(^|\/)admin_admin_metrics(\/|$)/.test(pathname);
}

export function PortalChrome({
  header,
  footer,
  widget,
  skipLink,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  widget: ReactNode;
  skipLink: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (isBareChromeRoute(pathname)) {
    /*
     * No `.tn-app` wrapper either: it carries the portal's page background and
     * column constraints, and the Observatory paints its own ground edge to
     * edge. `<main>` keeps its id so the skip target still resolves for anybody
     * who lands here from a keyboard.
     */
    return <main id="main">{children}</main>;
  }

  return (
    <>
      {skipLink}
      <div className="tn-app">
        {header}
        <main id="main">{children}</main>
        {footer}
      </div>
      {widget}
    </>
  );
}
