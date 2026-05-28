// Audit: list Beginner VBS children by phase
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const snapshot = await db.collection('registrations').orderBy('created_at', 'asc').get();

const early = [];
const regular = [];

for (const doc of snapshot.docs) {
  const data = doc.data();
  const phase = data.registration_phase;
  const date = new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  for (const c of (data.children ?? [])) {
    const cls = c.class ?? (c.grade === 'Pre-K' ? 'beginner' : 'regular');
    if (cls !== 'beginner') continue;
    const entry = `  ${date.padEnd(7)}  ${`${c.first_name} ${c.last_name}`.padEnd(30)}  [${c.grade}]  parent: ${data.parent_name}`;
    if (phase === 'early') early.push(entry);
    else regular.push(entry);
  }
}

console.log(`\n=== BEGINNER — EARLY BIRD (${early.length}) ===`);
early.forEach((e) => console.log(e));

console.log(`\n=== BEGINNER — REGULAR (${regular.length}) ===`);
regular.forEach((e) => console.log(e));

console.log(`\nTotal Beginner: ${early.length + regular.length}`);
