export const LOCK_MS = 60_000;
export const USDT_DECIMALS = 6;

/** Immutable quote created when a merchant taps "Create payment request". */
export interface LockedQuote {
  readonly txId: string;                 // UUID v4
  readonly merchantId: string;
  readonly merchantName: string;
  readonly payTo: string;                // per-request merchant address (unique per txId)
  readonly zarCents: number;             // integer: no float drift
  readonly rateMicroZarPerUsdt: number;  // locked rate x 1e6
  readonly usdtBase: bigint;             // USDT base units (6 dp), rounded UP
  readonly lockedAt: number;             // epoch ms
  readonly expiresAt: number;            // lockedAt + 60s
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';

export interface LedgerRecord {
  quote: LockedQuote;
  status: PaymentStatus;
  derivationIndex: number;
  txHash?: string;
  payerAddress?: string;
  confirmedAt?: number;
  refundTxHash?: string;
}
