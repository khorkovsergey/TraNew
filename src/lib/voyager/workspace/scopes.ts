/**
 * What the workspace may read from the Wealth Hub, and for how long.
 *
 * Consent to share context with Voyager already exists in `lib/consent.ts`,
 * versioned and audited, and this does not replace it. Consent is the answer to
 * "may Voyager see my wealth record at all"; a scope is the answer to "which
 * parts, for this piece of work". Both are required, and neither implies the
 * other — a person who agreed once should not find that a later analysis read
 * something they never had in mind.
 *
 * Three properties this file is responsible for.
 *
 * **Nothing is read before a grant exists.** The grant is what a reader is
 * checked against, and there is no default that permits anything.
 *
 * **A grant is for one workspace.** It does not survive into the next question,
 * because "yes, for this" is not "yes, from now on".
 *
 * **Values are optional.** The concentration analysis works on weights alone,
 * so the scope that carries amounts can be refused without refusing the answer.
 * A permission dialog whose boxes are all required is not a choice.
 *
 * Import-free, so the harness compiles it alone.
 */

export type ScopeId = 'holdings' | 'values' | 'history' | 'goals';

export type Scope = {
  id: ScopeId;
  label: string;
  /** What the analysis cannot do without it. Empty where it can do everything. */
  neededFor: string;
  /** Required scopes cannot be unticked; everything else can. */
  required: boolean;
};

/**
 * The scopes, narrowest first.
 *
 * Only one is required, and the copy on each says what refusing it costs rather
 * than what granting it gives. Somebody deciding needs the second.
 */
export const SCOPES: Scope[] = [
  {
    id: 'holdings',
    label: 'Which assets you hold, and their weights',
    neededFor: 'Without this there is nothing to analyse — the question is about your holdings.',
    required: true,
  },
  {
    id: 'values',
    label: 'What each holding is worth',
    neededFor: 'Refusing this keeps the analysis to proportions. Concentration and overlap still work; anything in currency does not.',
    required: false,
  },
  {
    id: 'history',
    label: 'When you bought them',
    neededFor: 'Refusing this loses the timeline. Gains, holding periods and "since you bought" comparisons are unavailable.',
    required: false,
  },
  {
    id: 'goals',
    label: 'The goals you recorded',
    neededFor: 'Refusing this means the analysis cannot say whether a holding fits a goal you set.',
    required: false,
  },
];

export type Grant = {
  /** The workspace this grant is for, and only this one. */
  workspaceId: string;
  scopes: ScopeId[];
  grantedAt: string;
  revokedAt: string | null;
};

export type WealthStatus = 'not-connected' | 'connected' | 'granted' | 'revoked';

/**
 * Whether a scope may be read right now.
 *
 * The single function every reader goes through. It fails closed at every step:
 * no grant, a grant for a different workspace, a revoked grant, or a scope that
 * was never ticked all return false, and there is no argument combination that
 * returns true by default.
 */
export function canRead(grant: Grant | null, workspaceId: string, scope: ScopeId): boolean {
  if (!grant) return false;
  if (grant.workspaceId !== workspaceId) return false;
  if (grant.revokedAt) return false;
  return grant.scopes.includes(scope);
}

/**
 * A grant from the boxes somebody ticked.
 *
 * Required scopes are added whether or not they arrived, because the dialog
 * shows them ticked and disabled — but an unknown scope id is dropped rather
 * than trusted, since this list arrives from a client.
 */
export function grantFrom(workspaceId: string, ticked: string[], at: string): Grant {
  const known = new Set(SCOPES.map((scope) => scope.id));
  const required = SCOPES.filter((scope) => scope.required).map((scope) => scope.id);

  const scopes = [
    ...new Set([
      ...required,
      ...ticked.filter((id): id is ScopeId => known.has(id as ScopeId)),
    ]),
  ];

  return { workspaceId, scopes, grantedAt: at, revokedAt: null };
}

/** Revoking is one call and takes effect immediately. */
export function revoke(grant: Grant, at: string): Grant {
  return { ...grant, revokedAt: at };
}

/**
 * What the analysis can still say, given what was granted.
 *
 * Shown before the grant as well as after, so somebody unticking a box can see
 * what it costs while they are deciding rather than discovering it in the
 * answer.
 */
export function capabilities(scopes: ScopeId[]): { can: string[]; cannot: string[] } {
  const has = (id: ScopeId) => scopes.includes(id);

  const can: string[] = [];
  const cannot: string[] = [];

  if (has('holdings')) can.push('Concentration by asset, sector and region');
  else cannot.push('Anything about your holdings');

  if (has('values')) can.push('Amounts and currency exposure');
  else cannot.push('Anything expressed in money');

  if (has('history')) can.push('Gains, holding periods and changes since you bought');
  else cannot.push('Anything about time held or gains');

  if (has('goals')) can.push('Whether a holding fits a goal you recorded');
  else cannot.push('Whether holdings match your goals');

  return { can, cannot };
}

/** The status line, for the inspector. */
export function statusLabel(status: WealthStatus): string {
  switch (status) {
    case 'not-connected':
      return 'Not connected';
    case 'connected':
      return 'Connected · nothing shared';
    case 'granted':
      return 'Shared for this workspace';
    case 'revoked':
      return 'Revoked · nothing is being read';
  }
}
