'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import ChildInfoCard, { type ChildInfo } from '@/components/ChildInfoCard';
import PageContainer from '@/components/PageContainer';
import ParentInfoSection, { type ParentInfo } from '@/components/ParentInfoSection';
import PayPalButton from '@/components/PayPalButton';
import RegistrationSummary from '@/components/RegistrationSummary';
import SectionTitle from '@/components/SectionTitle';
import { BEGINNER_DOB, EVENT_INFO, PROGRAM_INFO, REGISTRATION_PRICING } from '@/lib/constants';
import { calculateChildPrice, formatDateLabel, getRegistrationPhase } from '@/lib/utils';

const GRADE_OPTIONS: Record<'prek' | 'k6', string[]> = {
  prek: ['Pre-K'],
  k6: ['Transitional Kindergarten', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade'],
};

const SIZE_OPTIONS: Record<'prek' | 'k6', string[]> = {
  prek: ['3Y', '4Y', '5Y'],
  k6: ['XS', 'S', 'M', 'L', 'XL', 'Adult S', 'Adult M'],
};

const PROGRAM_LABELS: Record<'prek' | 'k6', string> = {
  prek: 'Beginner Program',
  k6: 'Regular Program',
};

const initialParentInfo: ParentInfo = {
  parentName: '',
  email: '',
  phoneNumber: '',
  emergencyContactName: '',
  emergencyContactPhoneNumber: '',
};

function createEmptyChild(id: number, defaultGrade = ''): ChildInfo {
  return {
    id,
    firstName: '',
    lastName: '',
    preferredName: '',
    gender: '',
    dateOfBirth: '',
    age: '',
    grade: defaultGrade,
    tshirtSize: '',
    allergyInformation: '',
    medicalNotes: '',
  };
}

export default function RegistrationFormClient({ program }: { program: 'prek' | 'k6' }) {
  const router = useRouter();
  const allowedGrades = GRADE_OPTIONS[program];
  const allowedSizes = SIZE_OPTIONS[program];
  const defaultGrade = program === 'prek' ? 'Pre-K' : '';

  const [parentInfo, setParentInfo] = useState(initialParentInfo);
  const [children, setChildren] = useState<ChildInfo[]>([createEmptyChild(1, defaultGrade)]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [liabilityAcknowledgment, setLiabilityAcknowledgment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const nextChildId = useRef(2);

  const deadline = program === 'prek' ? EVENT_INFO.beginnerRegistrationDeadline : EVENT_INFO.registrationDeadline;
  const registrationPhase = getRegistrationPhase(
    new Date(),
    EVENT_INFO.earlyRegistrationStart,
    EVENT_INFO.earlyRegistrationDeadline,
    deadline,
  );
  const earlyRegistration = registrationPhase === 'early' || registrationPhase === 'not_open';
  const registrationOpen = registrationPhase !== 'closed';

  const pricingPhaseLabel =
    registrationPhase === 'early' || registrationPhase === 'not_open'
      ? 'Early Registration'
      : registrationPhase === 'regular'
        ? 'Regular Registration'
        : 'Registration Closed';

  const childPricing = useMemo(
    () =>
      children.map((child, index) => ({
        id: child.id,
        label: child.firstName || child.preferredName || `Child ${index + 1}`,
        price: calculateChildPrice(child.grade, earlyRegistration),
        pricingTierLabel: !child.grade ? 'Select a grade' : PROGRAM_LABELS[program],
      })),
    [children, earlyRegistration, program],
  );

  const totalAmount = childPricing.reduce((sum, c) => sum + c.price, 0);

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
        child.tshirtSize !== '' &&
        !getPreKDobWarning(child.dateOfBirth),
    );

    return parentValid && childrenValid && photoConsent && liabilityAcknowledgment && totalAmount > 0;
  }, [parentInfo, children, photoConsent, liabilityAcknowledgment, totalAmount, program]);

  function handleParentInfoChange(field: keyof ParentInfo, value: string) {
    setParentInfo((prev) => ({ ...prev, [field]: value }));
  }

  function handleChildChange(childId: number, field: keyof ChildInfo, value: string) {
    setChildren((prev) =>
      prev.map((child) => (child.id === childId ? { ...child, [field]: value } : child)),
    );
  }

  function handleAddAnotherChild() {
    setChildren((prev) => [...prev, createEmptyChild(nextChildId.current++, defaultGrade)]);
  }

  function getPreKDobWarning(dob: string): string | undefined {
    if (!dob || program !== 'prek') return undefined;
    const date = new Date(`${dob}T00:00:00`);
    const min = new Date(`${BEGINNER_DOB.min}T00:00:00`);
    const max = new Date(`${BEGINNER_DOB.max}T00:00:00`);
    if (date < min) return `This child may be too old for the Beginner Program (eligible birth dates: ${BEGINNER_DOB.labelLong}).`;
    if (date > max) return `This child may be too young for the Beginner Program (eligible birth dates: ${BEGINNER_DOB.labelLong}).`;
    return undefined;
  }

  function handleRemoveChild(childId: number) {
    setChildren((prev) => prev.filter((child) => child.id !== childId));
  }

  function handlePaymentSuccess(registrationId: string) {
    router.push(`/register/success?id=${registrationId}`);
  }

  function handlePaymentError(message: string) {
    setPaymentError(message);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="bg-[#0f1e5e] px-6 py-10 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-300">{EVENT_INFO.church}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
          🏰 {PROGRAM_LABELS[program]}
        </h1>
        <p className="mt-2 text-blue-200">{EVENT_INFO.subtitle} · {program === 'prek' ? EVENT_INFO.datesBeginner : EVENT_INFO.dates}</p>
        {program === 'prek' && (
          <p className="mt-1 text-sm text-blue-300">Who: {PROGRAM_INFO.beginner.who}</p>
        )}
      </div>

      <PageContainer className="space-y-8 pt-8">
        <p className="text-sm text-slate-500">
          Fields marked with <span className="text-red-500">*</span> are required.
        </p>

        {registrationPhase === 'closed' && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:p-6">
            <h2 className="text-base font-semibold">Registration Closed</h2>
            <div className="mt-2 space-y-3">
              <p>안녕하세요, 온누리 VBS 팀입니다.</p>
              <p>하나님의 은혜 가운데 많은 아이들이 등록하여 올해 VBS를 준비하고 있습니다.</p>
              <p>원활한 프로그램 준비를 위해 등록을 마감하려고 합니다.</p>
              <p>
                문의가 있으시면 <strong>(818) 312-2173</strong> 으로 연락주세요.
                <br />
                감사합니다.
              </p>
              <hr className="border-red-200" />
              <p>Hello,</p>
              <p>This is the Onnuri VBS Team.</p>
              <p>
                We will be closing registration now.
                <br />
                If you have any questions, please contact us at <strong>(818) 312-2173</strong>.
              </p>
              <p>Thank you for your support.</p>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900 sm:p-6">
          <h2 className="text-base font-semibold">Registration Pricing — {PROGRAM_LABELS[program]}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className={`rounded-2xl border p-3 ${earlyRegistration ? 'border-sky-400 bg-sky-100 font-semibold' : 'border-sky-200 bg-white/60'}`}>
              <p className="font-semibold">Early Registration</p>
              <p className="mt-0.5 text-sky-700">{formatDateLabel(EVENT_INFO.earlyRegistrationStart)} – {formatDateLabel(EVENT_INFO.earlyRegistrationDeadline)}</p>
              <p className="mt-1">{program === 'prek' ? `Pre-K: $${REGISTRATION_PRICING.early.beginner}` : `TK–6th Grade: $${REGISTRATION_PRICING.early.standard}`}</p>
            </div>
            <div className={`rounded-2xl border p-3 ${registrationPhase === 'regular' ? 'border-sky-400 bg-sky-100 font-semibold' : 'border-sky-200 bg-white/60'}`}>
              <p className="font-semibold">Regular Registration</p>
              <p className="mt-0.5 text-sky-700">{formatDateLabel(EVENT_INFO.regularRegistrationStart)} – {formatDateLabel(deadline)}</p>
              <p className="mt-1">{program === 'prek' ? `Pre-K: $${REGISTRATION_PRICING.regular.beginner}` : `TK–6th Grade: $${REGISTRATION_PRICING.regular.standard}`}</p>
            </div>
          </div>
          {registrationOpen && (
            <p className="mt-3">Current phase: <strong>{pricingPhaseLabel}</strong></p>
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
                  priceCategoryLabel={childPricing[index]?.pricingTierLabel ?? ''}
                  onChange={handleChildChange}
                  onRemove={children.length > 1 ? () => handleRemoveChild(child.id) : undefined}
                  allowedGrades={allowedGrades}
                  allowedSizes={allowedSizes}
                  dobWarning={getPreKDobWarning(child.dateOfBirth)}
                  dobHint={program === 'prek' ? BEGINNER_DOB.label : undefined}
                />
              ))}
              <button
                type="button"
                onClick={handleAddAnotherChild}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
              >
                + Add Another Child
              </button>
            </section>

            <section id="payment-section" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
              <SectionTitle
                title="Consent and Acknowledgment"
                description="Please read and agree to the following before submitting your registration."
              />
              <div className="mt-6 space-y-4">
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={photoConsent}
                    onChange={(e) => setPhotoConsent(e.target.checked)}
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
                    onChange={(e) => setLiabilityAcknowledgment(e.target.checked)}
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

          <div className="hidden xl:block">
          <RegistrationSummary
            childCount={children.length}
            pricingPhaseLabel={pricingPhaseLabel}
            childPrices={childPricing}
            totalAmount={totalAmount}
            isFormValid={isFormValid}
          />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
