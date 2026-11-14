import { useEffect, useRef, useState } from 'react';
import { parsePayload } from '@/lib/paymentUri';
import { formatUsdt, formatZar, remainingMs } from '@/lib/priceLock';
import { nfcSupported, readLinkFromTag } from '@/lib/nfc';
import { LockedQuote } from '@/lib/types';
import { useStore } from '@/store';
import { Badge, Btn, Header, PinInput, TLoader, Tick, XMark } from '@/ui/components';

type Phase = { t: 'scan' } | { t: 'confirm'; q: LockedQuote } | { t: 'sending' } | { t: 'done'; hash: string; q: LockedQuote } | { t: 'declined'; why: string };
/* eslint-disable @typescript-eslint/no-explicit-any */

export default function Payer({ initialLink, onExit }: { initialLink: string | null; onExit(): void }) {
  const [phase, setPhase] = useState<Phase>({ t: 'scan' });
  const [link, setLink] = useState('');
  const [pin, setPin] = useState('');
  const [left, setLeft] = useState(0);
  const [cam, setCam] = useState(false);
  const payerPay = useStore((s) => s.payerPay);

  const ingest = (raw: string) => {
    const r = parsePayload(raw, Date.now());
    setPin(''); setPhase(r.ok ? { t: 'confirm', q: r.quote } : { t: 'declined', why: r.reason === 'expired' ? 'This payment request has expired.' : 'This payment request is not valid.' });
    if (location.hash.startsWith('#/pay')) history.replaceState(null, '', location.pathname);
  };
  useEffect(() => { if (initialLink) ingest(initialLink); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (phase.t !== 'confirm') return;
    const q = phase.q;
    const t = setInterval(() => { const r = remainingMs(q, Date.now()); setLeft(r); if (r === 0) setPhase({ t: 'declined', why: 'The 60-second price lock expired.' }); }, 200);
    return () => clearInterval(t);
  }, [phase]);

  const pay = async (q: LockedQuote) => {
    setPhase({ t: 'sending' });
    const r = await payerPay(q, pin);
    if (r.ok) setPhase({ t: 'done', hash: r.hash, q });
    else if (r.reason === 'pin') { setPhase({ t: 'confirm', q }); setPin(''); alert('Incorrect PIN'); }
    else setPhase({ t: 'declined', why: r.reason });
  };

  if (phase.t === 'sending') return <div className="grid flex-1 place-items-center"><TLoader label="Confirming payment…" /></div>;
  if (phase.t === 'done') return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><Tick /><h1 className="text-3xl font-extrabold">Payment sent</h1>
      <p>{formatZar(phase.q.zarCents)} to {phase.q.merchantName}</p><p className="break-all text-xs text-mute">{phase.hash}</p><Btn onClick={() => setPhase({ t: 'scan' })}>Done</Btn></div>);
  if (phase.t === 'declined') return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"><XMark /><h1 className="text-3xl font-extrabold">Payment Declined.</h1>
      <p className="text-sm text-mute">{phase.why}</p><Btn onClick={() => setPhase({ t: 'scan' })}>Try again</Btn></div>);

  if (phase.t === 'confirm') {
    const q = phase.q; const secs = Math.ceil(left / 1000);
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <Header right={<Badge>PAYER</Badge>} onBack={() => setPhase({ t: 'scan' })} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <p className="text-xs font-bold tracking-wide text-brand">VERIFIED REQUEST · EXPIRES IN {secs}s</p>
          <h1 className="text-3xl font-extrabold">Pay {q.merchantName}</h1>
          <div className="rounded-2xl bg-white p-5"><p className="text-sm text-mute">You’re paying</p><p className="text-5xl font-extrabold">{formatZar(q.zarCents)}</p>
            <p className="mt-2 text-brand">You will be charged <b>{formatUsdt(q.usdtBase)} USDT</b></p><p className="text-xs text-mute">Rate locked at R {(q.rateMicroZarPerUsdt / 1e6).toFixed(2)} per USDT</p></div>
          <PinInput label="Enter your PIN to authorize" value={pin} onChange={setPin} />
          <Btn className="mt-auto" disabled={pin.length !== 6} onClick={() => void pay(q)}>Authorize payment</Btn>
        </div>
      </div>);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header right={<Badge>PAYER</Badge>} onBack={onExit} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <h1 className="text-3xl font-extrabold">Pay a merchant</h1><p className="text-mute">Scan their QR code, paste their payment link, or tap an NFC tag.</p>
        {cam ? <Scanner onCode={(c) => { setCam(false); ingest(c); }} onFail={() => setCam(false)} /> : <Btn onClick={() => setCam(true)}>Scan QR code</Btn>}
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste payment link" className="w-full rounded-xl border border-line bg-white px-4 py-3" />
        <Btn kind="ghost" disabled={!link} onClick={() => ingest(link)}>Open link</Btn>
        {nfcSupported() && <Btn kind="ghost" onClick={() => { const ac = new AbortController(); readLinkFromTag(ac.signal).then((l) => { ac.abort(); ingest(l); }).catch(() => ac.abort()); }}>Tap NFC tag</Btn>}
      </div>
    </div>
  );
}

function Scanner({ onCode, onFail }: { onCode(c: string): void; onFail(): void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stop = false; let stream: MediaStream | undefined;
    (async () => {
      try {
        const BD = (window as any).BarcodeDetector;
        if (!BD) { alert('QR scanning isn’t supported in this browser. Paste the link instead.'); return onFail(); }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!ref.current) return; ref.current.srcObject = stream; await ref.current.play();
        const det = new BD({ formats: ['qr_code'] });
        while (!stop) { const codes = await det.detect(ref.current); if (codes[0]) return onCode(codes[0].rawValue as string); await new Promise((r) => setTimeout(r, 250)); }
      } catch { onFail(); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode, onFail]);
  return <video ref={ref} playsInline muted className="h-72 w-full rounded-2xl bg-black object-cover" />;
}
