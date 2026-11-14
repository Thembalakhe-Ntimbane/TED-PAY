import { Platform, PermissionsAndroid } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

export async function nfcAvailable(): Promise<boolean> {
  try { return (await NfcManager.isSupported()) && (await NfcManager.isEnabled()); } catch { return false; }
}

/** Payer: read an NDEF text/URI record carrying the payload (reader mode). */
export async function readPayload(): Promise<string | null> {
  try {
    await NfcManager.start();
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const rec = tag?.ndefMessage?.[0];
    return rec ? (Ndef.uri.decodePayload(Uint8Array.from(rec.payload)) as string) : null;
  } finally { NfcManager.cancelTechnologyRequest().catch(() => {}); }
}

/** Merchant (Android HCE): emulate an NDEF tag exposing the payload until `signal` aborts (<=60 s window). */
export async function emulatePayload(payload: string, signal: AbortSignal): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS cannot emulate tags; QR/link remain available
  if (Platform.Version >= 31) await PermissionsAndroid.request('android.permission.NFC' as never).catch(() => undefined);
  const { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } = await import('react-native-hce');
  const tag = new NFCTagType4({ type: NFCTagType4NDEFContentType.URL, content: payload, writable: false });
  const session = await HCESession.getInstance();
  await session.setApplication(tag);
  await session.setEnabled(true);
  signal.addEventListener('abort', () => { session.setEnabled(false).catch(() => {}); });
}
