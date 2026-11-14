import { create } from 'zustand';
import { env } from '@/lib/env';
import { store as db } from '@/lib/storage';
import { uuid } from '@/lib/crypto';
import { fetchRate } from '@/lib/rate';
import { watchForPayment } from '@/lib/chain';
import { createLockedQuote, isExpired } from '@/lib/priceLock';
import { wallet } from '@/lib/wallet';
import { LedgerRecord, LockedQuote, Profile } from '@/lib/types';

interface State {
  ready: boolean; profile: Profile | null; lang: string; ledger: LedgerRecord[]; nextIndex: number;
  active: LedgerRecord | null; received: LedgerRecord | null; busy: boolean; demoRate: boolean; error: string | null;
  init(): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  setLang(l: string): Promise<void>;
  createRequest(zarCents: number): Promise<boolean>;
  cancelActive(): void; expireActive(): void; clearReceived(): void;
  payerPay(q: LockedQuote, pin: string): Promise<{ ok: true; hash: string } | { ok: false; reason: string }>;
  refund(txId: string): Promise<void>;
  resetAll(): Promise<void>;
}

let watcher: AbortController | null = null;
const patch = (l: LedgerRecord[], id: string, p: Partial<LedgerRecord>) => l.map((r) => (r.quote.txId === id ? { ...r, ...p } : r));
// JSON can't hold bigint: serialise usdtBase as string.
const ser = (l: LedgerRecord[]) => JSON.stringify(l, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v));
const de = (s: string): LedgerRecord[] => JSON.parse(s, (_k, v) => (typeof v === 'string' && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v));
const persist = (s: State) => { void db.set('ledger', ser(s.ledger)); void db.set('nextIndex', s.nextIndex); };

export const useStore = create<State>((set, get) => ({
  ready: false, profile: null, lang: 'English', ledger: [], nextIndex: 1, active: null, received: null, busy: false, demoRate: false, error: null,

  async init() {
    const [profile, lang, ledger, nextIndex] = await Promise.all([db.get<Profile>('profile'), db.get<string>('lang'), db.get<string>('ledger'), db.get<number>('nextIndex')]);
    const now = Date.now();
    const l = (ledger ? de(ledger) : []).map((r) => (r.status === 'pending' && isExpired(r.quote, now) ? { ...r, status: 'expired' as const } : r));
    set({ ready: true, profile: profile ?? null, lang: lang ?? 'English', ledger: l, nextIndex: nextIndex ?? 1 });
  },
  async saveProfile(p) { await db.set('profile', p); set({ profile: p }); },
  async setLang(l) { await db.set('lang', l); set({ lang: l }); },

  async createRequest(zarCents) {
    const { profile, nextIndex } = get();
    if (!profile) return false;
    set({ busy: true, error: null });
    try {
      const rate = await fetchRate();                                  // fresh live rate every time
      const quote = createLockedQuote({ txId: uuid(), merchantId: profile.merchantId, merchantName: profile.businessName,
        payTo: wallet.address(nextIndex), zarCents, rate: rate.zarPerUsdt, now: Date.now() });
      const rec: LedgerRecord = { quote, status: 'pending', derivationIndex: nextIndex };
      set((s) => ({ active: rec, ledger: [rec, ...s.ledger], nextIndex: nextIndex + 1, demoRate: rate.demo }));
      persist(get());
      watcher?.abort(); watcher = new AbortController();
      void watchForPayment(rec, (p) => {                                // merchant truth comes from the chain only
        if (get().active?.quote.txId !== quote.txId) return;
        if (!p) return get().expireActive();
        const done = { status: 'completed' as const, txHash: p.hash, payerAddress: p.from, confirmedAt: Date.now() };
        set((s) => ({ ledger: patch(s.ledger, quote.txId, done), active: null, received: { ...rec, ...done } }));
        persist(get());
      }, watcher.signal);
      return true;
    } catch (e) { set({ error: e instanceof Error ? e.message : 'Could not fetch a live rate' }); return false; }
    finally { set({ busy: false }); }
  },
  cancelActive() { watcher?.abort(); const a = get().active; if (a) { set((s) => ({ active: null, ledger: patch(s.ledger, a.quote.txId, { status: 'failed' }) })); persist(get()); } },
  expireActive() { watcher?.abort(); const a = get().active; if (a) { set((s) => ({ active: null, ledger: patch(s.ledger, a.quote.txId, { status: 'expired' }) })); persist(get()); } },
  clearReceived() { set({ received: null }); },

  async payerPay(q, pin) {
    if (isExpired(q, Date.now())) return { ok: false, reason: 'expired' };
    if (!(await wallet.verifyPin(pin))) return { ok: false, reason: 'pin' };
    try { return { ok: true, hash: await wallet.sendUsdt(0, q.payTo, q.usdtBase, q.expiresAt) }; }
    catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'failed' }; }
  },

  async refund(txId) {
    const r = get().ledger.find((x) => x.quote.txId === txId);
    if (!r || r.status !== 'completed' || !r.payerAddress) return;
    set({ busy: true, error: null });
    try {
      const hash = await wallet.sendUsdt(r.derivationIndex, r.payerAddress, r.quote.usdtBase, Date.now() + 120_000);
      set((s) => ({ ledger: patch(s.ledger, txId, { status: 'refunded', refundTxHash: hash }) })); persist(get());
    } catch (e) { set({ error: e instanceof Error ? `Refund failed: ${e.message}` : 'Refund failed' }); }
    finally { set({ busy: false }); }
  },
  async resetAll() { wallet.lock(); await db.clear(); localStorage.removeItem('tedpay.mockchain'); location.hash = ''; location.reload(); },
}));
void env;
