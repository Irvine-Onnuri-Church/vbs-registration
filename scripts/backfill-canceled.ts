/**
 * Backfill `canceled: false` on every child in every registration document.
 *
 * Usage:
 *   npx tsx scripts/backfill-canceled.ts
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

async function run() {
  const db = getDb();
  const snapshot = await db.collection('registrations').get();

  let totalChildren = 0;
  let updatedDocs = 0;

  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const children: Record<string, unknown>[] = data.children || [];

    const updatedChildren = children.map((child) => ({
      ...child,
      canceled: child.canceled ?? false,
    }));

    totalChildren += children.length;

    batch.update(doc.ref, { children: updatedChildren });
    updatedDocs++;
  }

  await batch.commit();

  console.log(`Done. Updated ${updatedDocs} registration docs (${totalChildren} children) with canceled: false.`);
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
