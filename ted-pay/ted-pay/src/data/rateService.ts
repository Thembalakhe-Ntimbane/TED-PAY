import { env } from '@/config/env';

/** Fetches the live ZAR-per-USDT rate. Throws on failure: the UI must never fall back to a stale/hardcoded rate. */
export async function fetchZarPerUsdt(signal?: AbortSignal): Promise<number> {
  const res = await fetch(env.rateApiUrl, {
    signal, headers: env.rateApiKey ? { 'x-cg-demo-api-key': env.rateApiKey } : undefined,
  });
  if (!res.ok) throw new Error(`Rate API ${res.status}`);
  const json = (await res.json()) as { tether?: { zar?: number } };
  const rate = json.tether?.zar;
  if (typeof rate !== 'number' || rate <= 0) throw new Error('Rate unavailable');
  return rate;
}
