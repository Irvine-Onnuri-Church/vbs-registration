'use client';

import { useEffect, useState } from 'react';

import PageContainer from '@/components/PageContainer';
import { EVENT_INFO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDob(dob: string | null | undefined): string {
  if (!dob) return '';
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
  waived?: boolean;
  phase?: string;
  class?: 'regular' | 'beginner' | 'appletree';
  canceled?: boolean;
  canceled_at?: string;
  created_at?: string;
  paypal_order_id?: string;
  edit_history?: EditEntry[];
};

type EditEntry = {
  field: string;
  old_value: string;
  new_value: string;
  edited_at: string;
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

function downloadCSV(rows: { reg: Registration; child: Child }[], isAppletree = false) {
  const headers = isAppletree
    ? ['Date', 'Grade', 'Child Name', 'T-Shirt', 'DOB', 'Gender', 'Parent Name', 'Mobile', 'Email', 'Allergies/ Medical', 'Friend', 'Emergency Contact', 'Emergency Phone', 'Photo Consent']
    : ['Date', 'Grade', 'Child Name', 'T-Shirt', 'DOB', 'Gender', 'Parent Name', 'Mobile', 'Email', 'Allergies/ Medical', 'Friend', 'Phase', 'Status', 'Price', 'Emergency Contact', 'Emergency Phone', 'Photo Consent', 'Total'];

  const formatDobCSV = (dob: string | null | undefined) => {
    if (!dob) return '';
    const [year, month, day] = dob.split('-');
    return year && month && day ? `${month}-${day}-${year}` : dob;
  };

  const csvRows = rows.map(({ reg, child }) => isAppletree
    ? [
        new Date(child.created_at || reg.created_at).toLocaleDateString(), child.grade, `${child.first_name} ${child.last_name}`, child.tshirt_size, formatDobCSV(child.date_of_birth), child.gender,
        reg.parent_name, formatPhone(reg.phone_number), reg.email,
        child.allergy_information ?? '', child.medical_notes ?? '',
        reg.emergency_contact_name, formatPhone(reg.emergency_contact_phone), reg.photo_consent ? 'Yes' : 'No',
      ]
    : [
        new Date(child.created_at || reg.created_at).toLocaleDateString(), child.grade, `${child.first_name} ${child.last_name}`, child.tshirt_size, formatDobCSV(child.date_of_birth), child.gender,
        reg.parent_name, formatPhone(reg.phone_number), reg.email,
        child.allergy_information ?? '', child.medical_notes ?? '', reg.registration_phase, reg.payment_status, String(child.price),
        reg.emergency_contact_name, formatPhone(reg.emergency_contact_phone), reg.photo_consent ? 'Yes' : 'No', String(reg.children.filter((c) => !c.canceled).reduce((s, c) => s + c.price, 0)),
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
  const [classFilter, setClassFilter] = useState<'total' | 'regular' | 'beginner' | 'appletree'>('total');

  const classFilterTabs = [
    { key: 'total' as const, label: 'Total' },
    { key: 'regular' as const, label: 'Regular VBS' },
    { key: 'beginner' as const, label: 'Beginner VBS' },
    { key: 'appletree' as const, label: 'Apple Tree' },
  ];

  const matchesClassFilter = (c: { class?: string; grade: string }) => {
    if (classFilter === 'total') return true;
    const cls = c.class ?? (c.grade === 'Pre-K' ? 'beginner' : 'regular');
    return cls === classFilter;
  };

  // All children flattened, filtered by class
  const allChildren = registrations.flatMap((r) => r.children.filter((c) => !c.canceled && matchesClassFilter(c)));

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
      const filtered = r.children.filter((c) => !c.canceled && matchesClassFilter(c)).length;
      if (filtered > 0) map.set(key, (map.get(key) ?? 0) + filtered);
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
    let outreach = 0;
    registrations.forEach((r) => {
      r.children.filter((c) => !c.canceled && matchesClassFilter(c)).forEach((c) => {
        const phase = c.phase ?? r.registration_phase;
        if (phase === 'outreach') outreach++;
        else if (phase === 'early') early++;
        else regular++;
      });
    });
    const result: { name: string; value: number }[] = [
      { name: 'Early Bird', value: early },
      { name: 'Regular', value: regular },
    ];
    if (outreach > 0) result.push({ name: 'Outreach(전도)', value: outreach });
    return result;
  })();

  // ── 4. Gender ──
  const genderData = (() => {
    const map = new Map<string, number>();
    allChildren.forEach((c) => {
      const key = c.gender?.trim() || 'Unspecified';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
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
      {/* Class filter tabs */}
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit">
        {classFilterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setClassFilter(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              classFilter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
                <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 600, fill: '#334155' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Early bird vs Regular */}
        <div className={cardClass}>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Early Bird vs Regular</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart style={{ overflow: 'visible' }}>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={4}
                dataKey="value"
                label={({ cx, cy, midAngle, outerRadius, index, name, value, percent, fill }: any) => {
                  const RADIAN = Math.PI / 180;
                  const r = outerRadius + 18 + (index > 0 ? index * 18 : 0);
                  const x = cx + r * Math.cos(-midAngle * RADIAN);
                  const y = cy + r * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} textAnchor={x > cx + 5 ? 'start' : x < cx - 5 ? 'end' : 'middle'} dominantBaseline="central" fill={fill} style={{ fontSize: 13, fontWeight: 600 }}>
                      {`${name}  ${value} (${(percent * 100).toFixed(0)}%)`}
                    </text>
                  );
                }}
                labelLine={false}
              >
                <Cell fill="#0284c7" />
                <Cell fill="#f59e0b" />
                <Cell fill="#7c3aed" />
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
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
            <PieChart style={{ overflow: 'visible' }}>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={4}
                dataKey="value"
                label={({ cx, cy, midAngle, outerRadius, name, value, percent, fill }: any) => {
                  const RADIAN = Math.PI / 180;
                  const r = outerRadius + 20;
                  const x = cx + r * Math.cos(-midAngle * RADIAN);
                  const y = cy + r * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} textAnchor={x > cx + 5 ? 'start' : x < cx - 5 ? 'end' : 'middle'} fill={fill}>
                      <tspan x={x} dy="-0.6em" style={{ fontSize: 14, fontWeight: 600 }}>{name}</tspan>
                      <tspan x={x} dy="1.4em" style={{ fontSize: 16, fontWeight: 700 }}>{`${value} (${(percent * 100).toFixed(0)}%)`}</tspan>
                    </text>
                  );
                }}
                labelLine={false}
              >
                {genderData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
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
              <Bar dataKey="count" name="Children" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 600, fill: '#334155' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dataError, setDataError] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'analytics'>(() => {
    if (typeof window === 'undefined') return 'list';
    const param = new URLSearchParams(window.location.search).get('view');
    return (['table', 'list', 'analytics'].includes(param || '') ? param : 'list') as 'table' | 'list' | 'analytics';
  });
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [drawerRegId, setDrawerRegId] = useState<string | null>(null);
  const [editingChild, setEditingChild] = useState<{ regId: string; childIdx: number } | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editHistoryOpen, setEditHistoryOpen] = useState<number | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildSaving, setAddChildSaving] = useState(false);
  const [addParentForm, setAddParentForm] = useState({ parentName: '', email: '', phoneNumber: '', emergencyContactName: '', emergencyContactPhone: '' });
  const emptyChild = { firstName: '', lastName: '', gender: '', dateOfBirth: '', grade: '', tshirtSize: '', allergyInformation: '', medicalNotes: '', price: '', paymentType: '', paymentNotes: '' };
  const [addChildrenForms, setAddChildrenForms] = useState([{ ...emptyChild }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<string | null>(null);
  const [filterTshirt, setFilterTshirt] = useState<string | null>(null);
  const [filterAllergies, setFilterAllergies] = useState<boolean | null>(null);
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterPayment, setFilterPayment] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const hasFilters = searchQuery || filterGrade || filterTshirt || filterAllergies !== null || filterGender || filterPhase || filterSource || filterPayment || filterType;

  function clearAllFilters() {
    setSearchQuery('');
    setFilterGrade(null);
    setFilterTshirt(null);
    setFilterAllergies(null);
    setFilterGender(null);
    setFilterPhase(null);
    setFilterSource(null);
    setFilterPayment(null);
    setFilterType(null);
    setCurrentPage(0);
  }

  async function handleAddChild() {
    if (!addParentForm.parentName || !addParentForm.email || !addParentForm.phoneNumber) return;
    const validChildren = addChildrenForms.filter((c) => c.firstName && c.lastName && c.gender && c.dateOfBirth && c.grade && c.tshirtSize);
    if (validChildren.length === 0) return;
    setAddChildSaving(true);
    try {
      const res = await fetch('/api/admin/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentInfo: addParentForm, children: validChildren, photoConsent: true }),
      });
      if (res.ok) {
        setShowAddChild(false);
        setAddParentForm({ parentName: '', email: '', phoneNumber: '', emergencyContactName: '', emergencyContactPhone: '' });
        setAddChildrenForms([{ ...emptyChild }]);
        await fetchRegistrations();
      }
    } catch { /* ignore */ }
    setAddChildSaving(false);
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
    reg.children
      .map((child, idx) => ({ reg, child, idx }))
      .filter(({ child }) => !child.canceled)
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
      const childPhase = child.phase ?? reg.registration_phase;
      if (filterPhase === 'outreach' && childPhase !== 'outreach') return false;
      if (filterPhase === 'early' && childPhase !== 'early') return false;
      if (filterPhase === 'regular' && (childPhase === 'early' || childPhase === 'outreach')) return false;
    }
    if (filterSource) {
      const src = reg.source || 'online';
      if (src !== filterSource) return false;
    }
    if (filterPayment && reg.payment_status !== filterPayment) return false;
    const cls = child.class ?? (child.grade === 'Pre-K' ? 'beginner' : 'regular');
    if (filterType) {
      if (cls !== filterType) return false;
    } else {
      if (cls === 'appletree') return false;
    }
    return true;
  });

  const gradeOrder: Record<string, number> = { 'Pre-K': 0, 'Transitional Kindergarten': 1, 'Kindergarten': 2, '1st Grade': 3, '2nd Grade': 4, '3rd Grade': 5, '4th Grade': 6, '5th Grade': 7, '6th Grade': 8 };

  if (sortKey) {
    filteredRows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': { const av = a.child.created_at || a.reg.created_at; const bv = b.child.created_at || b.reg.created_at; cmp = av < bv ? -1 : av > bv ? 1 : 0; break; }
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

  // Unique values for filter dropdowns (exclude appletree)
  const allChildren = registrations.flatMap((r) => r.children.filter((c) => c.class !== 'appletree'));
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
    window.dispatchEvent(new Event('admin-auth-changed'));
    await fetchRegistrations();
  }

  const EDITABLE_FIELDS = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'preferred_name', label: 'Preferred Name' },
    { key: 'gender', label: 'Gender', options: ['Male', 'Female'] },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
    { key: 'grade', label: 'Grade', options: ['Pre-K', 'TK', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade'] },
    { key: 'tshirt_size', label: 'T-Shirt', options: ['3Y', '4Y', '5Y', 'XS', 'S', 'M', 'L', 'XL', 'Adult S', 'Adult M'] },
    { key: 'allergy_information', label: 'Allergies' },
    { key: 'medical_notes', label: 'Friend Request' },
  ] as const;

  function startEditing(regId: string, childIdx: number, child: Child) {
    setEditingChild({ regId, childIdx });
    setEditForm({
      first_name: child.first_name,
      last_name: child.last_name,
      preferred_name: child.preferred_name ?? '',
      gender: child.gender,
      date_of_birth: child.date_of_birth,
      grade: child.grade,
      tshirt_size: child.tshirt_size,
      allergy_information: child.allergy_information ?? '',
      medical_notes: child.medical_notes ?? '',
    });
  }

  async function saveEdit() {
    if (!editingChild) return;
    setEditSaving(true);
    const { regId, childIdx } = editingChild;
    const reg = registrations.find((r) => r.id === regId);
    if (!reg) { setEditSaving(false); return; }
    const child = reg.children[childIdx];

    // Build changes object — only include actually changed fields
    const changes: Record<string, string> = {};
    for (const [key, newVal] of Object.entries(editForm)) {
      const oldVal = String((child as Record<string, unknown>)[key] ?? '');
      if (oldVal !== newVal) changes[key] = newVal;
    }

    if (Object.keys(changes).length === 0) {
      setEditingChild(null);
      setEditSaving(false);
      return;
    }

    const res = await fetch('/api/admin/edit-child', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: regId, childIndex: childIdx, changes }),
    });

    if (res.ok) {
      await fetchRegistrations();
      setEditingChild(null);
    }
    setEditSaving(false);
  }

  async function undoLastEdit(regId: string, childIdx: number) {
    const res = await fetch('/api/admin/edit-child', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: regId, childIndex: childIdx }),
    });
    if (res.ok) {
      await fetchRegistrations();
    }
  }

  const activeChildren = registrations.flatMap((r) => r.children.filter((c) => !c.canceled && c.class !== 'appletree'));
  const activeRegistrations = registrations.filter((r) => r.children.some((c) => !c.canceled && c.class !== 'appletree'));
  const totalAmount = activeRegistrations.reduce((sum, r) => {
    const activeTotal = r.children.filter((c) => !c.canceled && c.class !== 'appletree' && !c.waived).reduce((s, c) => s + c.price, 0);
    return sum + activeTotal;
  }, 0);
  const totalChildren = activeChildren.length;
  const appletreeCount = registrations.flatMap((r) => r.children.filter((c) => !c.canceled && c.class === 'appletree')).length;

  // Class breakdown (fallback: Pre-K → beginner, else regular if class not set)
  const classCounts = activeChildren.reduce(
    (acc, c) => {
      const cls = c.class ?? (c.grade === 'Pre-K' ? 'beginner' : 'regular');
      acc[cls] = (acc[cls] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

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
    <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Registration Dashboard</h1>
      </div>

      {/* Summary stats */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-6">
            <p className="text-sm font-semibold text-slate-500">Registrations</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{activeRegistrations.length}</p>
          </div>
          <div className="p-6">
            <p className="text-sm font-semibold text-slate-500">Children</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalChildren}</p>
          </div>
        </div>
      </div>

      {/* Class filter buttons — aligned to stat columns above */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button
          onClick={() => { setFilterType(filterType === 'regular' ? null : 'regular'); setViewMode('list'); setCurrentPage(0); }}
          style={{ border: '1.5px solid #93c5e8', borderRadius: 14, backgroundColor: filterType === 'regular' ? '#dbeeff' : 'transparent' }}
          className="flex items-center justify-between px-4 py-3 transition hover:bg-[#dbeeff]"
        >
          <span style={{ color: '#2563a8' }} className="text-base font-semibold">Regular VBS</span>
          <span style={{ backgroundColor: '#3a7bd5' }} className="ml-3 rounded-full px-2.5 py-0.5 text-base font-bold text-white">{classCounts.regular || 0}</span>
        </button>
        <button
          onClick={() => { setFilterType(filterType === 'beginner' ? null : 'beginner'); setViewMode('list'); setCurrentPage(0); }}
          style={{ border: '1.5px solid #6dd4b0', borderRadius: 14, backgroundColor: filterType === 'beginner' ? '#d0f5e8' : 'transparent' }}
          className="flex items-center justify-between px-4 py-3 transition hover:bg-[#d0f5e8]"
        >
          <span style={{ color: '#0e7a5a' }} className="text-base font-semibold">Beginner VBS</span>
          <span style={{ backgroundColor: '#1a9e75' }} className="ml-3 rounded-full px-2.5 py-0.5 text-base font-bold text-white">{classCounts.beginner || 0}</span>
        </button>
        <button
          onClick={() => { setFilterType(filterType === 'appletree' ? null : 'appletree'); setViewMode('list'); setCurrentPage(0); }}
          style={{ border: '1.5px solid #9ec95a', borderRadius: 14, backgroundColor: filterType === 'appletree' ? '#dff0c8' : 'transparent' }}
          className="flex items-center justify-between px-4 py-3 transition hover:bg-[#dff0c8]"
        >
          <span style={{ color: '#3a6b12' }} className="text-base font-semibold">Apple Tree</span>
          <span style={{ backgroundColor: '#5c9220' }} className="ml-3 rounded-full px-2.5 py-0.5 text-base font-bold text-white">{appletreeCount}</span>
        </button>
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
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
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

            {/* Filter chips + Download */}
            <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
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

              {/* Type */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterType ?? ''}
                  onChange={(e) => { setFilterType(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterType ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Type</option>
                  <option value="regular">Regular VBS</option>
                  <option value="beginner">Beginner VBS</option>
                  <option value="appletree">Apple Tree</option>
                </select>
                {filterType && (
                  <button onClick={() => { setFilterType(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
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
                  <option value="outreach">Outreach(전도)</option>
                </select>
                {filterPhase && (
                  <button onClick={() => { setFilterPhase(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Source */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterSource ?? ''}
                  onChange={(e) => { setFilterSource(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterSource ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Source</option>
                  <option value="online">Online</option>
                  <option value="in_person">In Person</option>
                </select>
                {filterSource && (
                  <button onClick={() => { setFilterSource(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Payment Status */}
              <div className="relative inline-flex items-center">
                <select
                  value={filterPayment ?? ''}
                  onChange={(e) => { setFilterPayment(e.target.value || null); setCurrentPage(0); }}
                  className={`rounded-full border py-1.5 text-sm font-semibold outline-none transition ${filterPayment ? 'border-sky-300 bg-sky-50 text-sky-700 pl-3 pr-7' : 'border-slate-300 text-slate-500 hover:bg-slate-50 px-3'}`}
                >
                  <option value="">Payment</option>
                  {[...new Set(registrations.map((r) => r.payment_status))].sort().map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {filterPayment && (
                  <button onClick={() => { setFilterPayment(null); setCurrentPage(0); }} className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-200 text-sky-700 hover:bg-sky-300">
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
                  <option value="">Allergies/ Medical</option>
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
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setShowAddChild(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add a new Child
                </button>
                <button
                  onClick={() => downloadCSV(filteredRows, filterType === 'appletree')}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable table area — headers sticky, both axes scroll together */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>

          {!dataLoading && registrations.length === 0 && !dataError && (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No registrations yet.</div>
          )}

          {registrations.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
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
                    { key: 'allergies', label: 'Allergies/ Medical', sortable: false },
                    { key: 'friend', label: 'Friend', sortable: false },
                    ...(filterType === 'appletree' ? [] : [
                      { key: 'phase', label: 'Phase', sortable: false },
                      { key: 'status', label: 'Status', sortable: false },
                    ]),
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
                  {filterType !== 'appletree' && <th className="px-1.5 py-1.5 text-right">Price</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map(({ reg, child, idx }) => (
                  <tr key={`${reg.id}-${idx}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrawerRegId(reg.id)}>
                    <td className="whitespace-nowrap px-1.5 py-1 text-slate-500">
                      {new Date(child.created_at || reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                    {filterType !== 'appletree' && (
                      <td className="whitespace-nowrap px-1.5 py-1">
                        {(() => {
                          const phase = child.phase ?? reg.registration_phase;
                          if (phase === 'outreach') return <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Outreach(전도)</span>;
                          return <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{phase === 'early' ? 'Early' : 'Regular'}</span>;
                        })()}
                      </td>
                    )}
                    {filterType !== 'appletree' && (
                      <td className="whitespace-nowrap px-1.5 py-1">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {reg.payment_status}
                        </span>
                      </td>
                    )}
                    {filterType !== 'appletree' && (
                      <td className="whitespace-nowrap px-1.5 py-1 text-right font-medium text-slate-900">
                        {child.waived ? <span className="text-slate-400">Waived</span> : formatCurrency(child.price)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          </div>{/* end scrollable table area */}

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
            {registrations.filter((r) => r.children.some((c) => {
              const cls = c.class ?? (c.grade === 'Pre-K' ? 'beginner' : 'regular');
              return filterType ? cls === filterType : cls !== 'appletree';
            })).map((reg) => {
              const visibleChildren = reg.children.filter((c) => {
                const cls = c.class ?? (c.grade === 'Pre-K' ? 'beginner' : 'regular');
                return filterType ? cls === filterType : cls !== 'appletree';
              });
              return (
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
                        {visibleChildren.length} child{visibleChildren.length !== 1 ? 'ren' : ''} ·{' '}
                        {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {filterType !== 'appletree' && <span className="font-semibold text-slate-900">{formatCurrency(reg.children.filter((c) => !c.canceled).reduce((s, c) => s + c.price, 0))}</span>}
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
                        {visibleChildren.map((child, idx) => (
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
                              {filterType !== 'appletree' && (child.waived ? <span className="font-semibold text-slate-400">Waived</span> : <span className="font-semibold text-slate-700">{formatCurrency(child.price)}</span>)}
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
              );
            })}
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      {showAddChild && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAddChild(false)} />
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">Add a new Child</h2>
                <button onClick={() => setShowAddChild(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Parent Info */}
              <div className="rounded-2xl border border-slate-200 p-5 mb-5">
                <h3 className="text-base font-bold text-slate-900 mb-1">Parent / Guardian Information</h3>
                <p className="text-sm text-slate-500 mb-4">Provide the main family contact details for registration and communication.</p>
                <hr className="mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Parent / Guardian Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Enter parent or guardian name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={addParentForm.parentName} onChange={(e) => setAddParentForm((p) => ({ ...p, parentName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                    <input type="email" placeholder="parent@example.com" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={addParentForm.email} onChange={(e) => setAddParentForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                    <input type="tel" placeholder="(555) 123-4567" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={addParentForm.phoneNumber} onChange={(e) => setAddParentForm((p) => ({ ...p, phoneNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Emergency Contact Name</label>
                    <input type="text" placeholder="Enter emergency contact name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={addParentForm.emergencyContactName} onChange={(e) => setAddParentForm((p) => ({ ...p, emergencyContactName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Emergency Contact Phone Number</label>
                    <input type="tel" placeholder="(555) 987-6543" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={addParentForm.emergencyContactPhone} onChange={(e) => setAddParentForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Children */}
              {addChildrenForms.map((childForm, ci) => (
                <div key={ci} className="rounded-2xl border border-slate-200 p-5 mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-bold text-slate-900">Child Information {addChildrenForms.length > 1 ? `#${ci + 1}` : ''}</h3>
                    {addChildrenForms.length > 1 && (
                      <button onClick={() => setAddChildrenForms((prev) => prev.filter((_, i) => i !== ci))} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-4">Add the details needed for attendance, classroom planning, and child safety.</p>
                  <hr className="mb-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="First name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.firstName} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, firstName: e.target.value } : c))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Last Name <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="Last name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.lastName} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, lastName: e.target.value } : c))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Gender <span className="text-red-500">*</span></label>
                      <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.gender} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, gender: e.target.value } : c))}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Date of Birth <span className="text-red-500">*</span></label>
                      <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.dateOfBirth} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, dateOfBirth: e.target.value } : c))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Grade <span className="text-red-500">*</span></label>
                      <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.grade} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, grade: e.target.value } : c))}>
                        <option value="">Select grade</option>
                        <option value="Pre-K">Pre-K</option>
                        <option value="TK">TK</option>
                        <option value="Kindergarten">Kindergarten</option>
                        <option value="1st Grade">1st Grade</option>
                        <option value="2nd Grade">2nd Grade</option>
                        <option value="3rd Grade">3rd Grade</option>
                        <option value="4th Grade">4th Grade</option>
                        <option value="5th Grade">5th Grade</option>
                        <option value="6th Grade">6th Grade</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">T-shirt Size <span className="text-red-500">*</span></label>
                      <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.tshirtSize} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, tshirtSize: e.target.value } : c))}>
                        <option value="">Select size</option>
                        {['3Y', '4Y', '5Y', 'XS', 'S', 'M', 'L', 'XL', 'Adult S', 'Adult M'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700">Allergies / Other Medical Conditions</label>
                    <textarea placeholder="List any food or environmental allergies and other medical conditions, or enter 'None'." rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.allergyInformation} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, allergyInformation: e.target.value } : c))} />
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700">Friend to be with</label>
                    <textarea placeholder="Name a friend your child would like to be grouped with (optional)." rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.medicalNotes} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, medicalNotes: e.target.value } : c))} />
                  </div>
                  <hr className="my-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Amount Paid <span className="text-red-500">*</span></label>
                      <input type="number" step="0.01" placeholder="0.00" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.price} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, price: e.target.value } : c))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Payment Type <span className="text-red-500">*</span></label>
                      <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.paymentType} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, paymentType: e.target.value } : c))}>
                        <option value="">Select payment type</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700">Payment Notes</label>
                    <input type="text" placeholder="Check number, PayPal transaction ID, etc. (optional)" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" value={childForm.paymentNotes} onChange={(e) => setAddChildrenForms((prev) => prev.map((c, i) => i === ci ? { ...c, paymentNotes: e.target.value } : c))} />
                  </div>
                </div>
              ))}

              <button
                onClick={() => setAddChildrenForms((prev) => [...prev, { ...emptyChild }])}
                className="mb-5 inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                + Add Another Child
              </button>

              <hr className="mb-5" />
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAddChild(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={handleAddChild} disabled={addChildSaving} className="rounded-full bg-sky-600 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
                  {addChildSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Side drawer for table row detail */}
      {drawerRegId && (() => {
        const regIndex = registrations.findIndex((r) => r.id === drawerRegId);
        const reg = registrations[regIndex];
        if (!reg) return null;
        const siblingRegs = registrations.filter((r) => r.id !== reg.id && r.email === reg.email);
        const allChildren: { child: typeof reg.children[0]; regId: string; childIdx: number }[] = [
          ...reg.children.map((child, idx) => ({ child, regId: reg.id, childIdx: idx })),
          ...siblingRegs.flatMap((sr) => sr.children.map((child, idx) => ({ child, regId: sr.id, childIdx: idx }))),
        ];
        return (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={() => { setDrawerRegId(null); setEditingChild(null); setEditHistoryOpen(null); }} />
            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>{regIndex + 1} of {registrations.length}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { if (regIndex > 0) { setDrawerRegId(registrations[regIndex - 1].id); setEditingChild(null); setEditHistoryOpen(null); } }}
                      disabled={regIndex === 0}
                      className="rounded-lg border border-slate-300 p-1 transition hover:bg-slate-100 disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                      onClick={() => { if (regIndex < registrations.length - 1) { setDrawerRegId(registrations[regIndex + 1].id); setEditingChild(null); setEditHistoryOpen(null); } }}
                      disabled={regIndex === registrations.length - 1}
                      className="rounded-lg border border-slate-300 p-1 transition hover:bg-slate-100 disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
                <button onClick={() => { setDrawerRegId(null); setEditingChild(null); setEditHistoryOpen(null); }} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{reg.payment_status}</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">{reg.registration_phase === 'early' ? 'Early Bird' : 'Regular'}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{allChildren.length} {allChildren.length === 1 ? 'child' : 'children'}</span>
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
                  <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(allChildren.filter((c) => !c.child.canceled).reduce((s, c) => s + c.child.price, 0))}</p>
                  {[reg, ...siblingRegs].filter((r) => r.paypal_order_id).map((r) => (
                    <a
                      key={r.id}
                      href={`https://www.paypal.com/merchant/transactions/details/${r.paypal_order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-sky-400 underline hover:text-sky-300"
                    >
                      PayPal: {r.paypal_order_id}
                    </a>
                  ))}
                </div>

                {/* Children */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Children</h3>
                  <div className="space-y-3">
                    {allChildren.map(({ child, regId, childIdx }, idx) => {
                      const isEditing = editingChild?.regId === regId && editingChild?.childIdx === childIdx;
                      const hasHistory = (child.edit_history?.length ?? 0) > 0;
                      const showHistory = editHistoryOpen === idx;

                      return (
                        <div key={`${regId}-child-${childIdx}`} className="rounded-2xl border border-slate-200 p-4">
                          {isEditing ? (
                            /* ── Edit Form ── */
                            <div className="space-y-3">
                              <p className="text-sm font-semibold text-slate-700">Editing {child.first_name} {child.last_name}</p>
                              {EDITABLE_FIELDS.map((f) => (
                                <div key={f.key}>
                                  <label className="block text-xs font-medium text-slate-500">{f.label}</label>
                                  {'options' in f ? (
                                    <select
                                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                                      value={editForm[f.key] ?? ''}
                                      onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                    >
                                      <option value="">—</option>
                                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : (
                                    <input
                                      type={'type' in f ? f.type : 'text'}
                                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                                      value={editForm[f.key] ?? ''}
                                      onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                    />
                                  )}
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={saveEdit}
                                  disabled={editSaving}
                                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                                >
                                  {editSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingChild(null)}
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Read-only View ── */
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
                                  {child.waived ? <span className="font-medium text-slate-400">Waived</span> : <span className="font-medium text-slate-700">{formatCurrency(child.price)}</span>}
                                </div>
                                {child.allergy_information && (
                                  <p className="mt-2 text-sm text-amber-700">Allergies/ Medical: {child.allergy_information}</p>
                                )}
                                {child.medical_notes && (
                                  <p className="mt-1 text-sm text-slate-500">Friend: {child.medical_notes}</p>
                                )}

                                {/* Action buttons */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => startEditing(regId, childIdx, child)}
                                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    Edit
                                  </button>
                                  {hasHistory && (
                                    <>
                                      <button
                                        onClick={() => setEditHistoryOpen(showHistory ? null : idx)}
                                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                      >
                                        {showHistory ? 'Hide History' : `History (${child.edit_history!.length})`}
                                      </button>
                                      <button
                                        onClick={() => { if (confirm(`Undo last edit on ${child.first_name}?`)) undoLastEdit(regId, childIdx); }}
                                        className="rounded-lg border border-orange-300 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50"
                                      >
                                        Undo
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Edit history */}
                                {showHistory && child.edit_history && (
                                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                                    <p className="mb-2 text-xs font-semibold text-slate-500">Edit History</p>
                                    <div className="space-y-1.5">
                                      {[...child.edit_history].reverse().map((entry, i) => (
                                        <div key={i} className="text-xs text-slate-600">
                                          <span className="font-medium">{entry.field}</span>:{' '}
                                          <span className="text-red-500 line-through">{entry.old_value || '(empty)'}</span>{' '}
                                          → <span className="text-emerald-600">{entry.new_value || '(empty)'}</span>
                                          <span className="ml-2 text-slate-400">
                                            {new Date(entry.edited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                                            {new Date(entry.edited_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
