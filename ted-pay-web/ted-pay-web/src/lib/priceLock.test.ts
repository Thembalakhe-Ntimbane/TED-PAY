import { describe, expect, it } from 'vitest';
import { createLockedQuote, formatUsdt, isExpired } from './priceLock';
import { buildPayLink, parsePayload } from './paymentUri';
import { decryptWithPin, encryptWithPin } from './crypto';

const q = createLockedQuote({ txId: 'a', merchantId: 'm', merchantName: 'Cafe', payTo: '0x' + '1'.repeat(40), zarCents: 35000, rate: 20, now: 1000 });
describe('price lock', () => {
  it('R350 @ 20 = 17.5 USDT', () => expect(formatUsdt(q.usdtBase)).toBe('17.5'));
  it('expires at 60s', () => { expect(isExpired(q, 60_999)).toBe(false); expect(isExpired(q, 61_000)).toBe(true); });
  it('link round-trips, rejects expiry & tampering', () => {
    const link = buildPayLink('https://x.app', q);
    expect(parsePayload(link, 2000).ok).toBe(true);
    expect(parsePayload(link, 70_000)).toEqual({ ok: false, reason: 'expired' });
    expect(parsePayload(link.replace('usdt=17500000', 'usdt=1'), 2000).ok).toBe(false);
  });
});
describe('crypto', () => {
  it('AES-GCM vault round-trip; wrong PIN fails', async () => {
    const v = await encryptWithPin('seed words', '123456');
    expect(await decryptWithPin(v, '123456')).toBe('seed words');
    await expect(decryptWithPin(v, '000000')).rejects.toBeTruthy();
  });
});
