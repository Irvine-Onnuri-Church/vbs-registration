/**
 * One-time migration script: Supabase → Firestore
 *
 * This script reads all registrations (with children) from the existing
 * Supabase database and writes them to Firestore, preserving the original
 * Supabase registration IDs as Firestore document IDs.
 *
 * Prerequisites:
 *   1. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in your environment
 *   2. Set FIREBASE_SERVICE_ACCOUNT_KEY in your environment (JSON string)
 *
 * Usage:
 *   npx tsx scripts/migrate-to-firestore.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load .env.production manually (tsx doesn't auto-load env files)
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

// ── Migrate ──────────────────────────────────────────────────
async function migrate() {
  console.log('Fetching registrations from Supabase...');

  const { data: registrations, error } = await supabase
    .from('registrations')
    .select('*, children(*)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase query failed:', error.message);
    process.exit(1);
  }

  if (!registrations || registrations.length === 0) {
    console.log('No registrations found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${registrations.length} registrations. Migrating...`);

  let migrated = 0;

  for (const reg of registrations) {
    const { id, children, ...regData } = reg;

    // Map children from Supabase rows to embedded array (remove relational fields)
    const childArray = (children || []).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ id: _childId, registration_id: _regId, ...childData }: Record<string, unknown>) => childData
    );

    // Use the original Supabase UUID as the Firestore doc ID
    await db.collection('registrations').doc(id).set({
      ...regData,
      children: childArray,
    });

    migrated++;
    console.log(`  [${migrated}/${registrations.length}] Migrated registration ${id}`);
  }

  console.log(`\nDone! Migrated ${migrated} registrations to Firestore.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
