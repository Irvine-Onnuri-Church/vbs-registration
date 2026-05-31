import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/firebase';
import { calculateChildPrice } from '@/lib/utils';

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

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { parentInfo, children, photoConsent } = await request.json();

    const childRows = children.map((child: any) => ({
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
      price: child.price ? parseFloat(child.price) : calculateChildPrice(child.grade, true),
      payment_type: child.paymentType || null,
      payment_notes: child.paymentNotes || null,
      canceled: false,
      created_at: new Date().toISOString(),
    }));

    const totalAmount = childRows.reduce((s: number, c: any) => s + c.price, 0);
    const paymentTypes = [...new Set(children.map((c: any) => c.paymentType).filter(Boolean))];

    const docRef = await getAdminDb().collection('registrations').add({
      parent_name: parentInfo.parentName,
      email: parentInfo.email.toLowerCase().trim(),
      phone_number: parentInfo.phoneNumber,
      emergency_contact_name: parentInfo.emergencyContactName,
      emergency_contact_phone: parentInfo.emergencyContactPhone,
      photo_consent: photoConsent ?? false,
      liability_acknowledgment: true,
      paypal_order_id: null,
      payment_status: paymentTypes.length > 0 ? paymentTypes.join(', ') : 'admin_added',
      total_amount: totalAmount,
      registration_phase: 'admin',
      created_at: new Date().toISOString(),
      children: childRows,
    });

    return NextResponse.json({ success: true, registrationId: docRef.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
