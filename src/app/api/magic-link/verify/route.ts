import { NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: 'Token is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: link } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .single();

    if (!link) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 401 });
    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired. Please request a new one.' }, { status: 401 });
    }

    // Fetch all registrations + children for this email
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('*, children(*)')
      .eq('email', link.email)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ registrations, email: link.email });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
