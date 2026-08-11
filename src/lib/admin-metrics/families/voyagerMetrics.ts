/**
 * Voyager, as the server saw it.
 *
 * Import-free, so every rule is checkable with fixtures.
 *
 * The distinction this file exists to keep, and the one a dashboard is most
 * tempted to lose: **a scripted fallback is not a model answer.** It is
 * valuable graceful degradation — the person got this platform's written
 * background, labelled as such, instead of an error — but reporting it under
 * "Voyager answered" would turn a provider outage into a healthy-looking
 * engagement number. Real and simulated are separate everywhere here, and the
 * words never blur.
 */

export type VoyagerOutcome = 'real_answer' | 'simulated_fallback' | 'quota_refused' | 'server_failure';
export type QuotaDisposition = 'charged' | 'released' | 'refused_released' | 'unmetered';

export type VoyagerRequestRow = {
  outcome: VoyagerOutcome;
  quotaDisposition: QuotaDisposition;
  modelConfigured: boolean;
  durationMs: number;
  screen: string;
  tier: string;
  sourceCount: number;
  toolSteps: number;
  hasChart: boolean;
  hasStudy: boolean;
  actionCount: number;
};

export type VoyagerToolRow = {
  tool: string;
  outcome: 'success' | 'failure';
  code: string;
  durationMs: number;
};

/**
 * Requests that actually reached the model.
 *
 * A quota refusal never got that far, so it belongs in the refusal rate and in
 * nothing else — leaving it in the latency population would report the speed of
 * a rejection as the speed of an answer, and leaving it in the fallback
 * denominator would make the product look more degraded the more popular it
 * became.
 */
export function executedRequests(rows: readonly VoyagerRequestRow[]): VoyagerRequestRow[] {
  return rows.filter((row) => row.outcome !== 'quota_refused');
}

export type VoyagerCounts = {
  requests: number;
  realAnswers: number;
  simulatedFallbacks: number;
  quotaRefusals: number;
  serverFailures: number;
  executed: number;
  charged: number;
  released: number;
  refusedReleased: number;
  unmetered: number;
  modelConfiguredRequests: number;
  /** Fallbacks that happened while a model *was* configured. */
  fallbacksWithModel: number;
  withChart: number;
  withStudy: number;
  withActions: number;
  toolAssisted: number;
};

export function countRequests(rows: readonly VoyagerRequestRow[]): VoyagerCounts {
  const executed = executedRequests(rows);
  const is = (outcome: VoyagerOutcome) => rows.filter((row) => row.outcome === outcome).length;
  const disposed = (disposition: QuotaDisposition) =>
    rows.filter((row) => row.quotaDisposition === disposition).length;

  return {
    requests: rows.length,
    realAnswers: is('real_answer'),
    simulatedFallbacks: is('simulated_fallback'),
    quotaRefusals: is('quota_refused'),
    serverFailures: is('server_failure'),
    executed: executed.length,
    charged: disposed('charged'),
    released: disposed('released'),
    refusedReleased: disposed('refused_released'),
    unmetered: disposed('unmetered'),
    modelConfiguredRequests: rows.filter((row) => row.modelConfigured).length,
    fallbacksWithModel: rows.filter(
      (row) => row.outcome === 'simulated_fallback' && row.modelConfigured
    ).length,
    withChart: executed.filter((row) => row.hasChart).length,
    withStudy: executed.filter((row) => row.hasStudy).length,
    withActions: executed.filter((row) => row.actionCount > 0).length,
    toolAssisted: executed.filter((row) => row.toolSteps > 0).length,
  };
}

/* -------------------------------------------------------- Quota integrity */

export type QuotaIntegrity = {
  /** Rows whose outcome and quota disposition contradict the product contract. */
  violations: number;
  /** What the violations were, so a reader can act rather than worry. */
  detail: Array<{ outcome: VoyagerOutcome; disposition: QuotaDisposition; rows: number }>;
  checked: number;
};

