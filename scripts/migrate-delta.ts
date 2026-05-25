/**
 * Delta migration script: Supabase → Firestore (new records only)
 *
 * Only migrates registrations that do NOT already exist in Firestore.
 * Safe to run multiple times — will never overwrite existing data.
 *
 * Prerequisites:
 *   1. Uncomment NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.production
 *   2. FIREBASE_SERVICE_ACCOUNT_KEY must be set in .env.production
 *
 * Usage:
 *   npx tsx scripts/migrate-delta.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
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

// ── Supabase client ──────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure they are uncommented in .env.production');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Firebase Admin client ────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!serviceAccount.project_id) {
  console.error('Missing or invalid FIREBASE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// ── Delta Migrate ─────────────────────────────────────────────
async function migrateDelta() {
  console.log('Fetching all registrations from Supabase...');

  const { data: registrations, error } = await supabase
    .from('registrations')
    .select('*, children(*)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase query failed:', error.message);
    process.exit(1);
  }

  if (!registrations || registrations.length === 0) {
    console.log('No registrations found in Supabase.');
    return;
  }

  console.log(`Found ${registrations.length} registrations in Supabase.`);

  // Get all existing Firestore doc IDs
  console.log('Fetching existing Firestore document IDs...');
  const fsSnapshot = await db.collection('registrations').select().get();
  const existingIds = new Set(fsSnapshot.docs.map((doc) => doc.id));
  console.log(`Found ${existingIds.size} existing registrations in Firestore.`);

  // Filter to only new registrations
  const newRegs = registrations.filter((reg) => !existingIds.has(reg.id));

  if (newRegs.length === 0) {
    console.log('\n✅ No new registrations to migrate. Everything is in sync.');
    return;
  }

  console.log(`\n${newRegs.length} new registrations to migrate:\n`);

  let migrated = 0;

  for (const reg of newRegs) {
    const { id, children, ...regData } = reg;

    // Map children from Supabase rows to embedded array (remove relational fields)
    const childArray = (children || []).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ id: _childId, registration_id: _regId, ...childData }: Record<string, unknown>) => childData
    );

    await db.collection('registrations').doc(id).set({
      ...regData,
      children: childArray,
    });

    migrated++;
    console.log(`  [${migrated}/${newRegs.length}] Migrated: ${regData.parent_name} (${regData.email})`);
  }

  console.log(`\n✅ Done! Migrated ${migrated} new registrations to Firestore.`);
  console.log(`   Total in Firestore now: ${existingIds.size + migrated}`);
}

migrateDelta().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
