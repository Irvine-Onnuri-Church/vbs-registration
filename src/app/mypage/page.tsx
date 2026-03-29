'use client';

import { useState } from 'react';

import PageContainer from '@/components/PageContainer';
import { formatCurrency } from '@/lib/utils';

type Child = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  grade: string;
  tshirt_size: string;
  price: number;
};

type Registration = {
  id: string;
  parent_name: string;
  email: string;
  phone_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  total_amount: number;
  registration_phase: string;
  payment_status: string;
  created_at: string;
  children: Child[];
};

export default function MyPage() {
  const [email, setEmail] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setRegistration(null);
    setLoading(true);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, registrationId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setRegistration(data.registration);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer className="space-y-8 py-12">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">My Page</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Look Up Your Registration</h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          Enter the email address you registered with and the Registration ID from your confirmation email.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <form onSubmit={handleLookup} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Email Address <span className="text-red-500">*</span></span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Registration ID <span className="text-red-500">*</span></span>
            <input
              type="text"
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
              placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            <p className="text-xs text-slate-500">Found in your confirmation email.</p>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60 sm:w-auto"
          >
            {loading ? 'Looking up...' : 'Find Registration'}
          </button>
        </form>
      </section>

      {registration && (
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{registration.parent_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{registration.email} · {registration.phone_number}</p>
              </div>
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                {registration.payment_status}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs text-slate-500">
              {registration.id}
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Registered on {new Date(registration.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}{registration.registration_phase === 'early' ? 'Early Registration' : 'Regular Registration'}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Registered Children</h2>
            <div className="mt-4 space-y-3">
              {registration.children.map((child) => (
                <div key={child.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">
                      {child.first_name} {child.last_name}
                      {child.preferred_name && <span className="ml-1 text-slate-500">({child.preferred_name})</span>}
                    </p>
                    <p className="text-slate-500">{child.grade} · T-shirt: {child.tshirt_size}</p>
                  </div>
                  <span className="font-semibold text-slate-700">{formatCurrency(child.price)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              <span>Total Paid</span>
              <span>{formatCurrency(registration.total_amount)}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Need to make changes?</p>
            <p className="mt-1">Please contact <strong>이지나 전도사 (Deaconess Jina Lee)</strong> at (818) 312-2173.</p>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
