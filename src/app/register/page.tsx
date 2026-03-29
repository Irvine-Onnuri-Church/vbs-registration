'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import ChildInfoCard, { type ChildInfo } from '@/components/ChildInfoCard';
import PageContainer from '@/components/PageContainer';
import ParentInfoSection, { type ParentInfo } from '@/components/ParentInfoSection';
import PayPalButton from '@/components/PayPalButton';
import RegistrationSummary from '@/components/RegistrationSummary';
import SectionTitle from '@/components/SectionTitle';
import { EVENT_INFO } from '@/lib/constants';
import { calculateChildPrice, formatDateLabel, getRegistrationPhase, getPricingTierFromGrade } from '@/lib/utils';

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
  const router = useRouter();
  const [parentInfo, setParentInfo] = useState(initialParentInfo);
  const [children, setChildren] = useState<ChildInfo[]>([createEmptyChild(1)]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [liabilityAcknowledgment, setLiabilityAcknowledgment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const nextChildId = useRef(2);

  const registrationPhase = getRegistrationPhase(
    new Date(),
    EVENT_INFO.earlyRegistrationStart,
    EVENT_INFO.earlyRegistrationDeadline,
    EVENT_INFO.registrationDeadline,
  );
  const earlyRegistration = registrationPhase === 'early';
  const registrationOpen = registrationPhase === 'early' || registrationPhase === 'regular';

  const pricingPhaseLabel =
    registrationPhase === 'early'
      ? 'Early Registration'
      : registrationPhase === 'regular'
        ? 'Regular Registration'
        : registrationPhase === 'not_open'
          ? 'Registration Not Yet Open'
          : 'Registration Closed';

  const childPricing = useMemo(
    () =>
      children.map((child, index) => {
        const price = calculateChildPrice(child.grade, earlyRegistration);
        const pricingTierLabel = !child.grade
          ? 'Select a grade'
          : getPricingTierFromGrade(child.grade) === 'beginner'
            ? 'Beginner (Preschool)'
            : 'K–6th Grade';
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

  const isFormValid = useMemo(() => {
    const parentValid =
      parentInfo.parentName.trim() !== '' &&
      parentInfo.email.trim() !== '' &&
      parentInfo.phoneNumber.trim() !== '' &&
      parentInfo.emergencyContactName.trim() !== '' &&
      parentInfo.emergencyContactPhoneNumber.trim() !== '';

    const childrenValid = children.every(
      (child) =>
        child.firstName.trim() !== '' &&
        child.lastName.trim() !== '' &&
        child.gender !== '' &&
        child.dateOfBirth !== '' &&
        child.grade !== '' &&
        child.tshirtSize !== '',
    );

    return parentValid && childrenValid && photoConsent && liabilityAcknowledgment && totalAmount > 0;
  }, [parentInfo, children, photoConsent, liabilityAcknowledgment, totalAmount]);

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
    const newId = nextChildId.current++;
    setChildren((currentChildren) => [...currentChildren, createEmptyChild(newId)]);
  }

  function handleRemoveChild(childId: number) {
    setChildren((currentChildren) => currentChildren.filter((child) => child.id !== childId));
  }

  function handlePaymentSuccess(registrationId: string) {
    router.push(`/register/success?id=${registrationId}`);
  }

  function handlePaymentError(message: string) {
    setPaymentError(message);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  return (
    <PageContainer className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Register</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">VBS Registration Form</h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          Complete the form below to register your child(ren) for VBS 2026. Fields marked with <span className="text-red-500">*</span> are required.
        </p>
      </section>

      {registrationPhase === 'not_open' && (
        <section className="rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 sm:p-6">
          <h2 className="text-base font-semibold">Registration Not Yet Open</h2>
          <p className="mt-2">
            Early registration opens on <strong>{formatDateLabel(EVENT_INFO.earlyRegistrationStart)}</strong>. Check back then to complete your registration.
          </p>
        </section>
      )}

      {registrationPhase === 'closed' && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:p-6">
          <h2 className="text-base font-semibold">Registration Closed</h2>
          <p className="mt-2">
            Registration closed on <strong>{formatDateLabel(EVENT_INFO.registrationDeadline)}</strong>. Please contact us if you have questions.
          </p>
        </section>
      )}

      <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900 sm:p-6">
        <h2 className="text-base font-semibold">Registration Pricing</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className={`rounded-2xl border p-3 ${registrationPhase === 'early' ? 'border-sky-400 bg-sky-100 font-semibold' : 'border-sky-200 bg-white/60'}`}>
            <p className="font-semibold">Early Registration</p>
            <p className="mt-0.5 text-sky-700">{formatDateLabel(EVENT_INFO.earlyRegistrationStart)} – {formatDateLabel(EVENT_INFO.earlyRegistrationDeadline)}</p>
            <p className="mt-1">Preschool: $40 &nbsp;|&nbsp; K–6th: $70</p>
          </div>
          <div className={`rounded-2xl border p-3 ${registrationPhase === 'regular' ? 'border-sky-400 bg-sky-100 font-semibold' : 'border-sky-200 bg-white/60'}`}>
            <p className="font-semibold">Regular Registration</p>
            <p className="mt-0.5 text-sky-700">{formatDateLabel(EVENT_INFO.regularRegistrationStart)} – {formatDateLabel(EVENT_INFO.registrationDeadline)}</p>
            <p className="mt-1">Preschool: $50 &nbsp;|&nbsp; K–6th: $90</p>
          </div>
        </div>
        {registrationOpen && (
          <p className="mt-3">
            Current phase: <strong>{pricingPhaseLabel}</strong>
          </p>
        )}
      </section>

      <div className={`grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start${!registrationOpen ? ' pointer-events-none opacity-50' : ''}`}>
        <div className="space-y-6">
          <ParentInfoSection values={parentInfo} onChange={handleParentInfoChange} />

          <section className="space-y-4">
            {children.map((child, index) => (
              <ChildInfoCard
                key={child.id}
                child={child}
                childNumber={index + 1}
                childPrice={childPricing[index]?.price ?? 0}
                priceCategoryLabel={childPricing[index]?.pricingTierLabel ?? 'Select a grade'}
                onChange={handleChildChange}
                onRemove={children.length > 1 ? () => handleRemoveChild(child.id) : undefined}
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
              description="Please read and agree to the following before submitting your registration."
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
                  I acknowledge that my child(ren) will participate in VBS activities and release the church from liability for injuries arising from normal program participation.
                </span>
              </label>
            </div>

            <div className="mt-6">
              {isFormValid ? (
                <div className="space-y-3">
                  {paymentError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {paymentError}
                    </div>
                  )}
                  <PayPalButton
                    children={children}
                    parentInfo={parentInfo}
                    photoConsent={photoConsent}
                    liabilityAcknowledgment={liabilityAcknowledgment}
                    earlyRegistration={earlyRegistration}
                    registrationPhase={registrationPhase}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Complete all required fields and check both boxes above to proceed to payment.
                </div>
              )}
            </div>
          </section>
        </div>

        <RegistrationSummary
          childCount={childCount}
          pricingPhaseLabel={pricingPhaseLabel}
          childPrices={childPricing}
          totalAmount={totalAmount}
        />
      </div>
    </PageContainer>
  );
}
