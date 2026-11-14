import { env } from './env';

export interface Rate { zarPerUsdt: number; demo: boolean }
/** Live rate. In mock mode only, an API failure falls back to a flagged demo rate so the demo never dies offline. */
export async function fetchRate(): Promise<Rate> {
  try {
    const res = await fetch(env.rateUrl);
    if (!res.ok) throw new Error(`rate ${res.status}`);
    const j = (await res.json()) as { tether?: { zar?: number } };
    const r = j.tether?.zar;
    if (typeof r !== 'number' || r <= 0) throw new Error('rate unavailable');
    return { zarPerUsdt: r, demo: false };
  } catch (e) {
    if (env.mock) return { zarPerUsdt: 18.0, demo: true };
    throw e;
  }
}
