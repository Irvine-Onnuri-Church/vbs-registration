/**
 * Find duplicate children in Firestore by name (first_name + last_name).
 * Reports all registrations that share a child with the same name.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load .env.production manually
const envPath = resolve(process.cwd(), '.env.production');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  const value = trimmed.slice(eqIndex + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

// ── Firebase ─────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

interface ChildEntry {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  gender: string;
  date_of_birth: string;
  grade: string;
  tshirt_size: string;
  canceled: boolean;
  // parent info
  registration_id: string;
  parent_name: string;
  parent_email: string;
  created_at: string;
  source: string;
}

async function findDuplicates() {
  console.log('Fetching all registrations from Firestore...\n');
  const snapshot = await db.collection('registrations').get();

  // Build a map: normalized child name → list of occurrences
  const nameMap = new Map<string, ChildEntry[]>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const children = data.children || [];

    for (const child of children) {
      const firstName = (child.first_name || '').trim().toLowerCase();
      const lastName = (child.last_name || '').trim().toLowerCase();
      const key = `${firstName} ${lastName}`;

      if (!firstName && !lastName) continue;

      const entry: ChildEntry = {
        first_name: child.first_name || '',
        last_name: child.last_name || '',
        preferred_name: child.preferred_name || null,
        gender: child.gender || '',
        date_of_birth: child.date_of_birth || '',
        grade: child.grade || '',
        tshirt_size: child.tshirt_size || '',
        canceled: child.canceled || false,
        registration_id: doc.id,
        parent_name: data.parent_name || '',
        parent_email: data.email || '',
        created_at: data.created_at || '',
        source: data.source || '',
      };

      const list = nameMap.get(key) || [];
      list.push(entry);
      nameMap.set(key, list);
    }
  }

  // Filter to only names that appear more than once
  const duplicates = [...nameMap.entries()]
    .filter(([, entries]) => entries.length > 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (duplicates.length === 0) {
    console.log('✅ No duplicate children found.');
    return;
  }

  console.log(`❌ Found ${duplicates.length} duplicate child name(s):\n`);

  let totalDuplicateChildren = 0;

  // Table header
  const cols = {
    child: 20,
    parent: 22,
    email: 28,
    dob: 12,
    grade: 18,
    gender: 8,
    shirt: 8,
    canceled: 9,
    source: 10,
    regId: 38,
  };

  const header = [
    'Child Name'.padEnd(cols.child),
    'Parent'.padEnd(cols.parent),
    'Email'.padEnd(cols.email),
    'DOB'.padEnd(cols.dob),
    'Grade'.padEnd(cols.grade),
    'Gender'.padEnd(cols.gender),
    'Shirt'.padEnd(cols.shirt),
    'Canceled'.padEnd(cols.canceled),
    'Source'.padEnd(cols.source),
    'Registration ID'.padEnd(cols.regId),
  ].join(' │ ');

  const separator = [
    '─'.repeat(cols.child),
    '─'.repeat(cols.parent),
    '─'.repeat(cols.email),
    '─'.repeat(cols.dob),
    '─'.repeat(cols.grade),
    '─'.repeat(cols.gender),
    '─'.repeat(cols.shirt),
    '─'.repeat(cols.canceled),
    '─'.repeat(cols.source),
    '─'.repeat(cols.regId),
  ].join('─┼─');

  console.log(header);
  console.log(separator);

  for (const [, entries] of duplicates) {
    totalDuplicateChildren += entries.length;

    for (const e of entries) {
      const row = [
        `${e.first_name} ${e.last_name}`.padEnd(cols.child),
        e.parent_name.padEnd(cols.parent),
        e.parent_email.padEnd(cols.email),
        e.date_of_birth.padEnd(cols.dob),
        e.grade.padEnd(cols.grade),
        e.gender.padEnd(cols.gender),
        e.tshirt_size.padEnd(cols.shirt),
        String(e.canceled).padEnd(cols.canceled),
        (e.source || 'N/A').padEnd(cols.source),
        e.registration_id.padEnd(cols.regId),
      ].join(' │ ');
      console.log(row);
    }

    // blank line between duplicate groups
    console.log('');
  }

  console.log(`=== SUMMARY ===`);
  console.log(`  Duplicate names:     ${duplicates.length}`);
  console.log(`  Total entries:       ${totalDuplicateChildren}`);
  console.log(`  Extra (to remove):   ${totalDuplicateChildren - duplicates.length}`);
}

findDuplicates().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
