import { LOCK_MS, LockedQuote } from './types';
import { isExpired, zarCentsToUsdtBase } from './priceLock';

export function buildQuoteQuery(q: LockedQuote): string {
  return new URLSearchParams({ v: '1', id: q.txId, m: q.merchantId, n: q.merchantName, to: q.payTo, zar: String(q.zarCents),
    rate: String(q.rateMicroZarPerUsdt), usdt: q.usdtBase.toString(), ts: String(q.lockedAt), exp: String(q.expiresAt) }).toString();
}
/** Shareable link that opens the payer flow directly (hash route => works on any static host). */
export const buildPayLink = (origin: string, q: LockedQuote) => `${origin}/#/pay?${buildQuoteQuery(q)}`;

export type ParseResult = { ok: true; quote: LockedQuote } | { ok: false; reason: 'malformed' | 'expired' };
export function parsePayload(raw: string, now: number): ParseResult {
  try {
    const params = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
    const g = (k: string) => { const v = params.get(k); if (!v) throw new Error(k); return v; };
    if (g('v') !== '1') throw new Error('version');
    const quote: LockedQuote = { txId: g('id'), merchantId: g('m'), merchantName: g('n'), payTo: g('to'), zarCents: Number(g('zar')),
      rateMicroZarPerUsdt: Number(g('rate')), usdtBase: BigInt(g('usdt')), lockedAt: Number(g('ts')), expiresAt: Number(g('exp')) };
    if (!/^0x[0-9a-fA-F]{40}$/.test(quote.payTo)) throw new Error('address');
    if (zarCentsToUsdtBase(quote.zarCents, quote.rateMicroZarPerUsdt) !== quote.usdtBase) throw new Error('amount');
    if (quote.expiresAt - quote.lockedAt !== LOCK_MS) throw new Error('window');
    return isExpired(quote, now) ? { ok: false, reason: 'expired' } : { ok: true, quote };
  } catch { return { ok: false, reason: 'malformed' }; }
}
