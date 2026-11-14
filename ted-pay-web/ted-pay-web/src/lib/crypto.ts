// Web Crypto only (no dependencies): PBKDF2-SHA256 (310k iters) -> AES-256-GCM. Replaces expo-crypto.
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 310_000, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export interface Vault { salt: string; iv: string; ct: string }

export async function encryptWithPin(plain: string, pin: string): Promise<Vault> {
  const salt = bytes(16), iv = bytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await deriveKey(pin, salt), enc.encode(plain));
  return { salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}
/** Throws on wrong PIN (GCM auth failure). */
export async function decryptWithPin(v: Vault, pin: string): Promise<string> {
  const key = await deriveKey(pin, unb64(v.salt));
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) as BufferSource }, key, unb64(v.ct) as BufferSource));
}
export const randomHex = (n: number) => '0x' + [...bytes(n)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const uuid = () => crypto.randomUUID();
