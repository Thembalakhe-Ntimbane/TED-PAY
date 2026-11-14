# TED Pay — ZAR → USDT payments (Python / Flask)

A SnapScan-style payment app for South African vendors. A **merchant** types a rand amount, the app
locks a ZAR→USDT rate for **60 seconds** and shows a QR code, a payment link and an NFC share.
A separate **payer** account opens the request, reviews it, authorises with a PIN, and the USDT moves on
the **Tether Testnet ledger**. The merchant's screen only says **"Payment received"** once the *ledger*
confirms the transaction — never because the payer's phone said so.

The UI follows the supplied Figma export: red / white / accent blue, the "T" block loader, PoS keypad with the
"Enter amount to charge in ZAR" placeholder, Payments · Transactions · Analytics · Settings tabs, 3-step
merchant onboarding, and the "Payment received" / "Payment Declined." outcomes.

---

## 1. Install (5 minutes)

You need **Python 3.10 or newer** (check with `python --version`; use `python3` on macOS/Linux if needed).

```bash
# 1. open a terminal inside the ted_pay folder and create an isolated environment
python -m venv .venv

# 2. activate it
#    macOS / Linux:
source .venv/bin/activate
#    Windows (PowerShell):
.venv\Scripts\Activate.ps1

# 3. install the dependencies (Flask, flask-cors, segno for QR codes)
pip install -r requirements.txt

# 4. (optional) create your private config — the app also runs without it
cp .env.example .env          # Windows: copy .env.example .env

# 5. run
python run.py
```

The terminal prints the addresses to use. Open **http://localhost:5000**.
The database (`instance/tedpay.db`) and a random session secret are created automatically on first run.

## 2. Try it — two separate accounts, one affects the other

Easiest: open **http://localhost:5000/demo**. It shows the **Merchant** phone on the left and the
**Payer** phone on the right, side by side.

No accounts or passwords ship with the app. Create two accounts yourself:
**Register as Merchant** (3-step onboarding) and **Create wallet** on the payer side (`/payer/login`).
Optional: put the `SEED_*` variables from `.env.example` in your private `.env` to auto-create a demo merchant and
payer with a week of sample sales. Credentials are never stored in code, printed, or pre-filled in the UI.

1. **Merchant:** register / sign in → tap `3`, `5`, `0` → **Create payment request**. You get R 350.00, the USDT amount,
   the locked rate, a 60-second countdown, a QR code and a **Copy** button for the link.
2. **Payer:** create wallet / sign in → paste the link into **"Or paste a payment link"** → **Go** (or use **Scan QR code**).
   Review the checkout → **Review & authorise** → enter PIN → **Authorise & pay**.
3. Watch both screens. The payer sees *Confirming your payment…*, the merchant sees *Confirming payment*, and after
   the ledger confirms (3–6 s) both show success and the merchant's **Transactions** page lists the sale.
4. **Merchant → Transactions → Issue Refund** sends the USDT back; the payer's balance goes up again.
5. Let the 60 seconds run out on the merchant screen: it shows **Payment Declined.**, then automatically fetches
   a fresh rate and a new request.

Each role has its **own login and session**: merchant credentials don't work on the payer login and vice versa.
Use two browsers, a normal + private window, or two devices. You can also register new accounts
(**Register as Merchant** with the 3-step onboarding, or **Create wallet** on the payer side).

### Using a real phone as the payer
- Phone and computer on the same Wi-Fi → open `http://<your-computer-ip>:5000/payer` (printed by `run.py`).
- Browsers only allow **camera** and **Web NFC** on HTTPS (or localhost). Over plain `http://` on your LAN, use
  **paste link** — or tunnel with HTTPS (e.g. `cloudflared tunnel --url http://localhost:5000`) and open the
  tunnel URL on both devices.

## 3. What is implemented (mapped to your spec)

| Spec | Where |
|---|---|
| 60-second price lock; UUID / merchant ID / timestamp / rate / ZAR metadata | `app.py: create_request` → `payments.meta`, also written into the ledger memo |
| Visible countdown; expiry invalidates + refreshes the rate | `request.html`, `checkout.html`, server-side expiry in `reconcile()` |
| QR, copy-link, NFC | `request.html` (QR via `/qr`, Copy, Web NFC write); payer: camera scan + NFC read in `payer_home.html` |
| Payer verification modal → authorise → broadcast | `checkout.html`, `POST /payer/api/pay/<id>` |
| Merchant confirms from the ledger, never client flags | `reconcile()` — *completed* only when the `chain` row is `confirmed` |
| "Payment Declined." + bold X | `macros.html: xbadge` |
| "Issue Refund" reverse transaction | `POST /merchant/api/refund/<id>` → reversal tx; *Refunded* once confirmed |
| Email invoice + local PDF proof | `/api/invoice/<id>` (native `mailto:` + Gmail compose) · `/receipt/<id>.pdf` |
| Landing (Sign In / Register as Merchant), 3-step onboarding with KYC uploads | `landing.html`, `register.html` |
| Forgot / reset / change password, 2FA (real TOTP) | `forgot.html`, `reset.html`, `security.html` |
| PoS keypad, Transactions ledger, Settings (gear), Analytics (bar + line + insights) | `pos.html`, `transactions.html`, `settings.html`, `analytics.html` |
| Languages: English, German, Dutch, French, Mandarin first, then others | `i18n.py` (nav + PoS strings translated; the rest falls back to English) |
| T-block loader for async states | `macros.html: loader` |
| No secrets in Git; `.env` + `.env.example` | `config.py`, `.gitignore` |

## 4. Configuration (`.env`)

