import { formatAmount } from '@/utils/formatting';
import ComplianceBadge from './ComplianceBadge';
import TransferEligibilityBadge from './TransferEligibilityBadge';
import TransferRestrictionExplainer from '@/features/investor/components/TransferRestrictionExplainer';
import type { PortfolioAsset } from '@/lib/aegis/types';

type AssetActivity = {
  id: string;
  type: string;
  description: string;
  date: string;
  explorerLink?: string;
};

interface AssetCardProps {
  asset: PortfolioAsset;
  onTransferClick: () => void;
  activity?: AssetActivity[];
}

export default function AssetCard({ asset, onTransferClick, activity }: AssetCardProps) {
  const { name, ticker, balance, metadata, compliance, transferEligibility, lifecycleStatus, isDataAvailable } = asset;
  const canTransfer = isDataAvailable && transferEligibility.state === 'eligible';

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-800">{name}</h3>
          <span className="text-xs font-semibold text-aegis-brand bg-blue-50 px-2 py-1 rounded">
            {ticker}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isDataAvailable && <ComplianceBadge compliance={compliance} />}
          {lifecycleStatus && <AssetLifecycleBadge state={lifecycleStatus.current} />}
        </div>
      </div>

      {isDataAvailable ? (
        <p className="text-sm text-slate-500 mb-4">
          {metadata.assetClass} &middot; {metadata.issuer} &middot; {metadata.jurisdiction}
        </p>
      ) : (
        <p className="text-sm text-amber-600 mb-4">
          Asset metadata is temporarily unavailable from the compliance registry. Your recorded balance is still shown below.
        </p>
      )}

      <div className="mb-4">
        <p className="text-sm text-slate-500 mb-1">Your Balance</p>
        <p className="text-2xl font-bold text-slate-900">
          {formatAmount(balance)} {ticker}
        </p>
      </div>

      <div className="mb-4">
        <TransferEligibilityBadge eligibility={transferEligibility} />
      </div>

      <div className="mb-6">
        <TransferRestrictionExplainer asset={asset} compact />
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Activity</h4>
        {activity ? (
          activity.length > 0 ? (
            <ul className="space-y-2">
              {activity.map((event) => (
                <li key={event.id} className="text-xs text-slate-600">
                  <span className="font-medium capitalize">{event.type}</span>
                  <span> &middot; {event.description}</span>
                  <span> &middot; {new Date(event.date).toLocaleDateString()}</span>
                  {event.explorerLink && (
                    <a href={event.explorerLink} target="_blank" rel="noopener noreferrer" className="text-aegis-brand hover:underline ml-1">
                      View on Explorer
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No activity available.</p>
          )
        ) : (
          <p className="text-xs text-slate-400">Activity data is currently unavailable.</p>
        )}
      </div>

      <button
        onClick={onTransferClick}
        disabled={!canTransfer}
        title={!canTransfer ? transferEligibility.reasons[0] ?? 'Transfer is unavailable for this asset.' : undefined}
        className="mt-auto w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
      >
        Transfer
      </button>
    </div>
  );
}
