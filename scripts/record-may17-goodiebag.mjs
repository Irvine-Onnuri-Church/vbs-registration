// One-time script: record May 17, 2026 goodie bag pickup for listed children
// Run: node scripts/record-may17-goodiebag.mjs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Load .env.local ──────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}

// ── Firebase init ────────────────────────────────────────────────────────────

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Target children ──────────────────────────────────────────────────────────

// Format: [lastName, firstName]
const TARGETS = [
  // Pre-K
  ['Cha',      'Jooho'],
  ['Hong',     'Joshua'],
  ['Jung',     'Jude'],
  ['Lee',      'Evelyn'],
  ['Lee',      'Jay'],
  ['Oh',       '인유'],
  ['Park',     'Ellie'],
  ['Thompson', 'Billy'],
  ['Yoo',      'Gianna'],
  ['Yoon',     'Mason'],
  // TK
  ['Baik',     'Rei'],
  ['Chang',    'Arthur'],
  ['Cho',      'Eric'],
  ['Han',      'Jiho'],
  ['Han',      'Melody'],
  ['Jung',     'Benjamin'],
];

const SESSION_KEY = '2026-05-17_goodiebag';
const SESSION_VALUE = {
  status: 'picked_up',
  by: null,
  at: '2026-05-17T00:00:00.000Z',
  pickup_type: 'parent',
};

// ── Match helper ─────────────────────────────────────────────────────────────

function normalize(str) {
  return str.trim().toLowerCase();
}

function firstNameMatches(childFirst, targetFirst) {
  // Handle "Evelyn (채은)" → match "Evelyn", and "Mason (지후)" → match "Mason"
  const base = normalize(childFirst).split(/[\s(]/)[0];
  return base === normalize(targetFirst) || normalize(childFirst) === normalize(targetFirst);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const snapshot = await db.collection('registrations').get();
console.log(`Loaded ${snapshot.size} registrations.`);

let updated = 0;
const notFound = [...TARGETS];

for (const doc of snapshot.docs) {
  const data = doc.data();
  const children = data.children || [];
  let dirty = false;
  const updatedChildren = children.map((child) => {
    const matchIdx = notFound.findIndex(([last, first]) =>
      normalize(child.last_name) === normalize(last) &&
      firstNameMatches(child.first_name, first)
    );
    if (matchIdx === -1) return child;

    // Remove from notFound list
    notFound.splice(matchIdx, 1);

    const sessions = { ...(child.sessions || {}), [SESSION_KEY]: SESSION_VALUE };
    dirty = true;
    console.log(`  ✓ ${child.first_name} ${child.last_name} (reg: ${doc.id})`);
    return { ...child, sessions };
  });

  if (dirty) {
    await doc.ref.update({ children: updatedChildren });
    updated++;
  }
}

console.log(`\nUpdated ${updated} registration(s).`);

if (notFound.length > 0) {
  console.warn('\n⚠️  Not found in database:');
  notFound.forEach(([last, first]) => console.warn(`   ${last}, ${first}`));
} else {
  console.log('All children found and updated.');
}
