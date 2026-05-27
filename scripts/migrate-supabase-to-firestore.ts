/**
 * Migrate specific Supabase registrations to Firestore.
 * Saves a backup before any changes.
 */

import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const firestoreDb = getFirestore(app);

const supabase = createClient(
  'https://jlyhstvqofesiopobkbf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseWhzdHZxb2Zlc2lvcG9ia2JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY5MTYyNCwiZXhwIjoyMDg5MjY3NjI0fQ.LltHGAgCPa80J_-ISL0ecjy5QQNBE0wnIuPkVJEykGw'
);

// IDs to migrate (only genuinely new registrations)
const TO_MIGRATE = [
  'c719cd5a-aefb-4c74-9c80-7482041fec05', // Joo-Ah Shin – parent: Jane Jeong Eun Park
];

async function run() {
  if (!existsSync('backups')) mkdirSync('backups');

  for (const id of TO_MIGRATE) {
    const { data: reg, error } = await supabase
      .from('registrations')
      .select('*, children(*)')
      .eq('id', id)
      .single();

    if (error || !reg) { console.error(`Failed to fetch ${id}:`, error); continue; }

    // Convert to Firestore format
    const phone = reg.phone_number?.replace(/\D/g, '') || '';
    const formattedPhone = phone.length === 10
      ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
      : reg.phone_number || '';

    const emergPhone = reg.emergency_contact_phone?.replace(/\D/g, '') || '';
    const formattedEmergPhone = emergPhone.length === 10
      ? `(${emergPhone.slice(0, 3)}) ${emergPhone.slice(3, 6)}-${emergPhone.slice(6)}`
      : reg.emergency_contact_phone || '';

    const children = (reg.children || []).map((c: any) => {
      const grade = c.grade || '';
      const isPreK = grade.toLowerCase().includes('pre-k') || grade.toLowerCase().includes('prek');
      const price = isPreK ? 50 : 90; // regular phase pricing
      const childClass = isPreK ? 'beginner' : 'regular';

      return {
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        preferred_name: c.preferred_name || null,
        gender: c.gender || '',
        date_of_birth: c.date_of_birth || '',
        age: c.date_of_birth
          ? Math.floor((Date.now() - new Date(c.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null,
        grade,
        tshirt_size: c.tshirt_size || '',
        allergy_information: c.allergy_information || null,
        medical_notes: c.medical_notes || null,
        price,
        class: childClass,
        canceled: false,
      };
    });

    const firestoreDoc = {
      parent_name: reg.parent_name || '',
      email: (reg.email || '').toLowerCase().trim(),
      phone_number: formattedPhone,
      emergency_contact_name: reg.emergency_contact_name || '',
      emergency_contact_phone: formattedEmergPhone,
      photo_consent: reg.photo_consent ?? true,
      liability_acknowledgment: reg.liability_acknowledgment ?? true,
      paypal_order_id: reg.paypal_order_id || null,
      paypal_capture_id: reg.paypal_capture_id || null,
      payment_status: reg.payment_status || 'completed',
      payment_time: reg.payment_time || null,
      total_amount: children.reduce((s: number, c: any) => s + c.price, 0),
      registration_phase: reg.registration_phase || 'regular',
      created_at: reg.created_at || new Date().toISOString(),
      source: 'online',
      children,
    };

    // Save backup
    const backupFile = `backups/migrated-${id}.json`;
    writeFileSync(backupFile, JSON.stringify({ supabase: reg, firestore: firestoreDoc }, null, 2));
    console.log(`Backup saved to ${backupFile}`);

    // Write to Firestore (use Supabase ID as doc ID for traceability)
    await firestoreDb.collection('registrations').doc(id).set(firestoreDoc);

    const names = children.map((c: any) => `${c.first_name} ${c.last_name}`).join(', ');
    console.log(`Added: ${reg.parent_name} (${reg.email}) — children: ${names}`);
  }

  console.log('\nDone.');
}

run().catch(console.error);
