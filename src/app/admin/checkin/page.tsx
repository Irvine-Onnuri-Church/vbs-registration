'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { EVENT_INFO } from '@/lib/constants';
import {
  buildSeedMap,
  CLASS_ORDER,
  GRADE_COLORS,
  GRADE_ORDER,
  type Gender,
  type Grade,
  type RosterMap,
} from '@/lib/roster';

const STORAGE_KEY = 'vbs-checkin-v1';
const CHECKED_GREEN = '#1D9E75';

// Native <select> arrows ignore padding and sit at a browser-fixed offset. Hide
// the native arrow and draw our own chevron at the same 0.75rem margin as the
// left text padding, so the arrow's margins are consistent on both sides.
const SELECT_CLASS =
  'w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200';
const SELECT_STYLE: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '1rem',
};

// Perceived-luminance pick: dark text on light fills (K, 3rd), white on the rest.
function textColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= 170 ? '#222' : '#fff';
}

// ─── Derived view model ─────────────────────────────────────────────────────

type Student = { id: string; name: string; note: string; sat: boolean; crossed: boolean };
type GroupedClass = { className: string; left: Student[]; right: Student[] };

// Group the flat roster map into ordered classes/columns for rendering.
// Unassigned Saturday students (cls === '') are skipped here — they render in the
// banner, not in class cards.
function groupRoster(map: RosterMap): Record<string, GroupedClass[]> {
  const byGradeClass: Record<string, Record<string, Array<{ id: string; col: 'L' | 'R'; order: number; name: string; note: string; sat: boolean; crossed: boolean }>>> = {};
  for (const [id, r] of Object.entries(map)) {
    if (!r.cls) continue;
    ((byGradeClass[r.grade] ??= {})[r.cls] ??= []).push({ id, col: r.col, order: r.order, name: r.name, note: r.note, sat: !!r.saturdayOnly, crossed: !!r.crossedOut });
  }

  const out: Record<string, GroupedClass[]> = {};
  for (const grade of GRADE_ORDER) {
    const classList = CLASS_ORDER[grade] ?? [];
    out[grade] = classList.map((cls) => {
      const arr = byGradeClass[grade]?.[cls] ?? [];
      const toStudent = (s: { id: string; name: string; note: string; sat: boolean; crossed: boolean }): Student => ({ id: s.id, name: s.name, note: s.note, sat: s.sat, crossed: s.crossed });
      const left = arr.filter((s) => s.col === 'L').sort((a, b) => a.order - b.order).map(toStudent);
      const right = arr.filter((s) => s.col === 'R').sort((a, b) => a.order - b.order).map(toStudent);
      return { className: cls, left, right };
    });
  }
  return out;
}

// All unassigned students for a grade (banner contents) — Saturday-only and not.
function bannerStudentsFor(map: RosterMap, grade: Grade): Student[] {
  return Object.entries(map)
    .filter(([, r]) => r.grade === grade && !r.cls)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id, r]) => ({ id, name: r.name, note: r.note, sat: !!r.saturdayOnly, crossed: !!r.crossedOut }));
}

function SatBadge() {
  return (
    <span className="rounded bg-amber-500 px-1 py-0.5 text-[10px] font-bold uppercase leading-none text-white">SAT</span>
  );
}

