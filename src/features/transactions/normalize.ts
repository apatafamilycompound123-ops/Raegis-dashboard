import {
  NormalizedTransaction,
  TransactionOperation,
  TransactionRecordInput,
  TransactionStatus,
} from '@/features/transactions/types';

const UNKNOWN_ACTOR = 'unknown-actor';
const UNKNOWN_TARGET = 'unknown-target';
const UNKNOWN_HASH = 'unavailable';

const createId = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const toIsoString = (value?: string | number | Date): string => {
  if (!value) return new Date().toISOString();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
};

const inferEventOperation = (eventType?: string): TransactionOperation => {
  const lowered = (eventType ?? '').toLowerCase();
  if (lowered.includes('compliance') || lowered.includes('whitelist')) return 'compliance_update';
  if (lowered.includes('mint')) return 'mint';
  if (lowered.includes('transfer')) return 'transfer';
  if (lowered.includes('register') || lowered.includes('asset')) return 'asset_registration';
  return 'admin_action';
};

const mapEventStatus = (status?: 'ok' | 'pending' | 'reverted'): TransactionStatus => {
  if (status === 'ok') return 'success';
  if (status === 'pending') return 'pending';
  if (status === 'reverted') return 'failed';
  return 'unknown';
};

export const normalizeTransactionRecord = (record: TransactionRecordInput): NormalizedTransaction => {
  if (record.kind === 'sdk_receipt') {
    return {
      id: record.receiptId ?? createId('sdk'),
      status: record.successful === undefined ? 'unknown' : record.successful ? 'success' : 'failed',
      actor: record.signer ?? UNKNOWN_ACTOR,
      target: record.recipient ?? UNKNOWN_TARGET,
      operation: inferEventOperation(record.action),
      hash: record.txHash ?? UNKNOWN_HASH,
      timestamp: toIsoString(record.createdAt),
      source: 'sdk_receipt',
      amount: record.amount,
      assetTicker: record.assetTicker,
      notes: record.notes,
      raw: record,
    };
  }

  if (record.kind === 'contract_event') {
    return {
      id: record.eventId ?? createId('event'),
      status: mapEventStatus(record.status),
      actor: record.actor ?? UNKNOWN_ACTOR,
      target: record.target ?? UNKNOWN_TARGET,
      operation: inferEventOperation(record.eventType),
      hash: record.txHash ?? UNKNOWN_HASH,
      timestamp: toIsoString(record.happenedAt),
      source: 'contract_event',
      amount: record.amount,
      assetTicker: record.assetTicker,
      notes: record.notes ?? `Raw event type: ${record.eventType}`,
      raw: record,
    };
  }

  return {
    id: record.id,
    status: record.status ?? 'unknown',
    actor: record.actor ?? UNKNOWN_ACTOR,
    target: record.target ?? UNKNOWN_TARGET,
    operation: record.operation ?? inferEventOperation(record.operation),
    hash: record.hash ?? UNKNOWN_HASH,
    timestamp: toIsoString(record.timestamp),
    source: 'placeholder',
    amount: record.amount,
    assetTicker: record.assetTicker,
    notes: record.notes ?? record.label,
    raw: record,
  },
};
