export type TransactionStatus = 'success' | 'pending' | 'failed' | 'unknown';

export type TransactionOperation =
  | 'compliance_update'
  | 'mint'
  | 'transfer'
  | 'asset_registration'
  | 'admin_action';

export type TransactionSource = 'sdk_receipt' | 'contract_event' | 'placeholder';

export interface NormalizedTransaction {
  id: string;
  status: TransactionStatus;
  actor: string;
  target: string;
  operation: TransactionOperation;
  hash: string;
  timestamp: string;
  source: TransactionSource;
  assetTicker?: string;
  amount?: number;
  notes?: string;
  raw?: unknown;
}

export interface SdkReceiptRecord {
  kind: 'sdk_receipt';
  receiptId?: string;
  txHash?: string;
  successful?: boolean;
  signer?: string;
  recipient?: string;
  createdAt?: string | number | Date;
  action?: 'compliance_update' | 'mint' | 'asset_registration' | 'admin_action';
  amount?: number;
  assetTicker?: string;
  notes?: string;
}

export interface ContractEventRecord {
  kind: 'contract_event';
  eventId?: string;
  txHash?: string;
  eventType: string;
  actor?: string;
  target?: string;
  happenedAt?: string | number | Date;
  amount?: number;
  assetTicker?: string;
  status?: 'ok' | 'pending' | 'reverted';
  notes?: string;
}

export interface PlaceholderRecord {
  kind: 'placeholder';
  id: string;
  label?: string;
  status?: TransactionStatus;
  actor?: string;
  target?: string;
  timestamp?: string | number | Date;
  hash?: string;
  operation?: TransactionOperation;
  amount?: number;
  assetTicker?: string;
  notes?: string;
}

export type TransactionRecordInput = SdkReceiptRecord | ContractEventRecord | PlaceholderRecord;

export interface TransactionHistoryFilters {
  query: string;
  operations: TransactionOperation[];
  statuses: TransactionStatus[];
}

export interface ExplorerLink {
  url: string;
  label?: string;
}

export type ActivityTimelineCategory =
  | 'transaction'
  | 'compliance'
  | 'admin'
  | 'unknown';

export type ActivityTimelineState = 'available' | 'empty' | 'unavailable';

export interface ActivityTimeline {
  assetTicker?: string;
  events: NormalizedTransaction[];
  state: ActivityTimelineState;
  stateReason?: string;
}

export interface ActivityTimelineFilters extends TransactionHistoryFilters {
  categories: ActivityTimelineCategory[];
}
