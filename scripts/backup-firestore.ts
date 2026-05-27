/**
 * Backup all Firestore registrations to a JSON file.
 *
 * Usage:
 *   npx tsx scripts/backup-firestore.ts
 */

import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function run() {
  const snapshot = await db.collection('registrations').get();
  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (!existsSync('backups')) mkdirSync('backups');
  const file = `backups/firestore-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify(data, null, 2));

  console.log(`Backed up ${data.length} registrations to ${file}`);
}

run().catch(console.error);
