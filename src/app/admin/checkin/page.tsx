'use client';

import { useEffect, useMemo, useState } from 'react';

import { EVENT_INFO } from '@/lib/constants';

// ─── Data ─────────────────────────────────────────────────────────────────

const GRADE_ORDER = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th'] as const;
type Grade = (typeof GRADE_ORDER)[number];

const GRADE_COLORS: Record<Grade, string> = {
  K: '#74C3DD',
  '1st': '#EE1C24',
  '2nd': '#F0915A',
  '3rd': '#F4CB3C',
  '4th': '#19A64E',
  '5th': '#4C50DF',
  '6th': '#8E2C6C',
};

type ClassRoster = { left: string[]; right: string[] };
type GradeRoster = Record<string, ClassRoster>;

const ROSTER: Record<Grade, GradeRoster> = {
  K: {
    K1: { left: ['Ashet Oh', 'Billy Thompson', 'Earth Kim', 'Ezra Shim', 'Jude Jung', 'Paxton Yoon'], right: ['Ellie Park', 'Evelyn Lee', 'Jay Lee', 'Joelle Wang'] },
    K2: { left: ['Eric Cho', 'Ethan Park', 'Hajun Sa', 'Joshua Hong', 'Yijun Kim'], right: ['Alisa Choi', 'Melody Han', 'Taelin Kim', 'Taylor Kim', 'Himavarsha Kumar', 'Lea Neumann'] },
    K3: { left: ['Aiden Oh', 'Benjamin Jung', 'Ethan Kim', 'Gio Kim', 'Henry Cho', 'Nathan Lee'], right: ['Elena Park', 'Olivia Min', 'Stella Park', 'Yuha Hwang'] },
    K4: { left: ['Gio Kim', 'Robin Song', 'WooJoo Kim'], right: ['Ina Youn', 'Jayla Kim', 'Jisoo Park', 'Leah Seo', 'Seoyoo Lee', 'Suji Han', 'Yuna Kim (05/09/20)'] },
    K5: { left: ['Arthur Chang', 'Inyu Oh', 'Jiho Han', 'Jooho Cha', 'Mason Yoon'], right: ['Byul Kim', 'Joo-Ah Shin', 'Layla Shin', 'Rei Baik', 'Yuna Kim (04/28/20)'] },
    K6: { left: ['Joshua Ock', 'Ryden Chiou', 'Seungmin Ahn', 'Yunu Cho', 'Aryan Patel'], right: ['Dayoon Ko', 'Heejoo Yang', 'Isla Yoon', 'Junie Whang', 'Sofia Kim'] },
    K7: { left: ['Asher Kim', 'Gio Park', 'Ian Lee', 'Jordan Rough'], right: ['Eliana Kim', 'Erin Kim', 'Gianna Yoo', 'Hyenah Song', 'Noelle Choi'] },
  },
  '1st': {
    '1A': { left: ['Aiden Park', 'Gio Lee', 'Brent Carballo', 'Sky Jung', 'Seogeun Lee'], right: ['Leah He', 'Elise Kim', 'Chloe Liang', 'Ria Choi'] },
    '1B': { left: ['Noah Baek', 'Joshua Kim', 'Jacob Hong', 'Leo Jeong', 'Roy Chang'], right: ['Shanvika Karumujji', 'Olivia Chang', 'Emmy Neumann'] },
    '1C': { left: ['Akshiv Gupta', 'Sebastian Lee', 'Daniel Park', 'Sean Kim'], right: ['Allison Kwon', 'Hailey Kim', 'Joy Kim', 'Faith Ha'] },
    '1D': { left: ['Ethan Chang', 'Yohan Jang', 'Jacob Kim', 'Daniel Lee', 'Ian Choi'], right: ['Olivia Pai', 'Everlyn Oh', 'Ellis Kim'] },
    '1E': { left: ['Aisultan Ural', 'Benjamin Serpa', 'Heewon Ku', 'Ethan Lee', 'Eden Moon'], right: ['Heidi Han', 'Karley Fung', 'Jayleen Hur'] },
  },
  '2nd': {
    '2A': { left: ['Cayden Won', 'Simon Park', 'Christian Oh', 'Nathaniel Ha'], right: ['Audrey Nam', 'Eleanor Yune', 'Claire Chang', 'Emma Yang', 'Yejee Bang'] },
    '2B': { left: ['Charlie Whang', 'Aiden Kim', 'Matthew Kim'], right: ['Paige Chong', 'Calla Rough', 'Maxine Koh-Parsons', 'Yuha Kim', 'Jeongyoon Moon', 'Gian Kim'] },
    '2C': { left: ['Ellis Baik', 'Dylan Lee', 'Brian Song'], right: ['Dana Kim', 'Corrie Whang', 'Alena Bueno', 'Lindsay Liew', 'Jaea Choi', 'Yullie Jung'] },
  },
  '3rd': {
    '3A': { left: ['Liam Choi', 'Hageun Lee', 'Siwoo Yang', 'Jacob Choi'], right: ['Emma Medina', 'Seoyeong Lee', 'Soul Lee', 'Clover Jung', 'Rena Oh', 'Lily Park'] },
    '3B': { left: ['Evan Hwang', 'Aabhash Patel', 'Elliott Chang'], right: ['Chelsea Mawji', 'Priscilla Ryu', 'Kaitlyn Kim', 'Adelynn Won', 'Soul Kim', 'Chloe Kwon'] },
    '3C': { left: ['Luke Lim', 'Asher Eom', 'Jiun Lim'], right: ['Joy Kim', 'Jamie Lee', 'Olivia Park', 'Valentina Torres', 'Ellie Choi', 'Elisha Kim'] },
  },
  '4th': {
    '4A': { left: ['Evan Yang', 'Aaron Yoo', 'Leon Jeong', 'Haejin Kim', 'Luke Kim'], right: ['Jane Richardson', 'Joy Kim', 'Janet Hur', 'Liann Kim'] },
    '4B': { left: ['Daniel Kim', 'Clayton Choi', 'Shaun Kim', 'Roy Kim'], right: ['Charlotte Liang', 'Ashley Xiao', 'Ailyn Kim', 'Mackenzie Kim'] },
    '4C': { left: ['Jeremy Liew', 'Darron Lee', 'Youngmin Park', 'Timothy Park'], right: ['Charlotte Mawji', 'Hayeon Cho', 'Jimin Park', 'Amy Kim'] },
    '4D': { left: ['Daniel Lee', 'Joshua Park', 'Evan Baik', 'Logan Shin', 'Jonathan Ryu'], right: ['Jiyu Song', 'Terri Kim', 'Seoyoon Ko'] },
    '4E': { left: ['Elias Kim', 'Ian Lee', 'Caleb Lee', 'Elliot Hong', 'Blake Carballo'], right: ['Isabel Choi', 'Kaylee Kim', 'Mina Kim'] },
  },
  '5th': {
    '5A': { left: ['Nathan Jung', 'Siho Yang', 'Eugene Kim', 'Andy Song', 'Elijah Shin', 'Rihwan Kim', 'Daniel Kim', 'Jaeyul Ryu'], right: ['Eunhu Lee', 'Hara Jang', 'Charlotte Chiou'] },
    '5B': { left: ['Emiliano Medina', 'Asher Oh', 'Jackson Fung', 'Harrison Lee', 'Jaden Hwang'], right: ['Sofia Torres', 'Yein Park', 'Faith Lee', 'Ellie Jung'] },
    '5C': { left: ['Jackson Koh-Parsons', 'Jeonghun Yeom', 'Robin Kim', 'Samuel Moon', 'Nathan Choi', 'Jake Kang', 'Jonah Min'], right: ['Jenny Kim', 'Eliana Park', 'Celine Chang', 'Geo Kwak'] },
  },
  '6th': {
    '6A': { left: ['Jayden Hur', 'Micah Chang', 'Ethan Eom', 'Jonah Min'], right: ['Kiwi Gupta', 'Audrey Han', 'Rachel Kahng', 'Euna Kim'] },
    '6B': { left: ['Ethan Song', 'Heesoo Yang', 'James Kim', 'Noul Lee'], right: ['Yumin Kim', 'Seohee Cho', 'Jordan Lee'] },
  },
};

