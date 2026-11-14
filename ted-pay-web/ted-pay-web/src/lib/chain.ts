import { env } from './env';
import { LedgerRecord } from './types';
import { randomHex } from './crypto';

export interface OnChainPayment { hash: string; from: string; amount: bigint }

/* ---------- Mock chain: shared across tabs of the same browser via localStorage ---------- */
const MOCK_KEY = 'tedpay.mockchain';
interface MockTx { hash: string; from: string; to: string; amount: string }
const readMock = (): MockTx[] => JSON.parse(localStorage.getItem(MOCK_KEY) ?? '[]') as MockTx[];
export async function mockTransfer(from: string, to: string, amount: bigint): Promise<string> {
  await new Promise((r) => setTimeout(r, 1800)); // simulated block time
  const hash = randomHex(32);
  localStorage.setItem(MOCK_KEY, JSON.stringify([...readMock(), { hash, from, to, amount: amount.toString() }]));
  return hash;
}

/* ---------- Real chain: plain JSON-RPC ---------- */
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad = (a: string) => '0x' + a.toLowerCase().replace('0x', '').padStart(64, '0');
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(env.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error || j.result === undefined) throw new Error(j.error?.message ?? 'RPC error');
  return j.result;
}

/** Ledger truth for the merchant: USDT Transfer into this request's address, in a mined (status 1) tx. */
export async function findPayment(rec: LedgerRecord): Promise<OnChainPayment | null> {
  const need = rec.quote.usdtBase;
  if (env.mock) {
    const t = readMock().find((x) => x.to.toLowerCase() === rec.quote.payTo.toLowerCase() && BigInt(x.amount) >= need);
    return t ? { hash: t.hash, from: t.from, amount: BigInt(t.amount) } : null;
  }
  const head = parseInt(await rpc<string>('eth_blockNumber', []), 16);
  const logs = await rpc<Array<{ transactionHash: string; topics: string[]; data: string }>>('eth_getLogs', [{
    address: env.usdt, fromBlock: '0x' + Math.max(0, head - 3000).toString(16), toBlock: 'latest', topics: [TRANSFER_TOPIC, null, pad(rec.quote.payTo)] }]);
  for (const l of logs) {
    if (BigInt(l.data) < need) continue;
    const r = await rpc<{ status: string } | null>('eth_getTransactionReceipt', [l.transactionHash]);
    if (r?.status === '0x1') return { hash: l.transactionHash, from: '0x' + (l.topics[1] ?? '').slice(26), amount: BigInt(l.data) };
  }
  return null;
}

/** Polls until paid/mined, the 60 s window closes, or aborted. */
export async function watchForPayment(rec: LedgerRecord, onDone: (p: OnChainPayment | null) => void, signal: AbortSignal) {
  while (!signal.aborted) {
    try { const p = await findPayment(rec); if (p) return onDone(p); } catch { /* transient: keep polling */ }
    if (Date.now() >= rec.quote.expiresAt) return onDone(null);
    await new Promise((r) => setTimeout(r, env.pollMs));
  }
}
