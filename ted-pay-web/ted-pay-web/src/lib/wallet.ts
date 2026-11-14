import { Contract, HDNodeWallet, JsonRpcProvider, Mnemonic } from 'ethers';
import { Vault, decryptWithPin, encryptWithPin } from './crypto';
import { env } from './env';
import { mockTransfer } from './chain';
import { store } from './storage';

/**
 * Self-custody wallet. The BIP-39 phrase is AES-GCM encrypted with the user's PIN and stored in IndexedDB;
 * the decrypted phrase lives only in this module's memory while unlocked. This is the single seam to swap for
 * Tether WDK's JS wallet modules later (same address(index) / send(...) surface).
 */
let phrase: string | null = null;
const VAULT = 'vault';
const path = (i: number) => `m/44'/60'/0'/0/${i}`;
const node = (i: number) => HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase!), path(i));

export const wallet = {
  hasVault: async () => (await store.get<Vault>(VAULT)) !== null,
  isUnlocked: () => phrase !== null,
  async create(pin: string): Promise<string> {
    const m = HDNodeWallet.createRandom().mnemonic!.phrase;
    await store.set(VAULT, await encryptWithPin(m, pin));
    phrase = m; return m;
  },
  async unlock(pin: string): Promise<boolean> {
    const v = await store.get<Vault>(VAULT); if (!v) return false;
    try { phrase = await decryptWithPin(v, pin); return true; } catch { return false; }
  },
  async verifyPin(pin: string): Promise<boolean> {
    const v = await store.get<Vault>(VAULT); if (!v) return false;
    try { await decryptWithPin(v, pin); return true; } catch { return false; }
  },
  async reveal(pin: string): Promise<string | null> {
    const v = await store.get<Vault>(VAULT); if (!v) return null;
    try { return await decryptWithPin(v, pin); } catch { return null; }
  },
  lock() { phrase = null; },
  address(i: number): string { if (!phrase) throw new Error('Wallet locked'); return node(i).address; },
  /** Signs + broadcasts a USDT transfer from HD account i. Callers must have verified the PIN first. */
  async sendUsdt(i: number, to: string, amount: bigint, deadline: number): Promise<string> {
    if (!phrase) throw new Error('Wallet locked');
    if (env.mock) return mockTransfer(node(i).address, to, amount);
    const signer = node(i).connect(new JsonRpcProvider(env.rpcUrl, env.chainId));
    const c = new Contract(env.usdt, ['function transfer(address to, uint256 value) returns (bool)'], signer);
    const tx = await c.getFunction('transfer')(to, amount);
    const left = deadline - Date.now();
    if (left <= 0) throw new Error('timeout');
    const rcpt = await Promise.race([tx.wait(1), new Promise<null>((r) => setTimeout(() => r(null), left))]);
    if (!rcpt || rcpt.status !== 1) throw new Error('not confirmed in time');
    return tx.hash as string;
  },
};
