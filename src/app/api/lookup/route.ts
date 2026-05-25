import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const { email, registrationId } = await request.json();

    if (!email || !registrationId) {
      return NextResponse.json({ error: 'Email and registration ID are required.' }, { status: 400 });
    }

    const doc = await getAdminDb().collection('registrations').doc(registrationId.trim()).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'No registration found. Please check your email and registration ID.' }, { status: 404 });
    }

    const data = doc.data()!;
    if (data.email !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'No registration found. Please check your email and registration ID.' }, { status: 404 });
    }

    return NextResponse.json({ registration: { id: doc.id, ...data } });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
