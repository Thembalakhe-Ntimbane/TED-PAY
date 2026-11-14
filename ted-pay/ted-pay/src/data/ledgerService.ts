import { env } from '@/config/env';
import { LedgerRecord } from '@/domain/types';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad = (a: string) => '0x' + a.toLowerCase().replace('0x', '').padStart(64, '0');

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(env.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error || j.result === undefined) throw new Error(j.error?.message ?? 'RPC error');
  return j.result;
}

export interface OnChainPayment { hash: string; from: string; amount: bigint; blockNumber: number; }

/** Ledger truth: Transfer(USDT) logs into the per-request address. Never trusts payer-side flags. */
export async function findPayment(rec: LedgerRecord): Promise<OnChainPayment | null> {
  const logs = await rpc<Array<{ transactionHash: string; topics: string[]; data: string; blockNumber: string }>>('eth_getLogs', [{
    address: env.usdtContract, fromBlock: 'earliest', toBlock: 'latest',
    topics: [TRANSFER_TOPIC, null, pad(rec.quote.payTo)],
  }]);
  for (const l of logs) {
    const amount = BigInt(l.data);
    if (amount >= rec.quote.usdtBase) {
      return { hash: l.transactionHash, from: '0x' + (l.topics[1] ?? '').slice(26), amount, blockNumber: parseInt(l.blockNumber, 16) };
    }
  }
  return null;
}

/** Mined = receipt exists with status 0x1. */
export async function isMined(hash: string): Promise<boolean> {
  const r = await rpc<{ status: string } | null>('eth_getTransactionReceipt', [hash]);
  return !!r && r.status === '0x1';
}

/** Polls until the payment is mined, the 60 s window closes, or aborted. */
export async function watchForPayment(rec: LedgerRecord, onDone: (p: OnChainPayment | null) => void, signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const p = await findPayment(rec);
      if (p && (await isMined(p.hash))) return onDone(p);
    } catch { /* transient network error: keep polling until the lock expires */ }
    if (Date.now() >= rec.quote.expiresAt) return onDone(null);
    await new Promise((r) => setTimeout(r, env.ledgerPollMs));
  }
}
