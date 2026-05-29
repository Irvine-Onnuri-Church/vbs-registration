// One-time script: remove all goodie bag pickup sessions for Yuha Hwang
// Run: node scripts/cancel-goodiebag-yuha-hwang.mjs

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

function normalize(str) { return str.trim().toLowerCase(); }
function firstNameMatches(childFirst, targetFirst) {
  const base = normalize(childFirst).split(/[\s(]/)[0];
  return base === normalize(targetFirst) || normalize(childFirst) === normalize(targetFirst);
}

const snapshot = await db.collection('registrations').get();
let found = false;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const children = data.children || [];
  let dirty = false;

  const updatedChildren = children.map((child) => {
    if (normalize(child.last_name) !== 'hwang' || !firstNameMatches(child.first_name, 'yuha')) return child;
    found = true;

    const sessions = { ...(child.sessions || {}) };
    const removed = [];
    for (const key of Object.keys(sessions)) {
      if (key.endsWith('_goodiebag')) {
        sessions[key] = null;
        removed.push(key);
      }
    }

    if (removed.length === 0) {
      console.log(`  ⚠️  ${child.first_name} ${child.last_name} — no goodie bag sessions found`);
      return child;
    }

    dirty = true;
    console.log(`  ✓ Removed goodie bag session(s) for ${child.first_name} ${child.last_name}: ${removed.join(', ')}`);
    return { ...child, sessions };
  });

  if (dirty) await doc.ref.update({ children: updatedChildren });
}

if (!found) console.warn('⚠️  Yuha Hwang not found in database.');
