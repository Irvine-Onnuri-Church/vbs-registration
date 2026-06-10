import { randomUUID } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '@/lib/firebase';
import {
  buildSeedMap,
  CLASS_ORDER,
  GRADE_ORDER,
  STUDENT_ID_RE,
  type Grade,
  type RosterMap,
  type StudentRecord,
} from '@/lib/roster';

// Always live, never cached — the browser must never serve a stale roster.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// Roster source of truth: a single Firestore doc mapping student id -> record.
const ROSTER_COLLECTION = 'roster';
const ROSTER_DOC = 'students';
// Check-in store (kept in sync on removal).
const CHECKIN_COLLECTION = 'roster_checkin';
const CHECKIN_DOC = 'state';

const MAX_NAME = 100;
const MAX_NOTE = 200;

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return !!session && session.value === 'authenticated';
}

function rosterRef() {
  return getAdminDb().collection(ROSTER_COLLECTION).doc(ROSTER_DOC);
}

// Idempotent one-time seed. `create()` is atomic and fails-if-exists, so
// concurrent first-loads can't double-seed — exactly one create wins.
async function ensureSeeded() {
  const ref = rosterRef();
  const snap = await ref.get();
  if (!snap.exists) {
    try {
      await ref.create(buildSeedMap());
    } catch {
      /* created concurrently — fine */
    }
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }

  try {
    await ensureSeeded();
    const snap = await rosterRef().get();
    const students = (snap.data() as RosterMap | undefined) ?? {};
    return NextResponse.json({ students }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[roster][GET] failed:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }

  try {
    const body = await request.json();
    const op = body?.op;

    if (op === 'add') return await handleAdd(body);
    if (op === 'assign') return await handleAssign(body);
    if (op === 'rename') return await handleRename(body);
    if (op === 'remove') return await handleRemove(body);

    return NextResponse.json({ error: 'Unknown op.' }, { status: 400, headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[roster][POST] failed:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

async function handleAdd(body: { grade?: unknown; cls?: unknown; name?: unknown; note?: unknown; saturdayOnly?: unknown; unassigned?: unknown }) {
  const grade = body.grade as Grade;
  const cls = typeof body.cls === 'string' ? body.cls : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
  const saturdayOnly = body.saturdayOnly === true;
  // A Saturday-only student created with no class is "unassigned" — it lives in
  // the banner until an admin assigns it to a class.
  const wantUnassigned = saturdayOnly && (body.unassigned === true || !cls);

  if (!GRADE_ORDER.includes(grade)) {
    return NextResponse.json({ error: 'Invalid grade.' }, { status: 400, headers: NO_STORE });
  }
  if (!wantUnassigned && !(CLASS_ORDER[grade] ?? []).includes(cls)) {
    return NextResponse.json({ error: 'Invalid class.' }, { status: 400, headers: NO_STORE });
  }
  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: 'Invalid name.' }, { status: 400, headers: NO_STORE });
  }

  await ensureSeeded();
  const ref = rosterRef();
  const db = getAdminDb();

  // Transaction so the dup-check, shorter-column choice, and next-order are all
  // computed against a consistent snapshot.
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const map = (snap.data() as RosterMap | undefined) ?? {};

    // Pool to dedupe / order against: the unassigned-Saturday list for the grade,
    // or the target class otherwise.
    const pool = wantUnassigned
      ? Object.values(map).filter((r) => r.grade === grade && r.saturdayOnly && !r.cls)
      : Object.values(map).filter((r) => r.grade === grade && r.cls === cls);

    if (pool.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
      return { duplicate: true as const };
    }

    let col: 'L' | 'R';
    let order: number;
    if (wantUnassigned) {
      col = 'L'; // column is irrelevant for the banner; keep a stable value
      order = pool.reduce((m, r) => Math.max(m, r.order), -1) + 1;
    } else {
      const leftCount = pool.filter((r) => r.col === 'L').length;
      const rightCount = pool.filter((r) => r.col === 'R').length;
      col = leftCount <= rightCount ? 'L' : 'R';
      order = pool.filter((r) => r.col === col).reduce((m, r) => Math.max(m, r.order), -1) + 1;
    }

    const id = `new|${randomUUID()}`;
    const student: StudentRecord = {
      grade,
      cls: wantUnassigned ? '' : cls,
      col,
      order,
      name,
      note,
      ...(saturdayOnly ? { saturdayOnly: true } : {}),
    };
    tx.set(ref, { [id]: student }, { merge: true });
    return { id, student };
  });

  if ('duplicate' in result) {
    return NextResponse.json(
      { error: 'Duplicate name.', duplicate: true },
      { status: 409, headers: NO_STORE },
    );
  }

  console.log(`[roster][POST] add ${result.id} (${name}) -> ${grade}/${result.student.cls || 'UNASSIGNED'}/${result.student.col}`);
  return NextResponse.json({ success: true, id: result.id, student: result.student }, { headers: NO_STORE });
}

