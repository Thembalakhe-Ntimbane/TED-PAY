export const LOCK_MS = 60_000;

export interface LockedQuote {
  readonly txId: string;                 // UUID v4
  readonly merchantId: string;
  readonly merchantName: string;
  readonly payTo: string;                // unique per-request merchant address
  readonly zarCents: number;
  readonly rateMicroZarPerUsdt: number;  // locked rate x 1e6
  readonly usdtBase: bigint;             // 6-dp base units, rounded up
  readonly lockedAt: number;
  readonly expiresAt: number;
}
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';
export interface LedgerRecord {
  quote: LockedQuote; status: PaymentStatus; derivationIndex: number;
  txHash?: string; payerAddress?: string; confirmedAt?: number; refundTxHash?: string;
}
export interface Profile { merchantId: string; businessName: string; regNumber: string; email: string; country: string; }
