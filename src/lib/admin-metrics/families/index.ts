import 'server-only';
import { readFunnelEvents } from '../telemetryQuery';
import { MIN_BREAKDOWN_COHORT } from '../journeys';
import { accountFacts } from './accounts';
import { academyFacts } from './academy';
import { commerceFacts } from './commerce';
import { eventsFacts } from './events';
import { expertsFacts } from './experts';
import { savesFacts } from './saves';
import { wealthFacts } from './wealth';
import { sequentialFunnel, startFunnel, START_EVENTS, type StartFunnel, type SequentialStage } from './startFunnel';
import type { FamilyFacts } from './durable';

/**
 * The product families, composed.
 *
 * The shape of the answer is the point of Phase 3: each family carries its
 * **behaviour** and its **durable facts** side by side and never merged. A
 * registration funnel and a table of seats are different evidence about the
 * same flow, and a payload that added them would be answering a question nobody
 * asked with a number nobody can check.
 *
 * The durable reads run concurrently — they are independent aggregates against
 * different tables, and running them in sequence would make the page wait for
 * the sum of them rather than the slowest.
 */

/** The Events discovery chain. Ordered, and each step must follow the last. */
const EVENT_FUNNEL_CHAIN = [
  'events_discovery_viewed',
  'event_viewed',
  'event_registration_started',
  'event_registration_completed',
];

export type ProductFamilies = {
  start: {
    funnel: StartFunnel;
    /** Named so nobody reads a behavioural funnel as a count of outcomes. */
    sourceType: 'telemetry';
    limitations: string[];
  };
  events: FamilyFacts & { funnel: { stages: SequentialStage[]; sessionsSeen: number } };
  academy: FamilyFacts;
  experts: FamilyFacts;
  saves: FamilyFacts;
  wealth: FamilyFacts;
  commerce: FamilyFacts;
  accounts: FamilyFacts;
  queriedAt: string;
};

export async function productFamilies(since: Date): Promise<ProductFamilies> {
  const queriedAt = new Date().toISOString();

  const [startPoints, eventPoints, events, academy, experts, saves, wealth, commerce, accounts] =
    await Promise.all([
      readFunnelEvents(since, START_EVENTS),
      readFunnelEvents(since, EVENT_FUNNEL_CHAIN),
      eventsFacts(since),
      academyFacts(since),
      expertsFacts(since),
      savesFacts(since),
      wealthFacts(),
      commerceFacts(since),
      accountFacts(since),
    ]);

  return {
    start: {
      funnel: startFunnel(startPoints, MIN_BREAKDOWN_COHORT),
      sourceType: 'telemetry',
      limitations: [
        'Behavioural only. There is no durable "next step" record, so nothing here is a business outcome — it is what the router reported.',
        'Sequential within a session: a stage counts only where the stage before it happened earlier in the same session. Totals divided by totals would be a different and wrong number.',
        'Clarification is optional and is never a denominator. Not every route asks, and treating it as mandatory would report every unambiguous path as a drop-off.',
        'The seven retired plan-funnel events are excluded. They have no emitter and describe a flow whose screen is now a redirect.',
      ],
    },
    events: { ...events, funnel: sequentialFunnel(eventPoints, EVENT_FUNNEL_CHAIN, MIN_BREAKDOWN_COHORT) },
    academy,
    experts,
    saves,
    wealth,
    commerce,
    accounts,
    queriedAt,
  };
}
