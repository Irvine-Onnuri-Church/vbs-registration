'use client';

import { useEffect, useState } from 'react';

import PageContainer from '@/components/PageContainer';
import { EVENT_INFO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

type Child = {
  first_name: string;
  last_name: string;
  grade: string;
  tshirt_size: string;
  price: number;
};

type Registration = {
  id: string;
  parent_name: string;
  email: string;
  total_amount: number;
  registration_phase: string;
  payment_status: string;
  created_at: string;
  children: Child[];
};

export default function MyPageClient({ token }: { token: string | null }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState('');

  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    fetch('/api/magic-link/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.registrations) setRegistrations(data.registrations);
        else setVerifyError(data.error ?? 'Invalid or expired link.');
      })
      .catch(() => setVerifyError('Something went wrong. Please try again.'))
      .finally(() => setVerifyLoading(false));
  }, [token]);

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setSendError('');
    setSendLoading(true);
    try {
      await fetch('/api/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSendError('Something went wrong. Please try again.');
    } finally {
      setSendLoading(false);
    }
  }

  // ── Loading ──
  if (verifyLoading) {
    return (
      <PageContainer className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-500">Verifying your link...</p>
      </PageContainer>
    );
  }

  // ── Token error ──
  if (token && verifyError) {
    return (
      <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-600">{verifyError}</p>
        <button
          onClick={() => window.location.href = '/mypage'}
          className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Request a new link
        </button>
      </PageContainer>
    );
  }

  // ── Registrations view ──
  if (registrations) {
    const allChildren = registrations.flatMap((reg) =>
      reg.children.map((child) => ({ ...child, reg }))
    );
    const totalPaid = registrations.reduce((sum, r) => sum + r.total_amount, 0);

    return (
      <PageContainer className="space-y-8 py-12">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">My Registration</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Registered Children</h1>
          <p className="text-sm text-slate-500">{registrations[0]?.email}</p>
        </div>

        {allChildren.length === 0 ? (
          <p className="text-slate-500">No registrations found for this email.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              <div className="rounded-2xl bg-[#0f1e5e] px-6 py-4 text-white">
                <p className="text-xs text-blue-300">Total Children</p>
                <p className="text-2xl font-bold">{allChildren.length}</p>
              </div>
              <div className="rounded-2xl bg-[#0f1e5e] px-6 py-4 text-white">
                <p className="text-xs text-blue-300">Total Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
            </div>

            <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="font-semibold text-slate-900">Registered Children</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {allChildren.map((child, idx) => (
                  <div key={`${child.reg.id}-${idx}`} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{child.first_name} {child.last_name}</p>
                      <p className="text-sm text-slate-500">{child.grade} · T-shirt: {child.tshirt_size}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(child.reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{child.reg.payment_status}</span>
                      </p>
                    </div>
                    <span className="font-semibold text-slate-700">{formatCurrency(child.price)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Need to make changes?</p>
          <p className="mt-1">Please contact <strong>{EVENT_INFO.contactName}</strong> at {EVENT_INFO.contactPhone}.</p>
        </div>
      </PageContainer>
    );
  }

  // ── Email form ──
  return (
    <PageContainer className="space-y-8 py-12">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">My Registration</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">View Your Registration</h1>
        <p className="text-slate-600">Enter your email and we&apos;ll send you a secure link to view all your registrations. The link expires in <strong>1 hour</strong>.</p>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        {sent ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✉️</div>
            <h2 className="text-lg font-semibold text-slate-900">Check your inbox!</h2>
            <p className="text-sm text-slate-500">
              If we found registrations for <strong>{email}</strong>, a link has been sent. It expires in 1 hour.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-sm text-sky-600 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendLink} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </label>
            {sendError && <p className="text-sm text-red-600">{sendError}</p>}
            <button
              type="submit"
              disabled={sendLoading}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#0f1e5e] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2f7a] disabled:opacity-60 sm:w-auto"
            >
              {sendLoading ? 'Sending...' : 'Send Me a Link →'}
            </button>
          </form>
        )}
      </section>
    </PageContainer>
  );
}
