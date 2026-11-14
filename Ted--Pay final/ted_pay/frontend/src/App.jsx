import { useState } from 'react'
import PayerCheckout from './PayerCheckout.jsx'

export default function App() {
  const paymentId = new URLSearchParams(window.location.search).get('paymentId')
  const [seed, setSeed] = useState('')

  return (
    <main className="phone">
      <header><span className="logo">T</span> TED Pay <span className="chip">PAYER</span></header>
      {!paymentId && <p>Open this page from a merchant's payment link: <code>/?paymentId=…</code></p>}
      <label htmlFor="seed">Testnet seed phrase (kept in memory only)</label>
      <input
        id="seed"
        type="password"
        autoComplete="off"
        spellCheck="false"
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        placeholder="12 or 24 words, throwaway testnet wallet"
      />
      {paymentId && <PayerCheckout paymentId={paymentId} seedPhrase={seed} onDone={() => setSeed('')} />}
    </main>
  )
}
