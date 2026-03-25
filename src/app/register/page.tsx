'use client';

import { useMemo, useState } from 'react';

import ChildInfoCard, { type ChildInfo } from '@/components/ChildInfoCard';
import PageContainer from '@/components/PageContainer';
import ParentInfoSection, { type ParentInfo } from '@/components/ParentInfoSection';
import PayPalPaymentPlaceholder from '@/components/PayPalPaymentPlaceholder';
import RegistrationSummary from '@/components/RegistrationSummary';
import SectionTitle from '@/components/SectionTitle';
import { EVENT_INFO } from '@/lib/constants';
import { calculateChildPrice, formatDateLabel, getPricingTierFromGrade, isEarlyRegistration } from '@/lib/utils';

const initialParentInfo: ParentInfo = {
  parentName: '',
  email: '',
  phoneNumber: '',
  emergencyContactName: '',
  emergencyContactPhoneNumber: '',
};

function createEmptyChild(id: number): ChildInfo {
  return {
    id,
    firstName: '',
    lastName: '',
    preferredName: '',
    gender: '',
    dateOfBirth: '',
    age: '',
    grade: '',
    tshirtSize: '',
    allergyInformation: '',
    medicalNotes: '',
  };
}

export default function RegisterPage() {
  const [parentInfo, setParentInfo] = useState(initialParentInfo);
  const [children, setChildren] = useState<ChildInfo[]>([createEmptyChild(1)]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [liabilityAcknowledgment, setLiabilityAcknowledgment] = useState(false);

  const earlyRegistration = isEarlyRegistration(new Date(), EVENT_INFO.earlyRegistrationDeadline);
  const pricingPhaseLabel = earlyRegistration ? 'Early Registration' : 'Regular Registration';

  const childPricing = useMemo(
    () =>
      children.map((child, index) => {
        const price = calculateChildPrice(child.grade, earlyRegistration);
        const pricingTierLabel = getPricingTierFromGrade(child.grade) === 'beginner' ? 'Beginner (Pre-K)' : 'Kinder / Elementary';
        const childName = child.firstName || child.preferredName || `Child ${index + 1}`;

        return {
          id: child.id,
          label: childName,
          price,
          pricingTierLabel,
        };
      }),
    [children, earlyRegistration],
  );

  const childCount = children.length;
  const totalAmount = childPricing.reduce((total, child) => total + child.price, 0);

  function handleParentInfoChange(field: keyof ParentInfo, value: string) {
    setParentInfo((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  function handleChildChange(childId: number, field: keyof ChildInfo, value: string) {
    setChildren((currentChildren) =>
      currentChildren.map((child) =>
        child.id === childId
          ? {
              ...child,
              [field]: value,
            }
          : child,
      ),
    );
  }

  function handleAddAnotherChild() {
    setChildren((currentChildren) => [...currentChildren, createEmptyChild(currentChildren.length + 1)]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <PageContainer className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Register</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">VBS Registration Form</h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          This frontend-only form preview is ready for future validation, Supabase storage, and PayPal checkout.
        </p>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900 sm:p-6">
        <h2 className="text-base font-semibold">Pricing Rules</h2>
        <p className="mt-2">
          Early pricing ends on <strong>{formatDateLabel(EVENT_INFO.earlyRegistrationDeadline)}</strong>. Beginner (Pre-K)
          is $40 early / $50 regular. Kinder and Elementary is $80 early / $100 regular.
        </p>
        <p className="mt-2">
          Current pricing phase: <strong>{pricingPhaseLabel}</strong>
        </p>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-6">
          <ParentInfoSection values={parentInfo} onChange={handleParentInfoChange} />

          <section className="space-y-4">
            {children.map((child, index) => (
              <ChildInfoCard
                key={child.id}
                child={child}
                childNumber={index + 1}
                childPrice={childPricing[index]?.price ?? 0}
                priceCategoryLabel={childPricing[index]?.pricingTierLabel ?? 'Kinder / Elementary'}
                onChange={handleChildChange}
              />
            ))}

            <button
              type="button"
              onClick={handleAddAnotherChild}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              Add Another Child
            </button>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <SectionTitle
              title="Consent and Acknowledgment"
              description="These checkboxes are placeholders for your final registration agreement."
            />
            <div className="mt-6 space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={photoConsent}
                  onChange={(event) => setPhotoConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm leading-6 text-slate-700">
                  I give permission for my child to appear in approved church photo or media materials.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={liabilityAcknowledgment}
                  onChange={(event) => setLiabilityAcknowledgment(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm leading-6 text-slate-700">
                  I acknowledge the event participation and liability statement will be finalized before launch.
                </span>
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
              Continue to Payment will remain frontend-only until PayPal checkout is integrated.
            </div>

            <PayPalPaymentPlaceholder totalAmount={totalAmount} />

            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 sm:w-auto"
            >
              Continue to Payment
            </button>
          </section>
        </div>

        <RegistrationSummary
          childCount={childCount}
          pricingPhaseLabel={pricingPhaseLabel}
          childPrices={childPricing}
          totalAmount={totalAmount}
        />
      </form>
    </PageContainer>
  );
}
