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

const GRADE_FIX: Record<string, string> = {
  '1st': '1st Grade',
  '2nd': '2nd Grade',
  '3rd': '3rd Grade',
  '4th': '4th Grade',
  '5th': '5th Grade',
  '6th': '6th Grade',
  'K': 'Kindergarten',
};

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const snapshot = await db.collection('registrations').get();
  let fixCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const children = data.children || [];
    let changed = false;

    for (const child of children) {
      const fix = GRADE_FIX[child.grade];
      if (fix) {
        console.log(`${child.first_name} ${child.last_name}: "${child.grade}" → "${fix}" (doc ${doc.id})`);
        child.grade = fix;
        changed = true;
        fixCount++;
      }
    }

    if (changed && !dryRun) {
      await doc.ref.update({ children });
    }
  }

  console.log(`\n${fixCount} children to fix.${dryRun ? ' (dry run — pass --apply to write)' : ' Updated.'}`);
}

main().catch(console.error);
