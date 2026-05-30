/**
 * Add Jayden Hur to Firestore under existing parent Jacqueline Hur (pianist.hur@gmail.com)
 * Data from Excel row 147: 6th grade, Male, T-shirt L, DOB serial 41845 (2014-07-22), Cash payment
 */
import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
  const snapshot = await db.collection('registrations')
    .where('email', '==', 'pianist.hur@gmail.com')
    .get();

  // Find the doc that has Janet Hur (the 6th grader's sibling group)
  let targetDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasJanet = (data.children || []).some((c: any) => c.first_name === 'Janet' && c.last_name === 'Hur');
    if (hasJanet) {
      targetDoc = doc;
      break;
    }
  }

  if (!targetDoc) {
    console.log('Could not find Janet Hur doc. Listing all docs for pianist.hur@gmail.com:');
    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log(`  ${doc.id}: ${(data.children || []).map((c: any) => c.first_name + ' ' + c.last_name).join(', ')}`);
    }
    return;
  }

  const data = targetDoc.data();
  const children = [...(data.children || [])];

  // Check if Jayden already exists
  if (children.some((c: any) => c.first_name === 'Jayden' && c.last_name === 'Hur')) {
    console.log('Jayden Hur already exists in this doc. Aborting.');
    return;
  }

  // Excel serial 41845 → 2014-07-22 (Excel date serial to date)
  const jayden = {
    first_name: 'Jayden',
    last_name: 'Hur',
    preferred_name: null,
    gender: 'Male',
    date_of_birth: '2014-07-22',
    age: 11,
    grade: '6th Grade',
    tshirt_size: 'L',
    allergy_information: null,
    medical_notes: null,
    price: 70,
    class: 'regular',
    created_at: new Date().toISOString(),
  };

  children.push(jayden);
  await targetDoc.ref.update({ children });

  console.log(`Added Jayden Hur to doc ${targetDoc.id} (parent: ${data.parent_name})`);
  console.log(`Doc now has ${children.length} children: ${children.map((c: any) => c.first_name + ' ' + c.last_name).join(', ')}`);
}

main().catch(console.error);
