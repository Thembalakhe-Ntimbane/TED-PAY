import { useState } from 'react';
import { wallet } from '@/lib/wallet';
import { uuid } from '@/lib/crypto';
import { useStore } from '@/store';
import { Btn, Field, Header, PinInput, TLoader } from '@/ui/components';
import type { Role } from './Landing';

const Step = ({ n, label }: { n: number; label: string }) => <p className="mt-2 text-xs font-bold tracking-wide text-brand">STEP {n} OF 3 · {label}</p>;

export default function Onboarding({ role, onDone, onBack }: { role: Role; onDone(): void; onBack(): void }) {
  const save = useStore((s) => s.saveProfile);
  const merchant = role === 'merchant';
  const [step, setStep] = useState(merchant ? 1 : 3);
  const [biz, setBiz] = useState({ businessName: '', regNumber: '', email: '', country: 'South Africa' });
  const [docs, setDocs] = useState({ reg: false, id: false, selfie: false });
  const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('');
  const [phrase, setPhrase] = useState<string | null>(null);
  const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);

  const bizOk = biz.businessName.trim().length > 1 && /\S+@\S+\.\S+/.test(biz.email) && biz.regNumber.trim().length > 3;
  const pinOk = pin.length === 6 && pin === pin2;

  const create = async () => {
    setBusy(true);
    const m = await wallet.create(pin);
    if (merchant) await save({ merchantId: `MER-${uuid().slice(0, 8).toUpperCase()}`, ...biz });
    setPhrase(m); setBusy(false);
  };

  if (busy) return <div className="grid flex-1 place-items-center"><TLoader label="Creating your secure wallet…" /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header onBack={step === 1 || (!merchant && !phrase) ? onBack : () => setStep(step - 1)} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        {step === 1 && (<>
          <Step n={1} label="YOUR BUSINESS" /><h1 className="text-3xl font-extrabold">Let’s meet your business.</h1>
          <p className="text-mute">Set up your merchant profile to accept USDT payments.</p>
          <Field label="Business name" value={biz.businessName} onChange={(v) => setBiz({ ...biz, businessName: v })} placeholder="e.g. Cape Table Café" />
          <Field label="Business registration number" value={biz.regNumber} onChange={(v) => setBiz({ ...biz, regNumber: v })} placeholder="2024 / 184729 / 07" />
          <Field label="Business email" type="email" value={biz.email} onChange={(v) => setBiz({ ...biz, email: v })} placeholder="you@business.co.za" />
          <Field label="Country of registration" value={biz.country} onChange={(v) => setBiz({ ...biz, country: v })} />
          <Btn className="mt-auto" disabled={!bizOk} onClick={() => setStep(2)}>Continue to verification</Btn>
        </>)}

        {step === 2 && (<>
          <Step n={2} label="VERIFICATION" /><h1 className="text-3xl font-extrabold">Build trust. Get verified.</h1>
          <p className="text-mute">A few checks help keep your business and customers safe.</p>
          {([['reg', 'Business registration', 'CIPC certificate, PDF up to 10 MB'], ['id', 'Identity document', 'South African ID or passport'], ['selfie', 'Quick identity check', 'Confirm it’s you with a short selfie']] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => setDocs({ ...docs, [k]: !docs[k] })} className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-left">
              <span><b className="block">{t}</b><span className="text-sm text-mute">{d}</span></span>
              <span className={`text-sm font-bold ${docs[k] ? 'text-ok' : 'text-brand'}`}>{docs[k] ? 'Added' : 'Add'}</span>
            </button>))}
          <p className="rounded-xl bg-line p-3 text-xs text-mute">Hackathon build: verification is simulated, nothing is uploaded or sent anywhere.</p>
          <Btn className="mt-auto" disabled={!(docs.reg && docs.id && docs.selfie)} onClick={() => setStep(3)}>Continue to security</Btn>
        </>)}

        {step === 3 && !phrase && (<>
          <Step n={3} label="SECURITY" /><h1 className="text-3xl font-extrabold">{merchant ? 'Your business. Protected.' : 'Create your wallet.'}</h1>
          <p className="text-mute">Choose a 6-digit PIN. It encrypts your wallet on this device and approves every payment.</p>
          <PinInput label="Create PIN" value={pin} onChange={setPin} />
          <PinInput label="Confirm PIN" value={pin2} onChange={setPin2} />
          {pin2.length === 6 && pin !== pin2 && <p className="text-sm text-brand">PINs don’t match.</p>}
          <Btn className="mt-auto" disabled={!pinOk} onClick={create}>Create wallet</Btn>
        </>)}

        {phrase && (<>
          <h1 className="text-3xl font-extrabold">Back up your recovery phrase.</h1>
          <p className="text-mute">Write these 12 words down and keep them offline. They are the only way to recover your wallet. TED Pay will never ask for them.</p>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-white p-3 text-sm">
            {phrase.split(' ').map((w, i) => <span key={i}><span className="text-mute">{i + 1}.</span> {w}</span>)}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-5 w-5 accent-brand" />I’ve saved my recovery phrase</label>
          <Btn className="mt-auto" disabled={!saved} onClick={onDone}>{merchant ? 'Open merchant portal' : 'Continue'}</Btn>
        </>)}
      </div>
    </div>
  );
}
