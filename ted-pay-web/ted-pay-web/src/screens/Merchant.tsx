import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { env } from '@/lib/env';
import { buildPayLink } from '@/lib/paymentUri';
import { formatUsdt, formatZar, remainingMs } from '@/lib/priceLock';
import { nfcSupported, writeLinkToTag } from '@/lib/nfc';
import { downloadPdfProof, emailInvoice } from '@/lib/proof';
import { wallet } from '@/lib/wallet';
import { useStore } from '@/store';
import { Badge, Btn, Header, Keypad, TLoader, Tick, XMark, useToast } from '@/ui/components';

type Tab = 'pay' | 'tx' | 'analytics' | 'settings';
export const LANGUAGES = ['English', 'Deutsch', 'Nederlands', 'Français', '中文 (Mandarin)', 'Afrikaans', 'isiXhosa', 'isiZulu', 'Español', 'Português', 'Italiano', 'العربية', 'हिन्दी', '日本語'];

export default function Merchant({ onLock }: { onLock(): void }) {
  const [tab, setTab] = useState<Tab>('pay');
  const { active, received } = useStore();
  const requestOpen = !!active || !!received;
  const nav: Array<[Tab, string, string]> = [['pay', '▣', 'Payments'], ['tx', '☰', 'Transactions'], ['analytics', '▥', 'Analytics'], ['settings', '⚙', 'Settings']];
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {requestOpen ? <Request /> : tab === 'pay' ? <Pos goAnalytics={() => setTab('analytics')} /> : tab === 'tx' ? <Transactions /> : tab === 'analytics' ? <Analytics /> : <Settings onLock={onLock} />}
      </div>
      {!requestOpen && (
        <nav className="grid grid-cols-4 border-t border-line bg-white">
          {nav.map(([k, i, l]) => <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center py-2.5 text-[11px] font-semibold ${tab === k ? 'text-brand' : 'text-mute'}`}><span className="text-xl leading-none">{i}</span>{l}</button>)}
        </nav>)}
    </>
  );
}

/* ---------------- Point of sale ---------------- */
function Pos({ goAnalytics }: { goAnalytics(): void }) {
  const { profile, createRequest, busy, error, ledger } = useStore();
  const [amt, setAmt] = useState('');
  const key = (k: string) => setAmt((a) => {
    if (k === '⌫') return a.slice(0, -1);
    if (k === '.') return a.includes('.') || !a ? (a ? a : '0.') : a + '.';
    const next = a === '0' ? k : a + k;
    return /^\d{1,6}(\.\d{0,2})?$/.test(next) ? next : a;
  });
  const cents = Math.round(parseFloat(amt || '0') * 100);
  const week = ledger.filter((r) => r.status === 'completed' && Date.now() - r.quote.lockedAt < 7 * 864e5);
  if (busy) return <div className="grid flex-1 place-items-center"><TLoader label="Fetching live rate and locking it for 60 seconds…" /></div>;
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header right={<Badge>MERCHANT</Badge>} />
      <div className="flex flex-1 flex-col px-5 pb-3">
        <p className="text-sm text-mute">{profile?.businessName}</p>
        <h1 className="text-3xl font-extrabold">Let’s take a payment.</h1>
        <div className="mt-4 rounded-2xl bg-white p-5">
          <p className="text-xs font-bold tracking-wide text-brand">AMOUNT TO CHARGE</p>
          <p className={`mt-2 min-h-12 ${amt ? 'text-5xl font-extrabold' : 'pt-3 text-lg text-mute'}`}>{amt ? `R ${amt}` : 'Enter amount to charge in ZAR'}</p>
          <p className="mt-2 text-xs text-mute">USDT quote is fetched live when you create the request.</p>
        </div>
        {error && <p className="mt-2 text-sm text-brand">{error}</p>}
        <button onClick={goAnalytics} className="mt-3 flex items-center justify-between rounded-2xl bg-white p-4 text-left">
          <span><b className="block">Sales analytics</b><span className="text-sm text-mute">This week · {week.length} payments · {formatZar(week.reduce((a, r) => a + r.quote.zarCents, 0))}</span></span><span className="text-xl text-mute">›</span>
        </button>
        <div className="mt-auto"><Keypad onKey={key} /></div>
        <Btn disabled={cents <= 0} onClick={() => void createRequest(cents)}>Create payment request</Btn>
      </div>
    </div>
  );
}

/* ---------------- Live request (QR / link / NFC + 60s timer) ---------------- */
function Request() {
  const { active, received, cancelActive, expireActive, clearReceived, demoRate } = useStore();
  const [left, setLeft] = useState(60_000);
  const toast = useToast();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { const r = remainingMs(active.quote, Date.now()); setLeft(r); if (r === 0) expireActive(); }, 200);
    return () => clearInterval(t);
  }, [active, expireActive]);

  if (received) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Tick /><h1 className="text-3xl font-extrabold">Payment Received</h1>
      <p className="text-4xl font-extrabold">{formatZar(received.quote.zarCents)}</p><p className="text-brand">{formatUsdt(received.quote.usdtBase)} USDT</p>
      <p className="break-all text-xs text-mute">Confirmed on-chain · {received.txHash}</p>
      <div className="mt-4 w-full space-y-2"><Btn onClick={clearReceived}>Back to dashboard</Btn><Btn kind="ghost" onClick={() => downloadPdfProof(received)}>Download PDF proof</Btn></div>
    </div>);

  if (!active) return null;
  const q = active.quote;
  const link = buildPayLink(location.origin, q);
  const secs = Math.ceil(left / 1000);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header right={<Badge>MERCHANT</Badge>} />
      <div className="flex flex-1 flex-col items-center gap-2 px-5 pb-5 text-center">
        <p className="text-4xl font-extrabold">{formatZar(q.zarCents)}</p>
        <p className="font-semibold text-brand">{formatUsdt(q.usdtBase)} USDT · 1 USDT = R {(q.rateMicroZarPerUsdt / 1e6).toFixed(2)}{demoRate ? ' (demo rate)' : ''}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line"><div className={`h-full ${secs <= 10 ? 'bg-brand' : 'bg-ok'}`} style={{ width: `${(left / 60_000) * 100}%`, transition: 'width .2s linear' }} /></div>
        <p className={`text-2xl font-extrabold tabular-nums ${secs <= 10 ? 'text-brand' : ''}`}>0:{String(secs).padStart(2, '0')}</p>
        <div className="rounded-2xl bg-white p-4"><QRCodeSVG value={link} size={220} level="M" marginSize={1} /></div>
        <div className="grid w-full grid-cols-2 gap-2">
          <Btn kind="ghost" onClick={async () => { await navigator.clipboard.writeText(link); toast.show('Payment link copied'); }}>Copy link</Btn>
          {nfcSupported()
            ? <Btn kind="ghost" onClick={() => writeLinkToTag(link).then(() => toast.show('Hold a tag to the phone'), () => toast.show('NFC unavailable'))}>Write to NFC tag</Btn>
            : <Btn kind="ghost" disabled>NFC n/a</Btn>}
        </div>
        <div className="mt-2 flex items-center gap-3"><div className="scale-50"><TLoader /></div><span className="text-sm text-mute">Waiting for on-chain confirmation…</span></div>
        <Btn kind="ghost" onClick={cancelActive}>Cancel request</Btn>
      </div>
      {toast.node}
    </div>);
}

/* ---------------- Transactions ---------------- */
const statusStyle = { pending: 'text-amber-600', completed: 'text-ok', failed: 'text-brand', expired: 'text-brand', refunded: 'text-mute' } as const;
const statusLabel = { pending: 'Pending', completed: 'Completed', failed: 'Failed', expired: 'Failed (expired)', refunded: 'Refunded' } as const;

function Transactions() {
  const { ledger, refund, busy, error } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header /><h1 className="px-5 text-3xl font-extrabold">Transactions</h1>
      {error && <p className="px-5 pt-2 text-sm text-brand">{error}</p>}
      <div className="space-y-2 p-5">
        {ledger.length === 0 && <p className="mt-10 text-center text-mute">No payments yet. Create your first payment request.</p>}
        {ledger.map((r) => (
          <div key={r.quote.txId} className="rounded-2xl bg-white p-4">
            <button className="flex w-full items-start justify-between text-left" onClick={() => setOpen(open === r.quote.txId ? null : r.quote.txId)}>
              <span><b className="block text-lg">{formatZar(r.quote.zarCents)}</b><span className="text-sm text-mute">{formatUsdt(r.quote.usdtBase)} USDT · {new Date(r.quote.lockedAt).toLocaleString('en-ZA')}</span></span>
              <span className={`text-sm font-bold ${statusStyle[r.status]}`}>{statusLabel[r.status]}</span>
            </button>
            {open === r.quote.txId && (
              <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs text-mute">
                <p className="break-all">Receipt {r.quote.txId}</p>{r.txHash && <p className="break-all">Tx {r.txHash}</p>}{r.refundTxHash && <p className="break-all">Refund tx {r.refundTxHash}</p>}
                {(r.status === 'completed' || r.status === 'refunded') && (
                  <div className="grid gap-2 pt-1">
                    {r.status === 'completed' && <Btn kind="danger" disabled={busy} onClick={() => { if (confirm('Refund the full amount to the payer?')) void refund(r.quote.txId); }}>{busy ? 'Refunding…' : 'Issue Refund'}</Btn>}
                    <div className="grid grid-cols-2 gap-2"><Btn kind="ghost" onClick={() => downloadPdfProof(r)}>PDF proof</Btn><Btn kind="ghost" onClick={() => emailInvoice(r)}>Email invoice</Btn></div>
                  </div>)}
              </div>)}
          </div>))}
      </div>
    </div>
  );
}

/* ---------------- Weekly analytics ---------------- */
function Analytics() {
  const ledger = useStore((s) => s.ledger);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
  const done = ledger.filter((r) => r.status === 'completed');
  const totals = days.map((d) => done.filter((r) => new Date(r.quote.lockedAt).toDateString() === d.toDateString()).reduce((a, r) => a + r.quote.zarCents, 0));
  const counts = days.map((d) => done.filter((r) => new Date(r.quote.lockedAt).toDateString() === d.toDateString()).length);
  const max = Math.max(1, ...totals); const sum = totals.reduce((a, b) => a + b, 0); const n = counts.reduce((a, b) => a + b, 0);
  const best = totals.indexOf(Math.max(...totals));
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header /><div className="px-5">
        <p className="text-sm text-mute">Weekly performance</p><h1 className="text-4xl font-extrabold">{formatZar(sum)}</h1><p className="text-mute">{n} completed payments</p>
        <div className="mt-6 flex h-52 items-end gap-2 rounded-2xl bg-white p-4">
          {totals.map((t, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-md bg-brand" style={{ height: `${Math.max(2, (t / max) * 100)}%`, opacity: t ? 1 : 0.15 }} title={formatZar(t)} />
              <span className="text-[11px] text-mute">{days[i]!.toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2)}</span>
            </div>))}
        </div>
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm">
          <b>Insight</b>
          <p className="mt-1 text-mute">{n === 0 ? 'Take your first payment to unlock weekly insights.' : `Your best day was ${days[best]!.toLocaleDateString('en-ZA', { weekday: 'long' })} with ${formatZar(totals[best]!)}. Average sale: ${formatZar(Math.round(sum / n))}.`}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function Settings({ onLock }: { onLock(): void }) {
  const { profile, lang, setLang, resetAll } = useStore();
  const [section, setSection] = useState<'' | 'profile' | 'security' | 'lang'>('');
  const [pin, setPin] = useState(''); const [phrase, setPhrase] = useState<string | null>(null); const [err, setErr] = useState('');
  const Row = ({ s, t }: { s: 'profile' | 'security' | 'lang'; t: string }) => <button onClick={() => setSection(s)} className="flex w-full justify-between border-b border-line py-4 text-left text-lg">{t}<span className="text-mute">›</span></button>;
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header onBack={section ? () => setSection('') : undefined} /><div className="px-5 pb-6">
        <h1 className="mb-2 text-3xl font-extrabold">{section === 'profile' ? 'Profile' : section === 'security' ? 'Security' : section === 'lang' ? 'Language' : 'Settings'}</h1>
        {!section && <><Row s="profile" t="Profile management" /><Row s="security" t="Security" /><Row s="lang" t={`Language · ${lang}`} />
          <div className="mt-6 space-y-2"><Btn kind="ghost" onClick={onLock}>Lock app</Btn></div></>}
        {section === 'profile' && profile && <dl className="space-y-3 text-sm">{([['Business', profile.businessName], ['Registration', profile.regNumber], ['Email', profile.email], ['Country', profile.country], ['Merchant ID', profile.merchantId], ['Network', env.mock ? 'Simulated testnet (demo)' : `Chain ${env.chainId}`]] as const).map(([k, v]) => <div key={k}><dt className="text-mute">{k}</dt><dd className="text-base font-semibold">{v}</dd></div>)}</dl>}
        {section === 'security' && (<div className="space-y-3">
          <p className="text-mute">Your recovery phrase is encrypted on this device. Enter your PIN to reveal it.</p>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} type="password" inputMode="numeric" placeholder="PIN" className="w-full rounded-xl border border-line bg-white px-4 py-3" />
          <Btn kind="ghost" disabled={pin.length !== 6} onClick={async () => { const p = await wallet.reveal(pin); setPhrase(p); setErr(p ? '' : 'Incorrect PIN'); setPin(''); }}>Reveal recovery phrase</Btn>
          {err && <p className="text-sm text-brand">{err}</p>}{phrase && <p className="rounded-xl border border-line bg-white p-3 text-sm">{phrase}</p>}
          <Btn kind="danger" onClick={() => { if (confirm('Erase ALL data on this device? Without your recovery phrase funds are unrecoverable.')) void resetAll(); }}>Erase all data</Btn></div>)}
        {section === 'lang' && LANGUAGES.map((l, i) => (
          <div key={l}>{i === 5 && <p className="pb-1 pt-4 text-xs font-bold tracking-wide text-mute">MORE LANGUAGES</p>}{i === 0 && <p className="pb-1 text-xs font-bold tracking-wide text-mute">CAPE TOWN VISITORS</p>}
            <button onClick={() => void setLang(l)} className={`flex w-full justify-between border-b border-line py-3 ${lang === l ? 'font-bold text-brand' : ''}`}>{l}{lang === l && '✓'}</button></div>))}
        {section === 'lang' && <p className="pt-3 text-xs text-mute">Preference is saved; translated UI strings are the next milestone.</p>}
      </div>
    </div>
  );
}
