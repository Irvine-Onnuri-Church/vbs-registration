import { NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: 'Token is required.' }, { status: 400 });

    // Find the magic link by token
    const linkSnapshot = await getAdminDb()
      .collection('magic_links')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (linkSnapshot.empty) {
      return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 401 });
    }

    const link = linkSnapshot.docs[0].data();

    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired. Please request a new one.' }, { status: 401 });
    }

    // Fetch all registrations + children for this email
    const regSnapshot = await getAdminDb()
      .collection('registrations')
      .where('email', '==', link.email)
      .orderBy('created_at', 'desc')
      .get();

    const registrations = regSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ registrations, email: link.email });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
