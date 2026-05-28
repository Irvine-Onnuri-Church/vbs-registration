import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';

/** POST — toggle check-in for a specific child within a registration */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { registrationId, childIndex, checkedIn, proxyChildren } = await request.json();

    if (!registrationId || childIndex === undefined || checkedIn === undefined) {
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

    children[childIndex] = {
      ...children[childIndex],
      check_in: checkedIn
        ? {
            checked_in: true,
            timestamp: new Date().toISOString(),
            ...(Array.isArray(proxyChildren) && proxyChildren.length ? { proxy_children: proxyChildren } : {}),
          }
        : { checked_in: false, timestamp: null },
    };

    await docRef.update({ children });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
