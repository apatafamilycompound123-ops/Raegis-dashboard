# RWA Asset Lifecycle Status

Closes #30. Documents the issuer-controlled operational lifecycle of an
already-minted RWA asset, and the UI used to display and (optionally) manage
it.

## Scope of this document
This covers the lifecycle **state machine and status display** only. It does
not duplicate two things that already exist elsewhere:
- **Pre-mint issuance approval** (draft → pending → approved → minted →
  rejected) is `IssuanceRequest.status` in `src/fixtures/issuer.ts` and
  `src/features/issuer/components/IssuanceRequestsTable.tsx`. Lifecycle state
  only begins once an asset has reached `minted` there.
- **Per-wallet transfer eligibility** is `src/lib/eligibility.ts`
  (Issue #55). Lifecycle state is asset-wide and issuer-driven; a paused
  asset will typically also affect eligibility (via the existing
  `assetPaused` flag on `AssetRestriction`), but this module does not compute
  eligibility itself — see "Known Limitation" below.

## Data Model
See `src/lib/assetLifecycle.ts` — a pure, framework-free module with no
React or SDK imports:
- `AssetLifecycleState` — `'active' | 'paused' | 'matured' | 'redeemed' | 'defaulted'`
- `AssetLifecycleEvent` — a single state entry with timestamp and optional note
- `AssetLifecycleStatus` — current state, since-timestamp, and full history
- `LIFECYCLE_STATE_INFO` — label/detail/tone metadata per state, used by the badge and timeline UI
- `validateTransition` / `applyLifecycleTransition` — pure, fail-closed transition validation

## State Machine

```
active  ──▶ paused ──▶ active (resume)
active  ──▶ matured ──▶ redeemed
active  ──▶ defaulted ──▶ redeemed  (wind-down / write-off)
paused  ──▶ defaulted ──▶ redeemed
redeemed = terminal (no further transitions)
```

Any transition not shown above is rejected by `validateTransition`,
including same-state "transitions" and anything attempted from `redeemed`.

## UI Components
- `src/features/assets/components/AssetLifecycleBadge.tsx` — small badge
  (label + tone-coloured background), same pattern as the existing
  `ComplianceBadge` / `TransferEligibilityBadge`.
- `src/features/assets/components/AssetLifecycleTimeline.tsx` — the fuller
  status UI: current badge, detail copy, ordered history, and (only when an
  `onTransition` callback is supplied) one button per allowed next state.
  Read-only by default; this component never calls the SDK itself.

## Integration
`PortfolioAsset` in `src/lib/aegis/types.ts` gained an **optional**
`lifecycleStatus?: AssetLifecycleStatus` field — additive, so it does not
break any existing consumer or test that constructs a `PortfolioAsset`
without it. `AssetCard` renders `AssetLifecycleBadge` next to the existing
compliance badge only when `lifecycleStatus` is present.

`src/fixtures/portfolio.ts` was updated to exercise three states
(`active`, `matured`, `paused`) plus the **absence** of the field entirely
on the asset that already has `isDataAvailable: false` — this is a
deliberate edge case: the UI must not assume a default state (e.g. "active")
when lifecycle data could not be resolved.

## Edge Cases Handled
| Case | Behavior |
|---|---|
| Same-state "transition" (e.g. active → active) | Rejected with a clear reason |
| Transition attempted from a terminal state (`redeemed`) | Rejected |
| Transition that skips required states (e.g. active → redeemed directly) | Rejected, reason lists the actually-allowed next states |
| Unrecognized/malformed state string reaching the validator | Rejected rather than throwing |
| `lifecycleStatus` absent (SDK could not resolve it) | Badge/timeline simply do not render; no default assumed |
| History rendering | Ordered oldest-first; notes shown when present |

## Security & Compliance Assumptions
- Lifecycle state reflects **issuer-reported operational status only** — it
  is not a legal or financial determination about the asset, its
  performance, or investment safety. `LIFECYCLE_STATE_INFO` wording is
  written to avoid implying otherwise (see the compliance-safe-wording test
  in `assetLifecycle.test.ts`), consistent with
  `docs/compliance-safe-wording.md`.
- This module does not gate transfers, minting, or any SDK call by itself.
  A `paused` or `defaulted` lifecycle state does **not** automatically block
  a transfer in the current codebase — that would need to flow through
  `src/lib/eligibility.ts`'s existing `assetPaused` input. Wiring the two
  together (e.g. deriving `assetPaused` from `lifecycleStatus.current`) is a
  natural follow-up, intentionally left out of this change to keep this PR
  focused and reviewable.
- `AssetLifecycleTimeline`'s action buttons are UI affordances only; no
  admin page in this PR actually wires `onTransition` to a real mutation.
  That's a real gap for a future issue (e.g. an issuer-facing lifecycle
  management page, sibling to `IssuanceRequestsTable`) but out of scope
  here — this PR delivers the model, validation, display, and integration
  point.

## Testing
- `src/lib/assetLifecycle.test.ts` — 21 tests covering terminal-state
  detection, allowed-next-state lookups, transition validation (valid and
  every rejected case above), pure `applyLifecycleTransition` behavior
  (including that the input status is never mutated), and a
  compliance-safe-wording check on the default copy.
- `src/features/assets/components/AssetLifecycleTimeline.test.tsx` — 6
  tests covering badge/detail rendering, ordered history with notes,
  read-only mode (no buttons), one button per allowed next state, the
  `onTransition` callback firing with the correct argument, and the
  terminal-state messaging path.
- Full suite (`npm run test`) passes at 325/325 after this change, with zero
  regressions to any pre-existing test.

## Asset Detail Activity Timeline

Asset detail pages also surface an activity timeline that captures registration, minting, transfer, compliance, and admin events where the connected data sources provide them. This timeline is distinct from the lifecycle status described above — lifecycle is a single state machine, while activity is a chronological list.

### Data Source Limitations
- Events are only shown when the underlying source (e.g., minting records, transfer history, compliance logs, admin actions) actually supplies them. If a source is unavailable or not enabled for a particular asset, the timeline shows an explicit empty state — it never fabricates or infers an event that might have existed.
- On-chain transfer and minting events may depend on block explorer or indexer availability. When explorer links cannot be constructed, the UI still displays the event but without a link.
- Off-chain compliance and admin events are only included if the backing data is present. Assets created before this feature was introduced may have no history for these event types.

## Related Documentation
- [Investor Transfer Eligibility](investor-transfer-eligibility.md) — per-wallet eligibility gating (Issue #55)
- [Investor Transfer Request Flow](investor-transfer-request-flow.md) — request-validation layer (Issue #41)
- [Compliance-Safe Wording Guidance](compliance-safe-wording.md) — canonical disclaimer conventions
