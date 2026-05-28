/**
 * Quick check: what does Joel Ock's child object look like in Firestore?
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
  const snapshot = await db.collection('registrations')
    .where('email', '==', 'vminjiv@gmail.com')
    .get();

  if (snapshot.empty) {
    console.log('No registration found for vminjiv@gmail.com');
    return;
  }

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`\nDoc ID: ${doc.id}`);
    console.log(`Parent: ${data.parent_name} (${data.email})`);
    console.log(`Doc-level created_at: ${data.created_at}`);
    console.log(`\nChildren:`);
    for (const child of (data.children || [])) {
      console.log(`  ${child.first_name} ${child.last_name}:`);
      console.log(`    created_at: ${child.created_at}`);
      console.log(`    paypal_order_id: ${child.paypal_order_id}`);
      console.log(`    All keys: ${Object.keys(child).join(', ')}`);
    }
  }
}

main().catch(console.error);
