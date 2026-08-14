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

export const defaultTransactionHistoryFilters: TransactionHistoryFilters = {
  query: '',
  operations: [],
  statuses: [],
};

export const applyTransactionFilters = (
  records: NormalizedTransaction[],
  filters: TransactionHistoryFilters
): NormalizedTransaction[] => {
  const query = filters.query.trim().toLowerCase();

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

    return operationMatches && statusMatches && queryMatches;
  });
};
