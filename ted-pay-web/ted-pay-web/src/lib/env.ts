const e = import.meta.env;
export const env = {
  mock: e.VITE_MOCK_CHAIN !== 'false',
  rpcUrl: (e.VITE_RPC_URL as string) ?? '',
  chainId: Number(e.VITE_CHAIN_ID ?? 11155111),
  usdt: (e.VITE_USDT_CONTRACT as string) ?? '',
  rateUrl: (e.VITE_RATE_API_URL as string) ?? 'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=zar',
  pollMs: Number(e.VITE_LEDGER_POLL_MS ?? 2500),
} as const;
