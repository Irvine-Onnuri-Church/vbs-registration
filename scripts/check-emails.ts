import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const envPath = resolve(process.cwd(), '.env.production');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const emails = ['ddiddi1005@gmail.com', 'key8203001@gmail.com', 'lcs715@gmail.com', 'peskums@gmail.com'];

async function main() {
  for (const email of emails) {
    const snap = await db.collection('registrations').where('email', '==', email).get();
    if (snap.empty) {
      console.log(`${email}: NOT FOUND`);
    } else {
      for (const doc of snap.docs) {
        const d = doc.data();
        const kids = (d.children || []).map((c: any) => `${c.first_name} ${c.last_name}`).join(', ');
        console.log(`${email}: ${kids}`);
      }
    }
  }
}

main().catch(console.error);
