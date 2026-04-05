import Image from 'next/image';
import Link from 'next/link';

import { EVENT_INFO } from '@/lib/constants';

export default function Design1Page() {
  return (
    <div className="bg-slate-50">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#080f2e]" style={{ minHeight: '88vh' }}>
        {/* Background: Kingdom Quest image, heavily faded */}
        <Image
          src="/logo-theme.jpg"
          alt=""
          fill
          className="object-cover opacity-[0.07]"
          priority
        />
        {/* Gradient overlay to fade bottom into content */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080f2e]/60 via-transparent to-[#080f2e]" />
        {/* Radial glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[120px]" />

        <div className="relative z-10 flex min-h-[88vh] flex-col items-center justify-center px-6 py-20 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-orange-400">Irvine Onnuri Church · 2026</p>

          <h1
            className="mt-4 text-6xl font-black leading-none tracking-tight text-white sm:text-8xl lg:text-9xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", textShadow: '0 4px 40px rgba(0,0,0,0.5)' }}
          >
            Kingdom<br />
            <span className="text-orange-400">Quest</span>
          </h1>

          <p className="mt-6 text-lg font-semibold text-blue-200 sm:text-xl">
            Vacation Bible School · {EVENT_INFO.dates}
          </p>
          <p className="mt-1 text-sm text-blue-300/70">{EVENT_INFO.times}</p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-orange-500 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-orange-500/30 transition hover:scale-105 hover:bg-orange-400"
            >
              Register Now →
            </Link>
            <a
              href="#details"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              Learn More
            </a>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/30">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── EVENT DETAILS ── */}
      <section id="details" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-3xl bg-slate-200 shadow-xl sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Dates', value: EVENT_INFO.dates, icon: '📅' },
            { label: 'Times', value: EVENT_INFO.times, icon: '🕒' },
            { label: 'Who', value: 'TK – 6th Grade', icon: '👦' },
            { label: 'Location', value: EVENT_INFO.location, sub: EVENT_INFO.address, icon: '📍' },
          ].map((item) => (
            <div key={item.label} className="bg-white px-6 py-8">
              <div className="text-2xl">{item.icon}</div>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-orange-500">{item.label}</p>
              <p className="mt-1 font-semibold text-slate-900">{item.value}</p>
              {item.sub && <p className="mt-0.5 text-sm text-slate-400">{item.sub}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── IMAGES FULL-BLEED ── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="group relative overflow-hidden rounded-3xl shadow-xl">
            <Image
              src="/bottom-line.jpg"
              alt="I will follow Jesus"
              width={960}
              height={540}
              className="w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <p className="absolute bottom-5 left-6 text-lg font-bold text-white drop-shadow">I will follow Jesus</p>
          </div>
          <div className="group relative overflow-hidden rounded-3xl shadow-xl">
            <Image
              src="/basic-truth.jpg"
              alt="Jesus wants to be my friend forever"
              width={960}
              height={540}
              className="w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <p className="absolute bottom-5 left-6 text-lg font-bold text-white drop-shadow">Jesus wants to be my friend forever</p>
          </div>
        </div>
      </section>

      {/* ── MEMORY VERSE ── */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#0f1e5e] px-8 py-16 text-center shadow-xl sm:px-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-orange-400/10 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.3em] text-orange-400">Memory Verse</p>
          <blockquote
            className="relative mx-auto mt-6 max-w-3xl text-2xl leading-relaxed text-white sm:text-3xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Jesus spoke to the people again. He said, &ldquo;I am the light of the world. Anyone who follows me will never walk in darkness. They will have that light. They will have life.&rdquo;
          </blockquote>
          <p className="relative mt-6 text-sm font-bold tracking-[0.25em] text-orange-300">— JOHN 8:12</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-orange-500 px-8 py-16 text-center shadow-2xl shadow-orange-500/20">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/10" />
          <p className="relative text-sm font-bold uppercase tracking-widest text-orange-100">Don&apos;t miss out</p>
          <h2 className="relative mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Ready to Join<br />the Quest?
          </h2>
          <p className="relative mt-3 text-orange-100">{EVENT_INFO.dates} · {EVENT_INFO.location}</p>
          <Link
            href="/register"
            className="relative mt-8 inline-flex items-center justify-center rounded-full bg-white px-10 py-4 text-base font-bold text-orange-600 shadow-xl transition hover:scale-105 hover:bg-orange-50"
          >
            Register Now →
          </Link>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white px-8 py-10 text-center shadow-xl ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Questions?</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{EVENT_INFO.contactName}</p>
          <a
            href={`tel:${EVENT_INFO.contactPhone.replace(/\D/g, '')}`}
            className="mt-1 block text-2xl font-bold text-orange-500 transition hover:text-orange-400"
          >
            {EVENT_INFO.contactPhone}
          </a>
        </div>
      </section>

    </div>
  );
}
