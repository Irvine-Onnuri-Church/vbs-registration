'use client';

import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react';

import { EVENT_INFO } from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

type Session = {
  status: 'checked_in' | 'picked_up';
  by: string | null;
  at: string;
  pickup_type?: 'parent' | 'alternate';
  alternate_children?: { name: string; grade: string }[];
};

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
  sessions?: Record<string, Session | null>;
};

type Registration = {
  id: string;
  parent_name: string;
  email: string;
  phone_number: string;
  children: Child[];
  created_at?: string;
};

type FlatRow       = { reg: Registration; child: Child; childIndex: number };
type FilterMode    = 'all' | 'remaining' | 'checked_in' | 'has_allergies';
type PickupType    = 'parent' | 'friend';
type ViewMode      = 'checkin' | 'goodiebag';
type ConfirmData   = {
  regId: string; childIndex: number; childName: string;
  grade: string; tshirtSize: string; parentName: string;
  mode: ViewMode;
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function getChildSessions(child: Child): Record<string, Session | null> {
  const sessions: Record<string, Session | null> = { ...(child.sessions ?? {}) };
  if (child.check_in?.checked_in && child.check_in.timestamp) {
    const legacyKey = `${child.check_in.timestamp.slice(0, 10)}_checkin`;
    if (!sessions[legacyKey]) {
      sessions[legacyKey] = { status: 'checked_in', by: null, at: child.check_in.timestamp };
    }
  }
  return sessions;
}

function formatDateCol(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const GRADE_ORDER: Record<string, number> = {
  'Pre-K': 0, 'TK': 1, 'Transitional Kindergarten': 1, 'Kindergarten': 2,
  '1st Grade': 3, '2nd Grade': 4, '3rd Grade': 5,
  '4th Grade': 6, '5th Grade': 7, '6th Grade': 8,
};

const TSHIRT_ORDER: Record<string, number> = {
  'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4,
  '2Y': 5, '3Y': 6, '4Y': 7, '5Y': 8,
};

function lastName(fullName: string): string {
  return fullName.trim().split(/\s+/).pop()?.toLowerCase() ?? fullName.toLowerCase();
}

function getSortValue(row: FlatRow, col: string): string | number {
  switch (col) {
    case 'last_name':  return row.child.last_name.toLowerCase();
    case 'first_name': return row.child.first_name.toLowerCase();
    case 'parent':     return lastName(row.reg.parent_name);
    case 'grade':      return GRADE_ORDER[row.child.grade] ?? 99;
    case 'tshirt':     return TSHIRT_ORDER[row.child.tshirt_size] ?? 99;
    case 'dob':        return row.child.date_of_birth ?? '9999-99-99';
    case 'gender':     return (row.child.gender ?? '').toLowerCase();
    default:           return '';
  }
}

function formatDob(dob: string): string {
  const [year, month, day] = (dob ?? '').split('-');
  return year && month && day ? `${month}/${day}/${year}` : dob ?? '';
}

function formatPhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone ?? '';
}

const GOODIEBAG_EVENT_DATES = ['2026-05-17', '2026-05-31'];

function effectiveGoodieBagDate(): string {
  const today = new Date().toISOString().slice(0, 10);
  const past = GOODIEBAG_EVENT_DATES.filter(d => d <= today);
  return past.length > 0 ? past[past.length - 1] : GOODIEBAG_EVENT_DATES[0];
}

function downloadCheckinCSV(rows: FlatRow[], viewMode: ViewMode) {
  const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  const headers = [
    'Child Name', 'Parent Name', 'Grade', 'Class', 'T-Shirt Size',
    'DOB', 'Gender', 'Mobile', 'Allergies/Medical',
    'Checked In', 'Goodie Bag Picked Up',
  ];
  const csvRows = rows.map(({ reg, child }) => [
    `${child.first_name} ${child.last_name}`,
    reg.parent_name,
    child.grade,
    child.class === 'appletree' ? 'Apple Tree' : (child.class ?? ''),
    child.tshirt_size,
    child.date_of_birth ? formatDob(child.date_of_birth) : '',
    child.gender === 'Male' ? 'M' : child.gender === 'Female' ? 'F' : (child.gender ?? ''),
    formatPhone(reg.phone_number),
    child.allergy_information ?? '',
    child.check_in?.checked_in ? 'Yes' : 'No',
    Object.values(child.sessions ?? {}).some((s) => s?.status === 'picked_up') ? 'Yes' : 'No',
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const label = viewMode === 'goodiebag' ? 'goodiebag' : 'checkin';
  a.download = `vbs2026_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CheckInPage() {
  // Auth
  const [authenticated, setAuthenticated]     = useState(false);
  const [checkingSession, setCheckingSession]   = useState(true);
  const [password, setPassword]               = useState('');
  const [authError, setAuthError]             = useState('');
  const [authLoading, setAuthLoading]         = useState(false);

  // Data
  const [registrations, setRegistrations]     = useState<Registration[]>([]);
  const [dataLoading, setDataLoading]         = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [filterMode, setFilterMode]           = useState<FilterMode>('all');
  const [loadingCheckin, setLoadingCheckin]   = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode]               = useState<ViewMode>('checkin');
  const [showStats, setShowStats]             = useState(true);

  // Confirm popup
  const [confirmData, setConfirmData]         = useState<ConfirmData | null>(null);
  const [editPickupData, setEditPickupData]   = useState<{ reg: Registration; childIndex: number } | null>(null);

  // Check-in modal
  const [modalData, setModalData]             = useState<{ reg: Registration; childIndex: number } | null>(null);
  const [modalStep, setModalStep]             = useState<1 | 2 | 3>(1);
  const [pickupType, setPickupType]           = useState<PickupType | null>(null);
  const [step2Rows, setStep2Rows]             = useState<{ name: string; grade: string }[]>([{ name: '', grade: '' }]);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const [modalMode, setModalMode]             = useState<ViewMode>('checkin');
  const [sortCol,  setSortCol]                = useState<string | null>(null);
  const [sortDir,  setSortDir]                = useState<'asc' | 'desc' | null>(null);

  const GRADES = ['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade'];

  const fetchRegistrations = useCallback(async () => {
    const res = await fetch('/api/admin/registrations', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data.registrations);
    }
  }, []);

  useEffect(() => { checkSession(); }, []);

  useEffect(() => {
    if (!modalData || modalStep !== 3 || modalMode !== 'goodiebag') return;
    const timer = setTimeout(() => {
      setModalData(null);
      setPickupType(null);
      setModalStep(1);
      setStep2Rows([{ name: '', grade: '' }]);
      setOpenDropdownIdx(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [modalData, modalStep, modalMode]);

  async function checkSession() {
    try {
      const res = await fetch('/api/admin/auth');
      if (res.ok) {
        setAuthenticated(true);
        setDataLoading(true);
        await fetchRegistrations();
        setDataLoading(false);
      }
    } finally {
      setCheckingSession(false);
    }
  }

  async function handleLogin(e: { preventDefault(): void }) {
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
    await fetchRegistrations();
    setDataLoading(false);
  }

  function openCheckInModal(reg: Registration, childIndex: number) {
    setModalData({ reg, childIndex });
    setModalMode('checkin');
    setModalStep(1);
    setPickupType(null);
    setStep2Rows([{ name: '', grade: '' }]);
    setOpenDropdownIdx(null);
  }

  function openGoodieBagModal(reg: Registration, childIndex: number) {
    setModalData({ reg, childIndex });
    setModalMode('goodiebag');
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
      if (modalMode === 'goodiebag') {
        await toggleCheckIn(modalData.reg.id, modalData.childIndex, false, undefined, 'goodiebag', 'parent');
        setModalStep(3);
      } else {
        await toggleCheckIn(modalData.reg.id, modalData.childIndex, false, undefined, 'checkin');
        closeModal();
      }
    } else {
      setModalStep(2);
    }
  }

  async function toggleCheckIn(
    regId: string,
    childIndex: number,
    currentlyCheckedIn: boolean,
    proxyChildren?: { name: string; grade: string }[],
    mode: ViewMode = 'checkin',
    pickupType?: 'parent' | 'alternate',
  ) {
    const key = `${regId}-${childIndex}`;
    setLoadingCheckin(key);

    const res = await fetch('/api/admin/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: regId,
        childIndex,
        checkedIn: !currentlyCheckedIn,
        mode,
        ...(proxyChildren?.length ? { proxyChildren } : {}),
        ...(pickupType ? { pickupType } : {}),
      }),
    });

    if (res.ok) {
      const sessionKey = mode === 'goodiebag'
        ? `${effectiveGoodieBagDate()}_goodiebag`
        : `${new Date().toISOString().slice(0, 10)}_checkin`;
      setRegistrations((prev) =>
        prev.map((reg) => {
          if (reg.id !== regId) return reg;
          return {
            ...reg,
            children: reg.children.map((child, i) => {
              if (i !== childIndex) return child;
              let updatedSessions: Record<string, Session | null>;
              if (mode === 'goodiebag' && currentlyCheckedIn) {
                // Cancel: null out all goodiebag sessions (covers historical dates)
                updatedSessions = Object.fromEntries(
                  Object.entries(child.sessions ?? {}).map(([k, v]) =>
                    k.endsWith('_goodiebag') ? [k, null] : [k, v]
                  )
                );
              } else {
                updatedSessions = {
                  ...(child.sessions ?? {}),
                  [sessionKey]: !currentlyCheckedIn
                    ? { status: mode === 'goodiebag' ? 'picked_up' : 'checked_in', by: null, at: new Date().toISOString() }
                    : null,
                };
              }
              if (mode === 'goodiebag') {
                return { ...child, sessions: updatedSessions };
              }
              return {
                ...child,
                check_in: {
                  checked_in: !currentlyCheckedIn,
                  timestamp: !currentlyCheckedIn ? new Date().toISOString() : null,
                  ...(!currentlyCheckedIn && proxyChildren?.length ? { proxy_children: proxyChildren } : {}),
                },
                sessions: updatedSessions,
              };
            }),
          };
        }),
      );
    }
    setLoadingCheckin(null);
  }

  function switchMode(newMode: ViewMode) {
    setViewMode(newMode);
    setFilterMode('all');
    setSortCol(null);
    setSortDir(null);
  }

  function handleSort(col: string) {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
    else if (sortDir === 'asc') { setSortDir('desc'); }
    else { setSortCol(null); setSortDir(null); }
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const allRows: FlatRow[] = registrations.flatMap((reg) =>
    reg.children
      .map((child, idx) => ({ reg, child, childIndex: idx }))
      .filter(({ child }) => !child.canceled),
  );

  const isAllergyTab   = filterMode === 'has_allergies';
  const showMultiColumns = filterMode === 'all';

  // Only show the two fixed goodie bag event dates — no dynamic dates
  const goodieBagDates = showMultiColumns ? GOODIEBAG_EVENT_DATES : [];
  const checkinDates   = showMultiColumns ? ['2026-06-10'] : [];

  const hasGapCol      = showMultiColumns && goodieBagDates.length > 0 && checkinDates.length > 0;
  const showActionCol  = !showMultiColumns && !isAllergyTab;
  const staticColCount = 6; // Grade, Name, DOB, Gender, Parent, Mobile
  const totalCols = showMultiColumns
    ? staticColCount + goodieBagDates.length + checkinDates.length + (hasGapCol ? 1 : 0)
    : staticColCount + (showActionCol ? 1 : 0);

  function hasAnyPickup(child: Child): boolean {
    return Object.values(child.sessions ?? {}).some((s) => s?.status === 'picked_up');
  }

  function getPickupAlternateChildren(child: Child): { name: string; grade: string }[] {
    for (const s of Object.values(child.sessions ?? {})) {
      if (s?.status === 'picked_up' && s.pickup_type === 'alternate' && s.alternate_children?.length) {
        return s.alternate_children;
      }
    }
    return [];
  }

  const filteredRows = allRows.filter(({ child }) => {
    if (filterMode === 'remaining') {
      if (viewMode === 'checkin' && child.check_in?.checked_in) return false;
      if (viewMode === 'goodiebag' && hasAnyPickup(child)) return false;
    }
    if (filterMode === 'checked_in') {
      if (viewMode === 'checkin' && !child.check_in?.checked_in) return false;
      if (viewMode === 'goodiebag' && !hasAnyPickup(child)) return false;
    }
    if (filterMode === 'has_allergies') {
      const ok = !!child.allergy_information && !/^(none|no|nope|na|n\/a|-)$/i.test(child.allergy_information.trim());
      if (!ok) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!`${child.first_name} ${child.last_name}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (sortCol && sortDir) {
    filteredRows.sort((a, b) => {
      const va = getSortValue(a, sortCol);
      const vb = getSortValue(b, sortCol);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      // Two-level sort: grade → last name → first name
      if (sortCol === 'grade') {
        const la = a.child.last_name.toLowerCase();
        const lb = b.child.last_name.toLowerCase();
        const lcmp = la.localeCompare(lb);
        if (lcmp !== 0) return lcmp;
        return a.child.first_name.toLowerCase().localeCompare(b.child.first_name.toLowerCase());
      }
      // Two-level sort: last name → first name
      if (sortCol === 'last_name') {
        const fa = a.child.first_name.toLowerCase();
        const fb = b.child.first_name.toLowerCase();
        const fcmp = fa.localeCompare(fb);
        return sortDir === 'asc' ? fcmp : -fcmp;
      }
      return 0;
    });
  }
  // else: preserve API order (created_at desc = most recent first)

  const totalChildren   = allRows.length;
  const checkedInCount  = allRows.filter(({ child }) => child.check_in?.checked_in).length;
  const pickedUpCount   = allRows.filter(({ child }) => hasAnyPickup(child)).length;
  const activeCount     = viewMode === 'goodiebag' ? pickedUpCount : checkedInCount;
  const remainingCount  = totalChildren - activeCount;

  const classStats = (['beginner', 'regular', 'appletree'] as const).map((cls) => {
    const rows = allRows.filter(({ child }) => (child.class ?? (child.grade === 'Pre-K' ? 'beginner' : 'regular')) === cls);
    const cnt  = viewMode === 'goodiebag'
      ? rows.filter(({ child }) => hasAnyPickup(child)).length
      : rows.filter(({ child }) => child.check_in?.checked_in).length;
    return { key: cls, total: rows.length, cnt };
  }).filter((s) => s.total > 0);

  const filterButtons: { key: FilterMode; label: string }[] = [
    { key: 'all',          label: 'All' },
    { key: 'remaining',    label: 'Remaining' },
    { key: 'checked_in',   label: viewMode === 'goodiebag' ? 'Picked up' : 'Checked in' },
    { key: 'has_allergies', label: 'Allergies/ Medical' },
  ];

  const SORTABLE_COLS = [
    { label: 'Grade',        key: 'grade',      sortable: true,  thClass: '' },
    { label: 'Student Name', key: 'last_name',  sortable: true,  thClass: '' },
    { label: 'DOB',          key: 'dob',        sortable: true,  thClass: '' },
    { label: 'Gender',       key: 'gender',     sortable: true,  thClass: '' },
    { label: 'Parent',       key: 'parent',     sortable: true,  thClass: '' },
    { label: 'Mobile',       key: 'mobile',     sortable: false, thClass: '' },
    { label: '',             key: 'notes',      sortable: false, thClass: '' },
  ];

  function SortIcon({ col }: { col: string }) {
    return (
      <svg className={`ml-1 h-3 w-3 ${sortCol === col ? 'text-slate-700' : 'text-slate-300'}`} viewBox="0 0 12 12" fill="currentColor">
        {sortCol === col
          ? (sortDir === 'asc' ? <path d="M6 3l4 5H2z" /> : <path d="M6 9l4-5H2z" />)
          : <><path d="M6 2l3 4H3z" /><path d="M6 10l3-4H3z" /></>}
      </svg>
    );
  }

  // ─── Session loading ──────────────────────────────────────────────────────

  if (checkingSession) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  // ─── Login screen ─────────────────────────────────────────────────────────

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

  // ─── Dashboard ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{viewMode === 'goodiebag' ? 'Goodie Bag Pickup' : 'Check-in'}</h1>
          <p className="text-sm text-slate-500">
            {viewMode === 'goodiebag'
              ? `${EVENT_INFO.name} · ${EVENT_INFO.subtitle} · May 17 & May 31, 2026`
              : `${EVENT_INFO.name} · ${EVENT_INFO.subtitle} · ${EVENT_INFO.dates}`}
          </p>
        </div>
        <button
          onClick={() => setShowStats((v) => !v)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <svg className={`h-3.5 w-3.5 transition ${showStats ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {showStats ? 'Hide Stats' : 'Show Stats'}
        </button>
      </div>

      {/* Stats bar */}
      {showStats && <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Total children</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalChildren}</p>
          </div>
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">
              {viewMode === 'goodiebag' ? 'Picked up' : 'Checked in'}
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{activeCount}</p>
          </div>
          <div className="p-5 px-6">
            <p className="text-sm font-semibold text-slate-500">Remaining</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{remainingCount}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200">
          {classStats.map(({ key, total, cnt }) => (
            <div key={key} className="p-5 px-6">
              <p className="text-sm font-semibold text-slate-500 capitalize">
                {key === 'appletree' ? 'Apple Tree' : key} VBS
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {cnt}<span className="text-lg text-slate-400">/{total}</span>
              </p>
            </div>
          ))}
        </div>
      </div>}

      {/* Table card */}
      <div className="overflow-hidden bg-white shadow-sm" style={{ borderRadius: '8px', border: '0.5px solid #e5e7eb' }}>

        {/* Search + filter bar */}
        <div className="border-b border-slate-200 px-6 py-4 space-y-3">

          {/* Row 1: search input + mode toggle buttons */}
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
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

            {/* 48 px circular mode toggle buttons — hidden on Allergies/Medical tab */}
            <div className={`ml-auto flex shrink-0 items-center gap-2 ${isAllergyTab ? 'invisible pointer-events-none' : ''}`}>
              <button
                onClick={() => switchMode('checkin')}
                title="VBS Check-in"
                className="flex items-center justify-center"
                style={{
                  width: 48, height: 48, borderRadius: '50%',
                  backgroundColor: viewMode === 'checkin' ? '#F97316' : '#f1f5f9',
                  boxShadow: viewMode === 'checkin' ? '0 0 0 2.5px rgba(249,115,22,0.4)' : 'none',
                  color: viewMode === 'checkin' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </button>
              <button
                onClick={() => switchMode('goodiebag')}
                title="Goodie Bag Pickup"
                className="flex items-center justify-center"
                style={{
                  width: 48, height: 48, borderRadius: '50%',
                  backgroundColor: viewMode === 'goodiebag' ? '#F97316' : '#f1f5f9',
                  boxShadow: viewMode === 'goodiebag' ? '0 0 0 2.5px rgba(249,115,22,0.4)' : 'none',
                  color: viewMode === 'goodiebag' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12v10H4V12" />
                  <path d="M22 7H2v5h20V7z" />
                  <path d="M12 22V7" />
                  <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
                  <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Row 2: filter chips + session selector + count */}
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setFilterMode(key);
                  if (key === 'has_allergies') { setSortCol('last_name'); setSortDir('asc'); }
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  filterMode === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => { setSortCol('grade'); setSortDir('asc'); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                sortCol === 'grade' && sortDir === 'asc' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V4" />
              </svg>
              Sort
            </button>
            {dataLoading && <span className="text-sm text-slate-400">Loading...</span>}


            <span className="ml-auto flex items-center gap-3">
              <button
                onClick={() => downloadCheckinCSV(filteredRows, viewMode)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
              <span className="text-sm text-slate-500">{filteredRows.length} of {totalChildren} children</span>
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 380px)', padding: '0 24px' }}>

        {/* ── Allergies/Medical emergency-reference table ───────────────── */}
        {isAllergyTab && (
          <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '190px' }} />
              <col style={{ width: '110px' }} />
              <col />
              <col style={{ width: '150px' }} />
              <col style={{ width: '148px' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f5f6f8', borderBottom: '0.5px solid #e5e7eb' }}>
                {([
                  { label: 'Student Name', key: 'last_name',  sortable: true  },
                  { label: 'Grade',        key: 'grade',      sortable: true  },
                  { label: 'Allergies / Medical', key: '',    sortable: false },
                  { label: 'Parent',       key: 'parent',     sortable: true  },
                  { label: 'Mobile',       key: 'mobile',     sortable: false },
                ] as { label: string; key: string; sortable: boolean }[]).map(({ label, key, sortable }) => (
                  <th
                    key={label}
                    onClick={sortable ? () => handleSort(key) : undefined}
                    style={{ padding: '10px 12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280', fontWeight: 600, cursor: sortable ? 'pointer' : 'default', userSelect: sortable ? 'none' : undefined }}
                  >
                    <span className="inline-flex items-center whitespace-nowrap">
                      {label}{sortable && <SortIcon col={key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                    {searchQuery ? 'No children match your search.' : 'No children with allergies or medical notes found.'}
                  </td>
                </tr>
              )}
              {filteredRows.map(({ reg, child, childIndex: ci }) => (
                <tr key={`${reg.id}-${ci}`} className="hover:bg-[#f5f6f8] cursor-pointer" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>{child.last_name}, {child.first_name}</td>
                  <td style={{ padding: '12px', fontSize: '15px', color: '#6b7280' }}>{child.grade}</td>
                  <td style={{ padding: '12px', fontSize: '15px', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' }}>{child.allergy_information}</td>
                  <td style={{ padding: '12px', fontSize: '15px', color: '#6b7280' }}>{reg.parent_name}</td>
                  <td style={{ padding: '12px', fontSize: '15px' }}>
                    {reg.phone_number
                      ? <a href={`tel:${reg.phone_number}`} className="text-sky-600 underline underline-offset-2">{formatPhone(reg.phone_number)}</a>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── All-tab table: multi-date columns ─────────────────────────── */}
        {!isAllergyTab && showMultiColumns && (
          <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {/* Grade 9% | Name 10% | DOB 7% | Gender 5% | Parent 15% | Mobile 10% = 56% */}
              {/* Goodie×2 = 24% | Gap 1% | Checkin 19% = 44% → Total 100% */}
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              {goodieBagDates.map((d) => <col key={`col-gb-${d}`} style={{ width: '12%' }} />)}
              {hasGapCol && <col style={{ width: '1%' }} />}
              {checkinDates.map((d) => <col key={`col-ci-${d}`} style={{ width: '19%' }} />)}
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {(goodieBagDates.length > 0 || checkinDates.length > 0) ? (
                <>
                  <tr style={{ backgroundColor: '#f5f6f8' }}>
                    <th colSpan={staticColCount} className="py-2 px-1.5 pb-1 pt-2" />{/* static cols */}
                    {goodieBagDates.length > 0 && (
                      <th
                        colSpan={goodieBagDates.length}
                        className="py-2 px-1.5 pb-1 pt-2 text-center text-xs font-bold uppercase tracking-wider text-amber-600"
                      >
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-1 border-b border-amber-200 pb-0.5">
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 12v10H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
                              <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
                            </svg>
                            Goodie Bag
                          </span>
                        </div>
                      </th>
                    )}
                    {hasGapCol && <th className="p-0" />}
                    {checkinDates.length > 0 && (
                      <th
                        colSpan={checkinDates.length}
                        className="py-2 px-1.5 pb-1 pt-2 text-center text-xs font-bold uppercase tracking-wider text-teal-600"
                      >
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-1 border-b border-teal-200 pb-0.5">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            <span className="whitespace-nowrap">VBS Check-in</span>
                          </span>
                        </div>
                      </th>
                    )}
                  </tr>
                  <tr style={{ backgroundColor: '#f5f6f8', borderBottom: '0.5px solid #e5e7eb' }}>
                    {SORTABLE_COLS.filter(c => c.key !== 'notes').map(({ label, key, sortable }) => (
                      <th
                        key={key}
                        onClick={sortable ? () => handleSort(key) : undefined}
                        style={{ padding: '8px 4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', fontWeight: 600, cursor: sortable ? 'pointer' : 'default', userSelect: sortable ? 'none' : undefined, overflow: 'hidden', whiteSpace: 'nowrap' }}
                      >
                        <span className="inline-flex items-center whitespace-nowrap">
                          {label}{sortable && <SortIcon col={key} />}
                        </span>
                      </th>
                    ))}
                    {goodieBagDates.map((date) => (
                      <th key={`gb-${date}`} style={{ padding: '10px 2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px', color: '#d97706', fontWeight: 600, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {formatDateCol(date)}
                      </th>
                    ))}
                    {hasGapCol && <th className="p-0" />}
                    {checkinDates.map((date) => (
                      <th key={`ci-${date}`} style={{ padding: '10px 2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px', color: '#0d9488', fontWeight: 600, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {formatDateCol(date)}
                      </th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr style={{ backgroundColor: '#f5f6f8', borderBottom: '0.5px solid #e5e7eb' }}>
                  {SORTABLE_COLS.filter(c => c.key !== 'notes').map(({ label, key, sortable }) => (
                    <th
                      key={key}
                      onClick={sortable ? () => handleSort(key) : undefined}
                      style={{ padding: '8px 4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', fontWeight: 600, cursor: sortable ? 'pointer' : 'default', userSelect: sortable ? 'none' : undefined, overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      <span className="inline-flex items-center whitespace-nowrap">
                        {label}{sortable && <SortIcon col={key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-12 text-center text-sm text-slate-400">
                    {searchQuery ? 'No children match your search.' : 'No children found.'}
                  </td>
                </tr>
              )}
              {filteredRows.map(({ reg, child, childIndex }) => {
                const isCheckedIn       = !!child.check_in?.checked_in;
                const isPickedUp        = viewMode === 'goodiebag' && hasAnyPickup(child);
                const loadKey           = `${reg.id}-${childIndex}`;
                const pickupAltChildren = viewMode === 'goodiebag' ? getPickupAlternateChildren(child) : [];
                const isGoodieAlternate = pickupAltChildren.length > 0;
                const proxyChildren     = (child.check_in?.proxy_children ?? []).filter(Boolean);
                const isProxyPickup     = isCheckedIn && proxyChildren.length > 0;
                return (
                  <Fragment key={loadKey}>
                    <tr
                      className="hover:bg-[#f5f6f8] cursor-pointer transition"
                      style={{ borderBottom: '0.5px solid #e5e7eb' }}
                    >
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: '#374151', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{child.grade}</td>
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: '#374151', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{child.last_name}, {child.first_name}</td>
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: '#6b7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {child.date_of_birth ? formatDob(child.date_of_birth) : <span className="text-slate-300">—</span>}
                      </td>
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: '#6b7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {child.gender ? (child.gender === 'Male' ? 'M' : child.gender === 'Female' ? 'F' : child.gender) : <span className="text-slate-300">—</span>}
                      </td>
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: '#6b7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{reg.parent_name}</td>
                      <td style={{ padding: '8px 4px', fontSize: '13px', color: '#6b7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {reg.phone_number ? formatPhone(reg.phone_number) : <span className="text-slate-300">—</span>}
                      </td>
                      {goodieBagDates.map((date) => {
                        const s = child.sessions?.[`${date}_goodiebag`];
                        const isAlt = s?.pickup_type === 'alternate';
                        return (
                          <td key={`gb-${date}`} className="py-1 px-1.5 text-center">
                            {s ? (
                              <span className="inline-flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center justify-center rounded-full bg-amber-100 p-1">
                                  <svg className="h-3 w-3 shrink-0 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                                {isAlt && <span className="text-[9px] font-medium text-amber-600">Alt</span>}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      {hasGapCol && <td className="p-0" />}
                      {checkinDates.map((date) => {
                        const s = getChildSessions(child)[`${date}_checkin`];
                        return (
                          <td key={`ci-${date}`} className="py-1 px-1.5 text-center">
                            {s ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-teal-100 p-1">
                                <svg className="h-3 w-3 shrink-0 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {viewMode === 'goodiebag' && isGoodieAlternate && (
                      <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                        <td colSpan={totalCols} style={{ padding: '0 20px 12px 20px' }}>
                          <div style={{ backgroundColor: '#E6F1FB', borderLeft: '2px solid #378ADD', borderRadius: '0 0 8px 8px', padding: '8px 14px' }}>
                            <div className="mb-2 flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#185FA5' }}>
                                <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                              </svg>
                              <span className="text-xs font-medium" style={{ color: '#185FA5' }}>Authorized Children</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pickupAltChildren.map((pc, i) => {
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
                    {viewMode === 'checkin' && isProxyPickup && (
                      <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                        <td colSpan={totalCols} style={{ padding: '0 20px 12px 20px' }}>
                          <div style={{ backgroundColor: '#e8f4ff', borderLeft: '2px solid #378ADD', borderRadius: '0 8px 8px 0', padding: '8px 14px' }}>
                            <div className="mb-2 flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#185FA5' }}>
                                <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                              </svg>
                              <span className="text-xs font-medium" style={{ color: '#185FA5' }}>Authorized Children</span>
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
        )}

        {/* ── Single-column tabs: CSS Grid ────────────────────────────────── */}
        {!isAllergyTab && !showMultiColumns && (() => {
          const G = '110px 1.6fr 1.1fr 80px 1.3fr 1.1fr 148px';
          const hCell: CSSProperties = { padding: '10px 12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden' };
          const dCell: CSSProperties = { padding: '10px 12px', fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' };
          return (
            <div style={{ width: '100%' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'grid', gridTemplateColumns: G, backgroundColor: '#f5f6f8', borderBottom: '0.5px solid #e5e7eb' }}>
                <div style={hCell} onClick={() => handleSort('grade')}>GRADE <SortIcon col="grade" /></div>
                <div style={hCell} onClick={() => handleSort('last_name')}>STUDENT NAME <SortIcon col="last_name" /></div>
                <div style={hCell} onClick={() => handleSort('dob')}>DOB <SortIcon col="dob" /></div>
                <div style={{ ...hCell, cursor: 'default', userSelect: undefined }}>GENDER</div>
                <div style={hCell} onClick={() => handleSort('parent')}>PARENT <SortIcon col="parent" /></div>
                <div style={{ ...hCell, cursor: 'default', userSelect: undefined }}>MOBILE</div>
                <div style={{ ...hCell, cursor: 'default', userSelect: undefined }} />
              </div>
              {filteredRows.length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-slate-400">
                  {searchQuery ? 'No children match your search.' : 'No children found.'}
                </div>
              )}
              {filteredRows.map(({ reg, child, childIndex }) => {
                const isCheckedIn       = !!child.check_in?.checked_in;
                const isPickedUp        = viewMode === 'goodiebag' && hasAnyPickup(child);
                const loadKey           = `${reg.id}-${childIndex}`;
                const isLoading         = loadingCheckin === loadKey;
                const proxyChildren     = (child.check_in?.proxy_children ?? []).filter(Boolean);
                const isProxyPickup     = isCheckedIn && proxyChildren.length > 0;
                const pickupAltChildren = viewMode === 'goodiebag' ? getPickupAlternateChildren(child) : [];
                const isGoodieAlternate = pickupAltChildren.length > 0;
                const rowActive         = viewMode === 'goodiebag' ? isPickedUp : isCheckedIn;
                const rowBg: string | undefined = viewMode === 'checkin' && isProxyPickup
                  ? '#f0faf6'
                  : rowActive && viewMode === 'checkin'
                  ? 'rgba(236, 253, 245, 0.5)'
                  : undefined;
                return (
                  <Fragment key={loadKey}>
                    <div
                      className={!rowActive && !isProxyPickup ? 'hover:bg-[#f5f6f8]' : ''}
                      style={{ display: 'grid', gridTemplateColumns: G, borderBottom: '0.5px solid #e5e7eb', backgroundColor: rowBg, cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                    >
                      <div style={dCell}>{child.grade}</div>
                      <div style={{ ...dCell, color: '#111827' }}>{child.last_name}, {child.first_name}</div>
                      <div style={dCell}>{child.date_of_birth ? formatDob(child.date_of_birth) : <span className="text-slate-300">—</span>}</div>
                      <div style={dCell}>{child.gender ? (child.gender === 'Male' ? 'M' : child.gender === 'Female' ? 'F' : child.gender) : <span className="text-slate-300">—</span>}</div>
                      <div style={dCell}>{reg.parent_name}</div>
                      <div style={dCell}>{reg.phone_number ? formatPhone(reg.phone_number) : <span className="text-slate-300">—</span>}</div>
                      <div style={{ ...dCell, justifyContent: 'flex-end', padding: '6px 12px' }}>
                        {viewMode === 'goodiebag' ? (
                          isPickedUp ? (
                            isGoodieAlternate ? (
                              <button
                                onClick={() => setEditPickupData({ reg, childIndex })}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap transition hover:opacity-75"
                                style={{ backgroundColor: '#FEF3C7', color: '#854F0B', borderRadius: '999px', padding: '6px 14px', fontSize: '14px', fontWeight: 600 }}
                              >
                                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Authorized
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditPickupData({ reg, childIndex })}
                                className="inline-flex items-center justify-center transition hover:opacity-75"
                                style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#FEF3C7' }}
                              >
                                <svg className="h-4 w-4 shrink-0" style={{ color: '#854F0B' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => openGoodieBagModal(reg, childIndex)}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                            >
                              {isLoading ? 'Saving...' : 'Pick up'}
                            </button>
                          )
                        ) : isProxyPickup ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#854F0B', padding: '3px 10px' }}>
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                              </svg>
                              Authorized
                            </span>
                            <button
                              onClick={() => setConfirmData({ regId: reg.id, childIndex, childName: `${child.first_name} ${child.last_name}`, grade: child.grade, tshirtSize: child.tshirt_size, parentName: reg.parent_name, mode: 'checkin' })}
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
                              ? setConfirmData({ regId: reg.id, childIndex, childName: `${child.first_name} ${child.last_name}`, grade: child.grade, tshirtSize: child.tshirt_size, parentName: reg.parent_name, mode: 'checkin' })
                              : openCheckInModal(reg, childIndex)
                            }
                            disabled={isLoading}
                            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                              isCheckedIn
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 whitespace-nowrap'
                                : 'bg-slate-900 text-white hover:bg-slate-700 whitespace-nowrap'
                            }`}
                          >
                            {isLoading ? 'Saving...' : isCheckedIn ? (
                              <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Checked in
                              </>
                            ) : 'Check in'}
                          </button>
                        )}
                      </div>
                    </div>
                    {viewMode === 'goodiebag' && isGoodieAlternate && (
                      <div style={{ borderBottom: '0.5px solid #e5e7eb', padding: '0 20px 12px 20px' }}>
                        <div style={{ backgroundColor: '#E6F1FB', borderLeft: '2px solid #378ADD', borderRadius: '0 0 8px 8px', padding: '8px 14px' }}>
                          <div className="mb-2 flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#185FA5' }}>
                              <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                            </svg>
                            <span className="text-xs font-medium" style={{ color: '#185FA5' }}>Authorized Children</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {pickupAltChildren.map((pc, i) => {
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
                      </div>
                    )}
                    {viewMode === 'checkin' && isProxyPickup && (
                      <div style={{ borderBottom: '0.5px solid #e5e7eb', backgroundColor: '#f0faf6', padding: '0 20px 12px 20px' }}>
                        <div style={{ backgroundColor: '#e8f4ff', borderLeft: '2px solid #378ADD', borderRadius: '0 8px 8px 0', padding: '8px 14px' }}>
                          <div className="mb-2 flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#185FA5' }}>
                              <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                            </svg>
                            <span className="text-xs font-medium" style={{ color: '#185FA5' }}>Authorized Children</span>
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
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          );
        })()}

        </div>
      </div>

      {/* ── Confirm popup ───────────────────────────────────────────────────── */}
      {confirmData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmData(null)}
        >
          <div
            className="animate-fade-in relative w-full max-w-md p-6 shadow-2xl"
            style={{ backgroundColor: '#1c1c1e', border: '1px solid #2a3a4a', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setConfirmData(null)}
              className="absolute -right-3 -top-3 flex items-center justify-center rounded-full text-white transition hover:opacity-80"
              style={{ width: '36px', height: '36px', backgroundColor: '#2a3a4a' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="mb-4 pr-6 text-base text-white" style={{ fontWeight: 500 }}>
              {confirmData.mode === 'goodiebag' ? 'Cancel this pickup?' : 'Cancel this check-in?'}
            </h3>

            <div className="mb-6 flex items-center gap-3 rounded-[10px] px-[14px] py-3" style={{ backgroundColor: '#0f1c2a' }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px]" style={{ backgroundColor: '#2e3d4f', color: '#8899aa', fontWeight: 500 }}>
                {confirmData.childName.split(' ').map((p) => p[0] ?? '').filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white" style={{ fontWeight: 500 }}>{confirmData.childName}</p>
                <p className="text-sm" style={{ color: '#8899aa' }}>{confirmData.grade} · T-shirt {confirmData.tshirtSize} · Parent: {confirmData.parentName}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmData(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
                style={{ border: '1px solid #3a4a5a' }}
              >
                No
              </button>
              <button
                onClick={async () => {
                  await toggleCheckIn(confirmData.regId, confirmData.childIndex, true, undefined, confirmData.mode);
                  setConfirmData(null);
                }}
                disabled={loadingCheckin === `${confirmData.regId}-${confirmData.childIndex}`}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#E24B4A' }}
              >
                {loadingCheckin === `${confirmData.regId}-${confirmData.childIndex}`
                  ? 'Canceling...'
                  : confirmData.mode === 'goodiebag' ? 'Cancel Pickup' : 'Cancel Check-in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / Cancel pickup popup ──────────────────────────────────────── */}
      {editPickupData && (() => {
        const { reg, childIndex } = editPickupData;
        const child = reg.children[childIndex];
        const initials = `${child.first_name[0] ?? ''}${child.last_name[0] ?? ''}`.toUpperCase();
        const isAlt = getPickupAlternateChildren(child).length > 0;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setEditPickupData(null)}
          >
            <div
              className="animate-fade-in relative w-full max-w-sm p-6 shadow-2xl"
              style={{ backgroundColor: '#1c1c1e', border: '1px solid #2a3a4a', borderRadius: '16px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setEditPickupData(null)}
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white shadow-md transition hover:bg-zinc-700"
                style={{ fontSize: '16px', fontWeight: 400 }}
              >×</button>

              {/* Child info */}
              <div className="mb-5 flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-500/40 text-sm font-bold text-slate-100">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{child.first_name} {child.last_name}</p>
                  <p className="text-sm text-slate-400">
                    {child.grade} · T-shirt {child.tshirt_size} · Parent: {reg.parent_name}
                  </p>
                </div>
              </div>

              {/* Current pickup badge */}
              <p className="mb-4 text-sm text-slate-400">
                Picked up via{' '}
                <span className="font-semibold text-white">{isAlt ? 'Authorized' : 'Parent Pickup'}</span>
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setEditPickupData(null); openGoodieBagModal(reg, childIndex); }}
                  className="w-full rounded-2xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#1e3a6e' }}
                >
                  Edit Pickup
                </button>
                <button
                  onClick={async () => {
                    setEditPickupData(null);
                    await toggleCheckIn(reg.id, childIndex, true, undefined, 'goodiebag');
                  }}
                  disabled={loadingCheckin === `${reg.id}-${childIndex}`}
                  className="w-full rounded-2xl py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }}
                >
                  {loadingCheckin === `${reg.id}-${childIndex}` ? 'Canceling...' : 'Cancel Pickup'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Check-in / Goodie Bag modal ──────────────────────────────────────── */}
      {modalData && (() => {
        const { reg, childIndex } = modalData;
        const child = reg.children[childIndex];
        const initials = `${child.first_name[0] ?? ''}${child.last_name[0] ?? ''}`.toUpperCase();
        const loadKey = `${reg.id}-${childIndex}`;
        const isLoading = loadingCheckin === loadKey;

        const steps = [
          { num: 1, label: 'Guardian Check' },
          { num: 2, label: 'Child Info' },
          { num: 3, label: 'Done' },
        ];

        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/60" onClick={closeModal} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="relative w-full max-w-lg rounded-3xl bg-[#1c1c1e] p-6 shadow-2xl">

                <button
                  onClick={closeModal}
                  className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-white transition hover:bg-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Step progress */}
                <div className="mb-6 flex items-center justify-center">
                  {steps.map((step, i) => {
                    const isActive = modalStep === step.num;
                    const isDone   = modalStep > step.num;
                    return (
                      <div key={step.num} className="flex items-center">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                            isDone ? 'bg-teal-500 text-white' : isActive ? 'bg-[#1e3a6e] text-white' : 'border-2 border-slate-600 text-slate-500'
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
                        {i < steps.length - 1 && <div className="mx-3 h-px w-8 bg-slate-600" />}
                      </div>
                    );
                  })}
                </div>

                {/* Child info card — step 1 only */}
                {modalStep === 1 && (
                  <div className="mb-5 flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-500/40 text-sm font-bold text-slate-100">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{child.first_name} {child.last_name}</p>
                      <p className="text-sm text-slate-400">{child.grade} · T-shirt {child.tshirt_size} · Parent: {reg.parent_name}</p>
                    </div>
                  </div>
                )}

                {/* Step 1 — who is checking in */}
                {modalStep === 1 && (
                  <>
                    <h2 className="mb-1 text-lg font-bold text-white">
                      {modalMode === 'goodiebag' ? 'Who is picking up the goodie bag?' : 'Who is checking in?'}
                    </h2>
                    <p className="mb-5 text-sm text-slate-400">
                      {modalMode === 'goodiebag' ? 'Please select who is picking up the goodie bag.' : 'Please select who is picking up the child.'}
                    </p>
                    <div className="mb-6 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPickupType('parent')}
                        className="flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5"
                        style={{ transition: 'all 0.15s ease', borderColor: pickupType === 'parent' ? '#1D9E75' : '#4b5563', backgroundColor: pickupType === 'parent' ? '#E1F5EE' : '#18181b' }}
                      >
                        <svg className="h-8 w-8" style={{ color: pickupType === 'parent' ? '#1D9E75' : '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <circle cx="12" cy="6.5" r="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 20c0-3.59 2.91-6.5 6.5-6.5"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M10 18l2.5 2.5 5.5-5.5"/>
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color: pickupType === 'parent' ? '#0F6E56' : '#ffffff' }}>Parent</p>
                          <p className="text-xs" style={{ color: pickupType === 'parent' ? '#1D9E75' : '#9ca3af' }}>Registered guardian</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setPickupType('friend')}
                        className="flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5"
                        style={{ transition: 'all 0.15s ease', borderColor: pickupType === 'friend' ? '#378ADD' : '#4b5563', backgroundColor: pickupType === 'friend' ? '#E6F1FB' : '#18181b' }}
                      >
                        <svg className="h-8 w-8" style={{ color: pickupType === 'friend' ? '#378ADD' : '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="9.5" r="4"/>
                          <path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/>
                          <circle cx="16.5" cy="5.5" r="2.5"/>
                          <path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color: pickupType === 'friend' ? '#185FA5' : '#ffffff' }}>Authorized</p>
                          <p className="text-xs" style={{ color: pickupType === 'friend' ? '#378ADD' : '#9ca3af' }}>Picking up on behalf</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2 — child info for proxy */}
                {modalStep === 2 && (
                  <>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: '#fdf0e0', color: '#7c4814' }}>
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="9.5" r="4"/><path d="M1.5 22c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"/><circle cx="16.5" cy="5.5" r="2.5"/><path d="M14 17.5c0-2.49 1.12-4.5 2.5-4.5s2.5 2.01 2.5 4.5"/>
                      </svg>
                      <span className="text-sm font-semibold">Authorized</span>
                    </div>
                    <h2 className="mb-1 text-lg font-bold text-white">Child Information</h2>
                    <p className="mb-4 text-sm text-slate-400">
                      {modalMode === 'goodiebag'
                        ? 'Please enter the name and grade of the child you are picking up for.'
                        : "Please enter the child's name and grade."}
                    </p>

                    <div className="mb-1.5 flex gap-2">
                      <span className="flex-1 pl-9 text-xs text-slate-400">Name</span>
                      <span className="flex-1 text-xs text-slate-400">Grade</span>
                    </div>

                    <div className="mb-3 space-y-2">
                      {step2Rows.map((row, idx) => (
                        <div key={idx} className="flex gap-2">
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
                              placeholder="Child's name"
                              className="w-full rounded-xl bg-zinc-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-slate-500"
                            />
                          </div>
                          <div className="relative flex-1">
                            <button
                              type="button"
                              onClick={() => setOpenDropdownIdx(openDropdownIdx === idx ? null : idx)}
                              className="w-full rounded-xl bg-zinc-800 py-2.5 text-left text-sm outline-none"
                              style={{ color: row.grade ? '#fff' : '#6b7280', border: `1px solid ${openDropdownIdx === idx ? '#378ADD' : 'transparent'}`, paddingLeft: '12px', paddingRight: step2Rows.length > 1 ? '32px' : '12px' }}
                            >
                              {row.grade || 'Select grade'}
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

                    {step2Rows.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setStep2Rows([...step2Rows, { name: '', grade: '' }])}
                        className="mb-5 w-full rounded-xl bg-zinc-800 py-3 text-sm font-medium text-slate-300 transition hover:bg-zinc-700"
                      >
                        + Add child
                      </button>
                    )}
                  </>
                )}

                {/* Step 3 — Success (goodie bag only) */}
                {modalStep === 3 && modalMode === 'goodiebag' && (
                  <div
                    className="flex flex-col items-center py-6 text-center"
                    onClick={closeModal}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-teal-500">
                      <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-white">Goodie bag picked up!</h2>
                    <p className="font-semibold text-slate-200">{child.first_name} {child.last_name}</p>
                    <p className="text-sm text-slate-400">{child.grade} · T-shirt {child.tshirt_size}</p>
                    <p className="mt-8 text-xs text-slate-600">Tap anywhere to close</p>
                  </div>
                )}

                {/* Modal bottom buttons */}
                {modalStep !== 3 && (
                  <div className="flex gap-3">
                    {modalStep === 1 ? (
                      <>
                        <button
                          onClick={closeModal}
                          className="flex-1 rounded-2xl border-2 border-slate-600 py-3 text-sm font-semibold text-white transition hover:border-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleModalNext}
                          disabled={!pickupType || isLoading}
                          className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white transition disabled:opacity-40"
                          style={{ backgroundColor: pickupType === 'parent' ? '#1D9E75' : '#1e3a6e' }}
                        >
                          {isLoading ? 'Saving...' : pickupType === 'parent' ? (modalMode === 'goodiebag' ? 'Complete Pickup' : 'Complete Check-in') : 'Next →'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setModalStep(1)}
                          className="flex-1 rounded-2xl border-2 border-slate-600 py-3 text-sm font-semibold text-white transition hover:border-slate-400"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={async () => {
                            if (modalMode === 'goodiebag') {
                              await toggleCheckIn(reg.id, childIndex, false, step2Rows.filter((r) => r.name.trim()), 'goodiebag', 'alternate');
                              setModalStep(3);
                            } else {
                              await toggleCheckIn(reg.id, childIndex, false, step2Rows.filter((r) => r.name.trim()), 'checkin');
                              closeModal();
                            }
                          }}
                          disabled={isLoading}
                          className="flex-1 rounded-2xl bg-[#1e3a6e] py-3 text-sm font-semibold text-white transition hover:bg-[#254a8a] disabled:opacity-40"
                        >
                          {isLoading ? 'Saving...' : modalMode === 'goodiebag' ? 'Complete Pickup' : 'Complete Check-in'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
