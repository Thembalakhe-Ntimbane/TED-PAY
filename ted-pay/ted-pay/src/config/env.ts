import Config from 'react-native-config';

const raw = Config as Record<string, string | undefined>;
const req = (k: string): string => {
  const v = raw[k];
  if (!v) throw new Error(`Missing env var ${k} - copy .env.example to .env`);
  return v;
};

export const env = {
  appEnv: req('APP_ENV'),
  useMockWdk: raw.USE_MOCK_WDK === 'true',
  rpcUrl: req('RPC_URL'),
  chainId: Number(req('CHAIN_ID')),
  usdtContract: req('USDT_CONTRACT'),
  rateApiUrl: req('RATE_API_URL'),
  rateApiKey: raw.RATE_API_KEY ?? '',
  payLinkBase: req('PAY_LINK_BASE'),
  ledgerPollMs: Number(raw.LEDGER_POLL_MS ?? 3000),
} as const;