// Assign an (unassigned Saturday) student to a real class: sets cls/col/order,
// preserves saturdayOnly/name/note. Returns 409 on a name clash in the target.
async function handleAssign(body: { id?: unknown; cls?: unknown }) {
  const id = typeof body.id === 'string' ? body.id : '';
  const cls = typeof body.cls === 'string' ? body.cls : '';

  if (!STUDENT_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400, headers: NO_STORE });
  }
  if (!/^[A-Za-z0-9]+$/.test(cls)) {
    return NextResponse.json({ error: 'Invalid class.' }, { status: 400, headers: NO_STORE });
  }

  await ensureSeeded();
  const ref = rosterRef();
  const db = getAdminDb();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const map = (snap.data() as RosterMap | undefined) ?? {};
    const rec = map[id];
    if (!rec) return { missing: true as const };
    if (!(CLASS_ORDER[rec.grade] ?? []).includes(cls)) return { badClass: true as const };

    const inClass = Object.entries(map).filter(([k, r]) => k !== id && r.grade === rec.grade && r.cls === cls);
    if (inClass.some(([, r]) => r.name.trim().toLowerCase() === rec.name.trim().toLowerCase())) {
      return { duplicate: true as const };
    }

    const leftCount = inClass.filter(([, r]) => r.col === 'L').length;
    const rightCount = inClass.filter(([, r]) => r.col === 'R').length;
    const col: 'L' | 'R' = leftCount <= rightCount ? 'L' : 'R';
    const order = inClass.filter(([, r]) => r.col === col).reduce((m, [, r]) => Math.max(m, r.order), -1) + 1;

    tx.set(ref, { [id]: { cls, col, order } }, { merge: true });
    return { ok: true as const, col };
  });

  if ('missing' in result) return NextResponse.json({ error: 'Student not found.' }, { status: 404, headers: NO_STORE });
  if ('badClass' in result) return NextResponse.json({ error: 'Invalid class.' }, { status: 400, headers: NO_STORE });
  if ('duplicate' in result) return NextResponse.json({ error: 'Duplicate name.', duplicate: true }, { status: 409, headers: NO_STORE });

  console.log(`[roster][POST] assign ${id} -> ${cls}/${result.col}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

async function handleRename(body: { id?: unknown; name?: unknown; note?: unknown }) {
  const id = typeof body.id === 'string' ? body.id : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!STUDENT_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400, headers: NO_STORE });
  }
  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: 'Invalid name.' }, { status: 400, headers: NO_STORE });
  }

  // Deep merge-set: preserves sibling fields (grade/cls/col/order/note).
  const patch: Record<string, unknown> = { name };
  if (typeof body.note === 'string') patch.note = body.note.trim().slice(0, MAX_NOTE);

  await rosterRef().set({ [id]: patch }, { merge: true });
  console.log(`[roster][POST] rename ${id} -> ${name}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

async function handleRemove(body: { id?: unknown }) {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!STUDENT_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400, headers: NO_STORE });
  }

  const db = getAdminDb();
  // Remove from the roster AND its check-in entry; await both before returning.
  await Promise.all([
    db.collection(ROSTER_COLLECTION).doc(ROSTER_DOC).set({ [id]: FieldValue.delete() }, { merge: true }),
    db.collection(CHECKIN_COLLECTION).doc(CHECKIN_DOC).set({ [id]: FieldValue.delete() }, { merge: true }),
  ]);

  console.log(`[roster][POST] remove ${id}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
