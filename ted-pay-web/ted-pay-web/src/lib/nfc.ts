// Web NFC (Chrome on Android, HTTPS only). Browsers cannot emulate a card (no HCE): the merchant writes the link
// to a tag / the payer reads one. QR + link remain the primary channels.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const nfcSupported = () => typeof window !== 'undefined' && 'NDEFReader' in window;

export async function writeLinkToTag(link: string): Promise<void> {
  const r = new (window as any).NDEFReader();
  await r.write({ records: [{ recordType: 'url', data: link }] });
}
export async function readLinkFromTag(signal: AbortSignal): Promise<string> {
  const r = new (window as any).NDEFReader();
  await r.scan({ signal });
  return new Promise((resolve, reject) => {
    r.onreading = (e: any) => {
      const rec = e.message.records.find((x: any) => x.recordType === 'url' || x.recordType === 'text');
      if (rec) resolve(new TextDecoder().decode(rec.data));
    };
    r.onreadingerror = () => reject(new Error('Unreadable tag'));
  });
}
