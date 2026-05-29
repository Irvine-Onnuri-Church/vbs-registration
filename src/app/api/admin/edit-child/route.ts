import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';

/** POST — edit fields on a specific child, with history tracking */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { registrationId, childIndex, changes } = await request.json();

    if (!registrationId || childIndex === undefined || !changes || typeof changes !== 'object') {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('registrations').doc(registrationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    const data = doc.data()!;
    const children = [...(data.children || [])];

    if (childIndex < 0 || childIndex >= children.length) {
      return NextResponse.json({ error: 'Invalid child index.' }, { status: 400 });
    }

    const child = { ...children[childIndex] };
    const editHistory: Array<{ field: string; old_value: string; new_value: string; edited_at: string }> = child.edit_history || [];
    const now = new Date().toISOString();

    // Apply each changed field
    for (const [field, newValue] of Object.entries(changes)) {
      const oldValue = String(child[field] ?? '');
      const newVal = String(newValue);
      if (oldValue !== newVal) {
        editHistory.push({ field, old_value: oldValue, new_value: newVal, edited_at: now });
        child[field] = newValue;
      }
    }

    child.edit_history = editHistory;
    children[childIndex] = child;

    await docRef.update({ children });

    return NextResponse.json({ success: true, child });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — undo the last edit on a specific child */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { registrationId, childIndex } = await request.json();

    if (!registrationId || childIndex === undefined) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('registrations').doc(registrationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
    }

    const data = doc.data()!;
    const children = [...(data.children || [])];

    if (childIndex < 0 || childIndex >= children.length) {
      return NextResponse.json({ error: 'Invalid child index.' }, { status: 400 });
    }

    const child = { ...children[childIndex] };
    const editHistory: Array<{ field: string; old_value: string; new_value: string; edited_at: string }> = [...(child.edit_history || [])];

    if (editHistory.length === 0) {
      return NextResponse.json({ error: 'No edits to undo.' }, { status: 400 });
    }

    // Pop last edit and restore old value
    const lastEdit = editHistory.pop()!;
    child[lastEdit.field] = lastEdit.old_value;
    child.edit_history = editHistory;
    children[childIndex] = child;

    await docRef.update({ children });

    return NextResponse.json({ success: true, undone: lastEdit, child });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
