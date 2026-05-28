/**
 * Backfill paypal_order_id and per-child created_at on every child in Firestore
 *
 * Matches Supabase children → Firestore children by first_name + last_name
 * under the same parent email, then writes paypal_order_id and created_at
 * (from the Supabase registration date) to each child.
 *
 * Usage:
 *   npx tsx scripts/backfill-registration-ids.ts --dry-run   # preview
 *   npx tsx scripts/backfill-registration-ids.ts              # apply
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

// ── Supabase ─────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Firebase ─────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!serviceAccount.project_id) {
  console.error('Missing or invalid FIREBASE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  // 1. Fetch all Supabase registrations + children
  console.log('Fetching all registrations from Supabase...');
  const { data: sbRegs, error } = await supabase
    .from('registrations')
    .select('*, children(*)');
  if (error) { console.error('Supabase error:', error.message); process.exit(1); }
  if (!sbRegs || sbRegs.length === 0) { console.log('No Supabase registrations found.'); return; }

  // Build a lookup: email → [{ paypal_order_id, created_at, first_name, last_name }]
  const sbLookup = new Map<string, { paypal_order_id: string; created_at: string; first_name: string; last_name: string }[]>();
  for (const reg of sbRegs) {
    const email = (reg.email || '').toLowerCase().trim();
    if (!email) continue;
    for (const child of (reg.children || [])) {
      if (!sbLookup.has(email)) sbLookup.set(email, []);
      sbLookup.get(email)!.push({
        paypal_order_id: reg.paypal_order_id || null,
        created_at: reg.created_at || null,
        first_name: (child.first_name || '').toLowerCase().trim(),
        last_name: (child.last_name || '').toLowerCase().trim(),
      });
    }
  }
  console.log(`Built lookup for ${sbLookup.size} parent emails from Supabase.\n`);

  // 2. Fetch all Firestore registrations
  console.log('Fetching all registrations from Firestore...');
  const fsSnapshot = await db.collection('registrations').get();
  console.log(`Found ${fsSnapshot.size} registrations in Firestore.\n`);

  let docsUpdated = 0;
  let childrenUpdated = 0;
  let childrenSkipped = 0;
  let childrenAlreadySet = 0;
  let childrenNotFound = 0;

  for (const doc of fsSnapshot.docs) {
    const data = doc.data();
    const email = (data.email || '').toLowerCase().trim();
    const children: Record<string, unknown>[] = data.children || [];

    if (children.length === 0) continue;

    const sbChildren = sbLookup.get(email);
    let docChanged = false;
    const updatedChildren = children.map((child) => {
      const firstName = ((child.first_name as string) || '').toLowerCase().trim();
      const lastName = ((child.last_name as string) || '').toLowerCase().trim();

      // Already has both fields
      if (child.paypal_order_id && child.created_at) {
        childrenAlreadySet++;
        return child;
      }

      if (!sbChildren) {
        childrenNotFound++;
        return child;
      }

      // Find matching Supabase child
      const match = sbChildren.find(
        (sc) => sc.first_name === firstName && sc.last_name === lastName
      );

      if (!match) {
        childrenNotFound++;
        return child;
      }

      docChanged = true;
      childrenUpdated++;
      return { ...child, paypal_order_id: match.paypal_order_id, created_at: match.created_at };
    });

    if (!docChanged) {
      childrenSkipped += children.length - children.filter((c) => c.paypal_order_id).length;
      continue;
    }

    if (DRY_RUN) {
      const names = updatedChildren
        .filter((c) => !children.find((orig) => orig === c)) // changed ones
        .map((c) => `${c.first_name} ${c.last_name}`)
        .join(', ');
      // Show all children that would be updated
      const updated = updatedChildren.filter((c, i) => c !== children[i]);
      console.log(`  ${data.parent_name} (${data.email}):`);
      for (const c of updated) {
        console.log(`    + ${c.first_name} ${c.last_name} → paypal_order_id: ${c.paypal_order_id}, created_at: ${c.created_at}`);
      }
    } else {
      await doc.ref.update({ children: updatedChildren });
    }

    docsUpdated++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Docs updated: ${docsUpdated}`);
  console.log(`  Children updated with paypal_order_id: ${childrenUpdated}`);
  console.log(`  Children already had paypal_order_id: ${childrenAlreadySet}`);
  console.log(`  Children not found in Supabase: ${childrenNotFound}`);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] No changes were made. Run without --dry-run to apply.`);
  } else {
    console.log(`\n✅ Done!`);
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
