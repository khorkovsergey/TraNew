import type { EvidenceItem, FinancialFact } from '../types';

/**
 * The point-in-time guard.
 *
 * An analysis dated 20 January must not see a report published on 15 February,
 * even though the period it covers ended on 31 December. The period end is when
 * the facts happened; the filing date is when anyone could know them. Confusing
 * the two is lookahead bias, and it is the failure mode that makes a historical
 * analysis look far better than the decision anyone could actually have made.
 *
 * It is a guard rather than a convention because the mistake is invisible: a
 * backtest with leakage does not error, it just quietly reports a result nobody
 * could have achieved. Everything entering the engine goes through here, and
 * the tests assert the leak is blocked rather than that the filter was called.
 */

export type CutoffDecision = {
  admitted: boolean;
  reason: string;
};

/**
 * The instant an item became knowable.
 *
 * Ordered deliberately: a filing date beats a publication date beats the period
 * end. The period end is the last resort and the one that leaks, so using it
 * always leaves a note behind.
 */
export function knowableAt(evidence: EvidenceItem): { at: string | null; basis: string } {
  if (evidence.filingDate) return { at: evidence.filingDate, basis: 'filing date' };
  if (evidence.publishedAt) return { at: evidence.publishedAt, basis: 'publication date' };
  if (evidence.periodEnd) return { at: evidence.periodEnd, basis: 'period end (assumed)' };
  return { at: null, basis: 'unknown' };
}

export function admits(evidence: EvidenceItem, cutoff: string): CutoffDecision {
  const { at, basis } = knowableAt(evidence);

  if (!at) {
    // No date at all cannot be shown to precede the cutoff, so it does not get
    // the benefit of the doubt: a fact of unknown vintage is exactly the kind
    // that turns out to be from the future.
    return { admitted: false, reason: 'no date on the source, so it cannot be placed before the cutoff' };
  }

  const knowable = Date.parse(at);
  const limit = Date.parse(cutoff);

  if (!Number.isFinite(knowable) || !Number.isFinite(limit)) {
    return { admitted: false, reason: 'unparseable date' };
  }

  if (knowable > limit) {
    return {
      admitted: false,
      reason: `published ${at} by ${basis}, after the ${cutoff} cutoff`,
    };
  }

  return { admitted: true, reason: `known by ${at} (${basis})` };
}

export type GuardResult = {
  evidence: EvidenceItem[];
  facts: FinancialFact[];
  excluded: Array<{ id: string; reason: string }>;
  warnings: string[];
};

/**
 * Filters everything to what was knowable at the cutoff.
 *
 * Facts are dropped when their evidence is dropped rather than checked
 * separately, so there is one rule and no way for a fact to survive its source.
 */
export function applyPointInTime(
  evidence: EvidenceItem[],
  facts: FinancialFact[],
  cutoff: string
): GuardResult {
  const excluded: Array<{ id: string; reason: string }> = [];
  const warnings: string[] = [];
  const admitted: EvidenceItem[] = [];

  for (const item of evidence) {
    const decision = admits(item, cutoff);

    if (decision.admitted) {
      admitted.push(item);
      if (!item.filingDate && !item.publishedAt) {
        warnings.push(
          `${item.sourceName} was admitted on its period end because it carries no filing or publication date; a report is normally knowable weeks after the period it covers.`
        );
      }
    } else {
      excluded.push({ id: item.evidenceId, reason: decision.reason });
    }
  }

  const admittedIds = new Set(admitted.map((item) => item.evidenceId));
  const survivingFacts = facts.filter((fact) => admittedIds.has(fact.sourceEvidenceId));

  const droppedFacts = facts.length - survivingFacts.length;
  if (droppedFacts > 0) {
    warnings.push(
      `${droppedFacts} figure${droppedFacts === 1 ? '' : 's'} excluded because the document behind them was not published by ${cutoff}.`
    );
  }

  return { evidence: admitted, facts: survivingFacts, excluded, warnings };
}

/** Prices after the cutoff are removed the same way, by date. */
export function truncateSeries(
  series: Array<{ date: string; close: number }>,
  cutoff: string
): Array<{ date: string; close: number }> {
  const limit = Date.parse(cutoff);
  return series.filter((point) => {
    const at = Date.parse(point.date);
    return Number.isFinite(at) && at <= limit;
  });
}
