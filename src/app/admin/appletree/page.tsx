'use client';

import { useEffect, useState } from 'react';

import { EVENT_INFO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDob(dob: string): string {
  const [year, month, day] = dob.split('-');
  if (year && month && day) {
    return `${month}/${day}/${year}`;
  }
  return dob;
}

type Child = {
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
  class?: 'regular' | 'beginner' | 'appletree';
  canceled?: boolean;
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
  paypal_order_id: string | null;
  source?: string;
  created_at: string;
  children: Child[];
};

function downloadCSV(rows: { reg: Registration; child: Child }[]) {
  const headers = [
    'Date', 'Child Name', 'T-Shirt', 'DOB', 'Gender',
    'Parent Name', 'Mobile', 'Email',
    'Allergies', 'Friend', 'Status', 'Price',
    'Emergency Contact', 'Emergency Phone', 'Photo Consent',
  ];

  const csvRows = rows.map(({ reg, child }) => [
    new Date(reg.created_at).toLocaleDateString(),
    `${child.first_name} ${child.last_name}`,
    child.tshirt_size,
    formatDob(child.date_of_birth),
    child.gender,
    reg.parent_name,
    formatPhone(reg.phone_number),
    reg.email,
    child.allergy_information ?? '',
    child.medical_notes ?? '',
    reg.payment_status,
    String(child.price),
    reg.emergency_contact_name,
    formatPhone(reg.emergency_contact_phone),
    reg.photo_consent ? 'Yes' : 'No',
  ]);

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csv = [headers, ...csvRows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AppleTree_registrations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AppleTreePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const res = await fetch('/api/admin/auth');
      if (res.ok) {
        setAuthenticated(true);
        fetchRegistrations();
      }
    } finally {
      setCheckingSession(false);
    }
  }

  async function fetchRegistrations() {
    setDataLoading(true);
    const res = await fetch('/api/admin/registrations');
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data.registrations);
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

    setAuthenticated(true);
    setAuthLoading(false);
    await fetchRegistrations();
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // Only appletree children
  const allTableRows = registrations.flatMap((reg) =>
    reg.children
      .map((child, idx) => ({ reg, child, idx }))
      .filter(({ child }) => child.class === 'appletree' && !child.canceled)
  );

  // Filter
  const filteredRows = allTableRows.filter(({ reg, child }) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = reg.parent_name.toLowerCase().includes(q)
        || reg.email.toLowerCase().includes(q)
        || `${child.first_name} ${child.last_name}`.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Sort
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortKey) {
      return new Date(b.reg.created_at).getTime() - new Date(a.reg.created_at).getTime();
    }
    let aVal = '';
    let bVal = '';
    switch (sortKey) {
      case 'date': aVal = a.reg.created_at; bVal = b.reg.created_at; break;
      case 'child': aVal = `${a.child.first_name} ${a.child.last_name}`; bVal = `${b.child.first_name} ${b.child.last_name}`; break;
      case 'tshirt': aVal = a.child.tshirt_size; bVal = b.child.tshirt_size; break;
      case 'dob': aVal = a.child.date_of_birth; bVal = b.child.date_of_birth; break;
      case 'gender': aVal = a.child.gender; bVal = b.child.gender; break;
      case 'parent': aVal = a.reg.parent_name; bVal = b.reg.parent_name; break;
      case 'phone': aVal = a.reg.phone_number; bVal = b.reg.phone_number; break;
      case 'email': aVal = a.reg.email; bVal = b.reg.email; break;
    }
    const cmp = aVal.localeCompare(bVal);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalRows = sortedRows.length;
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalRows / pageSize);
  const paginatedRows = pageSize === 0 ? sortedRows : sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const totalAmount = allTableRows.reduce((sum, { child }) => sum + child.price, 0);

  // ── Checking session ──
  if (checkingSession) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  // ── Login screen ──
  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-16">
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
              className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Apple Tree</h1>
        <p className="text-sm text-slate-500">
          {EVENT_INFO.name} · {EVENT_INFO.subtitle} · {EVENT_INFO.datesBeginner}
        </p>
      </div>

      {/* Summary stats */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Registrations</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{allTableRows.length}</p>
          </div>
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Children</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{allTableRows.length}</p>
          </div>
          <div className="rounded-none bg-[#0f1e5e] p-6">
            <p className="text-sm font-semibold text-blue-300">Collected</p>
            <p className="mt-1 text-3xl font-bold text-white">—</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Search */}
        <div className="border-b border-slate-200 px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                placeholder="Search name or email"
                className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            {dataLoading && <span className="text-base text-slate-400">Loading...</span>}
            <div className="ml-auto">
              <button
                onClick={() => downloadCSV(sortedRows)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
            </div>
          </div>
        </div>

        {!dataLoading && allTableRows.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500">No Apple Tree registrations yet.</div>
        )}

        {allTableRows.length > 0 && (
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold uppercase tracking-wider text-slate-500">
                {[
                  { key: 'date', label: 'Date', sortable: true },
                  { key: 'child', label: 'Child', sortable: true },
                  { key: 'tshirt', label: 'T-Shirt', sortable: true },
                  { key: 'dob', label: 'DOB', sortable: true },
                  { key: 'gender', label: 'Gender', sortable: true },
                  { key: 'parent', label: 'Parent', sortable: true },
                  { key: 'phone', label: 'Mobile', sortable: true },
                  { key: 'email', label: 'Email', sortable: true },
                  { key: 'allergies', label: 'Allergies', sortable: false },
                  { key: 'friend', label: 'Friend', sortable: false },
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`px-1.5 py-1.5 ${col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <svg className={`h-3 w-3 ${sortKey === col.key ? 'text-slate-700' : 'text-slate-300'}`} viewBox="0 0 12 12" fill="currentColor">
                          {sortKey === col.key
                            ? (sortDir === 'asc' ? <path d="M6 3l4 5H2z" /> : <path d="M6 9l4-5H2z" />)
                            : <><path d="M6 2l3 4H3z" /><path d="M6 10l3-4H3z" /></>}
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.map(({ reg, child, idx }) => (
                <tr key={`${reg.id}-${idx}`} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">
                    {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1 font-medium text-slate-900">
                    {child.first_name} {child.last_name}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{child.tshirt_size}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{formatDob(child.date_of_birth)}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{child.gender === 'Female' ? 'F' : child.gender === 'Male' ? 'M' : child.gender}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{reg.parent_name}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{formatPhone(reg.phone_number)}</td>
                  <td className="px-1.5 py-1 text-slate-500">{reg.email}</td>
                  <td className="max-w-[150px] truncate px-1.5 py-1 text-slate-500" title={child.allergy_information ?? ''}>
                    {child.allergy_information || '—'}
                  </td>
                  <td className="max-w-[120px] truncate px-1.5 py-1 text-slate-500" title={child.medical_notes ?? ''}>
                    {child.medical_notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination footer */}
        {allTableRows.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(0);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:border-sky-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All</option>
              </select>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>
                {pageSize === 0
                  ? `1–${totalRows} of ${totalRows}`
                  : `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, totalRows)} of ${totalRows}`}
              </span>
              {pageSize !== 0 && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
