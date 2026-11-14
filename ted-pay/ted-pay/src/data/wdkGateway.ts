import { env } from '@/config/env';

/**
 * The ONLY file that talks to Tether WDK. WDK RN core is beta (API still moving), so everything
 * else depends on this interface. Replace `wdkGateway` internals with the hooks from
 * @tetherto/wdk-react-native-core (useWalletManager / useAccount / useAddresses) once the bundle
 * is generated (`npm run wdk:bundle`). Verify method names against the installed beta.
 */
export interface WalletGateway {
  /** Address for HD account `index` (merchant: one per payment request; payer: index 0). */
  getAddress(index: number): Promise<string>;
  /** Signs + broadcasts an ERC-20 USDT transfer from account `index`. Caller MUST authenticate first. */
  sendUsdt(fromIndex: number, to: string, usdtBase: bigint): Promise<{ hash: string }>;
}

class MockGateway implements WalletGateway {
  async getAddress(i: number) { return '0x' + (i + 1).toString(16).padStart(40, '0'); }
  async sendUsdt(_f: number, to: string, a: bigint) {
    await new Promise((r) => setTimeout(r, 1500));
    return { hash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0') + `#${to.slice(-4)}${a}` };
  }
}

class WdkGateway implements WalletGateway {
  async getAddress(_i: number): Promise<string> { throw new Error('TODO: bind to WDK useAddresses/getAccount(index)'); }
  async sendUsdt(): Promise<{ hash: string }> { throw new Error('TODO: bind to WDK account.transfer({token: USDT, recipient, amount})'); }
}

export const wdkGateway: WalletGateway = env.useMockWdk ? new MockGateway() : new WdkGateway();
