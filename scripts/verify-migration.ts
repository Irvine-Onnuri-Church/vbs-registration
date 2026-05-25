/**
 * Verification script: Compare Supabase vs Firestore data
 * Ensures no records were dropped or overwritten during migration.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
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

// ── Supabase ─────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars (are they uncommented in .env.production?)');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Firebase ─────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function verify() {
  console.log('=== Fetching from Supabase ===');
  const { data: sbRegs, error: sbError } = await supabase
    .from('registrations')
    .select('*, children(*)')
    .order('created_at', { ascending: true });

  if (sbError) {
    console.error('Supabase error:', sbError.message);
    process.exit(1);
  }

  const { data: sbChildren, error: sbChildError } = await supabase
    .from('children')
    .select('*');

  if (sbChildError) {
    console.error('Supabase children error:', sbChildError.message);
    process.exit(1);
  }

  console.log(`  Registrations: ${sbRegs!.length}`);
  console.log(`  Children (total): ${sbChildren!.length}`);

  console.log('\n=== Fetching from Firestore ===');
  const fsSnapshot = await db.collection('registrations').get();
  const fsDocs = fsSnapshot.docs;

  let fsChildrenTotal = 0;
  for (const doc of fsDocs) {
    const data = doc.data();
    fsChildrenTotal += (data.children || []).length;
  }

  console.log(`  Registrations: ${fsDocs.length}`);
  console.log(`  Children (total): ${fsChildrenTotal}`);

  // ── Compare counts ──
  console.log('\n=== Comparison ===');
  const regMatch = sbRegs!.length === fsDocs.length;
  const childMatch = sbChildren!.length === fsChildrenTotal;

  console.log(`  Registrations: Supabase=${sbRegs!.length} | Firestore=${fsDocs.length} ${regMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`  Children:      Supabase=${sbChildren!.length} | Firestore=${fsChildrenTotal} ${childMatch ? '✅ MATCH' : '❌ MISMATCH'}`);

  // ── Check every Supabase registration exists in Firestore ──
  console.log('\n=== Checking every Supabase record exists in Firestore ===');
  const fsIdSet = new Set(fsDocs.map((d) => d.id));
  const missing: string[] = [];

  for (const reg of sbRegs!) {
    if (!fsIdSet.has(reg.id)) {
      missing.push(reg.id);
    }
  }

  if (missing.length === 0) {
    console.log('  ✅ All Supabase registration IDs found in Firestore');
  } else {
    console.log(`  ❌ ${missing.length} registrations MISSING from Firestore:`);
    for (const id of missing) {
      console.log(`    - ${id}`);
    }
  }

  // ── Spot-check: verify children count per registration ──
  console.log('\n=== Spot-checking children per registration ===');
  let childMismatches = 0;
  for (const reg of sbRegs!) {
    const fsDoc = fsDocs.find((d) => d.id === reg.id);
    if (!fsDoc) continue;
    const sbCount = (reg.children || []).length;
    const fsCount = (fsDoc.data().children || []).length;
    if (sbCount !== fsCount) {
      childMismatches++;
      console.log(`  ❌ ${reg.id}: Supabase=${sbCount} children, Firestore=${fsCount} children`);
    }
  }
  if (childMismatches === 0) {
    console.log('  ✅ All registrations have matching children counts');
  }

  // ── Final verdict ──
  console.log('\n=== RESULT ===');
  if (regMatch && childMatch && missing.length === 0 && childMismatches === 0) {
    console.log('✅ Migration verified — all data matches perfectly.');
  } else {
    console.log('❌ Migration has discrepancies — review above.');
  }
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
