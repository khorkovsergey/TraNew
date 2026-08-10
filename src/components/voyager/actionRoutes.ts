import type { StaticPathname } from '@/i18n/routing';
import type { VoyagerActionId, VoyagerContext } from '@/lib/voyager/types';

/**
 * Where each allowlisted action goes.
 *
 * This is the other half of the guarantee made in the orchestrator: the model
 * chooses an id, and the id resolves here. Nothing the model writes ever reaches
 * the router, so an answer cannot navigate anywhere this table does not name.
 *
 * `null` means the action stays in the conversation — the widget asks a follow-up
 * instead of leaving the page.
 */
export function routeFor(
  action: VoyagerActionId,
  context: VoyagerContext
): StaticPathname | { pathname: '/symbols/[ticker]'; params: { ticker: string } } | null {
  const ticker = context.facts?.ticker;

  switch (action) {
    case 'open_symbol':
      return ticker ? { pathname: '/symbols/[ticker]', params: { ticker } } : '/explore';
    case 'open_chart':
      return '/supercharts';
    case 'open_news':
      return '/news';
    case 'open_economy':
      return '/economy';
    case 'open_indicator':
      return '/economy';
    case 'open_academy':
      return '/academy';
    case 'open_events':
      return '/events';
    case 'open_my_events':
      return '/events/my';
    case 'open_experts':
      return '/marketplace/experts';
    case 'open_experts_intake':
      /* The same screen as `open_experts`, because the intake stopped being a
         page of its own: the conversation that structures a request now runs
         on the Expert Services screen itself. The two actions stay distinct
         because they are distinct offers — "find me somebody" and "help me say
         what I need" — and the second may earn its own entry point again. */
      return '/marketplace/experts';
    case 'open_strategy':
      return '/strategy';
    case 'open_explore':
      return '/explore';
    /* Instruments side by side, which is a different screen from the one that
       explains what an asset class is. */
    case 'open_market_compare':
      return '/markets/compare';
    case 'open_screener':
      return '/research';
    case 'open_wealth':
      return '/account/wealth';
    case 'open_wealth_assets':
      return '/account/wealth';
    case 'open_wealth_scenarios':
      return '/account/wealth';
    case 'open_wealth_insights':
      return '/account/wealth';
    case 'open_watchlist':
      return '/account/workspace';
    case 'open_practice':
      return '/portfolio';
    case 'open_research':
      return '/voyager/research';
    /*
     * The three that write something.
     *
     * They are listed here for where the result *lands*, so a surface with no
     * confirmation card can send somebody to look at it rather than perform it.
     * The performing is `runVoyagerAction`, on the server, after a Confirm.
     */
    case 'add_to_watchlist':
    case 'save_conversation':
    case 'create_alert':
      return '/account/workspace';
    // Reveals the Pine block on the chart already open. Nothing to navigate to,
    // which is why it resolves to null like `none` does.
    case 'view_pine':
      return null;
    case 'none':
      return null;
  }
}
