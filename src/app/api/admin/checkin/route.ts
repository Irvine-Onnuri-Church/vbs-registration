import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { registrationId, childIndex, checkedIn, proxyChildren, mode, pickupType } = await request.json();
    const effectiveMode: 'checkin' | 'goodiebag' = mode === 'goodiebag' ? 'goodiebag' : 'checkin';

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

    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `${today}_${effectiveMode}`;
    const existingSessions: Record<string, unknown> = { ...(children[childIndex].sessions || {}) };

    if (effectiveMode === 'goodiebag') {
      if (checkedIn) {
        existingSessions[sessionKey] = {
          status: 'picked_up',
          by: null,
          at: new Date().toISOString(),
          ...(pickupType ? { pickup_type: pickupType } : {}),
          ...(Array.isArray(proxyChildren) && proxyChildren.length ? { alternate_children: proxyChildren } : {}),
        };
      } else {
        // Cancel: null out every goodiebag session key (covers historical dates)
        for (const key of Object.keys(existingSessions)) {
          if (key.endsWith('_goodiebag')) existingSessions[key] = null;
        }
      }

      children[childIndex] = {
        ...children[childIndex],
        sessions: existingSessions,
      };
    } else {
      existingSessions[sessionKey] = checkedIn
        ? { status: 'checked_in', by: null, at: new Date().toISOString() }
        : null;

      children[childIndex] = {
        ...children[childIndex],
        check_in: checkedIn
          ? {
              checked_in: true,
              timestamp: new Date().toISOString(),
              ...(Array.isArray(proxyChildren) && proxyChildren.length ? { proxy_children: proxyChildren } : {}),
            }
          : { checked_in: false, timestamp: null },
        sessions: existingSessions,
      };
    }

    await docRef.update({ children });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
