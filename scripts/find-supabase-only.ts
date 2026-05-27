import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const firestoreDb = getFirestore(app);

const supabase = createClient(
  'https://jlyhstvqofesiopobkbf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseWhzdHZxb2Zlc2lvcG9ia2JmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY5MTYyNCwiZXhwIjoyMDg5MjY3NjI0fQ.LltHGAgCPa80J_-ISL0ecjy5QQNBE0wnIuPkVJEykGw'
);

async function run() {
  // Get all Supabase registrations with children
  const { data: sbRegs, error } = await supabase
    .from('registrations')
    .select('*, children(*)');
  if (error) throw error;

  // Get all Firestore emails and child names for matching
  const fsSnapshot = await firestoreDb.collection('registrations').get();
  const fsEmails = new Set<string>();
  const fsChildKeys = new Set<string>();
  for (const doc of fsSnapshot.docs) {
    const data = doc.data();
    const email = (data.email || '').toLowerCase().trim();
    if (email) fsEmails.add(email);
    for (const c of (data.children || [])) {
      fsChildKeys.add(`${(c.first_name||'').toLowerCase().trim()}|${(c.last_name||'').toLowerCase().trim()}`);
    }
  }

  console.log(`Supabase: ${sbRegs.length} registrations`);
  console.log(`Firestore: ${fsSnapshot.size} registrations\n`);

  // Find Supabase registrations not in Firestore
  const missing = sbRegs.filter((r) => {
    const email = (r.email || '').toLowerCase().trim();
    if (email && fsEmails.has(email)) return false;
    // Also check by children names
    const children = r.children || [];
    if (children.length > 0 && children.every((c: any) => 
      fsChildKeys.has(`${(c.first_name||'').toLowerCase().trim()}|${(c.last_name||'').toLowerCase().trim()}`)
    )) return false;
    return true;
  });

  console.log(`Missing from Firestore: ${missing.length} registrations\n`);

  for (const reg of missing) {
    console.log(`ID: ${reg.id}`);
    console.log(`  Parent: ${reg.parent_name}`);
    console.log(`  Email: ${reg.email}`);
    console.log(`  Phone: ${reg.phone_number}`);
    console.log(`  Payment: ${reg.payment_status}`);
    console.log(`  Phase: ${reg.registration_phase}`);
    console.log(`  Created: ${reg.created_at}`);
    console.log(`  Children (${reg.children?.length || 0}):`);
    for (const c of (reg.children || [])) {
      console.log(`    - ${c.first_name} ${c.last_name} | grade: ${c.grade} | gender: ${c.gender} | DOB: ${c.date_of_birth} | shirt: ${c.tshirt_size} | allergy: ${c.allergy_information || 'none'} | medical: ${c.medical_notes || 'none'}`);
    }
    console.log('');
  }
}

run().catch(console.error);
