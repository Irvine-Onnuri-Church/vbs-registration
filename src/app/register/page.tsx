import Link from 'next/link';

import { EVENT_INFO, REGISTRATION_PRICING } from '@/lib/constants';

export default function RegisterLandingPage() {
  return (
    <div>
      <div className="bg-[#0f1e5e] px-6 py-10 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-300">{EVENT_INFO.church}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">🏰 VBS Registration</h1>
        <p className="mt-2 text-blue-200">Kingdom Quest · {EVENT_INFO.dates}</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="mb-10 text-center text-lg font-semibold text-slate-700">Select your child&apos;s program to get started:</p>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Pre-K */}
          <Link
            href="/register/prek"
            className="group flex flex-col items-center rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-amber-300"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl transition group-hover:bg-amber-200">
              🌟
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Beginner Program</h2>
            <p className="mt-1 text-sm text-slate-500">For preschool-aged children</p>
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-slate-600">Early: <span className="font-bold text-slate-900">${REGISTRATION_PRICING.early.beginner}</span></p>
              <p className="text-slate-600">Regular: <span className="font-bold text-slate-900">${REGISTRATION_PRICING.regular.beginner}</span></p>
            </div>
            <span className="mt-6 inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-amber-900 transition group-hover:bg-amber-300">
              Register →
            </span>
          </Link>

          {/* TK–6th */}
          <Link
            href="/register/k6"
            className="group flex flex-col items-center rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-sky-300"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl transition group-hover:bg-sky-200">
              🏰
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Regular Program</h2>
            <p className="mt-1 text-sm text-slate-500">Transitional Kindergarten through 6th grade</p>
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-slate-600">Early: <span className="font-bold text-slate-900">${REGISTRATION_PRICING.early.standard}</span></p>
              <p className="text-slate-600">Regular: <span className="font-bold text-slate-900">${REGISTRATION_PRICING.regular.standard}</span></p>
            </div>
            <span className="mt-6 inline-flex items-center rounded-full bg-[#0f1e5e] px-5 py-2 text-sm font-bold text-white transition group-hover:bg-[#1a2f7a]">
              Register →
            </span>
          </Link>
        </div>

        <p className="mt-10 text-center text-sm text-slate-400">
          Questions? Contact <span className="font-semibold text-slate-600">{EVENT_INFO.contactName}</span> · {EVENT_INFO.contactPhone}
        </p>
      </div>
    </div>
  );
}
