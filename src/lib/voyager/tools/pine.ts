/**
 * Pine Script: written, explained, checked — never run.
 *
 * The rule is permanent and is stated as one. Executing Pine needs
 * TradingView's own engine, which this platform does not reimplement, so there
 * is no version of this product where a script here has been backtested. Every
 * artefact this module produces carries that sentence, attached by code rather
 * than left to a model to remember, because somebody who believes a script was
 * checked against live data is somebody who will trade on an unchecked one.
 *
 * Two provenances, kept apart, because they deserve different trust:
 *
 * - **`template`** — the deterministic Pine for a study in this repository's
 *   registry, with its parameters interpolated. The same function that draws
 *   the line on the chart emits this code, so the picture and the script are
 *   the same calculation. Nothing was generated.
 * - **`model-written`** — Pine the model wrote for a free-form request. Useful,
 *   unverified, and labelled as such. It has not been compiled, let alone run.
 *
 * Checking is real but bounded: `diagnose` is this repository's own Pine
 * linter, so "no errors found" means the structure and the built-ins check out,
 * not that the script does what somebody wanted.
 *
 * Import-free beyond the two registries it reuses.
 */

import { STUDIES, type StudyId } from '../../studies/registry';
import { diagnose, statusFor, statusLabel } from '../../superchart/scripts/diagnostics';
import { PINE_NOT_EXECUTED } from '../research';
import { argString, toolFailure, type VoyagerToolResult } from './types';

export type PineProvenance = 'template' | 'model-written';

export type PineArtifact = {
  language: 'pine';
  title: string;
  source: string;
  provenance: PineProvenance;
  /** The permanent limit, attached here so no answer has to remember it. */
  notExecuted: string;
  /** Findings from this repository's own linter, when the code was checked. */
  findings: { severity: 'error' | 'warning' | 'note'; line: number; message: string }[];
  /** What the findings add up to, in words that do not overstate the check. */
  status: string;
};

/** Long enough for a real indicator, short enough not to be a payload. */
const MAX_PINE_LENGTH = 12_000;

function artifact(
  title: string,
  source: string,
  provenance: PineProvenance
): PineArtifact {
  const findings = diagnose(source);

  return {
    language: 'pine',
    title,
    source,
    provenance,
    notExecuted: PINE_NOT_EXECUTED,
    findings,
    /*
     * "Errors found" / "No errors found" from the linter, said as what it is.
     * A script that lints clean has been checked for structure and known
     * built-ins — not for whether it expresses the idea somebody had.
     */
    status: `${statusLabel(statusFor(findings))} — checked for syntax and known built-ins only; not compiled and not run.`,
  };
}

/**
 * The exact Pine behind a study this platform draws.
 *
 * Deterministic: the registry emits it, the same registry computes the line on
 * the chart, and neither went near a model.
 */
export function pineTemplate(
  studyId: unknown,
  params: unknown
): VoyagerToolResult<PineArtifact> {
  const id = argString(studyId, 24)?.toLowerCase();
  if (!id || !(id in STUDIES)) {
    return toolFailure(
      'not_found',
      `There is no built-in study called "${argString(studyId, 24) ?? '—'}" here. The ones with Pine are: ${Object.keys(STUDIES).join(', ')}.`,
      true
    );
  }

  const definition = STUDIES[id as StudyId];
  const supplied = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};

  const resolved: Record<string, number> = {};
  for (const [name, range] of Object.entries(definition.params)) {
    const value = supplied[name];
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : range.default;
    resolved[name] = Math.min(range.max, Math.max(range.min, Math.round(numeric * 100) / 100));
  }

  return {
    ok: true,
    data: artifact(definition.label(resolved), definition.pine(resolved), 'template'),
    summary:
      `Pine for ${definition.label(resolved)}, from this platform's study registry — the same ` +
      `calculation the chart draws. Not executed.`,
  };
}

/**
 * Somebody else's Pine, checked.
 *
 * The debugging half of the workflow. It reports what the linter found and
 * nothing more: no claim about behaviour, no claim about profitability, and no
 * claim that it ran.
 */
export function pineReview(source: unknown): VoyagerToolResult<PineArtifact> {
  const code = typeof source === 'string' ? source.slice(0, MAX_PINE_LENGTH) : '';
  if (!code.trim()) {
    return toolFailure('bad_arguments', 'There is no Pine source to look at.', true);
  }

  const checked = artifact('Reviewed script', code, 'model-written');

  const errors = checked.findings.filter((finding) => finding.severity === 'error');
  return {
    ok: true,
    data: checked,
    summary:
      errors.length === 0
        ? `No errors found in ${code.split('\n').length} lines — syntax and known built-ins only, not compiled and not run.`
        : `${errors.length} error(s): ${errors
            .slice(0, 4)
            .map((finding) => `line ${finding.line}: ${finding.message}`)
            .join('; ')}. Not compiled and not run.`,
  };
}

/**
 * Pine the model wrote, turned into an artefact.
 *
 * The model may write Pine — the brief allows it and it is useful — but what it
 * writes goes through here so the label, the linting and the never-executed
 * sentence are applied by code. Left to the answer text, "this has not been
 * backtested" is a sentence that gets dropped on a busy day.
 */
export function pineFromModel(title: unknown, source: unknown): PineArtifact | null {
  const code = typeof source === 'string' ? source.slice(0, MAX_PINE_LENGTH) : '';
  if (!code.trim()) return null;

  return artifact(argString(title, 80) ?? 'Generated script', code, 'model-written');
}

/**
 * Language that must never appear about a script from here.
 *
 * Exported so the unit suite can assert it against every artefact this module
 * produces, rather than trusting a review to notice a word like "backtested"
 * creeping into a summary.
 */
export const FORBIDDEN_PINE_CLAIMS = [
  'backtested',
  'back-tested',
  'verified against live data',
  'executed',
  'profitable',
  'proven',
];