`config.py` reads `.env` at start-up (no extra package needed). Real values live **only** in `.env`, which is
git-ignored. See `.env.example` for all options; the important ones:

| Variable | Meaning |
|---|---|
| `SECRET_KEY` | Flask session key. Empty → generated once into `instance/secret.key` |
| `RATE_SOURCE` | `coingecko` (live ZAR/USDT, needs internet) or `fixed` |
| `FALLBACK_ZAR_PER_USDT` | Rate used when offline or `fixed` |
| `QUOTE_TTL_SECONDS` | Price-lock length (default 60) |
| `CONFIRM_SECONDS_MIN/MAX` | How long the testnet takes to "mine" a transaction |
| `FAUCET_USDT` | Test USDT given to new payer wallets |
| `DEBUG` | `1` for auto-reload while developing |

Never put real keys in `.env.example`, the code, or Git.

## 5. Honest limits of this prototype

- **The Tether Testnet is simulated.** `ledger.py` is a self-contained testnet ledger (pending → confirmed, with
  block number and tx hash). As far as I know, Tether's WDK ships as JavaScript / React Native packages rather than
  a Python library, and this build was made offline, so it was **not** tested against the real network.
  `ledger.py` is the one seam to replace: implement `submit()` and `sync()` against a WDK node/RPC
  (`CHAIN_MODE=wdk`, `WDK_RPC_URL`) and keep signing keys in an OS keystore/HSM, never in the DB or Git.
- **No private keys exist yet.** Wallet addresses are generated and payments are authorised by a server-checked PIN.
  Real self-custody signing belongs in the testnet adapter.
- **Biometrics** (fingerprint / Face ID) need WebAuthn in a browser; this build uses a PIN.
- **Web NFC** works only in Chrome on NFC-capable Android over HTTPS; elsewhere the button says why it's unavailable.
- The keypad takes whole rand (as in the design), not cents.
- KYC uploads are stored privately and auto-approved (testnet). 2FA codes are real TOTP.
- QR images need the `segno` package (in `requirements.txt`). It could not be installed in my offline build
  environment, so the QR image itself is the one piece I could not see rendering; the payload (the payment link) is tested.
- SQLite + one Flask process is fine for a demo. For production add a proper database, HTTPS, CSRF protection,
  login rate-limiting and a real mail service (reset links are printed to the console, and shown on screen only
  if you set `DEV_SHOW_RESET_LINK=1`).

## 6. Project layout

```
run.py            start script          app.py        routes + business logic
config.py         .env loading          ledger.py     Tether Testnet ledger (swap point)
db.py             SQLite schema         rates.py      live ZAR/USDT rate + fallback
seed.py           optional demo data    pdfgen.py     dependency-free PDF proof
frontend/         React + WDK payer app (section 7)
i18n.py           languages             templates/  static/   UI
```

Reset everything: stop the app and delete the `instance/` folder.

## 7. React payer app with the real Tether WDK (optional, EVM testnet)

Everything above runs with Python only. This extra part lets a payer pay with a **real self-custodial wallet**
on an EVM testnet (Sepolia) using `@tetherto/wdk` and `@tetherto/wdk-wallet-evm`. The browser holds the seed phrase
and signs; Flask only receives the **transaction hash** and verifies it on-chain.

**Requires:** Node 18+ (check `node --version`).

```bash
# 1. backend config: add to your private .env (see .env.example)
#    FRONTEND_ORIGIN=http://localhost:5173
#    RPC_URL=<Sepolia RPC URL>
#    USDT_CONTRACT=<testnet USDT contract address, 6 decimals>

# 2. frontend
cd frontend
npm install
cp .env.example .env.local          # Windows: copy .env.example .env.local
#    fill VITE_RPC_URL and VITE_USDT_CONTRACT with the SAME values as above

# 3. run Flask (:5000) and React (:5173) together (activate the Python .venv first)
npm run dev:all
```

1. In the Flask app, register a merchant and create a payment request (e.g. R 100). Copy the payment id from the
   request page URL (`/merchant/request/<payment-id>`).
2. Open `http://localhost:5173/?paymentId=<payment-id>`, paste your **throwaway testnet** seed phrase, and tap
   **Authorise & pay**. The merchant screen shows "Confirming payment", then "Payment received" once
   Flask verifies the mined transaction (success, USDT contract, recipient, amount).

**Polyfills:** `frontend/src/polyfills.js` sets `window.Buffer`, `window.global` and `window.process`, and it must be
the first import in `main.jsx`. If you still see `Buffer is not defined`, restart with `npm run dev -- --force`.
For webpack, add a `ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })` and `resolve.fallback` entries.

**Free test USDT (no real money):**
1. Create a brand-new testnet-only wallet. Never paste a seed that holds real funds.
2. Get Sepolia ETH for gas from any public Sepolia faucet (Google Cloud Web3, Alchemy, Chainlink…) and send it to account 0 of that seed.
3. Get testnet USDT. Tether has no official faucet, so either mint on the Aave testnet faucet (testnet mode, Sepolia)
   and use the token address it shows, or deploy a mock 6-decimals ERC-20 in [Remix](https://remix.ethereum.org),
   mint 1000 to your payer address, and use that address as `USDT_CONTRACT`.
4. Restart both servers and pay. Check the transaction on sepolia.etherscan.io.

Faucets change often; the mock token is the most reliable option.

**Security:** no accounts, passwords or seed phrases are stored in code, the database or Git. The seed is a password
field held in memory, cleared after use, never logged, and never sent to Flask. `wdk.dispose()` runs in `finally`.

**Not tested here:** the JavaScript was written offline, so `npm install` and the WDK calls were not run. Pin the
`@tetherto/*` versions after your first install and check them against the current WDK docs.
