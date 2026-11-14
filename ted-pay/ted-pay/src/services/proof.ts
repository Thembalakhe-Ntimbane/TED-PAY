import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import { LedgerRecord } from '@/domain/types';
import { formatUsdt, formatZar } from '@/domain/priceLock';

const rows = (r: LedgerRecord): Array<[string, string]> => [
  ['Receipt', r.quote.txId], ['Merchant', r.quote.merchantName], ['Amount (ZAR)', formatZar(r.quote.zarCents)],
  ['Amount (USDT)', formatUsdt(r.quote.usdtBase)], ['Locked rate', `1 USDT = R ${(r.quote.rateMicroZarPerUsdt / 1e6).toFixed(4)}`],
  ['Locked at', new Date(r.quote.lockedAt).toISOString()], ['Status', r.status.toUpperCase()],
  ['Transaction hash', r.txHash ?? 'n/a'], ['Confirmed', r.confirmedAt ? new Date(r.confirmedAt).toISOString() : 'n/a'],
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const html = (r: LedgerRecord) => `<html><body style="font-family:Helvetica;padding:32px">
<h1 style="color:#E50914">TED Pay - Proof of Payment</h1><table style="width:100%;border-collapse:collapse">
${rows(r).map(([k, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">${esc(k)}</td><td style="padding:8px;border-bottom:1px solid #eee;word-break:break-all">${esc(v)}</td></tr>`).join('')}
</table><p style="color:#999;font-size:11px">Testnet transaction - no real funds.</p></body></html>`;

/** Renders PDF to app storage and opens the share/save sheet. */
export async function savePdfProof(r: LedgerRecord): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: html(r) });
  const dest = `${FileSystem.documentDirectory}TEDPay-${r.quote.txId.slice(0, 8)}.pdf`;
  await FileSystem.moveAsync({ from: uri, to: dest });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest, { mimeType: 'application/pdf' });
  return dest;
}

/** Native mail intent (Gmail etc.) with the PDF attached. */
export async function emailInvoice(r: LedgerRecord, to?: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: html(r) });
  await MailComposer.composeAsync({ recipients: to ? [to] : [], subject: `Invoice ${r.quote.txId.slice(0, 8)} - ${r.quote.merchantName}`,
    body: `Payment of ${formatZar(r.quote.zarCents)} (${formatUsdt(r.quote.usdtBase)} USDT). Proof of payment attached.`, attachments: [uri] });
}
