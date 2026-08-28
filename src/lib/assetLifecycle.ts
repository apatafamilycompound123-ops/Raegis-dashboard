/**
 * Asset lifecycle state machine for RWA tokens. (Issue #30)
 *
 * Models the *issuer-controlled operational stage* of an already-minted RWA
 * asset (active / paused / matured / redeemed / defaulted). This is distinct
 * from two things that already exist elsewhere in this codebase and are
 * NOT duplicated here:
 *
 *  - `src/fixtures/issuer.ts` `IssuanceRequest.status` -- the PRE-mint
 *    approval workflow (draft/pending/approved/minted/rejected). Lifecycle
 *    state only begins once an asset reaches 'minted' there.
  *  - `src/lib/eligibility.ts` -- per-wallet TRANSFER eligibility. Lifecycle
 *    state is asset-wide and issuer-driven; a paused asset will usually also
 *    affect eligibility (via the existing `assetPaused` flag), but this
 *    module does not compute eligibility itself.
 *
 * IMPORTANT (compliance wording): lifecycle state reflects issuer-reported
 * status, not a legal or financial determination about the asset or its
 * performance. See docs/asset-lifecycle-status.md.
 *
 * The module also includes a generic activity timeline model for asset
 * detail pages. See the "Asset activity timeline" section below. That
 * section intentionally does not fetch data; it defines the shape of timeline
 * events and pure conversion/filter helpers. Concrete data sources should
 * map their data to `AssetActivityEvent` and set `explorerUrl` when available.
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
  /** ISO 8601 timestamp the asset entered `current`-. */
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
d: ApplyTransitionResult {
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

// -------------------------------------------------------------------------------------------------------

/**
 * Asset activity timeline model for RWA tokens. (Issue #30)
 *
 * Complements the lifecycle state machine above. While lifecycle state focuses
 * on issuer-controlled operational state (active/paused/...), this model is
 * a generic timeline of *all* asset activity: lifecycle transitions, minting,
 * transfers, compliance events, and admin actions.
 *
 * Sources are intentionally abstracted. A concrete implementation (e.g., a
 * REST API or blockchain indexer) should map its raw data into
 * `AssetActivityEvent` objects. The pure helpers here provide mapping
 * from lifecycle status, filtering, and empty-state handling.
 */

export type AssetActivityType = 'mint' | 'transfer' | 'compliance' | 'admin' | 'lifecycle';

export interface AssetActivityEvent {
  id: string;
  type: AssetActivityType;
  title: string;
  description?: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Visual tone, reused from lifecycle. */
  tone?: LifecycleTone;
  /** Optional link to a block explorer. */
  explorerUrl?: string;
  /** Additional structured data (e.g., amount, from/to for transfers). */
  metadata?: Record<string, unknown>;
}

/** Convert an AssetLifecycleEvent into an AssetActivityEvent of type 'lifecycle'. */
export function lifecycleEventToActivity(
  event: AssetLifecycleEvent,
  assetId?: string
): AssetActivityEvent {
  const info = LIFECYCLE_STATE_INFO[event.state];
  return {
    id: `lifecycle-${event.occurredAt}-${event.state}`,
    type: 'lifecycle',
    title: `Lifecycle: ${info.label}`,
    description: event.note ?? info.detail,
    timestamp: event.occurredAt,
    tone: info.tone,
    metadata: {
      state: event.state,
      assetId,
      ...(event.note ? { note: event.note } : {}),
    },
  };
}

/** Map an AssetLifecycleStatus.history to a timeline ready for display. */
export function lifecycleHistoryToTimeline(
  status: AssetLifecycleStatus,
  assetId?: string
d: AssetActivityEvent[] {
  return status.history.map((event) => lifecycleEventToActivity(event, assetId));
}

/** Filter timeline events by one or more types. */
export function filterActivityByType(
  events: AssetActivityEvent[],
  types: AssetActivityType | AssetActivityType[]
): AssetActivityEvent[] {
  const allowed = Array.isArray(types) ? types : [types];
  return events.filter((event) => allowed.includes(event.type));
}

/** Returns events sorted newest-first (by timestalp). */
export function sortActivityNewestFirst(events: AssetActivityEvent[]): AssetActivityEvent[] {
  return [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Empty-state copy for each activity type. */
export const EMPTY_ACTIVITY_MESSAGES: Record<AssetActivityType, string> = {
  mint: 'No mint activity recorded for this asset.',
  transfer: 'No transfers recorded for this asset.',
  compliance: 'No compliance events recorded for this asset.',
  admin: 'No admin actions recorded for this asset.',
  lifecycle: 'No lifecycle events recorded for this asset.',
};

/** Get a human-readable empty-state message for the given type. */
export function getEmptyActivityMessage(type: AssetActivityType): string {
  return EMPTY_ACTIVITY_MESSAGES[type];
}

/**
 * Message used when the activity data source is unavailable (e.g., an external
 * api down). This is distinct from an empty state where the source is up
 * but has no records for this asset.
 */
export const ACTIVITY_UNAVAILABLE_MESSAGE = 'Activity data is not available for this asset.';