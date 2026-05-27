// One-time script: move specific children to 'beginner' class
// Run with: node scripts/move-to-regular.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const TARGET_CLASS = 'beginner';

// Children to move (matched by name + date_of_birth)
const targets = [
  { name: 'Joel Ock', dob: '2022-10-10' },
];

function matchesTarget(child) {
  const fullName = `${child.first_name ?? ''} ${child.last_name ?? ''}`.trim();
  return targets.some(
    (t) => fullName === t.name && child.date_of_birth === t.dob
  );
}

const snapshot = await db.collection('registrations').get();
let updated = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const children = data.children ?? [];
  let changed = false;

  const newChildren = children.map((c) => {
    if (matchesTarget(c) && c.class !== TARGET_CLASS) {
      console.log(`  Updating: ${c.first_name} ${c.last_name} (dob: ${c.date_of_birth}) — ${c.class ?? 'null'} → ${TARGET_CLASS}`);
      changed = true;
      return { ...c, class: TARGET_CLASS };
    }
    return c;
  });

  if (changed) {
    await doc.ref.update({ children: newChildren });
    updated++;
  }
}

console.log(`\nDone. Updated ${updated} registration document(s).`);
