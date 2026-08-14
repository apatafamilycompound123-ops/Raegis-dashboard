/**
 * Asset lifecycle state machine for RWA tokens. (Issue #30)
 *
 * Models the *issuer-controlled operational stage* of an already-minted RWA
 * asset (active / paused / matured / redeemed / defaulted). This is distinct
 * from two things that already exist elsewhere in this codebase and are
 * NOT duplicated here:
 *
 *  - `src/fixtures/issuer.ts` `IssuanceRequest.status` — the PRE-mint
 *    approval workflow (draft/pending/approved/minted/rejected). Lifecycle
 *    state only begins once an asset reaches 'minted' there.
 *  - `src/lib/eligibility.ts` — per-wallet TRANSFER eligibility. Lifecycle
 *    state is asset-wide and issuer-driven; a paused asset will usually also
 *    affect eligibility (via the existing `assetPaused` flag), but this
 *    module does not compute eligibility itself.
 *
 * IMPORTANT (compliance wording): lifecycle state reflects issuer-reported
 * status, not a legal or financial determination about the asset or its
 * performance. See docs/asset-lifecycle-status.md.
 */

export type AssetLifecycleState = 'active' | 'paused' | 'matured' | 'redeemed' | 'defaulted';

export interface AssetLifecycleEvent {
  state: AssetLifecycleState;
  /** ISO 8601 timestamp. */
  occurredAt: string;
  /** Optional free-text context, e.g. "Reached scheduled maturity." */
  note?: string;
}

export interface AssetLifecycleStatus {
  current: AssetLifecycleState;
  /** ISO 8601 timestamp the asset entered `current`. */
  since: string;
  /** Ordered oldest-first. Always includes at least the current event. */
  history: AssetLifecycleEvent[];
}

export type LifecycleTone = 'positive' | 'neutral' | 'caution' | 'negative';

export interface LifecycleStateInfo {
  label: string;
  detail: string;
  tone: LifecycleTone;
}

export const LIFECYCLE_STATE_INFO: Record<AssetLifecycleState, LifecycleStateInfo> = {
  active: {
    label: 'Active',
    detail:
      'This asset is live. Whether it can currently be transferred still depends on separate compliance and transfer-eligibility checks.',
    tone: 'positive',
  },
  paused: {
    label: 'Paused',
    detail:
      'The issuer has temporarily paused this asset. This reflects an issuer-level operational decision, not a compliance restriction on any individual wallet.',
    tone: 'caution',
  },
  matured: {
    label: 'Matured',
    detail:
      'This asset has reached its scheduled maturity. Redemption may be available; contact the issuer for the process and timing.',
    tone: 'neutral',
  },
  redeemed: {
    label: 'Redeemed',
    detail: 'This asset has been fully redeemed and is no longer an active holding.',
    tone: 'neutral',
  },
  defaulted: {
    label: 'Default',
    detail:
      'The issuer has reported a default event for this asset. This reflects issuer-reported status only, not a legal or financial determination.',
    tone: 'negative',
  },
};

/**
 * Valid forward transitions. Deliberately fail-closed: any pair not listed
 * here is invalid, including same-state "transitions" and anything out of
 * a terminal state.
 *
 *   active   -> paused, matured, defaulted
 *   paused   -> active, defaulted
 *   matured  -> redeemed
 *   defaulted-> redeemed   (issuer wind-down / write-off after a default)
 *   redeemed -> (terminal)
 */
const TRANSITIONS: Record<AssetLifecycleState, AssetLifecycleState[]> = {
  active: ['paused', 'matured', 'defaulted'],
  paused: ['active', 'defaulted'],
  matured: ['redeemed'],
  defaulted: ['redeemed'],
  redeemed: [],
};

export const TERMINAL_STATES: AssetLifecycleState[] = ['redeemed'];

export function isTerminalState(state: AssetLifecycleState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function getAllowedNextStates(state: AssetLifecycleState): AssetLifecycleState[] {
  return TRANSITIONS[state] ?? [];
}

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a proposed transition without mutating anything.
 *
 * Edge cases covered:
 *  - same-state no-op (rejected — callers should not log a redundant event)
 *  - transition attempted from a terminal state
 *  - transition that skips required intermediate states (e.g. active -> redeemed)
 *  - unknown "to" state (defensive — satisfies exhaustiveness even if an
 *    invalid string reaches this function from an untyped boundary, e.g. a
 *    malformed SDK response)
 */
export function validateTransition(
  from: AssetLifecycleState,
  to: AssetLifecycleState
): TransitionValidationResult {
  if (!LIFECYCLE_STATE_INFO[to]) {
    return { valid: false, reason: `Unrecognized lifecycle state: "${to}".` };
  }

  if (from === to) {
    return { valid: false, reason: `Asset is already in the ${LIFECYCLE_STATE_INFO[from].label} state.` };
  }

  if (isTerminalState(from)) {
    return {
      valid: false,
      reason: `${LIFECYCLE_STATE_INFO[from].label} is a terminal state and cannot transition further.`,
    };
  }

  const allowed = getAllowedNextStates(from);
  if (!allowed.includes(to)) {
    const allowedLabels = allowed.map((s) => LIFECYCLE_STATE_INFO[s].label).join(', ') || 'none';
    return {
      valid: false,
      reason: `Cannot move directly from ${LIFECYCLE_STATE_INFO[from].label} to ${LIFECYCLE_STATE_INFO[to].label}. Allowed next states: ${allowedLabels}.`,
    };
  }

  return { valid: true };
}

export interface ApplyTransitionResult {
  ok: boolean;
  status?: AssetLifecycleStatus;
  reason?: string;
}

/**
 * Pure state transition: given a current status, attempt to move to `to`.
 * Returns a new AssetLifecycleStatus on success (input is never mutated) or
 * `{ ok: false, reason }` on a rejected transition.
 */
export function applyLifecycleTransition(
  status: AssetLifecycleStatus,
  to: AssetLifecycleState,
  occurredAt: string,
  note?: string
): ApplyTransitionResult {
  const validation = validateTransition(status.current, to);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason };
  }

  const event: AssetLifecycleEvent = { state: to, occurredAt, note };
  return {
    ok: true,
    status: {
      current: to,
      since: occurredAt,
      history: [...status.history, event],
    },
  };
}
