/**
 * Find a child by name in Firestore (partial match)
 * Usage: npx tsx scripts/find-child.ts "Elle"
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
  const query = (process.argv[2] || '').toLowerCase();
  if (!query) { console.log('Usage: npx tsx scripts/find-child.ts "name"'); process.exit(1); }

  const snapshot = await db.collection('registrations').get();
  let found = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    for (const child of (data.children || [])) {
      const fullName = `${child.first_name || ''} ${child.last_name || ''}`.toLowerCase();
      if (fullName.includes(query)) {
        found++;
        console.log(`Found: ${child.first_name} ${child.last_name}`);
        console.log(`  Parent: ${data.parent_name} (${data.email})`);
        console.log(`  Doc ID: ${doc.id}`);
        console.log(`  Canceled: ${child.canceled || false}`);
        console.log();
      }
    }
  }
  if (!found) console.log(`No children found matching "${query}"`);
}

main().catch(console.error);
