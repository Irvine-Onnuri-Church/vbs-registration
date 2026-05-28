// One-time fix: move medical info from medical_notes → allergy_information
// for children where medical_notes contains health/medical content (not a friend name).
// Run with: node scripts/move-medical-to-allergy.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const snapshot = await db.collection('registrations').get();

// Keywords that indicate the field holds medical/health info, not a friend name
const MEDICAL_KEYWORDS = ['autistic', 'allerg', 'asthma', 'diabetes', 'epipen', 'inhaler', 'medic', 'disability', 'extra help', 'accommodate', 'special need'];

let updated = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const children = data.children ?? [];
  let changed = false;

  const newChildren = children.map((c) => {
    const notes = (c.medical_notes ?? '').trim();
    if (!notes) return c;

    const lc = notes.toLowerCase();
    const isMedical = MEDICAL_KEYWORDS.some((kw) => lc.includes(kw));
    if (!isMedical) return c;

    // Append to existing allergy_information, or set it fresh
    const existing = (c.allergy_information ?? '').trim();
    const merged = existing ? `${existing}; ${notes}` : notes;

    console.log(`  Child: ${c.first_name} ${c.last_name} (doc: ${doc.id})`);
    console.log(`    medical_notes   → "${notes}"`);
    console.log(`    allergy_information (before) → "${existing || '(empty)'}"`);
    console.log(`    allergy_information (after)  → "${merged}"`);

    changed = true;
    return { ...c, allergy_information: merged, medical_notes: '' };
  });

  if (changed) {
    await doc.ref.update({ children: newChildren });
    updated++;
  }
}

console.log(`\nDone. Updated ${updated} registration document(s).`);
