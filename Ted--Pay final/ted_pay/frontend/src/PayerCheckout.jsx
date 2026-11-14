import { useEffect, useState } from 'react'
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const API_URL = import.meta.env.VITE_API_URL
const RPC_URL = import.meta.env.VITE_RPC_URL
const USDT_CONTRACT = import.meta.env.VITE_USDT_CONTRACT
const CHAIN = 'ethereum'

// USDT has 6 decimals. Rounded to cents of USDT so it matches the backend's locked quote.
function toUsdtUnits(zarAmount, exchangeRate) {
  const cents = Math.round((zarAmount / exchangeRate) * 100)
  return BigInt(cents) * 10000n
}

// ERC-20 transfer(address,uint256) calldata, no extra libraries needed
function encodeErc20Transfer(to, amount) {
  return (
    '0xa9059cbb' +
    to.toLowerCase().replace(/^0x/, '').padStart(64, '0') +
    amount.toString(16).padStart(64, '0')
  )
}

export default function PayerCheckout({ paymentId, seedPhrase, onDone }) {
  const [payment, setPayment] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // 1. Load payment specs from Flask
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/payment/${paymentId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Payment unavailable')
          setRemaining(0)
          return
        }
        const skew = data.server_time - Date.now() / 1000
        setPayment({ ...data, skew })
      } catch {
        if (!cancelled) setError('Could not reach the payment server.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [paymentId])

  // 2. Live countdown to expires_at (corrected for clock skew)
  useEffect(() => {
    if (!payment) return undefined
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil(payment.expires_at - (Date.now() / 1000 + payment.skew))))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [payment])

  const expired = remaining === 0
  const usdtText = payment
    ? (Number(toUsdtUnits(payment.zar_amount, payment.exchange_rate)) / 1e6).toFixed(2)
    : '--'

  // 3. Sign, broadcast, then report only the tx hash to Flask
  async function handlePay() {
    if (loading || expired || !payment || !seedPhrase) return
    setLoading(true)
    setError('')
    let wdk
    try {
      setStatus('Signing transaction…')
      wdk = new WDK(seedPhrase).registerWallet(CHAIN, WalletManagerEvm, { provider: RPC_URL })
      const account = await wdk.getAccount(CHAIN, 0)

      const amount = toUsdtUnits(payment.zar_amount, payment.exchange_rate)
      const tx = await account.sendTransaction({
        to: USDT_CONTRACT, // call the USDT token contract...
        value: 0n, // ...with no native ETH attached
        data: encodeErc20Transfer(payment.merchant_address, amount),
      })

      setStatus('Submitted. Waiting for server confirmation…')
      const res = await fetch(`${API_URL}/api/payment/${paymentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: tx.hash }),
      })
      if (!res.ok) throw new Error('Server rejected the confirmation.')
      setStatus('Payment sent. The merchant is confirming it on-chain.')
      if (onDone) onDone(true)
    } catch (e) {
      setStatus('')
      setError(e && e.message ? e.message : 'Payment failed.') // never include the seed in messages
      if (onDone) onDone(false)
    } finally {
      if (wdk) wdk.dispose() // wipe keys from memory
      setLoading(false)
    }
  }

  return (
    <div className="checkout">
      <h2>Pay merchant</h2>
      {payment && (
        <>
          <p>
            R {payment.zar_amount.toFixed(2)} ≈ {usdtText} USDT
          </p>
          <p>Rate locked: 1 USDT = R {payment.exchange_rate.toFixed(2)}</p>
          <p>To: {payment.merchant_address}</p>
          <p style={{ color: remaining <= 15 ? '#E62B1E' : 'inherit' }}>
            {expired ? 'Quote expired' : `Time left: 0:${String(remaining).padStart(2, '0')}`}
          </p>
        </>
      )}
      {status && <p>{status}</p>}
      {error && <p role="alert">{error}</p>}
      <button onClick={handlePay} disabled={loading || expired || !payment || !seedPhrase}>
        {loading ? 'Processing…' : 'Authorise & pay'}
      </button>
    </div>
  )
}
