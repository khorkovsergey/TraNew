'use client';

import { useEffect, useState } from 'react';

/**
 * The direct-link bootstrap.
 *
 * Reads `#access=…` from the URL fragment, exchanges it for an authorization
 * cookie, and clears the fragment before anything else happens.
 *
 * The fragment is used rather than a query string for one specific reason: a
 * fragment is never sent in the HTTP request. It does not reach the server, it
 * is not in an access log, it is not in a proxy log, and it is not in a
 * `Referer` header on the way to anywhere else. A query-string secret would be
 * written down in every one of those places by machines nobody administers.
 *
 * The fragment is removed with `replaceState` rather than `pushState`, so the
 * secret is not left one Back press away in the session history either.
 *
 * This component holds no secret of its own and knows nothing about what a
 * valid one looks like. It posts what it was given and believes the server.
 */
export function AccessBootstrap({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<'idle' | 'checking' | 'failed'>('idle');

  useEffect(() => {
    if (!enabled) return;

    const match = /(?:^|[#&])access=([^&]+)/.exec(location.hash);
    if (!match) return;

    const secret = decodeURIComponent(match[1]);

    // Clear it first, so a failed exchange does not leave the secret sitting in
    // the address bar while somebody reads an error message.
    history.replaceState(null, '', location.pathname + location.search);

    void (async () => {
      /*
       * Inside the async callback rather than in the effect body: a synchronous
       * `setState` there is a cascading render, and this repository's lint
       * treats that as an error rather than a style note.
       */
      await Promise.resolve();
      setState('checking');

      try {
        const response = await fetch('/api/admin-metrics/access', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret }),
          credentials: 'same-origin',
        });

        if (response.ok) location.reload();
        else setState('failed');
      } catch {
        setState('failed');
      }
    })();
  }, [enabled]);

  if (state === 'checking') return <p>Checking…</p>;
  if (state === 'failed') return <p>That link is not valid.</p>;
  return null;
}
