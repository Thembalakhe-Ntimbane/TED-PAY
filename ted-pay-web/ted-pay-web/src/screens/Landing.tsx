import { useEffect, useState } from 'react';
import { wallet } from '@/lib/wallet';
import { useStore } from '@/store';
import { Badge, Btn, Header, PinInput } from '@/ui/components';

export type Role = 'merchant' | 'payer';
interface Props { onEnter(r: Role): void; onRegister(r: Role): void; incomingLink: boolean }

export default function Landing({ onEnter, onRegister, incomingLink }: Props) {
  const profile = useStore((s) => s.profile);
  const [tab, setTab] = useState<'in' | 'reg'>('in');
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void wallet.hasVault().then(setHasVault); }, []);

  const unlock = async (role: Role) => {
    setBusy(true); setErr('');
    const ok = await wallet.unlock(pin);
    setBusy(false);
    if (ok) onEnter(role); else setErr('Incorrect PIN. Try again.');
  };
  const signedUpMerchant = hasVault && !!profile;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header right={<Badge>TESTNET</Badge>} />
      <div className="flex flex-1 flex-col px-5 pb-6">
        <h1 className="mt-6 text-4xl font-extrabold leading-tight">Local prices.<br />Borderless payments.</h1>
        <p className="mt-3 text-mute">Welcome to simpler payments in ZAR and USDT.</p>
        {incomingLink && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-brand">You’ve received a payment request. Tap “I’m paying a merchant” to review it.</p>}

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-line p-1 text-sm font-bold">
          {(['in', 'reg'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2.5 ${tab === t ? 'bg-white shadow' : 'text-mute'}`}>{t === 'in' ? 'Sign In' : 'Register as Merchant'}</button>))}
        </div>

        <div className="mt-5 space-y-3">
          {tab === 'in' ? (
            signedUpMerchant ? (<>
              <p className="text-sm text-mute">Signing in as <b className="text-ink">{profile!.businessName}</b></p>
              <PinInput label="Your PIN" value={pin} onChange={setPin} />
              {err && <p className="text-sm text-brand">{err}</p>}
              <Btn disabled={pin.length !== 6 || busy} onClick={() => unlock('merchant')}>{busy ? 'Unlocking…' : 'Sign in'}</Btn>
            </>) : <p className="rounded-xl border border-line bg-white p-4 text-sm text-mute">No merchant account on this device yet. Choose “Register as Merchant”.</p>
          ) : (<>
            <p className="text-sm text-mute">Takes about 2 minutes: business details, verification and a PIN-protected wallet.</p>
            <Btn onClick={() => onRegister('merchant')}>Start merchant setup</Btn>
          </>)}
        </div>

        <div className="mt-auto pt-8">
          {hasVault && !signedUpMerchant && <div className="mb-3"><PinInput label="Wallet PIN (to pay)" value={pin} onChange={setPin} />{err && <p className="mt-1 text-sm text-brand">{err}</p>}</div>}
          <Btn kind="ghost" disabled={busy || (!!hasVault && !signedUpMerchant && pin.length !== 6)}
            onClick={() => (hasVault ? (signedUpMerchant ? (pin.length === 6 ? unlock('payer') : setErr('Enter your PIN above first')) : unlock('payer')) : onRegister('payer'))}>I’m paying a merchant</Btn>
          <p className="mt-4 text-center text-xs text-mute">Your wallet. Your keys. Encrypted on this device.<br />By continuing, you agree to our Terms and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}
