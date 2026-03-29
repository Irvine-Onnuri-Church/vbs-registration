import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, registrationId } = await request.json();

    if (!email || !registrationId) {
      return NextResponse.json({ error: 'Email and registration ID are required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('registrations')
      .select('*, children(*)')
      .eq('id', registrationId.trim())
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'No registration found. Please check your email and registration ID.' }, { status: 404 });
    }

    return NextResponse.json({ registration: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
