# TED Pay Web (React + Vite + TypeScript)

Mobile-first web app for ZAR -> USDT payments with a Merchant portal and a Payer portal. Replaces the Expo/React Native build, so there are **no Android/iOS native toolchains** to configure. Open it in a phone browser (or install it to the home screen) and it behaves like an app.

## Quick start
Requirements: **Node 20+** and npm.

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev                    # http://localhost:5173
```
Open `http://localhost:5173` in Chrome and use DevTools -> device toolbar (phone size).

### Running on a real phone (important)
Wallet encryption (Web Crypto), the camera and NFC only work on a **secure origin** (HTTPS or `localhost`). Plain `http://192.168.x.x:5173` will fail when creating the wallet. Pick one:
- **Tunnel (fastest):** `npm run dev`, then in another terminal `npx cloudflared tunnel --url http://localhost:5173` (or `ngrok http 5173`). Open the https URL on the phone.
- **Deploy (best for judges):** `npm run build`, then upload `dist/` to Vercel / Netlify / Cloudflare Pages (static, no config). Payment links use hash routing (`/#/pay?...`), so no rewrite rules are needed.

## Demo modes
| `VITE_MOCK_CHAIN` | What happens | Use it for |
|---|---|---|
| `true` (default) | Simulated chain stored in the browser (`localStorage`). Merchant and payer must be **tabs of the same browser**. No gas or tokens required. | Reliable stage demo, UI work |
| `false` | Real testnet: ethers signs an ERC-20 `transfer`, merchant verifies via JSON-RPC logs + receipt. Works across devices. | End-to-end proof |

Same-browser demo: open the app in two tabs. Tab A: Register as Merchant, take a payment. Tab B: "I'm paying a merchant", paste the link (or scan it with the camera, two windows side by side). Approve with the PIN; Tab A flips to **Payment Received**.

### Real testnet setup
1. In `.env.local` set `VITE_MOCK_CHAIN=false`, `VITE_RPC_URL`, `VITE_CHAIN_ID` and `VITE_USDT_CONTRACT` (a test USDT ERC-20 on that network; default RPC/chain are Sepolia).
2. Create the payer wallet, copy its address (index 0) and fund it with test ETH (gas) and test USDT. There is no address screen yet: temporarily `console.log(wallet.address(0))` in `Payer.tsx`, or add a "Show my address" row in Settings.
3. Switch the flag, restart `npm run dev`.

## What was replaced
| Before (Expo/RN) | Now (web) |
|---|---|
| `react-native-mmkv` | `localforage` (IndexedDB) - `src/lib/storage.ts` |
| `expo-crypto`, native key storage | Web Crypto API: PBKDF2-SHA256 (310k) -> AES-256-GCM encrypts the recovery phrase with the user's PIN - `src/lib/crypto.ts`; BIP-39/HD keys and signing via `ethers` - `src/lib/wallet.ts` |
| Native web3 kit | `ethers` v6; `src/lib/wallet.ts` is the one seam to swap for Tether WDK's JS wallet modules |
| `<View>/<Text>` + native nav | `div`/`p` + Tailwind CSS v4, phone-shaped shell, safe-area insets, bottom tab bar |
| Biometric auth | PIN (6 digits). Biometrics would need WebAuthn/passkeys - not included |
| `expo-print`, `expo-mail-composer` | `jspdf` (PDF download) and a `mailto:` link |
| `react-native-nfc-manager` / HCE | Web NFC (Chrome Android): merchant writes the link to a tag, payer reads one. Browsers cannot emulate a card |

## Feature checklist
- 60-second price lock: live rate fetched per request, integer/BigInt maths (USDT rounded up), countdown bar, auto-expiry and clean reset.
- One payload for QR, link and NFC: tamper check (USDT is re-derived from ZAR x locked rate) and expiry check on the payer side.
- Payer: scan / paste / NFC -> verified summary (merchant, ZAR, USDT) -> PIN authorization -> broadcast. Failure shows the bold X and "Payment Declined."
- Merchant: "Payment Received" only after the transfer is found on the ledger. Each request uses its own HD address (`m/44'/60'/0'/0/n`), so a payment is matched to exactly one request.
- Transactions ledger (Pending / Completed / Failed / Refunded), **Issue Refund**, PDF proof, email invoice.
- Merchant onboarding (business -> verification (simulated) -> PIN + recovery phrase), Sales Analytics (weekly bars + insight), Settings (profile, security, languages with Cape Town tourism languages first).
- T-block loading animation for async steps.

## Project layout
```
src/lib      pure logic + services (priceLock, paymentUri, crypto, wallet, chain, rate, storage, nfc, proof) + tests
src/store.ts zustand state machine (requests, expiry, watcher, refund) persisted to IndexedDB
src/screens  Landing, Onboarding, Merchant (POS/Request/Transactions/Analytics/Settings), Payer
src/ui       shared components (Shell, Btn, Keypad, TLoader...)
```

## Scripts
`npm run dev` · `npm run build` · `npm run preview` · `npm run typecheck` · `npm test`

## Security notes (read before the demo claims)
- `VITE_*` values are public; never put keys or seeds in `.env*`. Only `.env.example` is committed.
- The recovery phrase is encrypted at rest but a 6-digit PIN is weak against offline brute force if the device is compromised. Fine for a testnet hackathon; use passkeys/WebAuthn or a stronger passphrase for production.
- Browser storage can be cleared by the user/OS: back up the recovery phrase. "Erase all data" in Settings wipes the vault.
- Testnet only. Funds sit in per-request merchant addresses; refunds are sent from the same address. A sweep job is needed for production.

## Known gaps
UI translations (the language choice is saved but strings are English), real KYC, sign-in with passkeys, a "show my address/balance" screen, service-worker offline mode.