function CheckCircle({ done }: { done: boolean }) {
  return done ? (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: CHECKED_GREEN }}>
      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CheckinPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated]     = useState(false);
  const [password, setPassword]               = useState('');
  const [authError, setAuthError]             = useState('');
  const [authLoading, setAuthLoading]         = useState(false);

  const [selectedGrade, setSelectedGrade] = useState<Grade>('1st');
  const [search, setSearch]               = useState('');
  const [checked, setChecked]             = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated]           = useState(false);
  const [syncError, setSyncError]         = useState('');

  // Dynamic roster — seeded for instant paint, replaced by the server GET.
  const [rosterMap, setRosterMap] = useState<RosterMap>(() => buildSeedMap());
  const [editMode, setEditMode]   = useState(false);

  // Keys with an in-flight check-in write — preserved when reconciling polls.
  const pendingRef = useRef<Set<string>>(new Set());
  // True while a roster add/rename/remove is in flight — pauses poll apply.
  const editBusyRef = useRef(false);

  useEffect(() => {
    checkSession();

    async function checkSession() {
      try {
        const res = await fetch('/api/admin/auth');
        if (res.ok) setAuthenticated(true);
      } finally {
        setCheckingSession(false);
      }
    }
  }, []);

  // Instant paint of check-in state from the local cache.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  // Mirror check-in state to a local cache so a refresh paints instantly.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore quota errors */
    }
  }, [checked, hydrated]);

  // ─── Check-in store: load + poll + focus ──────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;

    async function loadCheckin() {
      try {
        const res = await fetch('/api/admin/roster-checkin', { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data || typeof data.checked !== 'object' || data.checked === null) return;
        const server: Record<string, boolean> = data.checked;
        setChecked((prev) => {
          const merged = { ...server };
          pendingRef.current.forEach((k) => {
            if (prev[k]) merged[k] = true;
            else delete merged[k];
          });
          return merged;
        });
      } catch {
        /* keep cached state on errors */
      }
    }

    loadCheckin();
    const interval = setInterval(loadCheckin, 7000);
    window.addEventListener('focus', loadCheckin);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', loadCheckin);
    };
  }, [authenticated]);

  // ─── Roster store: load + poll + focus ────────────────────────────────────
  // Defined in component scope so edit handlers can force an authoritative refetch.
  async function loadRoster(force = false) {
    if (!force && editBusyRef.current) return;
    try {
      const res = await fetch('/api/admin/roster', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data.students !== 'object' || data.students === null) return;
      if (!force && editBusyRef.current) return; // re-check after await
      setRosterMap(data.students);
    } catch {
      /* keep current roster on errors */
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    const tick = () => { if (!cancelled) loadRoster(false); };

    tick();
    const interval = setInterval(tick, 7000);
    window.addEventListener('focus', tick);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', tick);
    };
    // loadRoster only touches stable refs/setters; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

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
    // Notify the Navbar so it swaps to the admin links immediately.
    window.dispatchEvent(new Event('admin-auth-changed'));
  }

  // ─── Check-in toggle (keyed by student id) ────────────────────────────────
  async function toggle(id: string) {
    const desired = !checked[id];
    pendingRef.current.add(id);
    setSyncError('');
    setChecked((prev) => {
      const next = { ...prev };
      if (desired) next[id] = true;
      else delete next[id];
      return next;
    });

    try {
      const res = await fetch('/api/admin/roster-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ key: id, checkedIn: desired }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
    } catch {
      setChecked((prev) => {
        const next = { ...prev };
        if (desired) delete next[id];
        else next[id] = true;
        return next;
      });
      setSyncError('Could not save check-in — check your connection and try again.');
    } finally {
      pendingRef.current.delete(id);
    }
  }

  // ─── Roster edit handlers ─────────────────────────────────────────────────
  // Returns 'ok' | 'dup' | 'err'. Persists to Firestore, then refetches.
  async function addStudent(grade: Grade, cls: string, name: string, note = '', gender?: Gender): Promise<'ok' | 'dup' | 'err'> {
    const trimmed = name.trim();
    if (!trimmed) return 'err';
    editBusyRef.current = true;
    try {
      const res = await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ op: 'add', grade, cls, name: trimmed, note, ...(gender ? { gender } : {}) }),
      });
      if (res.status === 409) return 'dup';
      if (!res.ok) return 'err';
      return 'ok';
    } catch {
      return 'err';
    } finally {
      editBusyRef.current = false;
      await loadRoster(true);
    }
  }

  // Create an unassigned student (lives in the banner). saturdayOnly toggles the SAT badge.
  async function addUnassignedStudent(grade: Grade, name: string, note = '', saturdayOnly = false, gender?: Gender): Promise<'ok' | 'dup' | 'err'> {
    const trimmed = name.trim();
    if (!trimmed) return 'err';
    editBusyRef.current = true;
    try {
      const res = await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ op: 'add', grade, name: trimmed, note, saturdayOnly, unassigned: true, ...(gender ? { gender } : {}) }),
      });
      if (res.status === 409) return 'dup';
      if (!res.ok) return 'err';
      return 'ok';
    } catch {
      return 'err';
    } finally {
      editBusyRef.current = false;
      await loadRoster(true);
    }
  }

  // Assign a banner (Saturday) student to a real class.
  async function assignStudent(id: string, cls: string): Promise<'ok' | 'dup' | 'err'> {
    editBusyRef.current = true;
    setRosterMap((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], cls } } : prev)); // optimistic move
    try {
      const res = await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ op: 'assign', id, cls }),
      });
      if (res.status === 409) return 'dup';
      if (!res.ok) return 'err';
      return 'ok';
    } catch {
      return 'err';
    } finally {
      editBusyRef.current = false;
      await loadRoster(true);
    }
  }

  async function renameStudent(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    editBusyRef.current = true;
    setRosterMap((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], name: trimmed } } : prev));
    try {
      await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ op: 'rename', id, name: trimmed }),
      });
    } catch {
      /* refetch below restores authoritative state */
    } finally {
      editBusyRef.current = false;
      await loadRoster(true);
    }
  }

  async function removeStudent(id: string) {
    editBusyRef.current = true;
    setRosterMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setChecked((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ op: 'remove', id }),
      });
    } catch {
      /* refetch below restores authoritative state */
    } finally {
      editBusyRef.current = false;
      await loadRoster(true);
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  const grouped = useMemo(() => groupRoster(rosterMap), [rosterMap]);
  const gradeClasses = grouped[selectedGrade] ?? [];
  const gradeColor = GRADE_COLORS[selectedGrade];

  const bannerStudents = useMemo(() => bannerStudentsFor(rosterMap, selectedGrade), [rosterMap, selectedGrade]);
  const bannerCount = useMemo(
    () => ({ done: bannerStudents.filter((s) => checked[s.id]).length, total: bannerStudents.length }),
    [bannerStudents, checked],
  );

  // Grade total includes both class students and unassigned (banner) students.
  const gradeCount = useMemo(() => {
    let total = 0;
    let done = 0;
    gradeClasses.forEach((c) => {
      [...c.left, ...c.right].forEach((s) => {
        total += 1;
        if (checked[s.id]) done += 1;
      });
    });
    bannerStudents.forEach((s) => {
      total += 1;
      if (checked[s.id]) done += 1;
    });
    return { done, total };
  }, [gradeClasses, bannerStudents, checked]);

  const gradeTotal = gradeCount.total;

  // ─── Auth screens ─────────────────────────────────────────────────────────

  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center px-4 py-16">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

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

  // ─── Main ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Check-in</h1>
          {editMode ? (
            <p className="text-sm text-slate-500">
              <span className="font-semibold" style={{ color: gradeColor }}>{selectedGrade}</span>
              {' · editing roster · '}{gradeTotal} student{gradeTotal === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {EVENT_INFO.name} · {EVENT_INFO.subtitle} · {EVENT_INFO.dates}
            </p>
          )}
        </div>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
            editMode
              ? 'bg-slate-900 text-white hover:bg-slate-700'
              : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          {editMode ? 'Done editing' : 'Edit roster'}
        </button>
      </div>

      {/* Grade tabs */}
      <div className="flex flex-wrap gap-2">
        {GRADE_ORDER.map((grade) => {
          const color = GRADE_COLORS[grade];
          const isSelected = grade === selectedGrade;
          return (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
              style={
                isSelected
                  ? { backgroundColor: color, color: textColorFor(color), border: `1.5px solid ${color}` }
                  : { backgroundColor: 'transparent', color, border: `1.5px solid ${color}` }
              }
            >
              {grade}
            </button>
          );
        })}
      </div>

      {editMode ? (
        <EditView
          grade={selectedGrade}
          gradeColor={gradeColor}
          classes={gradeClasses}
          bannerStudents={bannerStudents}
          bannerCount={bannerCount}
          checked={checked}
          onAdd={addStudent}
          onAddUnassigned={addUnassignedStudent}
          onAssign={assignStudent}
          onRename={renameStudent}
          onRemove={removeStudent}
        />
      ) : (
        <CheckInView
          selectedGrade={selectedGrade}
          gradeColor={gradeColor}
          classes={gradeClasses}
          count={gradeCount}
          checked={checked}
          onToggle={toggle}
          search={search}
          onSearch={setSearch}
          syncError={syncError}
          bannerStudents={bannerStudents}
          bannerCount={bannerCount}
        />
      )}
    </div>
  );
}

