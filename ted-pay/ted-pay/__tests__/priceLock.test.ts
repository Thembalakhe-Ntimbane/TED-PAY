import { createLockedQuote, isExpired, remainingMs, formatUsdt } from '../src/domain/priceLock';
import { buildPayUri, parsePayload } from '../src/domain/paymentUri';

const q = createLockedQuote({ txId: 'a', merchantId: 'm1', merchantName: 'Cape Table Cafe',
  payTo: '0x' + '1'.repeat(40), zarCents: 35000, rate: 20, now: 1_000 });

test('R350 at 20 ZAR/USDT = 17.5 USDT', () => expect(formatUsdt(q.usdtBase)).toBe('17.5'));
test('rounds up, never short', () => {
  const x = createLockedQuote({ ...{ txId: 'b', merchantId: 'm', merchantName: 'n', payTo: q.payTo }, zarCents: 100, rate: 18.4521, now: 0 });
  expect(x.usdtBase * 18452100n >= 100n * 10n ** 10n).toBe(true);
});
test('expires at exactly 60s', () => {
  expect(remainingMs(q, 1_000)).toBe(60_000);
  expect(isExpired(q, 60_999)).toBe(false);
  expect(isExpired(q, 61_000)).toBe(true);
});
test('URI round-trips and rejects expiry/tampering', () => {
  const uri = buildPayUri(q);
  expect(parsePayload(uri, 2_000).ok).toBe(true);
  expect(parsePayload(uri, 70_000)).toEqual({ ok: false, reason: 'expired' });
  expect(parsePayload(uri.replace('usdt=17500000', 'usdt=1'), 2_000)).toEqual({ ok: false, reason: 'malformed' });
});
