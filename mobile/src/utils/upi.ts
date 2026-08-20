/**
 * Utility helper to build NPCI standardized direct upi://pay URI links
 * for 0% commission fee payments across GPay, PhonePe, Paytm, BHIM, Amazon Pay.
 */

export interface UpiParams {
  upiId: string;
  merchantName?: string;
  amount: number;
  note?: string;
  refId?: string;
}

export function generateUpiUrl({ upiId, merchantName, amount, note, refId }: UpiParams): string {
  const pa = encodeURIComponent(upiId.trim());
  const pn = encodeURIComponent(merchantName ? merchantName.trim() : 'AFoodoo Kitchen');
  const am = amount.toFixed(2);
  const tn = encodeURIComponent(note || 'AFoodoo Payment');
  const tr = refId ? `&tr=${encodeURIComponent(refId)}` : '';

  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}${tr}`;
}
