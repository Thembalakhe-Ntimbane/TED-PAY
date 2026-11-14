# TED Pay (React Native + Tether WDK, testnet)

ZAR -> USDT merchant/payer payments. **Framework: React Native (TypeScript).** Tether's WDK only ships a React Native binding
(`@tetherto/wdk-react-native-core`, runs the WDK engine in a Bare worklet) - there is no Flutter binding.

## Status
Scaffold with working, unit-tested core logic (60 s price lock, payload codec, ledger verification, state machine) and UI
for the main flows. **Not yet run on a device.** See `CHECKPOINT.md` for exactly what is done and what remains.

## Known deviations from the brief (please read)
1. **minSdk 24, not 21.** React Native 0.76+, Expo 52+ and `react-native-bare-kit` (needed by WDK) all require Android 7.0+. minSdk 21 is not achievable with WDK.
2. **WDK integration is behind `src/data/wdkGateway.ts`.** WDK RN core is beta and its API is changing; `USE_MOCK_WDK=true` runs the whole flow with a mock. The real `WdkGateway` methods are stubs to bind to `useAddresses/useAccount` after bundling.
3. **Package versions in `package.json` are unverified.** Run `npx expo install --fix` and adjust anything npm rejects.
4. **Design vs. spec mismatch:** the Figma shows "USDC"/"USDT Ethereum" on some screens; the code uses USDT everywhere. Testnet chain/contract are set in `.env`.
5. **Merchant verification design:** each request gets its own HD address (`getAddress(index)`). The merchant checks USDT `Transfer` logs into that address and a mined receipt - never payer flags. Refunds send from that same sub-address back to the log's `from`. Funds therefore sit in per-request sub-accounts (add a sweep job before production).
6. iOS cannot emulate NFC tags; QR and link always work. NFC HCE is Android-only. Onboarding/KYC screens, sign-in and the Analytics "AI engine" card are not built yet.

## Prerequisites
Node 20+, JDK 17, Android Studio (SDK 34), Xcode 15+ for iOS. Expo **dev builds** are required (no Expo Go: WDK, NFC, camera are native).

## Setup
```bash
npm install
npx expo install --fix
cp .env.example .env          # edit values; never commit .env
npm run wdk:bundle            # generates ./.wdk from wdk.config.js (needed for real WDK mode)
npx expo prebuild
npm run android               # or: npm run ios
npm test                      # domain tests (price lock, URI codec)
npm run typecheck
```

## Environment & credential isolation
- `.env` is git-ignored; only `.env.example` is committed. `src/config/env.ts` validates variables at startup and fails fast.
- `.env` values are compiled into the app (react-native-config) - **put only public endpoints there, never keys or seed phrases.** Proxy any paid rate-API key through your own backend for production.
- Seed/keys live only in WDK's encrypted keychain storage; other app secrets use `expo-secure-store` (Keystore/Keychain, this-device-only).
- Payments are authorized with `expo-local-authentication` (biometric, OS PIN fallback) before any signing call.

## Architecture
`domain/` (pure logic) -> `data/` (rates, WDK gateway, chain ledger) -> `services/` (auth, NFC, PDF/email) -> `state/` (zustand) -> `ui/`.

## Testnet run-through
1. Set `USE_MOCK_WDK=false`, `RPC_URL`, `CHAIN_ID`, `USDT_CONTRACT` (test USDT) and fund the payer account with test USDT + gas.
2. Merchant: enter amount -> request screen shows QR/link/NFC + 60 s countdown.
3. Payer: scan/paste/tap -> confirm sheet -> biometric -> broadcast.
4. Merchant screen flips to "Payment Received" only after the log + receipt are found on-chain. Expiry or failure shows the X and "Payment Declined." (payer) / "Quote expired" (merchant).
5. Transactions -> Issue Refund / Download PDF proof / Email invoice.
