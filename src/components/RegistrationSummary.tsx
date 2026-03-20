import { formatCurrency } from '@/lib/utils';

type RegistrationSummaryProps = {
  childCount: number;
  feePerChild: number;
  totalAmount: number;
};

export default function RegistrationSummary({
  childCount,
  feePerChild,
  totalAmount,
}: RegistrationSummaryProps) {
  return (
    <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8 lg:sticky lg:top-6">
      <h2 className="text-xl font-semibold tracking-tight">Registration Summary</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Review the current total before continuing to the future payment step.
      </p>

      <dl className="mt-6 space-y-4 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
          <dt>Number of Children</dt>
          <dd className="font-semibold text-white">{childCount}</dd>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
          <dt>Fee per Child</dt>
          <dd className="font-semibold text-white">{formatCurrency(feePerChild)}</dd>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-white">
          <dt>Total Amount</dt>
          <dd>{formatCurrency(totalAmount)}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm leading-6 text-slate-200">
        PayPal checkout and payment confirmation will be connected in a future phase.
      </div>
    </aside>
  );
}
