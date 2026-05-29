// One-time migration: move 2026-05-29_goodiebag sessions → 2026-05-17_goodiebag
// Run: node scripts/migrate-may29-goodiebag-to-may17.mjs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SOURCE_KEY = '2026-05-29_goodiebag';
const TARGET_KEY = '2026-05-17_goodiebag';

const snapshot = await db.collection('registrations').get();
console.log(`Loaded ${snapshot.size} registrations.`);

let updatedDocs = 0;
let migratedChildren = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const children = data.children || [];
  let dirty = false;

  const updatedChildren = children.map((child) => {
    const sessions = child.sessions || {};
    if (!sessions[SOURCE_KEY]) return child; // nothing to migrate

    const sourceSession = sessions[SOURCE_KEY];
    const targetSession = sessions[TARGET_KEY];

    // Merge: keep target if it already exists, otherwise move source → target
    const mergedTarget = targetSession ?? sourceSession;

    dirty = true;
    migratedChildren++;
    console.log(`  ✓ ${child.first_name} ${child.last_name} (reg: ${doc.id})`);

    return {
      ...child,
      sessions: {
        ...sessions,
        [TARGET_KEY]: mergedTarget,
        [SOURCE_KEY]: null,
      },
    };
  });

  if (dirty) {
    await doc.ref.update({ children: updatedChildren });
    updatedDocs++;
  }
}

console.log(`\nMigrated ${migratedChildren} child session(s) across ${updatedDocs} registration(s).`);
if (migratedChildren === 0) console.log('No May 29 goodie bag sessions found — nothing to migrate.');
