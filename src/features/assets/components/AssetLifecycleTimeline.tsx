import AssetLifecycleBadge from './AssetLifecycleBadge';
import {
  LIFECYCLE_STATE_INFO,
  getAllowedNextStates,
  type AssetLifecycleStatus,
  type AssetLifecycleState,
} from '@/lib/assetLifecycle';

type AssetActivityType =
  | 'registration'
  | 'minting'
  | 'transfer'
  | 'compliance'
  | 'admin';

interface AssetActivityEvent {
  id: string;
  type: AssetActivityType;
  description: string;
  occurredAt: string;
  explorerLink?: string;
}

interface AssetLifecycleTimelineProps {
  status: AssetLifecycleStatus;
  /**
   * Additional asset activity (minting, transfer, compliance, admin, etc.)
   * to display alongside lifecycle state changes.
   */
  activities?: AssetActivityEvent[];
  /**
   * When provided, renders a button for each allowed next state and calls
   * this with the chosen state on click. Omit for a read-only view (e.g. the
   * investor-facing portfolio) — this component does not call the SDK
   * itself; wiring an actual transition through `useAegis`/a real mutation
   * is left to the caller.
   */
  onTransition?: (next: AssetLifecycleState) => void;
}

export default function AssetLifecycleTimeline({
  status,
  activities,
  onTransition,
}: AssetLifecycleTimelineProps) {
  const allowedNext = getAllowedNextStates(status.current);
  const currentInfo = LIFECYCLE_STATE_INFO[status.current];

  const lifecycleEvents = status.history.map((event, i) => ({
    id: `${event.state}-${event.occurredAt}-${i}`,
    timestamp: event.occurredAt,
    label: LIFECYCLE_STATE_INFO[event.state].label,
    note: event.note,
    explorerLink: undefined,
    type: 'lifecycle' as const,
  }));

  const activityEvents = (activities ?? []).map((activity) => ({
    id: activity.id,
    timestamp: activity.occurredAt,
    label: activity.description,
    note: undefined,
    explorerLink: activity.explorerLink,
    type: activity.type,
  }));

  const timelineEvents = [...lifecycleEvents, ...activityEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AssetLifecycleBadge state={status.current} />
        <span className="text-xs text-slate-500">since {new Date(status.since).toLocaleDateString()}</span>
      </div>

      <p className="text-sm text-slate-600">{currentInfo.detail}</p>

      {timelineEvents.length > 0 ? (
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
          {timelineEvents.map((event) => (
            <li key={event.id} className="text-sm">
              {event.explorerLink ? (
                <a
                  href={event.explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  <span className="font-medium text-slate-800">{event.label}</span>
                  <span className="text-slate-400"> &middot; {new Date(event.timestamp).toLocaleDateString()}</span>
                  {event.type !== 'lifecycle' && (
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">{event.type}</span>
                  )}
                </a>
              ) : (
                <>
                  <span className="font-medium text-slate-800">{event.label}</span>
                  <span className="text-slate-400"> &middot; {new Date(event.timestamp).toLocaleDateString()}</span>
                  {event.type !== 'lifecycle' && (
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">{event.type}</span>
                  )}
                </>
              )}
              {event.note && <p className="text-slate-500">{event.note}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-400">No asset activity is available.</p>
      )}

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
