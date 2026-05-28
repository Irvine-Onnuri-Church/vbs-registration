import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const snapshot = await db.collection('registrations').get();

for (const doc of snapshot.docs) {
  const data = doc.data();
  for (const c of (data.children ?? [])) {
    const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim().toLowerCase();
    if (name.includes('isaac') && name.includes('baek')) {
      console.log(JSON.stringify({
        doc_id: doc.id,
        created_at: data.created_at,
        created_at_readable: new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        registration_phase: data.registration_phase,
        payment_status: data.payment_status,
        parent: data.parent_name,
        child: { first_name: c.first_name, last_name: c.last_name, grade: c.grade, class: c.class, dob: c.date_of_birth, price: c.price },
      }, null, 2));
    }
  }
}
