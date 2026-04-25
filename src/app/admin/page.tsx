'use client';

import { useEffect, useState } from 'react';

import PageContainer from '@/components/PageContainer';
import { EVENT_INFO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

type Child = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  gender: string;
  date_of_birth: string;
  grade: string;
  tshirt_size: string;
  allergy_information: string | null;
  medical_notes: string | null;
  price: number;
};

type Registration = {
  id: string;
  parent_name: string;
  email: string;
  phone_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photo_consent: boolean;
  total_amount: number;
  registration_phase: string;
  payment_status: string;
  created_at: string;
  children: Child[];
};

function downloadCSV(registrations: Registration[]) {
  const headers = [
    'Registration ID', 'Date', 'Phase', 'Status', 'Total',
    'Parent Name', 'Email', 'Phone',
    'Emergency Contact', 'Emergency Phone', 'Photo Consent',
    'Child Name', 'Grade', 'Gender', 'DOB', 'T-Shirt', 'Allergies / Other Medical Conditions', 'Friend to be with', 'Price',
  ];

  const rows: string[][] = [];
  registrations.forEach((reg) => {
    if (reg.children.length === 0) {
      rows.push([
        reg.id, new Date(reg.created_at).toLocaleDateString(), reg.registration_phase, reg.payment_status, String(reg.total_amount),
        reg.parent_name, reg.email, reg.phone_number,
        reg.emergency_contact_name, reg.emergency_contact_phone, reg.photo_consent ? 'Yes' : 'No',
        '', '', '', '', '', '', '', '',
      ]);
    } else {
      reg.children.forEach((child) => {
        rows.push([
          reg.id, new Date(reg.created_at).toLocaleDateString(), reg.registration_phase, reg.payment_status, String(reg.total_amount),
          reg.parent_name, reg.email, reg.phone_number,
          reg.emergency_contact_name, reg.emergency_contact_phone, reg.photo_consent ? 'Yes' : 'No',
          `${child.first_name} ${child.last_name}`, child.grade, child.gender, child.date_of_birth, child.tshirt_size,
          child.allergy_information ?? '', child.medical_notes ?? '', String(child.price),
        ]);
      });
    }
  });

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${EVENT_INFO.name.replace(/\s+/g, '')}_registrations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dataError, setDataError] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Check if cookie already set from previous session
    checkSession();
  }, []);

  async function checkSession() {
    const res = await fetch('/api/admin/registrations');
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data.registrations);
      setAuthenticated(true);
    }
    // If 401, just show login — no error needed
  }

  async function fetchRegistrations() {
    setDataLoading(true);
    setDataError('');
    const res = await fetch('/api/admin/registrations');
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data.registrations);
    } else {
      const data = await res.json().catch(() => ({}));
      setDataError(data.error ?? 'Failed to load registrations. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local.');
    }
    setDataLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setAuthError(data.error);
      setAuthLoading(false);
      return;
    }

    // Auth succeeded — show dashboard immediately, then load data
    setAuthenticated(true);
    setAuthLoading(false);
    await fetchRegistrations();
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setRegistrations([]);
    setPassword('');
  }

  const totalAmount = registrations.reduce((sum, r) => sum + r.total_amount, 0);
  const totalChildren = registrations.reduce((sum, r) => sum + r.children.length, 0);

  // ── Login screen ──
  if (!authenticated) {
    return (
      <PageContainer className="flex min-h-[70vh] flex-col items-center justify-center py-16">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Admin Access</h1>
            <p className="mt-1 text-sm text-slate-500">{EVENT_INFO.church} {EVENT_INFO.name}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                autoFocus
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </label>

            {authError && <p className="text-sm text-red-600">{authError}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {authLoading ? 'Verifying...' : 'Enter'}
            </button>
          </form>
        </div>
      </PageContainer>
    );
  }

  // ── Dashboard ──
  return (
    <PageContainer className="space-y-8 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Registration Dashboard</h1>
          <p className="text-sm text-slate-500">{EVENT_INFO.church} {EVENT_INFO.name} — {EVENT_INFO.subtitle}</p>
        </div>
        <div className="flex gap-3">
          {registrations.length > 0 && (
            <button
              onClick={() => downloadCSV(registrations)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download CSV
            </button>
          )}
          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total Registrations</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{registrations.length}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total Children</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalChildren}</p>
        </div>
        <div className="rounded-3xl bg-[#0f1e5e] p-6 shadow-sm">
          <p className="text-sm text-blue-300">Total Collected</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Error state */}
      {dataError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dataError}
        </div>
      )}

      {/* Registrations list */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sm:px-8">
          <h2 className="font-semibold text-slate-900">All Registrations</h2>
          {dataLoading && <span className="text-sm text-slate-400">Loading...</span>}
        </div>

        {!dataLoading && registrations.length === 0 && !dataError && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No registrations yet.</div>
        )}

        <div className="divide-y divide-slate-100">
          {registrations.map((reg) => (
            <div key={reg.id}>
              {/* Row */}
              <button
                onClick={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                className="w-full px-6 py-4 text-left transition hover:bg-slate-50 sm:px-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{reg.parent_name}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {reg.payment_status}
                      </span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {reg.registration_phase === 'early' ? 'Early' : 'Regular'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{reg.email} · {reg.phone_number}</p>
                    <p className="text-xs text-slate-400">
                      {reg.children.length} child{reg.children.length !== 1 ? 'ren' : ''} ·{' '}
                      {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{formatCurrency(reg.total_amount)}</span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform ${expandedId === reg.id ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {expandedId === reg.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-6 pb-6 pt-4 sm:px-8">
                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Parent info */}
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-slate-700">Parent / Guardian</p>
                      <p className="text-slate-600">{reg.parent_name}</p>
                      <p className="text-slate-600">{reg.email}</p>
                      <p className="text-slate-600">{reg.phone_number}</p>
                      <p className="mt-3 font-semibold text-slate-700">Emergency Contact</p>
                      <p className="text-slate-600">{reg.emergency_contact_name}</p>
                      <p className="text-slate-600">{reg.emergency_contact_phone}</p>
                      <p className="mt-3 text-xs text-slate-400">Photo consent: {reg.photo_consent ? 'Yes' : 'No'}</p>
                    </div>

                    {/* Children */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700">Children</p>
                      {reg.children.map((child) => (
                        <div key={child.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-900">
                                {child.first_name} {child.last_name}
                                {child.preferred_name && <span className="ml-1 text-slate-400">({child.preferred_name})</span>}
                              </p>
                              <p className="text-slate-500">{child.grade} · {child.gender} · T-shirt: {child.tshirt_size}</p>
                              <p className="text-slate-500">DOB: {child.date_of_birth}</p>
                              {child.allergy_information && (
                                <p className="mt-1 text-amber-700">⚠ Allergies / Medical: {child.allergy_information}</p>
                              )}
                              {child.medical_notes && (
                                <p className="text-slate-600">Friend to be with: {child.medical_notes}</p>
                              )}
                            </div>
                            <span className="font-semibold text-slate-700">{formatCurrency(child.price)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-2 font-mono text-xs text-slate-400">
                    ID: {reg.id}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
