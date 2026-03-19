import Link from 'next/link';

import PageContainer from '@/components/PageContainer';
import SectionTitle from '@/components/SectionTitle';
import { EVENT_DETAILS, EVENT_INFO } from '@/lib/constants';

export default function HomePage() {
  return (
    <PageContainer className="space-y-10">
      <section className="rounded-3xl bg-white px-6 py-10 shadow-sm ring-1 ring-slate-200 sm:px-10">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Welcome families
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {EVENT_INFO.name}
          </h1>
          <p className="text-base leading-7 text-slate-600 sm:text-lg">
            A simple starting point for a church Vacation Bible School registration experience. Full forms,
            payments, and email updates will be connected in future steps.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Start Registration
            </Link>
            <a
              href={EVENT_INFO.parentGuidePdfPath}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Download Parent Guide PDF
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <SectionTitle
            title="Event Details"
            description="Replace these placeholders with your final VBS schedule, location, and attendance details."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {EVENT_DETAILS.map((detail) => (
              <div key={detail.label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-500">{detail.label}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{detail.value}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-500">Registration Fee</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{EVENT_INFO.registrationFee}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
          <SectionTitle
            title="Parent Guide"
            description="Share arrival details, policies, and volunteer information once the PDF is ready."
            action={
              <a
                href={EVENT_INFO.parentGuidePdfPath}
                className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                View PDF
              </a>
            }
          />
          <div className="mt-6 space-y-4 text-sm leading-6 text-slate-200">
            <p>Use this section to highlight what parents should know before registration opens.</p>
            <ul className="space-y-2">
              <li>• Check-in and pick-up process placeholder</li>
              <li>• Allergy and medical policy placeholder</li>
              <li>• Volunteer and contact information placeholder</li>
            </ul>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
