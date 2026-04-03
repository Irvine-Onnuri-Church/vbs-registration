import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

import { EVENT_INFO } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Check if any registration exists for this email
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .limit(1);

    // Always respond with success to avoid email enumeration
    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Generate token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await supabase.from('magic_links').insert({
      token,
      email: email.toLowerCase().trim(),
      expires_at: expiresAt.toISOString(),
    });

    const magicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://iocvbs.life'}/mypage?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: EVENT_INFO.emailFrom,
      to: email,
      subject: `Your ${EVENT_INFO.name} Registration Link`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0f1e5e;padding:28px 32px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#93c5fd;">${EVENT_INFO.church}</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${EVENT_INFO.name} — ${EVENT_INFO.subtitle}</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">View Your Registration</h2>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;">Click the button below to view all registrations linked to this email. This link expires in 1 hour.</p>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${magicUrl}" style="display:inline-block;background:#f97316;color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:100px;text-decoration:none;">
          View My Registrations →
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
