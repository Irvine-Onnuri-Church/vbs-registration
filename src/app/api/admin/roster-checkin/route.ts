import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '@/lib/firebase';
import { STUDENT_ID_RE } from '@/lib/roster';

// Never cache: this endpoint must always reflect live Firestore state, and the
// browser must never serve a stale (e.g. empty) GET response from its HTTP cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// Single Firestore document holding the shared roster check-in state.
// Shape: { "<student id>": true, ... }  (absent field = not checked in)
const COLLECTION = 'roster_checkin';
const DOC_ID = 'state';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return !!session && session.value === 'authenticated';
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }

  try {
    const snap = await getAdminDb().collection(COLLECTION).doc(DOC_ID).get();
    const data = snap.exists ? snap.data()! : {};
    const checked: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value) checked[key] = true;
    }
    return NextResponse.json({ checked }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[roster-checkin][GET] Firestore read failed:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }

  try {
    const { key, checkedIn } = await request.json();
    if (typeof key !== 'string' || !STUDENT_ID_RE.test(key)) {
      return NextResponse.json({ error: 'Invalid student key.' }, { status: 400, headers: NO_STORE });
    }

    // Merge-set a single field so concurrent check-ins from other devices are never clobbered.
    // Awaited so the 200 is only returned after the write is durably committed.
    const docRef = getAdminDb().collection(COLLECTION).doc(DOC_ID);
    const result = await docRef.set({ [key]: checkedIn ? true : FieldValue.delete() }, { merge: true });
    console.log(`[roster-checkin][POST] ${checkedIn ? 'check' : 'uncheck'} ${key} committed @ ${result.writeTime.toDate().toISOString()}`);

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[roster-checkin][POST] Firestore write failed:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
