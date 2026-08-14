import AssetLifecycleBadge from './AssetLifecycleBadge';
import {
  LIFECYCLE_STATE_INFO,
  getAllowedNextStates,
  type AssetLifecycleStatus,
  type AssetLifecycleState,
} from '@/lib/assetLifecycle';

interface AssetLifecycleTimelineProps {
  status: AssetLifecycleStatus;
  /**
   * When provided, renders a button for each allowed next state and calls
   * this with the chosen state on click. Omit for a read-only view (e.g. the
   * investor-facing portfolio) — this component does not call the SDK
   * itself; wiring an actual transition through `useAegis`/a real mutation
   * is left to the caller.
   */
  onTransition?: (next: AssetLifecycleState) => void;
}

export default function AssetLifecycleTimeline({ status, onTransition }: AssetLifecycleTimelineProps) {
  const allowedNext = getAllowedNextStates(status.current);
  const currentInfo = LIFECYCLE_STATE_INFO[status.current];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AssetLifecycleBadge state={status.current} />
        <span className="text-xs text-slate-500">since {new Date(status.since).toLocaleDateString()}</span>
      </div>

      <p className="text-sm text-slate-600">{currentInfo.detail}</p>

      <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
        {status.history.map((event, i) => {
          const info = LIFECYCLE_STATE_INFO[event.state];
          return (
            <li key={`${event.state}-${event.occurredAt}-${i}`} className="text-sm">
              <span className="font-medium text-slate-800">{info.label}</span>
              <span className="text-slate-400"> &middot; {new Date(event.occurredAt).toLocaleDateString()}</span>
              {event.note && <p className="text-slate-500">{event.note}</p>}
            </li>
          );
        })}
      </ol>

      {onTransition && allowedNext.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Available actions</p>
          <div className="flex flex-wrap gap-2">
            {allowedNext.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => onTransition(next)}
                className="text-xs font-medium px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 transition"
              >
                Mark as {LIFECYCLE_STATE_INFO[next].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {onTransition && allowedNext.length === 0 && (
        <p className="text-xs text-slate-400">This is a terminal state; no further transitions are available.</p>
      )}
    </div>
  );
}
