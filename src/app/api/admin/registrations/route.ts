import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');

  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const snapshot = await getAdminDb()
      .collection('registrations')
      .orderBy('created_at', 'desc')
      .get();

    const registrations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ registrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
