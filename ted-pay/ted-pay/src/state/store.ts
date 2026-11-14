import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { env } from '@/config/env';
import { fetchZarPerUsdt } from '@/data/rateService';
import { wdkGateway } from '@/data/wdkGateway';
import { watchForPayment } from '@/data/ledgerService';
import { createLockedQuote, isExpired } from '@/domain/priceLock';
import { LedgerRecord, LockedQuote } from '@/domain/types';
import { authorizePayment } from '@/services/auth';

const MERCHANT = { id: 'MER-CAPETABLE-001', name: 'Cape Table Café' }; // replace with onboarding profile

type Outcome = { kind: 'received' | 'declined'; record: LedgerRecord } | null;

interface State {
  ledger: LedgerRecord[];
  active: LedgerRecord | null;     // merchant: request on screen
  outcome: Outcome;
  nextIndex: number;
  busy: boolean;
  createRequest(zarCents: number): Promise<void>;
  cancelActive(): void;
  expireActive(): void;
  payerPay(quote: LockedQuote): Promise<'ok' | 'declined'>;
  refund(txId: string): Promise<void>;
  clearOutcome(): void;
}

let watcher: AbortController | null = null;
const patch = (l: LedgerRecord[], id: string, p: Partial<LedgerRecord>) => l.map((r) => (r.quote.txId === id ? { ...r, ...p } : r));

export const useStore = create<State>((set, get) => ({
  ledger: [], active: null, outcome: null, nextIndex: 1, busy: false,

  async createRequest(zarCents) {
    set({ busy: true });
    try {
      const rate = await fetchZarPerUsdt();                       // live rate, no hardcoding
      const idx = get().nextIndex;
      const quote = createLockedQuote({ txId: uuid(), merchantId: MERCHANT.id, merchantName: MERCHANT.name,
        payTo: await wdkGateway.getAddress(idx), zarCents, rate, now: Date.now() });
      const rec: LedgerRecord = { quote, status: 'pending', derivationIndex: idx };
      set((s) => ({ active: rec, ledger: [rec, ...s.ledger], nextIndex: idx + 1 }));
      watcher?.abort(); watcher = new AbortController();
      void watchForPayment(rec, (p) => {                           // merchant truth = chain, not payer flags
        if (get().active?.quote.txId !== quote.txId) return;
        if (!p) return get().expireActive();
        const done = { status: 'completed' as const, txHash: p.hash, payerAddress: p.from, confirmedAt: Date.now() };
        set((s) => ({ ledger: patch(s.ledger, quote.txId, done), active: null, outcome: { kind: 'received', record: { ...rec, ...done } } }));
      }, watcher.signal);
    } finally { set({ busy: false }); }
  },

  cancelActive() { watcher?.abort(); const a = get().active; if (a) set((s) => ({ active: null, ledger: patch(s.ledger, a.quote.txId, { status: 'failed' }) })); },

  expireActive() {          // 60 s elapsed: invalidate, abort, force a fresh rate next time
    watcher?.abort(); const a = get().active; if (!a) return;
    set((s) => ({ active: null, ledger: patch(s.ledger, a.quote.txId, { status: 'expired' }) }));
  },

  async payerPay(quote) {
    if (isExpired(quote, Date.now())) return 'declined';
    if (!(await authorizePayment(`Pay ${quote.merchantName}`))) return 'declined';
    try {
      const send = wdkGateway.sendUsdt(0, quote.payTo, quote.usdtBase);
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), Math.max(0, quote.expiresAt - Date.now())));
      await Promise.race([send, timeout]);
      return 'ok';
    } catch { return 'declined'; }   // UI shows bold X + "Payment Declined."
  },

  async refund(txId) {
    const rec = get().ledger.find((r) => r.quote.txId === txId);
    if (!rec || rec.status !== 'completed' || !rec.payerAddress) return;
    set({ busy: true });
    try {
      const { hash } = await wdkGateway.sendUsdt(rec.derivationIndex, rec.payerAddress, rec.quote.usdtBase);
      set((s) => ({ ledger: patch(s.ledger, txId, { status: 'refunded', refundTxHash: hash }) }));
    } finally { set({ busy: false }); }
  },

  clearOutcome() { set({ outcome: null }); },
}));
void env;
