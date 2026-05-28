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
 *   npx tsx scripts/migrate-delta.ts              # migrate all new registrations
 *   npx tsx scripts/migrate-delta.ts --dry-run    # preview only, no writes
 *   npx tsx scripts/migrate-delta.ts --email vminjiv@gmail.com            # migrate one new registration
 *   npx tsx scripts/migrate-delta.ts --email vminjiv@gmail.com --dry-run  # preview one registration
 *   npx tsx scripts/migrate-delta.ts --email vminjiv@gmail.com --child "Joel Ock" --dry-run  # add child to existing parent
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

const DRY_RUN = process.argv.includes('--dry-run');
const emailFlagIndex = process.argv.indexOf('--email');
const EMAIL_FILTER = emailFlagIndex !== -1 ? process.argv[emailFlagIndex + 1]?.toLowerCase() : null;
const childFlagIndex = process.argv.indexOf('--child');
const CHILD_FILTER = childFlagIndex !== -1 ? process.argv[childFlagIndex + 1]?.toLowerCase() : null;

// ── Add child to existing parent ─────────────────────────────
async function addChildToParent() {
  if (!EMAIL_FILTER || !CHILD_FILTER) {
    console.error('--child requires --email as well');
    process.exit(1);
  }

  console.log(`Looking for child "${CHILD_FILTER}" under parent email "${EMAIL_FILTER}" in Supabase...`);

  const { data: registrations, error } = await supabase
    .from('registrations')
    .select('*, children(*)')
    .ilike('email', EMAIL_FILTER);

  if (error) { console.error('Supabase query failed:', error.message); process.exit(1); }
  if (!registrations || registrations.length === 0) {
    console.error(`No registration found in Supabase for email: ${EMAIL_FILTER}`);
    process.exit(1);
  }

  // Find the specific child across all registrations for this email
  const [firstName, ...lastParts] = CHILD_FILTER.split(' ');
  const lastName = lastParts.join(' ');

  let matchedChild: Record<string, unknown> | null = null;
  for (const reg of registrations) {
    for (const c of (reg.children || [])) {
      if ((c.first_name || '').toLowerCase() === firstName && (c.last_name || '').toLowerCase() === lastName) {
        matchedChild = c;
        break;
      }
    }
    if (matchedChild) break;
  }

  if (!matchedChild) {
    console.error(`Child "${CHILD_FILTER}" not found in Supabase for email: ${EMAIL_FILTER}`);
    process.exit(1);
  }

  // Build the child object (strip Supabase child id, keep registration_id)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _cid, ...childData } = matchedChild as Record<string, unknown>;

  console.log(`Found child in Supabase:`, childData);

  // Find existing parent in Firestore by email
  const fsSnapshot = await db.collection('registrations')
    .where('email', '==', EMAIL_FILTER)
    .get();

  if (fsSnapshot.empty) {
    console.error(`No parent found in Firestore with email: ${EMAIL_FILTER}`);
    process.exit(1);
  }

  const parentDoc = fsSnapshot.docs[0];
  const parentData = parentDoc.data();
  const existingChildren: Record<string, unknown>[] = parentData.children || [];

  // Check if child already exists in Firestore
  const alreadyExists = existingChildren.some(
    (c) => (c.first_name as string || '').toLowerCase() === firstName &&
           (c.last_name as string || '').toLowerCase() === lastName
  );

  if (alreadyExists) {
    console.log(`\n✅ Child "${CHILD_FILTER}" already exists under ${parentData.parent_name} in Firestore. Nothing to do.`);
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would add child "${childData.first_name} ${childData.last_name}" to:`);
    console.log(`  Parent: ${parentData.parent_name} (${parentData.email})`);
    console.log(`  Firestore doc: ${parentDoc.id}`);
    console.log(`  Existing children: ${existingChildren.map((c) => `${c.first_name} ${c.last_name}`).join(', ') || 'none'}`);
    console.log(`\n[DRY RUN] No changes were made. Run without --dry-run to migrate.`);
    return;
  }

  await parentDoc.ref.update({
    children: [...existingChildren, childData],
  });

  console.log(`\n✅ Added "${childData.first_name} ${childData.last_name}" to ${parentData.parent_name} (${parentDoc.id})`);
}

// ── Delta Migrate (full registrations) ───────────────────────
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

  // Filter to only new registrations (optionally by email)
  const newRegs = registrations.filter((reg) => {
    if (existingIds.has(reg.id)) return false;
    if (EMAIL_FILTER && (reg.email || '').toLowerCase() !== EMAIL_FILTER) return false;
    return true;
  });

  if (newRegs.length === 0) {
    console.log('\n✅ No new registrations to migrate. Everything is in sync.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] ${newRegs.length} new registrations would be migrated:\n`);
    for (const reg of newRegs) {
      const { children, ...regData } = reg;
      const childNames = (children || []).map((c: Record<string, unknown>) => `${c.first_name} ${c.last_name}`).join(', ');
      console.log(`  - ${regData.parent_name} (${regData.email}) — children: ${childNames || 'none'}`);
    }
    console.log(`\n[DRY RUN] No changes were made. Run without --dry-run to migrate.`);
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

const main = CHILD_FILTER ? addChildToParent : migrateDelta;
main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