// ─── Check-in view ──────────────────────────────────────────────────────────

function CheckInView({
  selectedGrade,
  gradeColor,
  classes,
  count,
  checked,
  onToggle,
  search,
  onSearch,
  syncError,
  bannerStudents,
  bannerCount,
}: {
  selectedGrade: Grade;
  gradeColor: string;
  classes: GroupedClass[];
  count: { done: number; total: number };
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  search: string;
  onSearch: (v: string) => void;
  syncError: string;
  bannerStudents: Student[];
  bannerCount: { done: number; total: number };
}) {
  const searchLower = search.trim().toLowerCase();
  const hasRoster = classes.length > 0;

  return (
    <>
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
        <span className="text-lg font-bold" style={{ color: gradeColor }}>
          {selectedGrade} Grade
        </span>
        <span className="text-base font-medium text-slate-600">
          {count.done} / {count.total} checked in
        </span>
        {syncError && <span className="ml-auto text-sm font-medium text-red-600">{syncError}</span>}
      </div>

      {/* Saturday-only / Unassigned banner */}
      <SaturdayBanner mode="checkin" students={bannerStudents} count={bannerCount} checked={checked} onToggle={onToggle} />

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={`Search students in ${selectedGrade} grade…`}
        className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />

      {!hasRoster ? (
        <p className="py-12 text-center text-sm text-slate-500">No roster yet for {selectedGrade} grade.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
          {classes.map((c) => {
            const matches = (name: string) => !searchLower || name.toLowerCase().includes(searchLower);
            const leftItems = c.left.filter((s) => matches(s.name));
            const rightItems = c.right.filter((s) => matches(s.name));
            if (searchLower && leftItems.length === 0 && rightItems.length === 0) return null;

            const classTotal = c.left.length + c.right.length;
            const classDone =
              c.left.filter((s) => checked[s.id]).length + c.right.filter((s) => checked[s.id]).length;

            return (
              <div key={c.className} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `2px solid ${gradeColor}` }}>
                  <span className="text-base font-bold text-slate-900">{c.className}</span>
                  <span className="text-sm font-medium text-slate-500">{classDone} / {classTotal}</span>
                </div>
                <div className="flex">
                  <ul className="flex-1 space-y-0.5 p-3">
                    {leftItems.map((s) => (
                      <StudentRow key={s.id} student={s} done={!!checked[s.id]} onToggle={() => onToggle(s.id)} />
                    ))}
                  </ul>
                  <div className="w-px self-stretch bg-slate-200" />
                  <ul className="flex-1 space-y-0.5 p-3">
                    {rightItems.map((s) => (
                      <StudentRow key={s.id} student={s} done={!!checked[s.id]} onToggle={() => onToggle(s.id)} />
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StudentRow({ student, done, onToggle }: { student: Student; done: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        onClick={onToggle}
        aria-pressed={done}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${done ? '' : 'hover:bg-slate-50'}`}
        style={done ? { backgroundColor: 'rgba(29, 158, 117, 0.5)' } : undefined}
      >
        <CheckCircle done={done} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className={`text-sm ${student.crossed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{student.name}</span>
            {student.sat && <SatBadge />}
          </span>
          {student.note && <span className="block text-xs text-amber-600">{student.note}</span>}
        </span>
      </button>
    </li>
  );
}

// ─── Saturday-only / Unassigned banner ──────────────────────────────────────

function SaturdayBanner({
  mode,
  students,
  count,
  checked,
  onToggle,
  assignClasses,
  onAssign,
}: {
  mode: 'checkin' | 'edit';
  students: Student[];
  count: { done: number; total: number };
  checked: Record<string, boolean>;
  onToggle?: (id: string) => void;
  assignClasses?: string[];
  onAssign?: (id: string, cls: string) => void;
}) {
  if (students.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/60 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-bold text-amber-800">Unassigned</span>
        <span className="text-sm font-semibold text-amber-700">{count.done} / {count.total}</span>
      </div>
      <div className="mt-3 space-y-1">
        {students.map((s) => {
          const done = !!checked[s.id];
          if (mode === 'checkin') {
            return (
              <button
                key={s.id}
                onClick={() => onToggle?.(s.id)}
                aria-pressed={done}
                aria-label={`Check in ${s.name}`}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${done ? '' : 'hover:bg-amber-100/60'}`}
                style={done ? { backgroundColor: 'rgba(29, 158, 117, 0.5)' } : undefined}
              >
                <CheckCircle done={done} />
                <span className="text-sm text-slate-800">{s.name}</span>
                {s.sat && <SatBadge />}
              </button>
            );
          }
          return (
            <div key={s.id} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5">
              <span className="text-sm text-slate-800">{s.name}</span>
              {s.sat && <SatBadge />}
              <select
                value=""
                onChange={(e) => { if (e.target.value) onAssign?.(s.id, e.target.value); }}
                className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
              >
                <option value="" disabled>Assign to…</option>
                {(assignClasses ?? []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edit view ──────────────────────────────────────────────────────────────

const UNASSIGNED_SAT = '__unassigned_sat__';
const UNASSIGNED_PLAIN = '__unassigned_plain__';

function EditView({
  grade,
  gradeColor,
  classes,
  bannerStudents,
  bannerCount,
  checked,
  onAdd,
  onAddUnassigned,
  onAssign,
  onRename,
  onRemove,
}: {
  grade: Grade;
  gradeColor: string;
  classes: GroupedClass[];
  bannerStudents: Student[];
  bannerCount: { done: number; total: number };
  checked: Record<string, boolean>;
  onAdd: (grade: Grade, cls: string, name: string, note?: string, gender?: Gender) => Promise<'ok' | 'dup' | 'err'>;
  onAddUnassigned: (grade: Grade, name: string, note?: string, saturdayOnly?: boolean, gender?: Gender) => Promise<'ok' | 'dup' | 'err'>;
  onAssign: (id: string, cls: string) => Promise<'ok' | 'dup' | 'err'>;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [qaGrade, setQaGrade]   = useState<Grade>(grade);
  const [qaClass, setQaClass]   = useState<string>(CLASS_ORDER[grade][0]);
  const [qaGender, setQaGender] = useState<Gender>('M');
  const [qaName, setQaName]     = useState('');
  const [qaNote, setQaNote]     = useState('');
  const [qaMsg, setQaMsg]       = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Follow the active grade tab.
  useEffect(() => {
    setQaGrade(grade);
    setQaClass(CLASS_ORDER[grade][0]);
  }, [grade]);

  async function submitQuickAdd() {
    const name = qaName.trim();
    if (!name) return;
    const isSat = qaClass === UNASSIGNED_SAT;
    const isPlain = qaClass === UNASSIGNED_PLAIN;
    const isUnassigned = isSat || isPlain;
    const where = isSat
      ? `${qaGrade} Saturday list`
      : isPlain
        ? `${qaGrade} unassigned`
        : qaClass;
    const result = isUnassigned
      ? await onAddUnassigned(qaGrade, name, qaNote.trim(), isSat, qaGender)
      : await onAdd(qaGrade, qaClass, name, qaNote.trim(), qaGender);
    if (result === 'dup') {
      setQaMsg({ type: 'warn', text: `"${name}" is already in ${where}.` });
      return;
    }
    if (result === 'err') {
      setQaMsg({ type: 'warn', text: 'Could not add — try again.' });
      return;
    }
    setQaMsg({ type: 'ok', text: `Added ${name} to ${where} ✓` });
    setQaName('');
    setQaNote('');
    nameRef.current?.focus();
  }

  async function handleAssign(id: string, cls: string) {
    const result = await onAssign(id, cls);
    if (result === 'dup') setQaMsg({ type: 'warn', text: `A student with that name is already in ${cls}.` });
    else if (result === 'err') setQaMsg({ type: 'warn', text: 'Could not assign — try again.' });
  }

  return (
    <div className="space-y-6">
      {/* Quick-add bar */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-semibold text-slate-900">Add a student</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={qaGrade}
            onChange={(e) => {
              const g = e.target.value as Grade;
              setQaGrade(g);
              setQaClass(CLASS_ORDER[g][0]);
            }}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            {GRADE_ORDER.map((g) => (
              <option key={g} value={g}>{g} grade</option>
            ))}
          </select>
          <select
            value={qaClass}
            onChange={(e) => setQaClass(e.target.value)}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            {(CLASS_ORDER[qaGrade] ?? []).map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
            <option value={UNASSIGNED_SAT}>Unassigned — Saturday only (SAT)</option>
            <option value={UNASSIGNED_PLAIN}>Unassigned — no class</option>
          </select>
          <select
            value={qaGender}
            onChange={(e) => setQaGender(e.target.value as Gender)}
            className={SELECT_CLASS}
            style={SELECT_STYLE}
          >
            <option value="M">Male (left)</option>
            <option value="F">Female (right)</option>
          </select>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            ref={nameRef}
            value={qaName}
            onChange={(e) => setQaName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitQuickAdd(); } }}
            placeholder="Student name"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
          <input
            value={qaNote}
            onChange={(e) => setQaNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitQuickAdd(); } }}
            placeholder="Note (allergy…) — optional"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
          <button
            onClick={submitQuickAdd}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Add
          </button>
        </div>
        {qaMsg && (
          <p className={`mt-3 text-sm font-medium ${qaMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {qaMsg.text}
          </p>
        )}
      </div>

      {/* Saturday-only / Unassigned banner — assign chips */}
      <SaturdayBanner
        mode="edit"
        students={bannerStudents}
        count={bannerCount}
        checked={checked}
        assignClasses={CLASS_ORDER[grade]}
        onAssign={handleAssign}
      />

      {/* Class cards — wider so both gender columns fit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
        {classes.map((c) => (
          <EditClassCard
            key={c.className}
            grade={grade}
            className={c.className}
            gradeColor={gradeColor}
            left={c.left}
            right={c.right}
            onAdd={onAdd}
            onRename={onRename}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

function EditClassCard({
  grade,
  className,
  gradeColor,
  left,
  right,
  onAdd,
  onRename,
  onRemove,
}: {
  grade: Grade;
  className: string;
  gradeColor: string;
  left: Student[];
  right: Student[];
  onAdd: (grade: Grade, cls: string, name: string, note?: string, gender?: Gender) => Promise<'ok' | 'dup' | 'err'>;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [drafts, setDrafts]   = useState<{ key: number; side: 'L' | 'R' }[]>([]);
  const [cardMsg, setCardMsg] = useState('');
  const counterRef = useRef(0);

  function addDraftRow(side: 'L' | 'R') {
    setCardMsg('');
    setDrafts((d) => [...d, { key: counterRef.current++, side }]);
  }

  async function commitDraft(key: number, side: 'L' | 'R', name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setDrafts((d) => d.filter((r) => r.key !== key));
      return;
    }
    const result = await onAdd(grade, className, trimmed, undefined, side === 'L' ? 'M' : 'F');
    if (result === 'dup') {
      setCardMsg(`"${trimmed}" is already in ${className}.`);
      return; // keep the row so they can fix it
    }
    if (result === 'err') {
      setCardMsg('Could not add — try again.');
      return;
    }
    setDrafts((d) => d.filter((r) => r.key !== key));
  }

  // One column of students (males on the left, females on the right).
  const renderColumn = (items: Student[], side: 'L' | 'R', label: string) => (
    <div className="min-w-0 flex-1 space-y-1.5 p-2.5">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {items.map((s) => (
        <EditStudentRow key={s.id} student={s} onRename={onRename} onRemove={onRemove} />
      ))}
      {drafts.filter((d) => d.side === side).map((d) => (
        <DraftStudentRow
          key={`draft-${d.key}`}
          onCommit={(name) => commitDraft(d.key, side, name)}
          onCancel={() => setDrafts((rows) => rows.filter((r) => r.key !== d.key))}
        />
      ))}
      <button
        onClick={() => addDraftRow(side)}
        className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
      >
        + Add {side === 'L' ? 'male' : 'female'}
      </button>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `2px solid ${gradeColor}` }}>
        <span className="text-base font-bold text-slate-900">{className}</span>
        <span className="text-sm font-medium text-slate-500">{left.length + right.length}</span>
      </div>
      <div className="flex">
        {renderColumn(left, 'L', 'Male')}
        <div className="w-px self-stretch bg-slate-200" />
        {renderColumn(right, 'R', 'Female')}
      </div>
      {cardMsg && <p className="px-4 pb-3 text-xs font-medium text-red-600">{cardMsg}</p>}
    </div>
  );
}

function EditStudentRow({
  student,
  onRename,
  onRemove,
}: {
  student: Student;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState(student.name);

  // Sync if the server value changes (e.g. an edit from another device).
  useEffect(() => { setDraft(student.name); }, [student.name]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { setDraft(student.name); return; }
    if (trimmed !== student.name) onRename(student.id, trimmed);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-full min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
      {student.sat && <SatBadge />}
      <button
        onClick={() => onRemove(student.id)}
        aria-label={`Remove ${student.name}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
      >
        ×
      </button>
    </div>
  );
}

function DraftStudentRow({ onCommit, onCancel }: { onCommit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(value);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="New name"
        className="w-full min-w-0 flex-1 rounded-lg border border-sky-300 bg-sky-50/40 px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
      <button
        onClick={onCancel}
        aria-label="Cancel new student"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-400 transition hover:bg-slate-50"
      >
        ×
      </button>
    </div>
  );
}
