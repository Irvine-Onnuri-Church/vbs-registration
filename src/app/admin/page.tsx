'use client';

import { useEffect, useState } from 'react';

import PageContainer from '@/components/PageContainer';
import { EVENT_INFO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

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
  created_at: string;
  children: Child[];
};

function downloadCSV(rows: { reg: Registration; child: Child }[]) {
  const headers = [
    'Registration ID', 'Date', 'Phase', 'Status', 'Total',
    'Parent Name', 'Email', 'Phone',
    'Emergency Contact', 'Emergency Phone', 'Photo Consent',
    'Child Name', 'Grade', 'Gender', 'DOB', 'T-Shirt', 'Allergies / Other Medical Conditions', 'Friend to be with', 'Price',
  ];

  const csvRows = rows.map(({ reg, child }) => [
    reg.id, new Date(reg.created_at).toLocaleDateString(), reg.registration_phase, reg.payment_status, String(reg.total_amount),
    reg.parent_name, reg.email, reg.phone_number,
    reg.emergency_contact_name, reg.emergency_contact_phone, reg.photo_consent ? 'Yes' : 'No',
    `${child.first_name} ${child.last_name}`, child.grade, child.gender, child.date_of_birth, child.tshirt_size,
    child.allergy_information ?? '', child.medical_notes ?? '', String(child.price),
  ]);

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csv = [headers, ...csvRows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${EVENT_INFO.name.replace(/\s+/g, '')}_registrations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const CHART_COLORS = ['#0284c7', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function GraphsView({ registrations }: { registrations: Registration[] }) {
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // All children flattened
  const allChildren = registrations.flatMap((r) => r.children);

  // ── 1. Signups over time ──
  const timelineData = (() => {
    const map = new Map<string, number>();
    registrations.forEach((r) => {
      const d = new Date(r.created_at);
      let key: string;
      if (timeFilter === 'daily') {
        key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (timeFilter === 'weekly') {
        // Week starting Monday
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        key = `Wk ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else {
        key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      map.set(key, (map.get(key) ?? 0) + r.children.length);
    });
    // Sort chronologically (earliest first)
    const sorted = Array.from(map.entries()).sort((a, b) => {
      const parseKey = (k: string) => {
        if (timeFilter === 'weekly') {
          return new Date(k.replace('Wk ', '') + ', 2026');
        }
        if (timeFilter === 'monthly') {
          return new Date(k);
        }
        return new Date(k + ', 2026');
      };
      return parseKey(a[0]).getTime() - parseKey(b[0]).getTime();
    });
    return sorted.map(([date, count]) => ({ date, count }));
  })();

  // ── 2. Grade breakdown ──
  const gradeData = (() => {
    const map = new Map<string, number>();
    allChildren.forEach((c) => map.set(c.grade, (map.get(c.grade) ?? 0) + 1));
    const order = ['Pre-K', 'Transitional Kindergarten', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade'];
    return Array.from(map.entries())
      .sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([grade, count]) => ({ grade, count }));
  })();

  // ── 3. Early bird vs Regular ──
  const phaseData = (() => {
    let early = 0;
    let regular = 0;
    registrations.forEach((r) => {
      const count = r.children.length;
      if (r.registration_phase === 'early') early += count;
      else regular += count;
    });
    return [
      { name: 'Early Bird', value: early },
      { name: 'Regular', value: regular },
    ];
  })();

  // ── 4. Gender ──
  const genderData = (() => {
    const map = new Map<string, number>();
    allChildren.forEach((c) => map.set(c.gender, (map.get(c.gender) ?? 0) + 1));
    return Array.from(map.entries()).map(([gender, count]) => ({ name: gender, value: count }));
  })();

  // ── 5. T-shirt size ──
  const tshirtData = (() => {
    const map = new Map<string, number>();
    allChildren.forEach((c) => map.set(c.tshirt_size, (map.get(c.tshirt_size) ?? 0) + 1));
    const order = ['3Y', '4Y', '5Y', 'XS', 'S', 'M', 'L', 'XL', 'Adult S', 'Adult M', 'Adult L', 'Adult XL'];
    return Array.from(map.entries())
      .sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([size, count]) => ({ size, count }));
  })();

  const cardClass = 'rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200';

  return (
    <div className="space-y-6">
      {/* Signups over time */}
      <div className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Signups Over Time</h3>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  timeFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
            <Line type="monotone" dataKey="count" stroke="#0284c7" strokeWidth={2} dot={{ r: 4 }} name="Children" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Grade + Phase row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Grade breakdown */}
        <div className={cardClass}>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">By Grade</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="grade" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="count" name="Children" radius={[6, 6, 0, 0]}>
                {gradeData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Early bird vs Regular */}
        <div className={cardClass}>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Early Bird vs Regular</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent, value }: { name?: string; percent?: number; value?: number }) => `${name ?? ''} ${value ?? 0} (${((percent ?? 0) * 100).toFixed(0)}%)`}
              >
                <Cell fill="#0284c7" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gender + T-shirt row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gender pie */}
        <div className={cardClass}>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Gender</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent, value }: { name?: string; percent?: number; value?: number }) => `${name ?? ''} ${value ?? 0} (${((percent ?? 0) * 100).toFixed(0)}%)`}
              >
                {genderData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* T-shirt size */}
        <div className={cardClass}>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">T-Shirt Size</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tshirtData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="size" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="count" name="Children" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
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
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'analytics'>('list');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [drawerRegId, setDrawerRegId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<string | null>(null);
  const [filterTshirt, setFilterTshirt] = useState<string | null>(null);
  const [filterAllergies, setFilterAllergies] = useState<boolean | null>(null);
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);
  const hasFilters = searchQuery || filterGrade || filterTshirt || filterAllergies !== null || filterGender || filterPhase;

  function clearAllFilters() {
    setSearchQuery('');
    setFilterGrade(null);
    setFilterTshirt(null);
    setFilterAllergies(null);
    setFilterGender(null);
    setFilterPhase(null);
    setCurrentPage(0);
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // Build flat rows for table view, filter, then sort
  const allTableRows = registrations.flatMap((reg) =>
    reg.children.map((child, idx) => ({ reg, child, idx }))
  );

  const filteredRows = allTableRows.filter(({ reg, child }) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = reg.parent_name.toLowerCase().includes(q)
        || reg.email.toLowerCase().includes(q)
        || `${child.first_name} ${child.last_name}`.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterGrade && child.grade !== filterGrade) return false;
    if (filterTshirt && child.tshirt_size !== filterTshirt) return false;
    const hasAllergies = !!child.allergy_information && !/^(none|no|nope|na|n\/a|-)$/i.test(child.allergy_information.trim());
    if (filterAllergies === true && !hasAllergies) return false;
    if (filterAllergies === false && hasAllergies) return false;
    if (filterGender && child.gender !== filterGender) return false;
    if (filterPhase) {
      if (filterPhase === 'early' && reg.registration_phase !== 'early') return false;
      if (filterPhase === 'regular' && reg.registration_phase === 'early') return false;
    }
    return true;
  });

  const gradeOrder: Record<string, number> = { 'Pre-K': 0, 'Transitional Kindergarten': 1, 'Kindergarten': 2, '1st Grade': 3, '2nd Grade': 4, '3rd Grade': 5, '4th Grade': 6, '5th Grade': 7, '6th Grade': 8 };

  if (sortKey) {
    filteredRows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': { const av = a.reg.created_at; const bv = b.reg.created_at; cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
        case 'child': { const av = `${a.child.first_name} ${a.child.last_name}`.toLowerCase(); const bv = `${b.child.first_name} ${b.child.last_name}`.toLowerCase(); cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
        case 'parent': { const av = a.reg.parent_name.toLowerCase(); const bv = b.reg.parent_name.toLowerCase(); cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
        case 'email': { const av = a.reg.email; const bv = b.reg.email; cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
        case 'phone': { const av = a.reg.phone_number; const bv = b.reg.phone_number; cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
        case 'grade': { const av = gradeOrder[a.child.grade] ?? 99; const bv = gradeOrder[b.child.grade] ?? 99; cmp = av - bv; break; }
        case 'tshirt': { const sizeOrder: Record<string, number> = { '3Y': 0, '4Y': 1, '5Y': 2, 'XS': 3, 'S': 4, 'M': 5, 'L': 6, 'XL': 7, 'Adult S': 8, 'Adult M': 9 }; const av = sizeOrder[a.child.tshirt_size] ?? 99; const bv = sizeOrder[b.child.tshirt_size] ?? 99; cmp = av - bv; break; }
        case 'gender': { const av = a.child.gender; const bv = b.child.gender; cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
        case 'dob': { const av = a.child.date_of_birth; const bv = b.child.date_of_birth; cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const totalRows = filteredRows.length;
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalRows / pageSize);
  const paginatedRows = pageSize === 0 ? filteredRows : filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // Unique values for filter dropdowns
  const allChildren = registrations.flatMap((r) => r.children);
  const gradeOptions = [...new Set(allChildren.map((c) => c.grade))].sort();
  const tshirtOptions = (() => {
    const order = ['3Y', '4Y', '5Y', 'XS', 'S', 'M', 'L', 'XL', 'Adult S', 'Adult M', 'Adult L', 'Adult XL'];
    return [...new Set(allChildren.map((c) => c.tshirt_size))].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  })();

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
      setDataError(data.error ?? 'Failed to load registrations. Make sure FIREBASE_SERVICE_ACCOUNT_KEY is set in your environment.');
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
    <div className={`mx-auto w-full px-4 py-10 sm:px-6 lg:px-8 ${viewMode === 'table' ? 'max-w-[1800px]' : viewMode === 'analytics' ? 'max-w-7xl' : 'max-w-6xl'} space-y-8`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Registration Dashboard</h1>
          <p className="text-sm text-slate-500">{EVENT_INFO.church} {EVENT_INFO.name} — {EVENT_INFO.subtitle}</p>
        </div>
        <div className="flex gap-3">
          {registrations.length > 0 && (
            <button
              onClick={() => downloadCSV(filteredRows)}
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

      {/* View mode segmented control */}
      {registrations.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">View as</span>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">
            {([
              { key: 'list', label: 'List' },
              { key: 'table', label: 'Table' },
              { key: 'analytics', label: 'Analytics' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`rounded-full px-5 py-2 text-base font-semibold transition ${
                  viewMode === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Analytics view */}
      {viewMode === 'analytics' && registrations.length > 0 && (
        <GraphsView registrations={registrations} />
      )}

      {/* Registrations list */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          {/* Search + Filters */}
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
              {hasFilters && (
                <span className="text-base text-slate-500">{totalRows} of {allTableRows.length}</span>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Grade */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterGrade ?? ''}
                  onChange={(e) => { setFilterGrade(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterGrade ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Grade</option>
                  {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {filterGrade && (
                  <button onClick={() => { setFilterGrade(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* T-shirt */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterTshirt ?? ''}
                  onChange={(e) => { setFilterTshirt(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterTshirt ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">T-Shirt</option>
                  {tshirtOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {filterTshirt && (
                  <button onClick={() => { setFilterTshirt(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Gender */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterGender ?? ''}
                  onChange={(e) => { setFilterGender(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterGender ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                {filterGender && (
                  <button onClick={() => { setFilterGender(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Phase */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterPhase ?? ''}
                  onChange={(e) => { setFilterPhase(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterPhase ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Phase</option>
                  <option value="early">Early Bird</option>
                  <option value="regular">Regular</option>
                </select>
                {filterPhase && (
                  <button onClick={() => { setFilterPhase(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Allergies */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterAllergies === null ? '' : filterAllergies ? 'yes' : 'no'}
                  onChange={(e) => { setFilterAllergies(e.target.value === '' ? null : e.target.value === 'yes'); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterAllergies !== null ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Allergies</option>
                  <option value="yes">Has allergies</option>
                  <option value="no">No allergies</option>
                </select>
                {filterAllergies !== null && (
                  <button onClick={() => { setFilterAllergies(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {hasFilters && (
                <button onClick={clearAllFilters} className="text-sm font-medium text-sky-600 hover:text-sky-800 transition">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {!dataLoading && registrations.length === 0 && !dataError && (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No registrations yet.</div>
          )}

          {registrations.length > 0 && (
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  {[
                    { key: 'date', label: 'Date', sortable: true },
                    { key: 'grade', label: 'Grade', sortable: true },
                    { key: 'child', label: 'Child', sortable: true },
                    { key: 'tshirt', label: 'T-Shirt', sortable: true },
                    { key: 'dob', label: 'DOB', sortable: true },
                    { key: 'gender', label: 'Gender', sortable: true },
                    { key: 'parent', label: 'Parent', sortable: true },
                    { key: 'phone', label: 'Mobile', sortable: true },
                    { key: 'email', label: 'Email', sortable: true },
                    { key: 'allergies', label: 'Allergies', sortable: false },
                    { key: 'friend', label: 'Friend', sortable: false },
                    { key: 'phase', label: 'Phase', sortable: false },
                    { key: 'status', label: 'Status', sortable: false },
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
                  <th className="px-1.5 py-1.5 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map(({ reg, child, idx }) => (
                  <tr key={`${reg.id}-${idx}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrawerRegId(reg.id)}>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">
                      {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{child.grade}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 font-medium text-slate-900">
                      {child.first_name} {child.last_name}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{child.tshirt_size}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{formatDob(child.date_of_birth)}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">{child.gender === 'Female' ? 'F' : child.gender === 'Male' ? 'M' : child.gender}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">
                      {reg.parent_name}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">
                      {formatPhone(reg.phone_number)}
                    </td>
                    <td className="px-1.5 py-1 text-slate-500">
                      {reg.email}
                    </td>
                    <td className="max-w-[150px] truncate px-1.5 py-1 text-slate-500" title={child.allergy_information ?? ''}>
                      {child.allergy_information || '—'}
                    </td>
                    <td className="max-w-[120px] truncate px-1.5 py-1 text-slate-500" title={child.medical_notes ?? ''}>
                      {child.medical_notes || '—'}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1">
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {reg.registration_phase === 'early' ? 'Early' : 'Regular'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {reg.payment_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-right font-medium text-slate-900">
                      {formatCurrency(child.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination footer */}
          {registrations.length > 0 && (
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
      )}

      {/* List view */}
      {viewMode === 'list' && (
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
                      <p className="mt-0.5 text-sm text-slate-500">{reg.email} · {formatPhone(reg.phone_number)}</p>
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
                        <p className="text-slate-600">{formatPhone(reg.phone_number)}</p>
                        <p className="mt-3 font-semibold text-slate-700">Emergency Contact</p>
                        <p className="text-slate-600">{reg.emergency_contact_name}</p>
                        <p className="text-slate-600">{formatPhone(reg.emergency_contact_phone)}</p>
                        <p className="mt-3 text-xs text-slate-400">Photo consent: {reg.photo_consent ? 'Yes' : 'No'}</p>
                      </div>

                      {/* Children */}
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Children</p>
                        {reg.children.map((child, idx) => (
                          <div key={`${reg.id}-child-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-slate-900">
                                  {child.first_name} {child.last_name}
                                  {child.preferred_name && <span className="ml-1 text-slate-400">({child.preferred_name})</span>}
                                </p>
                                <p className="text-slate-500">{child.grade} · {child.gender} · T-shirt: {child.tshirt_size}</p>
                                <p className="text-slate-500">DOB: {formatDob(child.date_of_birth)}</p>
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
                    <div className="mt-4 space-y-1 rounded-2xl bg-slate-100 px-4 py-2 font-mono text-xs text-slate-400">
                      <p>Registration ID: {reg.id}</p>
                      {reg.paypal_order_id && (
                        <p>
                          PayPal Order ID:{' '}
                          <a
                            href={`https://www.paypal.com/merchant/transactions/details/${reg.paypal_order_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-500 underline hover:text-sky-700"
                          >
                            {reg.paypal_order_id}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side drawer for table row detail */}
      {drawerRegId && (() => {
        const regIndex = registrations.findIndex((r) => r.id === drawerRegId);
        const reg = registrations[regIndex];
        if (!reg) return null;
        return (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={() => setDrawerRegId(null)} />
            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>{regIndex + 1} of {registrations.length}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { if (regIndex > 0) setDrawerRegId(registrations[regIndex - 1].id); }}
                      disabled={regIndex === 0}
                      className="rounded-lg border border-slate-300 p-1 transition hover:bg-slate-100 disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                      onClick={() => { if (regIndex < registrations.length - 1) setDrawerRegId(registrations[regIndex + 1].id); }}
                      disabled={regIndex === registrations.length - 1}
                      className="rounded-lg border border-slate-300 p-1 transition hover:bg-slate-100 disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <button onClick={() => setDrawerRegId(null)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{reg.payment_status}</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">{reg.registration_phase === 'early' ? 'Early Bird' : 'Regular'}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{reg.children.length} {reg.children.length === 1 ? 'child' : 'children'}</span>
                </div>

                {/* Parent name + date */}
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{reg.parent_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Registered {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Total paid */}
                <div className="rounded-2xl bg-slate-900 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Paid</p>
                  <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(reg.total_amount)}</p>
                  {reg.paypal_order_id && (
                    <a
                      href={`https://www.paypal.com/merchant/transactions/details/${reg.paypal_order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-sky-400 underline hover:text-sky-300"
                    >
                      PayPal: {reg.paypal_order_id}
                    </a>
                  )}
                </div>

                {/* Children */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Children</h3>
                  <div className="space-y-3">
                    {reg.children.map((child, idx) => (
                      <div key={`${reg.id}-child-${idx}`} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                            {child.first_name[0]}{child.last_name[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">
                              {child.first_name} {child.last_name}
                              {child.preferred_name && <span className="ml-1 font-normal text-slate-400">({child.preferred_name})</span>}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                              <span>{child.grade}</span>
                              <span>{child.gender === 'Female' ? 'F' : child.gender === 'Male' ? 'M' : child.gender}</span>
                              <span>DOB: {formatDob(child.date_of_birth)}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                              <span>T-shirt: {child.tshirt_size}</span>
                              <span className="font-medium text-slate-700">{formatCurrency(child.price)}</span>
                            </div>
                            {child.allergy_information && (
                              <p className="mt-2 text-sm text-amber-700">Allergies: {child.allergy_information}</p>
                            )}
                            {child.medical_notes && (
                              <p className="mt-1 text-sm text-slate-500">Friend: {child.medical_notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parent / Guardian */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Parent / Guardian</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-700">{reg.email}</p>
                    <p className="text-slate-700">{formatPhone(reg.phone_number)}</p>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Emergency Contact</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-700">{reg.emergency_contact_name}</p>
                    <p className="text-slate-700">{formatPhone(reg.emergency_contact_phone)}</p>
                  </div>
                </div>

                {/* Photo consent */}
                <div className="text-sm text-slate-500">
                  Photo consent: <span className="font-medium text-slate-700">{reg.photo_consent ? 'Yes' : 'No'}</span>
                </div>

                {/* Registration ID */}
                <div className="rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs text-slate-400">
                  <p>ID: {reg.id}</p>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
