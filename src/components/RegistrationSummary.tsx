import { formatCurrency } from '@/lib/utils';

type ChildPriceRow = {
  id: number;
  label: string;
  price: number;
};

type RegistrationSummaryProps = {
  childCount: number;
  pricingPhaseLabel: string;
  childPrices: ChildPriceRow[];
  totalAmount: number;
};

export default function RegistrationSummary({
  childCount,
  pricingPhaseLabel,
  childPrices,
  totalAmount,
}: RegistrationSummaryProps) {
  return (
    <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8 lg:sticky lg:top-6">
      <h2 className="text-xl font-semibold tracking-tight">Registration Summary</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Pricing phase: <span className="font-semibold text-white">{pricingPhaseLabel}</span>
      </p>

      <dl className="mt-6 space-y-4 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
          <dt>Number of Children</dt>
          <dd className="font-semibold text-white">{childCount}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2">
        {childPrices.map((child) => (
          <div key={child.id} className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-2 text-sm">
            <span>{child.label}</span>
            <span className="font-semibold">{formatCurrency(child.price)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-white">
        <span>Total Amount</span>
        <span>{formatCurrency(totalAmount)}</span>
      </div>

      <div className="mt-6 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm leading-6 text-slate-200">
        Payment is due at time of registration. You will be redirected to complete payment after submitting this form.
      </div>
    </aside>
  );
}
