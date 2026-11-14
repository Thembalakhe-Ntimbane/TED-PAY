import { LOCK_MS, LockedQuote } from './types';
import { isExpired, zarCentsToUsdtBase } from './priceLock';

/** One canonical payload carried identically by QR, link and NFC. */
export function buildQuoteQuery(q: LockedQuote): string {
  return new URLSearchParams({
    v: '1', id: q.txId, m: q.merchantId, n: q.merchantName, to: q.payTo,
    zar: String(q.zarCents), rate: String(q.rateMicroZarPerUsdt), usdt: q.usdtBase.toString(),
    ts: String(q.lockedAt), exp: String(q.expiresAt),
  }).toString();
}
export const buildPayUri = (q: LockedQuote): string => `tedpay://pay?${buildQuoteQuery(q)}`;
export const buildPayLink = (base: string, q: LockedQuote): string => `${base}?${buildQuoteQuery(q)}`;

export type ParseResult =
  | { ok: true; quote: LockedQuote }
  | { ok: false; reason: 'malformed' | 'expired' };

/** Accepts tedpay:// and https pay links. Re-derives USDT from ZAR+rate and rejects any mismatch. */
export function parsePayload(raw: string, now: number): ParseResult {
  try {
    const params = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
    const g = (k: string): string => { const v = params.get(k); if (!v) throw new Error(k); return v; };
    if (g('v') !== '1') throw new Error('version');
    const quote: LockedQuote = {
      txId: g('id'), merchantId: g('m'), merchantName: g('n'), payTo: g('to'),
      zarCents: Number(g('zar')), rateMicroZarPerUsdt: Number(g('rate')), usdtBase: BigInt(g('usdt')),
      lockedAt: Number(g('ts')), expiresAt: Number(g('exp')),
    };
    if (!/^0x[0-9a-fA-F]{40}$/.test(quote.payTo)) throw new Error('address');
    if (zarCentsToUsdtBase(quote.zarCents, quote.rateMicroZarPerUsdt) !== quote.usdtBase) throw new Error('amount');
    if (quote.expiresAt - quote.lockedAt !== LOCK_MS) throw new Error('window');
    return isExpired(quote, now) ? { ok: false, reason: 'expired' } : { ok: true, quote };
  } catch { return { ok: false, reason: 'malformed' }; }
}
