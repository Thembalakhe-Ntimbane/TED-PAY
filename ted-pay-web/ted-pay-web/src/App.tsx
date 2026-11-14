import { useEffect, useState } from 'react';
import { wallet } from '@/lib/wallet';
import { useStore } from '@/store';
import { Shell, TLoader } from '@/ui/components';
import Landing, { Role } from '@/screens/Landing';
import Onboarding from '@/screens/Onboarding';
import Merchant from '@/screens/Merchant';
import Payer from '@/screens/Payer';

type Screen = 'landing' | { onboard: Role } | Role;

export default function App() {
  const { ready, init } = useStore();
  const [screen, setScreen] = useState<Screen>('landing');
  const [incoming, setIncoming] = useState<string | null>(location.hash.startsWith('#/pay?') ? location.href : null);
  useEffect(() => { void init(); }, [init]);
  useEffect(() => { const h = () => location.hash.startsWith('#/pay?') && setIncoming(location.href); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);

  const lock = () => { wallet.lock(); setScreen('landing'); };
  if (!ready) return <Shell><div className="grid flex-1 place-items-center"><TLoader /></div></Shell>;
  return (
    <Shell>
      {screen === 'landing' && <Landing incomingLink={!!incoming} onEnter={setScreen} onRegister={(r) => setScreen({ onboard: r })} />}
      {typeof screen === 'object' && <Onboarding role={screen.onboard} onBack={() => setScreen('landing')} onDone={() => setScreen(screen.onboard)} />}
      {screen === 'merchant' && <Merchant onLock={lock} />}
      {screen === 'payer' && <Payer initialLink={incoming} onExit={lock} />}
    </Shell>
  );
}
