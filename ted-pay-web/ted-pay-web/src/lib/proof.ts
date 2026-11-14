import { LedgerRecord } from './types';
import { formatUsdt, formatZar } from './priceLock';

const rows = (r: LedgerRecord): Array<[string, string]> => [
  ['Receipt', r.quote.txId], ['Merchant', r.quote.merchantName], ['Amount (ZAR)', formatZar(r.quote.zarCents)],
  ['Amount (USDT)', formatUsdt(r.quote.usdtBase)], ['Locked rate', `1 USDT = R ${(r.quote.rateMicroZarPerUsdt / 1e6).toFixed(4)}`],
  ['Locked at', new Date(r.quote.lockedAt).toISOString()], ['Status', r.status.toUpperCase()],
  ['Transaction hash', r.txHash ?? 'n/a'], ['Confirmed', r.confirmedAt ? new Date(r.confirmedAt).toISOString() : 'n/a'],
];

/** Generates and downloads a PDF proof of payment (works fully offline). */
export async function downloadPdfProof(r: LedgerRecord) {
  const { jsPDF } = await import('jspdf'); // lazy: keeps the first load small
  const d = new jsPDF();
  d.setFontSize(20); d.setTextColor(229, 9, 20); d.text('TED Pay - Proof of Payment', 15, 22);
  d.setFontSize(11); d.setTextColor(60);
  let y = 40;
  for (const [k, v] of rows(r)) {
    d.setTextColor(130); d.text(k, 15, y); d.setTextColor(20);
    d.text(d.splitTextToSize(v, 120) as string[], 65, y); y += 10 + (v.length > 60 ? 8 : 0);
  }
  d.setFontSize(9); d.setTextColor(150); d.text('Testnet transaction - no real funds.', 15, y + 10);
  d.save(`TEDPay-${r.quote.txId.slice(0, 8)}.pdf`);
}

/** Opens the user's mail app (Gmail etc.) with a prefilled invoice. mailto cannot attach files: download the PDF too. */
export function emailInvoice(r: LedgerRecord, to = '') {
  const body = rows(r).map(([k, v]) => `${k}: ${v}`).join('\n');
  location.href = `mailto:${to}?subject=${encodeURIComponent(`Invoice ${r.quote.txId.slice(0, 8)} - ${r.quote.merchantName}`)}&body=${encodeURIComponent(body)}`;
}
