import Link from 'next/link';

import PageContainer from '@/components/PageContainer';
import { EVENT_INFO } from '@/lib/constants';

export default function HomePage() {
  return (
    <PageContainer className="max-w-4xl space-y-10 py-12 sm:space-y-14 sm:py-16">
      <section className="space-y-6 text-center">
        <div className="overflow-hidden rounded-[2rem] bg-white p-4 shadow-lg shadow-sky-100 ring-1 ring-sky-100 sm:p-6">
          <div className="flex min-h-[260px] items-end justify-center rounded-[1.5rem] bg-gradient-to-br from-yellow-200 via-sky-200 to-white px-6 py-10 text-center shadow-inner sm:min-h-[340px]">
            <div className="max-w-2xl rounded-[1.5rem] bg-white/80 px-6 py-5 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">Summer at church</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-sky-950 sm:text-5xl">VBS 2025</h1>
              <p className="mt-3 text-xl font-medium text-yellow-700">Bright Summer Camp</p>
            </div>
          </div>
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
        <article className="rounded-[2rem] bg-white p-6 shadow-md shadow-sky-100 ring-1 ring-sky-100 sm:p-8">
          <h2 className="text-2xl font-semibold text-sky-950">Parent Guide</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Get the latest family information, event reminders, and day-of details in one easy guide.
          </p>
          <a
            href={EVENT_INFO.parentGuidePdfPath}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
          >
            Download PDF
          </a>
        </article>

        <article className="rounded-[2rem] bg-[#fffdf4] p-6 shadow-md shadow-yellow-100 ring-1 ring-yellow-100 sm:p-8">
          <h2 className="text-2xl font-semibold text-sky-950">Event Info</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700 sm:text-base">
            <div>
              <p className="font-semibold text-sky-700">Dates</p>
              <p>{EVENT_INFO.dates}</p>
            </div>
            <div>
              <p className="font-semibold text-sky-700">Location</p>
              <p>{EVENT_INFO.location}</p>
            </div>
            <div>
              <p className="font-semibold text-sky-700">About the Week</p>
              <p>
                Kids can look forward to worship, stories, crafts, games, and a bright summer atmosphere designed to
                help them grow in faith and friendship.
              </p>
            </div>
          </div>
        </article>
      </section>
    </PageContainer>
  );
}
