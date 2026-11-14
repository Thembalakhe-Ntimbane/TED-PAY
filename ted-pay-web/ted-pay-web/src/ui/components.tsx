import { ReactNode, useState } from 'react';

type BtnProps = { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string };
export const Btn = ({ children, onClick, kind = 'primary', disabled, className = '' }: BtnProps) => (
  <button onClick={onClick} disabled={disabled}
    className={`w-full rounded-xl py-4 text-base font-bold transition active:scale-[.98] disabled:opacity-40 ${
      kind === 'primary' ? 'bg-brand text-white' : kind === 'danger' ? 'border border-brand text-brand' : 'border border-line bg-white text-ink'} ${className}`}>
    {children}
  </button>
);

/** Phone-shaped shell: full-bleed on phones, centred 430px device frame on desktop. */
export const Shell = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-paper sm:my-0 sm:border-x sm:border-line"
    style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>{children}</div>
);

export const Header = ({ right, onBack }: { right?: ReactNode; onBack?: () => void }) => (
  <header className="flex items-center justify-between px-5 py-3">
    <div className="flex items-center gap-2">
      {onBack && <button aria-label="Back" onClick={onBack} className="mr-1 text-2xl leading-none">‹</button>}
      <span className="grid h-6 w-6 place-items-center rounded bg-brand text-sm font-black text-white">T</span><b>TED Pay</b>
    </div>
    {right}
  </header>
);

export const Badge = ({ children }: { children: ReactNode }) => <span className="rounded-full bg-line px-2.5 py-1 text-[10px] font-bold tracking-wide text-mute">{children}</span>;

export const TLoader = ({ label }: { label?: string }) => (
  <div className="flex flex-col items-center gap-4" role="status" aria-label={label ?? 'Loading'}>
    <div className="relative h-[88px] w-[88px]">
      {[[0, 0], [30, 0], [60, 0], [30, 30], [30, 60]].map(([x, y], i) => <div key={i} className="tblock absolute" style={{ left: x, top: y, animationDelay: `${i * 0.25}s` }} />)}
    </div>
    {label && <p className="text-sm text-mute">{label}</p>}
  </div>
);

export const XMark = () => <div className="pop grid h-28 w-28 place-items-center rounded-full bg-brand text-6xl font-black text-white">✕</div>;
export const Tick = () => <div className="pop grid h-28 w-28 place-items-center rounded-full bg-ok text-6xl font-black text-white">✓</div>;

export const Field = ({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-mute">{label}</span>
    <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-brand" />
  </label>
);

export const PinInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-mute">{label}</span>
    <input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} type="password" inputMode="numeric" autoComplete="off" placeholder="6-digit PIN"
      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-center text-2xl tracking-[.5em] outline-none focus:border-brand" />
  </label>
);

export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
        <button key={k} aria-label={k === '⌫' ? 'Backspace' : k} onClick={() => onKey(k)} className="py-5 text-2xl font-medium active:bg-line">{k}</button>))}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); };
  const node = msg ? <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white">{msg}</div> : null;
  return { show, node };
}
