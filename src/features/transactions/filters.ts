import {
  NormalizedTransaction,
  TransactionHistoryFilters,
  TransactionOperation,
  TransactionStatus,
} from '@/features/transactions/types';

export const TRANSACTION_OPERATIONS: TransactionOperation[] = [
  'compliance_update',
  'mint',
  'transfer',
  'asset_registration',
  'admin_action',
];

export const TRANSACTION_STATUSES: TransactionStatus[] = ['success', 'pending', 'failed', 'unknown'];

export interface TimelineTransactionHistoryFilters extends TransactionHistoryFilters {
  /** Optional inclusive start date (ISO string) for filtering by timestamp. */
  dateFrom?: string | null;
  /** Optional inclusive end date (ISO string) for filtering by timestamp. */
  dateTo?: string | null;
}

export const defaultTransactionHistoryFilters: TimelineTransactionHistoryFilters = {
  query: '',
  operations: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
};

export const applyTransactionFilters = (
  records: NormalizedTransaction[],
  filters: TimelineTransactionHistoryFilters
): NormalizedTransaction[] => {
  const query = filters.query.trim().toLowerCase();
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const dateTo = filters.dateTo ? new Date(filters.dateTo).getTime() : null;

  return records.filter((record) => {
    const operationMatches =
      filters.operations.length === 0 || filters.operations.includes(record.operation);

    const statusMatches = filters.statuses.length === 0 || filters.statuses.includes(record.status);

    const queryMatches =
      query.length === 0 ||
      record.actor.toLowerCase().includes(query) ||
      record.target.toLowerCase().includes(query) ||
      record.hash.toLowerCase().includes(query) ||
      record.operation.toLowerCase().includes(query) ||
      (record.assetTicker ? record.assetTicker.toLowerCase().includes(query) : false);

    const timestamp = record.timestamp ? new Date(record.timestamp).getTime() : null;
    let dateMatches = true;
    if (timestamp !== null) {
      if (dateFrom !== null && timestamp < dateFrom) {
        dateMatches = false;
      }
      if (dateTo !== null && timestamp > dateTo) {
        dateMatches = false;
      }
    } else if (filters.dateFrom || filters.dateTo) {
      dateMatches = false;
    }

    return operationMatches && statusMatches && queryMatches && dateMatches;
  });
};