const STORAGE_KEY = 'vbs-checkin-v1';
const CHECKED_GREEN = '#1D9E75';

// Perceived-luminance pick: dark text on light fills (K, 3rd), white on the rest.
function textColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= 170 ? '#222' : '#fff';
}

// Stable per-student key (handles duplicate names across classes/columns).
function studentKey(grade: Grade, className: string, side: 'L' | 'R', index: number): string {
  return `${grade}|${className}|${side}|${index}`;
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

  // Load persisted check-in state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  // Persist on every change (after initial hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore quota errors */
    }
  }, [checked, hydrated]);

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
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

  const gradeColor = GRADE_COLORS[selectedGrade];
  const classes = ROSTER[selectedGrade] ?? {};
  const searchLower = search.trim().toLowerCase();

  // Live grade-wide checked / total count (independent of search).
  const gradeCount = useMemo(() => {
    let total = 0;
    let done = 0;
    Object.entries(classes).forEach(([className, roster]) => {
      roster.left.forEach((_, i) => {
        total += 1;
        if (checked[studentKey(selectedGrade, className, 'L', i)]) done += 1;
      });
      roster.right.forEach((_, i) => {
        total += 1;
        if (checked[studentKey(selectedGrade, className, 'R', i)]) done += 1;
      });
    });
    return { done, total };
  }, [classes, checked, selectedGrade]);

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

  // ─── Check-in ───────────────────────────────────────────────────────────────

  const classEntries = Object.entries(classes);
  const hasRoster = classEntries.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Check-in</h1>
        <p className="text-sm text-slate-500">
          {EVENT_INFO.name} · {EVENT_INFO.subtitle} · {EVENT_INFO.dates}
        </p>
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

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
        <span className="text-lg font-bold" style={{ color: gradeColor }}>
          {selectedGrade} Grade
        </span>
        <span className="text-base font-medium text-slate-600">
          {gradeCount.done} / {gradeCount.total} checked in
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search students in ${selectedGrade} grade…`}
        className="w-full max-w-md rounded-2xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />

      {/* Classes */}
      {!hasRoster ? (
        <p className="py-12 text-center text-sm text-slate-500">No roster yet for {selectedGrade} grade.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '1rem',
          }}
        >
          {classEntries.map(([className, roster]) => {
            const matches = (name: string) => !searchLower || name.toLowerCase().includes(searchLower);

            const leftItems = roster.left
              .map((name, i) => ({ name, i, key: studentKey(selectedGrade, className, 'L', i) }))
              .filter((s) => matches(s.name));
            const rightItems = roster.right
              .map((name, i) => ({ name, i, key: studentKey(selectedGrade, className, 'R', i) }))
              .filter((s) => matches(s.name));

            // Hide a class card entirely if the search excludes all of its students.
            if (searchLower && leftItems.length === 0 && rightItems.length === 0) return null;

            const classTotal = roster.left.length + roster.right.length;
            const classDone =
              roster.left.filter((_, i) => checked[studentKey(selectedGrade, className, 'L', i)]).length +
              roster.right.filter((_, i) => checked[studentKey(selectedGrade, className, 'R', i)]).length;

            return (
              <div key={className} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `2px solid ${gradeColor}` }}
                >
                  <span className="text-base font-bold text-slate-900">{className}</span>
                  <span className="text-sm font-medium text-slate-500">
                    {classDone} / {classTotal}
                  </span>
                </div>

                {/* Card body: two columns + divider */}
                <div className="flex">
                  <ul className="flex-1 space-y-0.5 p-3">
                    {leftItems.map((s) => (
                      <StudentRow key={s.key} name={s.name} done={!!checked[s.key]} onToggle={() => toggle(s.key)} />
                    ))}
                  </ul>
                  <div className="w-px self-stretch bg-slate-200" />
                  <ul className="flex-1 space-y-0.5 p-3">
                    {rightItems.map((s) => (
                      <StudentRow key={s.key} name={s.name} done={!!checked[s.key]} onToggle={() => toggle(s.key)} />
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Student row ──────────────────────────────────────────────────────────

function StudentRow({ name, done, onToggle }: { name: string; done: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        onClick={onToggle}
        aria-pressed={done}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50"
      >
        {done ? (
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: CHECKED_GREEN }}
          >
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
        )}
        <span className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{name}</span>
      </button>
    </li>
  );
}
