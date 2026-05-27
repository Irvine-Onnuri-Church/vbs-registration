/**
 * Delete specific registration documents from Firestore.
 * Saves a backup JSON before each deletion for recovery.
 *
 * Usage:
 *   npx tsx scripts/find-and-delete.ts
 */

import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (!serviceAccount.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set or invalid. Check your .env file.');
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

// Registration doc IDs to delete entirely
const TO_DELETE = [
  '4521888d-e35e-443a-802a-8d067578fd6d', // Duplicate Rachel (Yena) Kahng – Supabase migration leftover
  '161d596e-638e-4f1d-bae1-0f803a885dfb', // Duplicate Emma Yang – Supabase migration leftover
  '6b565119-7b6c-40ef-9ac0-3cad262b6765', // Duplicate Ethan + Arthur Chang – Supabase migration leftover
];

const BACKUP_DIR = 'backups';

async function run() {
  const db = getDb();

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR);

  const deleted: { id: string; data: FirebaseFirestore.DocumentData }[] = [];

  for (const docId of TO_DELETE) {
    const ref = db.collection('registrations').doc(docId);
    const doc = await ref.get();

    if (!doc.exists) {
      console.log(`Doc ${docId} not found, skipping.`);
      continue;
    }

    const data = doc.data()!;
    const children = (data.children || []) as { first_name: string; last_name: string }[];
    const names = children.map((c) => `${c.first_name} ${c.last_name}`).join(', ');

    // Save backup before deleting
    deleted.push({ id: docId, data });
    console.log(`Deleting doc ${docId} (parent: ${data.parent_name}, children: ${names})`);

    await ref.delete();
    console.log(`  Deleted.`);
  }

  if (deleted.length > 0) {
    const backupFile = `${BACKUP_DIR}/deleted-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(backupFile, JSON.stringify(deleted, null, 2));
    console.log(`\nBackup saved to ${backupFile}`);
  }

  console.log('\nDone.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
