/**
 * Set canceled: true for specific children in Firestore.
 *
 * Usage:
 *   npx tsx scripts/set-canceled.ts
 */

import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (!serviceAccount.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set or invalid. Check your .env file.');
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

// Children to cancel: [first_name, last_name, parent email or parent name]
const TO_CANCEL = [
  { first_name: 'Laelle', last_name: 'Jeon', parent_email: 'imclaire7878@gmail.com' },
  { first_name: 'Evan', last_name: 'Kang', parent_email: 'chrisjgy21@gmail.com' },
  { first_name: 'Elle', last_name: 'Chang', parent_email: 'iced.prin@gmail.com' },
];

async function run() {
  const db = getDb();
  const snapshot = await db.collection('registrations').get();

  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const children: Record<string, unknown>[] = data.children || [];
    let changed = false;

    const updatedChildren = children.map((child) => {
      const match = TO_CANCEL.find(
        (tc) =>
          tc.first_name.toLowerCase().trim() === String(child.first_name || '').toLowerCase().trim() &&
          tc.last_name.toLowerCase().trim() === String(child.last_name || '').toLowerCase().trim() &&
          tc.parent_email.toLowerCase() === (data.email || '').toLowerCase(),
      );
      if (match) {
        changed = true;
        console.log(`  Setting canceled: true for ${child.first_name} ${child.last_name} (parent: ${data.parent_name}, doc: ${doc.id})`);
        return { ...child, canceled: true };
      }
      return child;
    });

    if (changed) {
      await doc.ref.update({ children: updatedChildren });
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} registration doc(s).`);
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
