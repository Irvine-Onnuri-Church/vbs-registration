import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '@/lib/firebase';

// Single Firestore document holding the shared roster check-in state.
// Shape: { "<grade>|<class>|<L|R>|<index>": true, ... }  (absent field = not checked in)
const COLLECTION = 'roster_checkin';
const DOC_ID = 'state';

// Matches the stable per-student key produced by the check-in page.
const KEY_RE = /^(K|1st|2nd|3rd|4th|5th|6th)\|[A-Za-z0-9]+\|[LR]\|\d+$/;

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return !!session && session.value === 'authenticated';
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const snap = await getAdminDb().collection(COLLECTION).doc(DOC_ID).get();
    const data = snap.exists ? snap.data()! : {};
    const checked: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value) checked[key] = true;
    }
    return NextResponse.json({ checked });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { key, checkedIn } = await request.json();
    if (typeof key !== 'string' || !KEY_RE.test(key)) {
      return NextResponse.json({ error: 'Invalid student key.' }, { status: 400 });
    }

    // Merge-set a single field so concurrent check-ins from other devices are never clobbered.
    const docRef = getAdminDb().collection(COLLECTION).doc(DOC_ID);
    await docRef.set({ [key]: checkedIn ? true : FieldValue.delete() }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
