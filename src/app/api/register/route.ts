import { Resend } from 'resend';
import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';
import { EVENT_INFO } from '@/lib/constants';
import { calculateChildPrice, formatCurrency } from '@/lib/utils';

type ChildInput = {
  firstName: string;
  lastName: string;
  preferredName: string;
  gender: string;
  dateOfBirth: string;
  age: string;
  grade: string;
  tshirtSize: string;
  allergyInformation: string;
  medicalNotes: string;
};

function buildConfirmationEmail(
  parentName: string,
  registrationId: string,
  children: ChildInput[],
  totalAmount: number,
  earlyRegistration: boolean,
): string {
  const childRows = children
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${c.firstName} ${c.lastName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${c.grade}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${formatCurrency(calculateChildPrice(c.grade, earlyRegistration))}</td>
      </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#fef08a,#bae6fd);padding:32px 32px 24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#0284c7;">${EVENT_INFO.church}</p>
      <h1 style="margin:0;font-size:28px;font-weight:700;color:#0c4a6e;">${EVENT_INFO.name} — ${EVENT_INFO.subtitle}</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#475569;font-style:italic;">${EVENT_INFO.scripture}</p>
    </div>

    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Registration Confirmed!</h2>
      <p style="margin:0 0 24px;color:#475569;">Dear ${parentName}, your registration is complete. Please save your Registration ID below to look up your registration at any time.</p>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#0284c7;">Registration ID</p>
        <p style="margin:0;font-size:14px;font-family:monospace;color:#0c4a6e;word-break:break-all;">${registrationId}</p>
      </div>

      <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;">Registered Children</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Name</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Grade</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Fee</th>
          </tr>
        </thead>
        <tbody>${childRows}</tbody>
      </table>

      <div style="background:#0f172a;border-radius:12px;padding:16px;display:flex;justify-content:space-between;margin-bottom:24px;">
        <span style="color:#cbd5e1;font-size:14px;font-weight:600;">Total Paid</span>
        <span style="color:#ffffff;font-size:16px;font-weight:700;">${formatCurrency(totalAmount)}</span>
      </div>

      <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-size:13px;color:#64748b;">
        <p style="margin:0 0 6px;"><strong style="color:#0f172a;">Dates:</strong> ${EVENT_INFO.dates}</p>
        <p style="margin:0 0 6px;"><strong style="color:#0f172a;">Times:</strong> ${EVENT_INFO.times}</p>
        <p style="margin:0 0 6px;"><strong style="color:#0f172a;">Location:</strong> ${EVENT_INFO.location}</p>
        <p style="margin:0 0 16px;color:#94a3b8;">${EVENT_INFO.address}</p>
        <p style="margin:0 0 4px;">Questions? Contact <strong>${EVENT_INFO.contactName}</strong></p>
        <p style="margin:0;">${EVENT_INFO.contactPhone}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const { parentInfo, children, photoConsent, liabilityAcknowledgment, paypalOrderId, paypalCaptureId, paymentTime, earlyRegistration, registrationPhase } =
      await request.json();

    const totalAmount: number = children.reduce((sum: number, child: ChildInput) => {
      return sum + calculateChildPrice(child.grade, earlyRegistration);
    }, 0);

    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .insert({
        parent_name: parentInfo.parentName,
        email: parentInfo.email.toLowerCase().trim(),
        phone_number: parentInfo.phoneNumber,
        emergency_contact_name: parentInfo.emergencyContactName,
        emergency_contact_phone: parentInfo.emergencyContactPhoneNumber,
        photo_consent: photoConsent,
        liability_acknowledgment: liabilityAcknowledgment,
        paypal_order_id: paypalOrderId,
        paypal_capture_id: paypalCaptureId ?? null,
        payment_status: 'completed',
        payment_time: paymentTime ?? null,
        total_amount: totalAmount,
        registration_phase: registrationPhase,
      })
      .select('id')
      .single();

    if (regError) {
      return NextResponse.json({ error: regError.message }, { status: 500 });
    }

    const childRows = children.map((child: ChildInput) => ({
      registration_id: registration.id,
      first_name: child.firstName,
      last_name: child.lastName,
      preferred_name: child.preferredName || null,
      gender: child.gender,
      date_of_birth: child.dateOfBirth,
      age: child.age ? parseInt(child.age) : null,
      grade: child.grade,
      tshirt_size: child.tshirtSize,
      allergy_information: child.allergyInformation || null,
      medical_notes: child.medicalNotes || null,
      price: calculateChildPrice(child.grade, earlyRegistration),
    }));

    const { error: childrenError } = await supabase.from('children').insert(childRows);

    if (childrenError) {
      return NextResponse.json({ error: childrenError.message }, { status: 500 });
    }

    // Send confirmation email (non-blocking — don't fail registration if email fails)
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: EVENT_INFO.emailFrom,
        to: parentInfo.email,
        subject: `${EVENT_INFO.name} Registration Confirmed — ${parentInfo.parentName}`,
        html: buildConfirmationEmail(
          parentInfo.parentName,
          registration.id,
          children,
          totalAmount,
          earlyRegistration,
        ),
      });
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
    }

    return NextResponse.json({ success: true, registrationId: registration.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
