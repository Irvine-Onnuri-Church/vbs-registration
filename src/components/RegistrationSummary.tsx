'use client';

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
  isFormValid: boolean;
};

export default function RegistrationSummary({
  childCount,
  pricingPhaseLabel,
  childPrices,
  totalAmount,
  isFormValid,
}: RegistrationSummaryProps) {
  function scrollToPayment() {
    document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
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

      <button
        onClick={scrollToPayment}
        className="mt-6 w-full rounded-full bg-orange-500 py-3 text-sm font-bold text-white transition hover:bg-orange-400 active:scale-95"
      >
        {isFormValid ? 'Pay Now →' : 'Complete Form to Pay ↓'}
      </button>
      {!isFormValid && (
        <p className="mt-3 text-center text-xs text-slate-400">Fill in all required fields and check both consent boxes to unlock payment.</p>
      )}
    </aside>
  );
}
