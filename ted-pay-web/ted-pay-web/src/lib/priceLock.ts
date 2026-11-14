import { LOCK_MS, LockedQuote } from './types';

export function rateToMicro(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid exchange rate');
  return Math.round(rate * 1e6);
}
/** usdtBase = cents*1e10 / rateMicro, rounded UP so the merchant is never short. */
export function zarCentsToUsdtBase(zarCents: number, rateMicro: number): bigint {
  if (!Number.isInteger(zarCents) || zarCents <= 0) throw new Error('Invalid ZAR amount');
  const r = BigInt(rateMicro);
  return (BigInt(zarCents) * 10n ** 10n + r - 1n) / r;
}
export function createLockedQuote(p: { txId: string; merchantId: string; merchantName: string; payTo: string; zarCents: number; rate: number; now: number }): LockedQuote {
  const rateMicro = rateToMicro(p.rate);
  return { txId: p.txId, merchantId: p.merchantId, merchantName: p.merchantName, payTo: p.payTo, zarCents: p.zarCents,
    rateMicroZarPerUsdt: rateMicro, usdtBase: zarCentsToUsdtBase(p.zarCents, rateMicro), lockedAt: p.now, expiresAt: p.now + LOCK_MS };
}
export const remainingMs = (q: LockedQuote, now: number) => Math.max(0, q.expiresAt - now);
export const isExpired = (q: LockedQuote, now: number) => now >= q.expiresAt;
export function formatUsdt(base: bigint): string {
  const s = base.toString().padStart(7, '0');
  const frac = s.slice(-6).replace(/0+$/, '');
  return frac ? `${s.slice(0, -6)}.${frac}` : s.slice(0, -6);
}
export const formatZar = (cents: number) => `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
