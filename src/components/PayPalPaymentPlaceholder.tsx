import { formatCurrency } from '@/lib/utils';

type PayPalPaymentPlaceholderProps = {
  totalAmount: number;
};

export default function PayPalPaymentPlaceholder({ totalAmount }: PayPalPaymentPlaceholderProps) {
  return (
    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <p className="font-semibold">PayPal Payment Placeholder</p>
      <p className="mt-1">Amount to send to PayPal: {formatCurrency(totalAmount)}</p>
      <input type="hidden" name="paypalAmount" value={totalAmount} />
    </div>
  );
}
