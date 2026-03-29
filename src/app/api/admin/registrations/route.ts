import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');

  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('registrations')
    .select('*, children(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ registrations: data });
}
