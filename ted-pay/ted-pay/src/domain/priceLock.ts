import { LOCK_MS, LockedQuote } from './types';

/** 18.4521 -> 18452100 (micro ZAR per USDT). */
export function rateToMicro(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid exchange rate');
  return Math.round(rate * 1e6);
}

/** usdtBase = (cents/100) / (rateMicro/1e6) * 1e6 = cents*1e10 / rateMicro, rounded up. */
export function zarCentsToUsdtBase(zarCents: number, rateMicro: number): bigint {
  if (!Number.isInteger(zarCents) || zarCents <= 0) throw new Error('Invalid ZAR amount');
  const r = BigInt(rateMicro);
  return (BigInt(zarCents) * 10n ** 10n + r - 1n) / r;
}

export function createLockedQuote(p: {
  txId: string; merchantId: string; merchantName: string; payTo: string;
  zarCents: number; rate: number; now: number;
}): LockedQuote {
  const rateMicro = rateToMicro(p.rate);
  return {
    txId: p.txId, merchantId: p.merchantId, merchantName: p.merchantName, payTo: p.payTo,
    zarCents: p.zarCents, rateMicroZarPerUsdt: rateMicro,
    usdtBase: zarCentsToUsdtBase(p.zarCents, rateMicro),
    lockedAt: p.now, expiresAt: p.now + LOCK_MS,
  };
}

export const remainingMs = (q: LockedQuote, now: number): number => Math.max(0, q.expiresAt - now);
export const isExpired = (q: LockedQuote, now: number): boolean => now >= q.expiresAt;

export function formatUsdt(base: bigint): string {
  const s = base.toString().padStart(7, '0');
  const whole = s.slice(0, -6);
  const frac = s.slice(-6).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
export const formatZar = (cents: number): string => `R ${(cents / 100).toFixed(2)}`;
