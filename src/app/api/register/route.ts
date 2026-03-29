import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';
import { calculateChildPrice } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { parentInfo, children, photoConsent, liabilityAcknowledgment, paypalOrderId, earlyRegistration, registrationPhase } =
      await request.json();

    // Recalculate total server-side
    const totalAmount: number = children.reduce((sum: number, child: { grade: string }) => {
      return sum + calculateChildPrice(child.grade, earlyRegistration);
    }, 0);

    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .insert({
        parent_name: parentInfo.parentName,
        email: parentInfo.email,
        phone_number: parentInfo.phoneNumber,
        emergency_contact_name: parentInfo.emergencyContactName,
        emergency_contact_phone: parentInfo.emergencyContactPhoneNumber,
        photo_consent: photoConsent,
        liability_acknowledgment: liabilityAcknowledgment,
        paypal_order_id: paypalOrderId,
        payment_status: 'completed',
        total_amount: totalAmount,
        registration_phase: registrationPhase,
      })
      .select('id')
      .single();

    if (regError) {
      return NextResponse.json({ error: regError.message }, { status: 500 });
    }

    const childRows = children.map((child: {
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
    }) => ({
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

    return NextResponse.json({ success: true, registrationId: registration.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
