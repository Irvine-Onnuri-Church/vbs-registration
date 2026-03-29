import Link from 'next/link';

import PageContainer from '@/components/PageContainer';

export default function RegistrationSuccessPage() {
  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
        <svg
          className="h-10 w-10 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Registration Complete!</h1>
        <p className="max-w-md text-base leading-7 text-slate-600">
          Thank you for registering for VBS 2026 at Irvine Onnuri Church. We look forward to seeing your child(ren) this summer!
        </p>
      </div>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
        <p className="font-semibold">What&apos;s next?</p>
        <ul className="mt-2 space-y-1 text-left">
          <li>• A confirmation email will be sent to the address you provided.</li>
          <li>• You can view your registration details on the My Page.</li>
          <li>• Contact us if you have any questions or need to make changes.</li>
        </ul>
      </div>

      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
      >
        Return to Home
      </Link>
    </PageContainer>
  );
}
