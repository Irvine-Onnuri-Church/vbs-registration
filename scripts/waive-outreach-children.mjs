// One-time update: mark Evan Hwang and Caden Lee as waived outreach attendees
// Sets child.price = 0 and child.waived = true; siblings in the same registration are untouched.
// Run: node scripts/waive-outreach-children.mjs

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const envLines = readFileSync('.env.local', 'utf8').split('\n');
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// [docId, first_name, last_name] of children to waive
const TARGETS = [
  ['ToPxeguYagcDAiUa4C32', 'Evan',  'Hwang'], // 3rd Grade — sibling Jaden stays paid
  ['i413ces8jttWJ3sqBT74', 'Caden', 'Lee'  ], // Pre-K     — siblings Zoey & Gia stay paid
];

for (const [docId, firstName, lastName] of TARGETS) {
  const ref = db.collection('registrations').doc(docId);
  const snap = await ref.get();
  const data = snap.data();

  const children = data.children ?? [];
  let matched = false;

  const updated = children.map((c) => {
    if (c.first_name === firstName && c.last_name === lastName) {
      matched = true;
      console.log(`  ✓ Waiving ${c.first_name} ${c.last_name} (${c.grade}) — was $${c.price}`);
      return { ...c, price: 0, waived: true };
    }
    return c;
  });

  if (!matched) {
    console.error(`  ✗ No match for ${firstName} ${lastName} in doc ${docId}`);
    continue;
  }

  await ref.update({ children: updated });
  console.log(`  Saved doc ${docId}`);
}

console.log('\nDone. Verify with: node scripts/waive-outreach-children.mjs --verify');