/**
 * The product's own rule, checked against what the telemetry says happened.
 *
 * `lib/voyager/quota.ts` states it: one intentional question moves the counter
 * by exactly one, a refusal is refunded, and an attempt that produced no answer
 * is refunded. So a simulated fallback that stayed charged is not a data point
 * to fold into a rate — it means the refund did not run, and somebody was
 * charged for an answer they never received.
 *
 * Reported as a data-health failure with its shape, never averaged in.
 */
export function quotaIntegrity(rows: readonly VoyagerRequestRow[]): QuotaIntegrity {
  const invalid = (row: VoyagerRequestRow): boolean => {
    if (row.quotaDisposition === 'unmetered') return false;
    if (row.outcome === 'real_answer') return row.quotaDisposition !== 'charged';
    if (row.outcome === 'simulated_fallback') return row.quotaDisposition === 'charged';
    if (row.outcome === 'quota_refused') return row.quotaDisposition !== 'refused_released';
    // A server failure produced no answer, so it must not have been charged.
    return row.quotaDisposition === 'charged';
  };

  const offenders = rows.filter(invalid);
  const grouped = new Map<string, { outcome: VoyagerOutcome; disposition: QuotaDisposition; rows: number }>();

  for (const row of offenders) {
    const key = `${row.outcome}|${row.quotaDisposition}`;
    const bucket = grouped.get(key) ?? { outcome: row.outcome, disposition: row.quotaDisposition, rows: 0 };
    bucket.rows += 1;
    grouped.set(key, bucket);
  }

  return {
    violations: offenders.length,
    detail: [...grouped.values()].sort((a, b) => b.rows - a.rows),
    checked: rows.length,
  };
}

/* ---------------------------------------------------------------- Latency */

export type LatencySummary = {
  median: number | null;
  p75: number | null;
  p90: number | null;
  sample: number;
};

/**
 * Percentiles over server elapsed time, nearest-rank.
 *
 * Quota refusals are excluded by the caller passing only executed requests: a
 * refusal is a database round trip, and mixing it in would report the product
 * getting faster as more people hit their limit.
 *
 * `null` below the threshold rather than a number, so a percentile over four
 * requests never reaches a card.
 */
export function latency(rows: readonly VoyagerRequestRow[], minimum: number): LatencySummary {
  const durations = rows.map((row) => row.durationMs).sort((a, b) => a - b);

  const at = (fraction: number): number | null => {
    if (durations.length < minimum) return null;
    const rank = Math.ceil(fraction * durations.length);
    return durations[Math.min(durations.length - 1, Math.max(0, rank - 1))];
  };

  return { median: at(0.5), p75: at(0.75), p90: at(0.9), sample: durations.length };
}

/* ------------------------------------------------------------------ Tools */

export type ToolSummary = {
  executions: number;
  successes: number;
  failures: number;
  byTool: Array<{ tool: string; executions: number; failures: number; medianMs: number | null }>;
  topFailureCodes: Array<{ code: string; count: number }>;
};

export function summariseTools(rows: readonly VoyagerToolRow[], minimum: number): ToolSummary {
  const byTool = new Map<string, { executions: number; failures: number; durations: number[] }>();
  const codes = new Map<string, number>();

  for (const row of rows) {
    const bucket = byTool.get(row.tool) ?? { executions: 0, failures: 0, durations: [] };
    bucket.executions += 1;
    if (row.outcome === 'failure') {
      bucket.failures += 1;
      codes.set(row.code, (codes.get(row.code) ?? 0) + 1);
    }
    bucket.durations.push(row.durationMs);
    byTool.set(row.tool, bucket);
  }

  return {
    executions: rows.length,
    successes: rows.filter((row) => row.outcome === 'success').length,
    failures: rows.filter((row) => row.outcome === 'failure').length,
    byTool: [...byTool.entries()]
      .map(([tool, bucket]) => {
        const sorted = [...bucket.durations].sort((a, b) => a - b);
        return {
          tool,
          executions: bucket.executions,
          failures: bucket.failures,
          medianMs: sorted.length >= minimum ? sorted[Math.ceil(0.5 * sorted.length) - 1] : null,
        };
      })
      .sort((a, b) => b.executions - a.executions),
    topFailureCodes: [...codes.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
  };
}
