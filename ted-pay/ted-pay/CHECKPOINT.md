# Checkpoint (resume point for another model/engineer)
## Done
- domain: LockedQuote, 60 s lock, integer/BigInt ZAR->USDT (rounds up), payload build/parse with tamper + expiry checks (tested, 4 passing)
- data: live rate fetch (no hardcoded rate), chain ledger (eth_getLogs Transfer + receipt), WDK gateway interface + mock, secure store
- services: biometric/PIN auth, NFC reader + Android HCE, PDF proof, email invoice
- state: zustand store - createRequest, watcher, expiry, payerPay, refund
- ui: POS keypad, request (QR/link/NFC/countdown/received/expired), payer scan+confirm+declined, transactions (+refund/PDF/email), analytics (weekly bars), settings (languages)
## Not done / next entry points
1. src/data/wdkGateway.ts `WdkGateway`: bind getAddress/sendUsdt to WDK RN core; wrap App.tsx in WdkAppProvider with ./.wdk bundle
2. Onboarding (3 steps) + landing sign-in/register screens per Figma; real merchant profile (store.ts MERCHANT const)
3. Payer 60 s ceiling should also cover ERC-4337 userOp inclusion; add confirmations setting
4. Persist ledger (secure/SQLite); sweep sub-addresses; Analytics AI insights card; "T" loader polish; localisation strings
5. Run on device; fix dependency versions (`npx expo install --fix`); add Android NFC/camera manifest entries via app config plugins
