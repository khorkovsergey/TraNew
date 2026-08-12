/**
 * The one-line conclusion under each section heading.
 *
 * Import-free and deterministic: the same inputs always produce the same
 * sentence, and every sentence is a restatement of a number already on the
 * page. Nothing here infers a cause, and nothing here is generated.
 *
 * The rule that keeps them honest: **a conclusion may say what is true, never
 * why.** "Most continuation starts on Home" is a fact about a breakdown.
 * "Users love Home" is a story about people the data cannot see. The second is
 * what a dashboard is for resisting.
 *
 * A section with nothing worth saying returns `null` and prints no line, which
 * is better than a sentence written to fill the space.
 */

export type StateLike = { state: string; value?: number; sample?: number };

const isNumeric = (metric: StateLike | undefined): metric is StateLike & { value: number } =>
  Boolean(metric) &&
  ['live', 'derived', 'instrumented_going_forward'].includes(metric!.state) &&
  typeof metric!.value === 'number';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/* ------------------------------------------------------------ Product pulse */

export function pulseConclusion(input: {
  eligibleSessions: StateLike;
  pmcr: StateLike;
  collectingSince: string | null;
}): string | null {
  if (!input.collectingSince) return 'No telemetry has arrived yet. Every event-derived figure below is waiting for its first row.';

  if (!isNumeric(input.eligibleSessions)) return null;

  const sessions = plural(input.eligibleSessions.value, 'eligible session');

  if (isNumeric(input.pmcr)) {
    return `${sessions} in this period, ${percent(input.pmcr.value)} of which continued to a meaningful action.`;
  }

  if (input.pmcr.state === 'insufficient_sample') {
    return `${sessions} in this period — below the threshold for publishing a continuation rate, so the count is shown and the rate is not.`;
  }

  return `${sessions} in this period.`;
}

/* --------------------------------------------------------------- Journeys */

export function journeyConclusion(input: {
  byLandingSurface: ReadonlyArray<{ key: string; sessions: number; rate: number | null }>;
  exclusions: Readonly<Record<string, number>>;
  eligibleSessions: number;
}): string | null {
  const top = [...input.byLandingSurface].sort((a, b) => b.sessions - a.sessions)[0];
  if (!top) return null;

  const excluded = Object.values(input.exclusions).reduce((sum, count) => sum + count, 0);
  const where = `Most eligible sessions land on ${top.key} (${plural(top.sessions, 'session')}).`;

  return excluded > 0
    ? `${where} ${plural(excluded, 'session')} left the denominator — see the exclusions below.`
    : where;
}

/* ---------------------------------------------------------------- Voyager */

export function voyagerConclusion(input: {
  awaitingEmitter: boolean;
  requests: StateLike;
  realAnswerRate: StateLike;
  realAnswers: StateLike;
  simulatedFallbacks: StateLike;
  integrityViolations: number;
}): string {
  if (input.awaitingEmitter) {
    return 'Server telemetry is contracted and no request has been recorded yet. This is an unfinished hand-off, not an unused feature.';
  }

  if (input.integrityViolations > 0) {
    return `Quota integrity failure: ${plural(input.integrityViolations, 'request')} contradict the charge contract. Investigate before reading any rate on this section.`;
  }

  if (isNumeric(input.realAnswerRate)) {
    return `${percent(input.realAnswerRate.value)} of executed requests were answered by the model; the rest fell back to the scripted layer.`;
  }

  if (isNumeric(input.realAnswers) && isNumeric(input.simulatedFallbacks)) {
    return `${plural(input.realAnswers.value, 'real model answer')} and ${plural(input.simulatedFallbacks.value, 'scripted fallback')} recorded — below the sample threshold for a rate, so counts are shown instead.`;
  }

  return 'Telemetry is arriving; no request has completed in this period.';
}

/* ------------------------------------------------------------- Supercharts */

export function superchartsConclusion(input: {
  opens: number;
  /** Sessions where the engine reported painting a study. Never the toggle. */
  sessionsRenderingStudy: number;
  /** Separate-pane renders, from `superchart_study_applied`. */
  paneRenders: number;
  /** Toggles pressed. Stated beside the renders and never added to them. */
  studyRequests: number;
  awaitingCapabilityEmitter: boolean;
}): string {
  if (input.opens === 0) return 'No chart opened in this period.';

  const use = `${plural(input.opens, 'chart open')}, ${plural(input.sessionsRenderingStudy, 'session')} where a study rendered and ${plural(input.paneRenders, 'render')} on a separate pane.`;
  const intent = ` ${plural(input.studyRequests, 'study request')} counted separately — a toggle is not a render.`;

  return input.awaitingCapabilityEmitter
    ? `${use}${intent} Capability outcomes are instrumented going forward.`
    : `${use}${intent}`;
}

