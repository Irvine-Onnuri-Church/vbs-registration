'use client';

import { useEffect, useState } from 'react';

import { EVENT_INFO } from '@/lib/constants';

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
  check_in?: {
    checked_in: boolean;
    timestamp: string | null;
  };
};

type Registration = {
  id: string;
  parent_name: string;
  email: string;
  phone_number: string;
  children: Child[];
};

type FlatRow = {
  reg: Registration;
  child: Child;
  childIndex: number;
};

type FilterMode = 'all' | 'remaining' | 'checked_in' | 'has_allergies';

export default function CheckInPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loadingCheckin, setLoadingCheckin] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const res = await fetch('/api/admin/auth');
      if (res.ok) {
        setAuthenticated(true);
        setDataLoading(true);
        const regRes = await fetch('/api/admin/registrations');
        if (regRes.ok) {
          const data = await regRes.json();
          setRegistrations(data.registrations);
        }
        setDataLoading(false);
      }
    } finally {
      setCheckingSession(false);
    }
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
    setDataLoading(true);
    const regRes = await fetch('/api/admin/registrations');
    if (regRes.ok) {
      const data = await regRes.json();
      setRegistrations(data.registrations);
    }
    setDataLoading(false);
  }

  async function toggleCheckIn(regId: string, childIndex: number, currentlyCheckedIn: boolean) {
    const key = `${regId}-${childIndex}`;
    setLoadingCheckin(key);

    const res = await fetch('/api/admin/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: regId,
        childIndex,
        checkedIn: !currentlyCheckedIn,
      }),
    });

    if (res.ok) {
      setRegistrations((prev) =>
        prev.map((reg) => {
          if (reg.id !== regId) return reg;
          const updatedChildren = reg.children.map((child, i) => {
            if (i !== childIndex) return child;
            return {
              ...child,
              check_in: {
                checked_in: !currentlyCheckedIn,
                timestamp: !currentlyCheckedIn ? new Date().toISOString() : null,
              },
            };
          });
          return { ...reg, children: updatedChildren };
        }),
      );
    }

    setLoadingCheckin(null);
  }

  // Build flat rows (active children only)
  const allRows: FlatRow[] = registrations.flatMap((reg) =>
    reg.children
      .map((child, idx) => ({ reg, child, childIndex: idx }))
      .filter(({ child }) => !child.canceled),
  );

  // Filter
  const filteredRows = allRows.filter(({ child }) => {
    if (filterMode === 'remaining' && child.check_in?.checked_in) return false;
    if (filterMode === 'checked_in' && !child.check_in?.checked_in) return false;
    if (filterMode === 'has_allergies') {
      const hasAllergy = !!child.allergy_information && !/^(none|no|nope|na|n\/a|-)$/i.test(child.allergy_information.trim());
      if (!hasAllergy) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const childName = `${child.first_name} ${child.last_name}`.toLowerCase();
      if (!childName.includes(q)) return false;
    }
    return true;
  });

  // Sort by grade then name
  const gradeOrder: Record<string, number> = {
    'Pre-K': 0, 'Transitional Kindergarten': 1, 'Kindergarten': 2,
    '1st Grade': 3, '2nd Grade': 4, '3rd Grade': 5,
    '4th Grade': 6, '5th Grade': 7, '6th Grade': 8,
  };
  filteredRows.sort((a, b) => {
    const ga = gradeOrder[a.child.grade] ?? 99;
    const gb = gradeOrder[b.child.grade] ?? 99;
    if (ga !== gb) return ga - gb;
    const na = `${a.child.first_name} ${a.child.last_name}`.toLowerCase();
    const nb = `${b.child.first_name} ${b.child.last_name}`.toLowerCase();
    return na.localeCompare(nb);
  });

  // Stats
  const totalChildren = allRows.length;
  const checkedInCount = allRows.filter(({ child }) => child.check_in?.checked_in).length;
  const remainingCount = totalChildren - checkedInCount;

  // Per-class stats
  const classStats = (() => {
    const classes = ['beginner', 'regular', 'appletree'] as const;
    return classes.map((cls) => {
      const rows = allRows.filter(({ child }) => (child.class || 'regular') === cls);
      const checked = rows.filter(({ child }) => child.check_in?.checked_in).length;
      return { key: cls, total: rows.length, checked };
    }).filter((s) => s.total > 0);
  })();

  const filterButtons: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'remaining', label: 'Remaining' },
    { key: 'checked_in', label: 'Checked in' },
    { key: 'has_allergies', label: 'Has allergies' },
  ];

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
              className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {authLoading ? 'Verifying...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Check-in Dashboard ──
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Check-in</h1>
        <p className="text-sm text-slate-500">
          {EVENT_INFO.name} · {EVENT_INFO.subtitle} · {EVENT_INFO.dates}
        </p>
      </div>

      {/* Stats bar */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Total children</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalChildren}</p>
          </div>
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Checked in</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{checkedInCount}</p>
          </div>
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Remaining</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{remainingCount}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200">
          {classStats.map(({ key, total, checked }) => (
            <div key={key} className="p-5 px-6">
              <p className="text-sm font-semibold text-slate-500 capitalize">{key === 'appletree' ? 'Apple Tree' : key} VBS</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{checked}<span className="text-lg text-slate-400">/{total}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Search + filters + table */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Search bar */}
        <div className="border-b border-slate-200 px-4 py-4 space-y-3">
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by child name..."
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  filterMode === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
            {dataLoading && <span className="text-sm text-slate-400">Loading...</span>}
            <span className="ml-auto text-sm text-slate-500">
              {filteredRows.length} of {totalChildren} children
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                {['Child', 'Parent', 'Grade', 'T-Shirt', 'Allergies', ''].map((col) => (
                  <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    {searchQuery ? 'No children match your search.' : 'No children found.'}
                  </td>
                </tr>
              )}
              {filteredRows.map(({ reg, child, childIndex }) => {
                const isCheckedIn = !!child.check_in?.checked_in;
                const loadKey = `${reg.id}-${childIndex}`;
                const isLoading = loadingCheckin === loadKey;
                const hasAllergy = !!child.allergy_information && !/^(none|no|nope|na|n\/a|-)$/i.test(child.allergy_information.trim());

                return (
                  <tr
                    key={loadKey}
                    className={`border-b border-slate-100 transition ${isCheckedIn ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">
                        {child.first_name} {child.last_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{reg.parent_name}</td>
                    <td className="px-4 py-3 text-slate-600">{child.grade}</td>
                    <td className="px-4 py-3 text-slate-600">{child.tshirt_size}</td>
                    <td className="px-4 py-3">
                      {hasAllergy ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          {child.allergy_information}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleCheckIn(reg.id, childIndex, isCheckedIn)}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                          isCheckedIn
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-900 text-white hover:bg-slate-700'
                        }`}
                      >
                        {isLoading ? (
                          'Saving...'
                        ) : isCheckedIn ? (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Checked in
                          </>
                        ) : (
                          'Check in'
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
