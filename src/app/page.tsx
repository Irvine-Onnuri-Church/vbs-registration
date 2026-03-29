import Image from 'next/image';
import Link from 'next/link';

import { EVENT_INFO } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="relative min-h-screen">

      {/* ── Faded Kingdom Quest background ── */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/logo-theme.jpg"
          alt=""
          fill
          className="object-cover opacity-[0.12]"
          priority
        />
        {/* White wash so content stays readable */}
        <div className="absolute inset-0 bg-white/70" />
      </div>

      {/* ── All content on top ── */}
      <div className="relative z-10 mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">

        {/* Banner */}
        <section className="flex justify-center">
          <Image
            src="/banner.png"
            alt="VBS 2026 Kingdom Quest — June 10–13"
            width={800}
            height={200}
            className="w-full rounded-3xl shadow-2xl"
            priority
          />
        </section>

        {/* Event details */}
        <section className="rounded-3xl bg-[#0f1e5e] p-8 text-white shadow-xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Dates', value: EVENT_INFO.dates },
              { label: 'Times', value: EVENT_INFO.times },
              { label: 'Who', value: 'Kinder – 6th Grade' },
              { label: 'Location', value: EVENT_INFO.location, sub: EVENT_INFO.address },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs font-bold uppercase tracking-widest text-orange-400">{item.label}</p>
                <p className="mt-1 font-semibold leading-snug text-white">{item.value}</p>
                {item.sub && <p className="mt-0.5 text-sm text-blue-300">{item.sub}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Image grid — bottom line + basic truth */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <Image
              src="/bottom-line.jpg"
              alt="I will follow Jesus"
              width={960}
              height={540}
              className="w-full object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <Image
              src="/basic-truth.jpg"
              alt="Jesus wants to be my friend forever"
              width={960}
              height={540}
              className="w-full object-cover"
            />
          </div>
        </section>

        {/* Memory verse */}
        <section className="relative overflow-hidden rounded-3xl bg-[#0f1e5e] px-8 py-14 text-center shadow-xl sm:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">Memory Verse</p>
          <blockquote
            className="mx-auto mt-5 max-w-3xl text-2xl leading-relaxed text-white sm:text-3xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Jesus spoke to the people again. He said, &ldquo;I am the light of the world. Anyone who follows me will never walk in darkness. They will have that light. They will have life.&rdquo;
          </blockquote>
          <p className="mt-5 text-sm font-bold tracking-widest text-orange-300">— JOHN 8:12</p>
        </section>

        {/* CTA */}
        <section className="rounded-3xl bg-orange-500 px-8 py-12 text-center text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-widest text-orange-100">Don&apos;t miss out</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to Join the Quest?</h2>
          <p className="mt-3 text-base text-orange-100">{EVENT_INFO.dates} · {EVENT_INFO.location}</p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-base font-bold text-orange-600 shadow-lg transition hover:scale-105 hover:bg-orange-50"
          >
            Register Now →
          </Link>
        </section>

        {/* Contact */}
        <section className="rounded-3xl bg-white px-8 py-10 text-center shadow-xl ring-1 ring-slate-200">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Questions?</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{EVENT_INFO.contactName}</p>
          <a
            href={`tel:${EVENT_INFO.contactPhone.replace(/\D/g, '')}`}
            className="mt-1 block text-2xl font-bold text-orange-500 transition hover:text-orange-400"
          >
            {EVENT_INFO.contactPhone}
          </a>
        </section>

      </div>

      {/* Floating Register button */}
      <Link
        href="/register"
        className="fixed bottom-8 right-6 z-50 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-orange-500 text-center shadow-2xl shadow-orange-500/40 transition hover:scale-110 hover:bg-orange-400 active:scale-95"
      >
        <span className="text-xl">🏰</span>
        <span
          className="mt-0.5 text-[10px] font-black leading-tight text-white"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Register<br />Now!
        </span>
      </Link>
    </div>
  );
}