/* ------------------------------------------------------------ Market data */

export function marketConclusion(input: {
  quotesConfigured: boolean;
  macroConfigured: boolean;
  awaitingEmitter: boolean;
  requests: StateLike;
  providerErrors: StateLike;
}): string {
  const configured = [
    input.quotesConfigured ? 'quotes' : null,
    input.macroConfigured ? 'macro' : null,
  ].filter(Boolean);

  const config = configured.length
    ? `${configured.join(' and ')} configured`
    : 'no provider configured';

  if (input.awaitingEmitter) {
    return `Providers: ${config}. Resolution telemetry is contracted and instrumented going forward — no outcome has been recorded yet.`;
  }

  if (isNumeric(input.requests) && isNumeric(input.providerErrors)) {
    return `Providers: ${config}. ${plural(input.requests.value, 'resolution')} recorded, ${plural(input.providerErrors.value, 'failure')} observed by the client.`;
  }

  return `Providers: ${config}.`;
}

/* ------------------------------------------------------------- Reliability */

export function reliabilityConclusion(input: {
  vitals: ReadonlyArray<{ metric: string; p75: number | null; sample: number }>;
  failures: StateLike;
}): string {
  const measured = input.vitals.filter((vital) => vital.p75 !== null);

  if (measured.length === 0) {
    const collected = input.vitals.reduce((sum, vital) => sum + vital.sample, 0);
    return collected === 0
      ? 'No Web Vital has been reported yet.'
      : `${plural(collected, 'measurement')} collected — below the threshold for publishing a percentile, so none is shown.`;
  }

  const failures = isNumeric(input.failures) ? `, ${plural(input.failures.value, 'client failure')} recorded` : '';
  return `${plural(measured.length, 'vital')} above the sample threshold${failures}.`;
}

/* --------------------------------------------------------- Monetization */

/**
 * The monetization sentence.
 *
 * `withExternalRef` used to be called `reconciled`, and the sentence repeated
 * the claim: sixteen records, settled against a payment provider. Every one of
 * those sixteen was a `demo` entitlement whose `external_ref` is a course slug
 * or a script product id, and no payment provider has ever seen one. It was the
 * most quotable false claim on the dashboard — a conclusion is what a reader
 * repeats out loud.
 *
 * A non-null column now says what it is, and the sentence still ends with the
 * only thing that is settled: there is no source for confirmed revenue, and
 * counting references does not create one.
 */
export function monetizationConclusion(input: {
  paidRecords: StateLike;
  demoRecords: StateLike;
  withExternalRef: StateLike;
}): string {
  const paid = isNumeric(input.paidRecords) ? input.paidRecords.value : 0;
  const demo = isNumeric(input.demoRecords) ? input.demoRecords.value : 0;
  const referenced = isNumeric(input.withExternalRef) ? input.withExternalRef.value : 0;

  const head = `${plural(paid, 'paid-status record')} and ${plural(demo, 'demo entitlement')}`;

  /*
   * `plural` appends an "s" to the noun it is given, so a clause has to
   * pluralise a noun rather than a phrase — `plural(16, 'reconciled against a
   * provider')` once produced "16 reconciled against a providers". The verb
   * agrees separately for the same reason.
   */
  const carries = referenced === 1 ? 'carries' : 'carry';

  return referenced === 0
    ? `${head}. No payment provider is connected, so confirmed revenue has no source.`
    : `${head}, of which ${plural(referenced, 'record')} ${carries} an external reference — an identifier the application wrote, not a provider confirmation. No payment provider is connected, so confirmed revenue has no source.`;
}

/* ------------------------------------------------------- Measurement gaps */

export type GapCount = { state: string; metrics: number };

/**
 * The credibility line, and the one this dashboard is most for.
 *
 * A product manager needs to tell "this number is bad" from "there is no
 * number", and the count of each is the shortest way to say it.
 */
export function coverageConclusion(gaps: ReadonlyArray<GapCount>): string | null {
  const of = (state: string) => gaps.find((gap) => gap.state === state)?.metrics ?? 0;

  const pieces = [
    of('not_measurable') > 0 ? `${of('not_measurable')} not measurable` : null,
    of('source_not_connected') > 0 ? `${of('source_not_connected')} awaiting a source` : null,
    of('insufficient_sample') > 0 ? `${of('insufficient_sample')} below sample threshold` : null,
    of('feature_disabled') > 0 ? `${of('feature_disabled')} behind a switched-off flag` : null,
    of('instrumented_going_forward') > 0 ? `${of('instrumented_going_forward')} collecting with no history` : null,
  ].filter(Boolean);

  if (pieces.length === 0) return null;

  return `${pieces.join(', ')}. None of these is a zero, and none is a product failure.`;
}
