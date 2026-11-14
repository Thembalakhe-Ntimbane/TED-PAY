# TED PAY

TED PAY is a multi-platform fintech prototype built for a South African merchant experience: a merchant creates a payment request in ZAR, the payer reviews the locked conversion to USDT, authorizes the payment, and the merchant sees confirmation only after the ledger confirms the transfer.

This repository brings together:
- `ted-pay` — React Native / Expo mobile app
- `ted-pay-web` — React + Vite + TypeScript web app
- `ted_pay` — Python / Flask backend demo
- design assets and demo resources at the repo root

## Overview

The project is designed around a simple but realistic flow:

1. A merchant enters a rand amount and creates a payment request.
2. The system locks a ZAR-to-USDT exchange rate for a short time window.
3. The payer scans or opens the payment link, reviews the quote, and authorizes with a PIN.
4. The payment is validated against the ledger before the merchant is marked as paid.
5. Merchant transaction history and refund flows are available.

This repository is intended as a hackathon/demo project and demonstrates a complete user flow across web, mobile, and backend components.

## Repository structure

```text
TED-PAY/
├── README.md
├── Resources To use.png
├── TED UI_UX design.pdf
├── Ted-Pay-Design-Demo.mp4
├── ted-pay/                  # React Native app
├── ted-pay-web/              # Web app
├── ted_pay/                  # Python backend demo
├── Ted--Pay final/           # additional project assets
└── .gitignore                # repo-level ignore rules (if present in future)
```

## Project modules

### 1) Mobile app — `ted-pay/`

The mobile app is a React Native + TypeScript implementation focused on:
- merchant onboarding and payment request generation
- payer verification and authorization
- rate locking and quote expiry handling
- transaction history and refunds
- wallet and payment flow simulation

Typical stack:
- React Native
- TypeScript
- Expo
- WDK-inspired wallet integration patterns

Run it from the folder:

```bash
cd ted-pay/ted-pay
npm install
npm run android
# or
npm run ios
```

See the app-specific README in `ted-pay/ted-pay/README.md` for full setup details.

### 2) Web app — `ted-pay-web/`

The web app is a Vite + React + TypeScript implementation designed to provide a browser-based version of the merchant and payer experience.

Typical stack:
- React
- Vite
- TypeScript
- Tailwind-style frontend components
- browser-based wallet simulation or testnet integration

Run it with:

```bash
cd ted-pay-web/ted-pay-web
npm install
cp .env.example .env.local
npm run dev
```

Then open:

```text
http://localhost:5173
```

See `ted-pay-web/ted-pay-web/README.md` for more detail.

### 3) Backend demo — `ted_pay/`

The backend is a Python / Flask service that simulates merchant and payer flows, including:
- rate handling and pricing logic
- ledger simulation
- transaction tracking
- payment request validation
- QR/payment-link flow support
- demo account and seed data

Run it with:

```bash
cd ted_pay/ted_pay
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
python run.py
```

Open the app at:

```text
http://localhost:5000
```

See `ted_pay/ted_pay/README.md` for the full backend instructions.

## Feature highlights

- ZAR → USDT payment flow
- merchant and payer roles with separate sessions or flows
- 60-second locked pricing window
- payment request QR code and shareable payment link
- PIN-based authorization
- transaction ledger and refund support
- design-driven UX with fintech styling and payment-state screens
- support for demo/mock scenarios and testnet-ready architecture

## Tech stack summary

- Frontend: React, React Native, TypeScript, Vite
- Backend: Python, Flask
- Data/logic: ledger simulation, pricing/rate locking, token conversion logic
- Assets: Figma export, demo video, UI design files

## Notes

This project is best understood as a prototype or hackathon build. Some directories include mock/testnet flows and design-oriented implementations, with more production security and integration work still needed before real-world deployment.

## Related docs

- `ted-pay/ted-pay/README.md`
- `ted-pay-web/ted-pay-web/README.md`
- `ted_pay/ted_pay/README.md`

## License

No explicit repository license file was found in the root of the project at the time of creation. If you intend to publish this project publicly, it is recommended to add an appropriate license file such as MIT or Apache 2.0.

## Status

Repository status: active prototype / demo project

This README is intended as the main entry point for the repository and summarizes the purpose and structure of the TED PAY project.

---

If you want, I can also tailor this README for a more polished GitHub presentation with badges, screenshots, architecture diagrams, and setup instructions for each app module.
