'use client';

import { Fragment, useEffect, useState } from 'react';

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
    proxy_children?: { name: string; grade: string }[] | null;
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
type PickupType = 'parent' | 'friend';

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

  // Confirm undo popup state
  const [confirmData, setConfirmData] = useState<{ regId: string; childIndex: number; childName: string; grade: string; tshirtSize: string; parentName: string } | null>(null);

  // Modal state
  const [modalData, setModalData] = useState<{ reg: Registration; childIndex: number } | null>(null);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [pickupType, setPickupType] = useState<PickupType | null>(null);
  const [step2Rows, setStep2Rows] = useState<{ name: string; grade: string }[]>([{ name: '', grade: '' }]);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

  const GRADES = ['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade'];

  function openCheckInModal(reg: Registration, childIndex: number) {
    setModalData({ reg, childIndex });
    setModalStep(1);
    setPickupType(null);
    setStep2Rows([{ name: '', grade: '' }]);
    setOpenDropdownIdx(null);
  }

  function closeModal() {
    setModalData(null);
    setPickupType(null);
    setModalStep(1);
    setStep2Rows([{ name: '', grade: '' }]);
    setOpenDropdownIdx(null);
  }

  async function handleModalNext() {
    if (!modalData || !pickupType) return;
    if (pickupType === 'parent') {
      await toggleCheckIn(modalData.reg.id, modalData.childIndex, false);
      closeModal();
    } else {
      setModalStep(2);
    }
  }

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

  async function toggleCheckIn(regId: string, childIndex: number, currentlyCheckedIn: boolean, proxyChildren?: { name: string; grade: string }[]) {
    const key = `${regId}-${childIndex}`;
    setLoadingCheckin(key);

    const res = await fetch('/api/admin/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: regId,
        childIndex,
        checkedIn: !currentlyCheckedIn,
        ...(proxyChildren?.length ? { proxyChildren } : {}),
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
                ...(!currentlyCheckedIn && proxyChildren?.length ? { proxy_children: proxyChildren } : {}),
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
                {['Child', 'Parent', 'Grade', 'Class', 'T-Shirt', 'Allergies', ''].map((col) => (
                  <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    {searchQuery ? 'No children match your search.' : 'No children found.'}
                  </td>
                </tr>
              )}
              {filteredRows.map(({ reg, child, childIndex }) => {
                const isCheckedIn = !!child.check_in?.checked_in;
                const loadKey = `${reg.id}-${childIndex}`;
                const isLoading = loadingCheckin === loadKey;
                const hasAllergy = !!child.allergy_information && !/^(none|no|nope|na|n\/a|-)$/i.test(child.allergy_information.trim());
                const proxyChildren = (child.check_in?.proxy_children ?? []).filter(Boolean);
                const isProxyPickup = isCheckedIn && proxyChildren.length > 0;

                return (
                  <Fragment key={loadKey}>
                    <tr
                      className={`transition ${isProxyPickup ? '' : 'border-b border-slate-100 ' + (isCheckedIn ? 'bg-emerald-50/50' : 'hover:bg-slate-50')}`}
                      style={isProxyPickup ? { backgroundColor: '#f0faf6' } : undefined}
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">
                          {child.first_name} {child.last_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{reg.parent_name}</td>
                      <td className="px-4 py-3 text-slate-600">{child.grade}</td>
                      <td className="px-4 py-3">
                        {child.class === 'appletree' ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Apple Tree</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
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
                        {isProxyPickup ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#854F0B', padding: '3px 10px' }}>
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                              </svg>
                              대리 픽업
                            </span>
                            <button
                              onClick={() => setConfirmData({ regId: reg.id, childIndex, childName: `${child.first_name} ${child.last_name}`, grade: child.grade, tshirtSize: child.tshirt_size, parentName: reg.parent_name })}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50"
                              style={{ backgroundColor: '#e0f5ee', color: '#0F6E56', border: '1px solid #1D9E75' }}
                            >
                              {isLoading ? 'Saving...' : (
                                <>
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Checked in
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => isCheckedIn
                              ? setConfirmData({ regId: reg.id, childIndex, childName: `${child.first_name} ${child.last_name}`, grade: child.grade, tshirtSize: child.tshirt_size, parentName: reg.parent_name })
                              : openCheckInModal(reg, childIndex)
                            }
                            disabled={isLoading}
                            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                              isCheckedIn
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 whitespace-nowrap'
                                : 'bg-slate-900 text-white hover:bg-slate-700 whitespace-nowrap'
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
                        )}
                      </td>
                    </tr>
                    {isProxyPickup && (
                      <tr className="border-b border-slate-100" style={{ backgroundColor: '#f0faf6' }}>
                        <td colSpan={7} style={{ padding: '0 20px 12px 20px' }}>
                          <div style={{ backgroundColor: '#e8f4ff', borderLeft: '2px solid #378ADD', borderRadius: '0 8px 8px 0', padding: '8px 14px' }}>
                            <div className="mb-2 flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#185FA5' }}>
                                <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                              </svg>
                              <span className="text-xs font-medium" style={{ color: '#185FA5' }}>대리 픽업 자녀</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {proxyChildren.map((pc, i) => {
                                const parts = pc.name.trim().split(/\s+/);
                                const initials = ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
                                return (
                                  <div key={i} className="inline-flex items-center gap-1.5" style={{ backgroundColor: '#fff', border: '0.5px solid #B5D4F4', borderRadius: '999px', padding: '3px 10px 3px 4px' }}>
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: '#B5D4F4', color: '#0C447C' }}>
                                      {initials}
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: '#185FA5' }}>{pc.name}</span>
                                    <span className="text-xs" style={{ color: '#378ADD' }}>· {pc.grade}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm undo popup */}
      {confirmData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmData(null)}
        >
          <div
            className="animate-fade-in relative w-full max-w-md p-6 shadow-2xl"
            style={{ backgroundColor: '#1a2535', border: '1px solid #2a3a4a', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* × close */}
            <button
              onClick={() => setConfirmData(null)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
              style={{ color: '#8899aa' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="mb-4 pr-6 text-base text-white" style={{ fontWeight: 500 }}>체크인을 취소하시겠습니까?</h3>

            {/* Child info card */}
            <div className="mb-6 flex items-center gap-3 rounded-[10px] px-[14px] py-3" style={{ backgroundColor: '#0f1c2a' }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px]" style={{ backgroundColor: '#2e3d4f', color: '#8899aa', fontWeight: 500 }}>
                {confirmData.childName.split(' ').map((p) => p[0] ?? '').filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white" style={{ fontWeight: 500 }}>{confirmData.childName}</p>
                <p className="text-xs" style={{ color: '#8899aa' }}>{confirmData.grade} · T-shirt {confirmData.tshirtSize} · 부모: {confirmData.parentName}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmData(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
                style={{ border: '1px solid #3a4a5a' }}
              >
                아니오
              </button>
              <button
                onClick={async () => {
                  await toggleCheckIn(confirmData.regId, confirmData.childIndex, true);
                  setConfirmData(null);
                }}
                disabled={loadingCheckin === `${confirmData.regId}-${confirmData.childIndex}`}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#E24B4A' }}
              >
                {loadingCheckin === `${confirmData.regId}-${confirmData.childIndex}` ? '취소 중...' : '체크인 취소'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {modalData && (() => {
        const { reg, childIndex } = modalData;
        const child = reg.children[childIndex];
        const initials = `${child.first_name[0] ?? ''}${child.last_name[0] ?? ''}`.toUpperCase();
        const loadKey = `${reg.id}-${childIndex}`;
        const isLoading = loadingCheckin === loadKey;

        const steps = [
          { num: 1, label: '본인 확인' },
          { num: 2, label: '자녀 정보' },
          { num: 3, label: '완료' },
        ];

        return (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/60" onClick={closeModal} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="relative w-full max-w-md rounded-3xl bg-[#1c1c1e] p-6 shadow-2xl">

                {/* Close button */}
                <button
                  onClick={closeModal}
                  className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-white transition hover:bg-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Step progress bar */}
                <div className="mb-6 flex items-center justify-center">
                  {steps.map((step, i) => {
                    const isActive = modalStep === step.num;
                    const isDone = modalStep > step.num;
                    return (
                      <div key={step.num} className="flex items-center">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                            isDone
                              ? 'bg-teal-500 text-white'
                              : isActive
                              ? 'bg-[#1e3a6e] text-white'
                              : 'border-2 border-slate-600 text-slate-500'
                          }`}>
                            {isDone ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : step.num}
                          </div>
                          <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>
                            {step.label}
                          </span>
                        </div>
                        {i < steps.length - 1 && (
                          <div className="mx-3 h-px w-8 bg-slate-600" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Child info card — Step 1 only */}
                {modalStep === 1 && (
                  <div className="mb-5 flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-500/40 text-sm font-bold text-slate-100">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{child.first_name} {child.last_name}</p>
                      <p className="text-xs text-slate-400">{child.grade} · T-shirt {child.tshirt_size} · 부모: {reg.parent_name}</p>
                    </div>
                  </div>
                )}

                {/* Step 1 */}
                {modalStep === 1 && (
                  <>
                    <h2 className="mb-1 text-lg font-bold text-white">체크인하시는 분이 누구신가요?</h2>
                    <p className="mb-5 text-sm text-slate-400">아이를 데려오신 분을 선택해 주세요.</p>

                    <div className="mb-6 grid grid-cols-2 gap-3">
                      {/* 부모님 본인 */}
                      <button
                        onClick={() => setPickupType('parent')}
                        className="flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5"
                        style={{
                          transition: 'all 0.15s ease',
                          borderColor: pickupType === 'parent' ? '#1D9E75' : '#4b5563',
                          backgroundColor: pickupType === 'parent' ? '#E1F5EE' : '#18181b',
                        }}
                      >
                        <svg
                          className="h-8 w-8"
                          style={{ color: pickupType === 'parent' ? '#1D9E75' : '#9ca3af' }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                        >
                          <circle cx="12" cy="6.5" r="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 20c0-3.59 2.91-6.5 6.5-6.5"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M10 18l2.5 2.5 5.5-5.5"/>
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color: pickupType === 'parent' ? '#0F6E56' : '#ffffff' }}>부모님 본인</p>
                          <p className="text-xs" style={{ color: pickupType === 'parent' ? '#1D9E75' : '#9ca3af' }}>등록된 보호자</p>
                        </div>
                      </button>

                      {/* 부모님 지인 */}
                      <button
                        onClick={() => setPickupType('friend')}
                        className="flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5"
                        style={{
                          transition: 'all 0.15s ease',
                          borderColor: pickupType === 'friend' ? '#378ADD' : '#4b5563',
                          backgroundColor: pickupType === 'friend' ? '#E6F1FB' : '#18181b',
                        }}
                      >
                        <svg
                          className="h-8 w-8"
                          style={{ color: pickupType === 'friend' ? '#378ADD' : '#9ca3af' }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                          strokeLinecap="round" strokeLinejoin="round"
                        >
                          <circle cx="9" cy="9.5" r="4"/>
                          <path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/>
                          <circle cx="16.5" cy="5.5" r="2.5"/>
                          <path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color: pickupType === 'friend' ? '#185FA5' : '#ffffff' }}>부모님 지인</p>
                          <p className="text-xs" style={{ color: pickupType === 'friend' ? '#378ADD' : '#9ca3af' }}>대리 픽업</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2 — 자녀 정보 */}
                {modalStep === 2 && (
                  <>
                    {/* Badge */}
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: '#fdf0e0', color: '#7c4814' }}>
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="9.5" r="4"/>
                        <path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/>
                        <circle cx="16.5" cy="5.5" r="2.5"/>
                        <path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                      </svg>
                      <span className="text-sm font-semibold">부모님 지인 대리 픽업</span>
                    </div>

                    <h2 className="mb-1 text-lg font-bold text-white">데려오시는 자녀 정보</h2>
                    <p className="mb-4 text-sm text-slate-400">자녀의 이름과 학년을 입력해 주세요.</p>

                    {/* Column headers */}
                    <div className="mb-1.5 flex gap-2">
                      <span className="flex-1 pl-9 text-xs text-slate-400">이름</span>
                      <span className="flex-1 text-xs text-slate-400">학년</span>
                    </div>

                    {/* Rows */}
                    <div className="mb-3 space-y-2">
                      {step2Rows.map((row, idx) => (
                        <div key={idx} className="flex gap-2">
                          {/* Name input with inset row number */}
                          <div className="relative flex-1">
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-xs font-bold text-white">
                              {idx + 1}
                            </div>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => {
                                const next = [...step2Rows];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setStep2Rows(next);
                              }}
                              placeholder="자녀 이름"
                              className="w-full rounded-xl bg-zinc-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-slate-500"
                            />
                          </div>
                          {/* Grade dropdown with inset delete button */}
                          <div className="relative flex-1">
                            <button
                              type="button"
                              onClick={() => setOpenDropdownIdx(openDropdownIdx === idx ? null : idx)}
                              className="w-full rounded-xl bg-zinc-800 py-2.5 text-left text-sm outline-none"
                              style={{
                                color: row.grade ? '#fff' : '#6b7280',
                                border: `1px solid ${openDropdownIdx === idx ? '#378ADD' : 'transparent'}`,
                                paddingLeft: '12px',
                                paddingRight: step2Rows.length > 1 ? '32px' : '12px',
                              }}
                            >
                              {row.grade || '학년 선택'}
                            </button>
                            {step2Rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setStep2Rows(step2Rows.filter((_, i) => i !== idx))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-zinc-700 hover:text-white"
                              >
                                ×
                              </button>
                            )}
                            {openDropdownIdx === idx && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownIdx(null)} />
                                <div className="absolute bottom-full left-0 z-20 mb-1 w-full rounded-xl bg-zinc-800 shadow-xl" style={{ border: '1px solid #3f3f46', maxHeight: '180px', overflowY: 'auto' }}>
                                  {GRADES.map((g) => (
                                    <button
                                      key={g}
                                      type="button"
                                      onClick={() => {
                                        const next = [...step2Rows];
                                        next[idx] = { ...next[idx], grade: g };
                                        setStep2Rows(next);
                                        setOpenDropdownIdx(null);
                                      }}
                                      className="flex w-full items-center gap-2 text-left text-sm text-white hover:bg-zinc-700"
                                      style={{ padding: '8px 16px' }}
                                    >
                                      <span className="w-4 shrink-0 text-xs text-teal-400">{row.grade === g ? '✓' : ''}</span>
                                      {g}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add child button */}
                    {step2Rows.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setStep2Rows([...step2Rows, { name: '', grade: '' }])}
                        className="mb-5 w-full rounded-xl bg-zinc-800 py-3 text-sm font-medium text-slate-300 transition hover:bg-zinc-700"
                      >
                        + 자녀 추가
                      </button>
                    )}
                  </>
                )}

                {/* Bottom buttons */}
                <div className="flex gap-3">
                  {modalStep === 1 ? (
                    <>
                      <button
                        onClick={closeModal}
                        className="flex-1 rounded-2xl border-2 border-slate-600 py-3 text-sm font-semibold text-white transition hover:border-slate-400"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleModalNext}
                        disabled={!pickupType || isLoading}
                        className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white transition disabled:opacity-40"
                        style={{
                          backgroundColor: pickupType === 'parent' ? '#1D9E75' : '#1e3a6e',
                        }}
                      >
                        {isLoading ? '저장 중...' : pickupType === 'parent' ? '체크인 완료' : '다음 →'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setModalStep(1)}
                        className="flex-1 rounded-2xl border-2 border-slate-600 py-3 text-sm font-semibold text-white transition hover:border-slate-400"
                      >
                        ← 이전
                      </button>
                      <button
                        onClick={async () => {
                          await toggleCheckIn(reg.id, childIndex, false, step2Rows.filter((r) => r.name.trim()));
                          closeModal();
                        }}
                        disabled={isLoading}
                        className="flex-1 rounded-2xl bg-[#1e3a6e] py-3 text-sm font-semibold text-white transition hover:bg-[#254a8a] disabled:opacity-40"
                      >
                        {isLoading ? '저장 중...' : '체크인 완료'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
