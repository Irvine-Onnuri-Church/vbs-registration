'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import PageContainer from '@/components/PageContainer';

function SuccessContent() {
  const searchParams = useSearchParams();
  const registrationId = searchParams.get('id') ?? '';

  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Registration Complete!</h1>
        <p className="max-w-md text-base leading-7 text-slate-600">
          Thank you for registering for VBS 2026 at Irvine Onnuri Church. A confirmation email has been sent to you.
        </p>
      </div>

      {registrationId && (
        <div className="w-full max-w-md rounded-3xl border border-sky-200 bg-sky-50 p-6 text-left">
          <p className="text-sm font-semibold text-sky-700">Your Registration ID</p>
          <p className="mt-2 break-all font-mono text-sm text-sky-950">{registrationId}</p>
          <p className="mt-3 text-xs text-slate-500">
            Save this ID — you&apos;ll need it along with your email to look up your registration on the My Page.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-left text-sm text-emerald-900">
        <p className="font-semibold">What&apos;s next?</p>
        <ul className="mt-2 space-y-1">
          <li>• A confirmation email has been sent with your registration details.</li>
          <li>• You can look up your registration anytime on the My Page.</li>
          <li>• Contact us if you have any questions or need to make changes.</li>
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/mypage"
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          View My Registration
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Return to Home
        </Link>
      </div>
    </PageContainer>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
