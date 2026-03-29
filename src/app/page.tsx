import Image from 'next/image';
import Link from 'next/link';

import PageContainer from '@/components/PageContainer';
import { EVENT_INFO } from '@/lib/constants';

export default function HomePage() {
  return (
    <PageContainer className="max-w-4xl space-y-10 py-12 sm:space-y-14 sm:py-16">
      <section className="space-y-6 text-center">
        <div className="overflow-hidden rounded-[2rem] shadow-lg shadow-sky-100 ring-1 ring-sky-100">
          <Image
            src="/banner.png"
            alt="VBS 2026 Kingdom Quest"
            width={1200}
            height={500}
            className="w-full object-cover"
            priority
          />
        </div>

        <div className="mx-auto max-w-2xl space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">Irvine Onnuri Church</p>
          <h1 className="text-4xl font-bold tracking-tight text-sky-950 sm:text-5xl">VBS 2026</h1>
          <p className="text-xl font-medium text-yellow-700">Kingdom Quest</p>
          <p className="pt-1 text-sm italic text-slate-500">{EVENT_INFO.scripture}</p>
        </div>

        <div className="mx-auto max-w-2xl space-y-4">
          <p className="text-base leading-7 text-slate-700 sm:text-lg">{EVENT_INFO.shortDescription}</p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-6 py-3 text-base font-semibold text-sky-950 shadow-md shadow-yellow-200 transition hover:bg-yellow-300"
          >
            Register Now
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-[2rem] bg-[#fffdf4] p-6 shadow-md shadow-yellow-100 ring-1 ring-yellow-100 sm:p-8">
          <h2 className="text-2xl font-semibold text-sky-950">Event Info</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700 sm:text-base">
            <div>
              <p className="font-semibold text-sky-700">Dates</p>
              <p>{EVENT_INFO.dates}</p>
            </div>
            <div>
              <p className="font-semibold text-sky-700">Times</p>
              <p>{EVENT_INFO.times}</p>
            </div>
            <div>
              <p className="font-semibold text-sky-700">Who</p>
              <p>Kinder – 6th Grade</p>
            </div>
            <div>
              <p className="font-semibold text-sky-700">Location</p>
              <p>{EVENT_INFO.location}</p>
              <p className="text-slate-500">{EVENT_INFO.address}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] bg-white p-6 shadow-md shadow-sky-100 ring-1 ring-sky-100 sm:p-8">
          <h2 className="text-2xl font-semibold text-sky-950">Contact</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Have questions about registration? Feel free to reach out.
          </p>
          <div className="mt-5 space-y-2 text-sm text-slate-700 sm:text-base">
            <p className="font-semibold text-sky-700">{EVENT_INFO.contactName}</p>
            <a
              href={`tel:${EVENT_INFO.contactPhone.replace(/\D/g, '')}`}
              className="block text-sky-600 transition hover:text-sky-800"
            >
              {EVENT_INFO.contactPhone}
            </a>
          </div>
        </article>
      </section>
    </PageContainer>
  );
}
