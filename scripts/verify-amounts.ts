import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function verify() {
  const snapshot = await db.collection('registrations').orderBy('created_at', 'desc').get();
  const registrations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];

  console.log(`Total registrations in DB: ${registrations.length}\n`);

  // --- Non-appletree, non-canceled ---
  let sumChildPrices = 0;
  let sumRegTotals = 0;
  let childCount = 0;
  let regCount = 0;

  // --- Appletree ---
  let appletreeSum = 0;
  let appletreeCount = 0;

  // --- All ---
  let grandTotal = 0;

  for (const reg of registrations) {
    const children = reg.children || [];
    const nonApple = children.filter((c: any) => !c.canceled && c.class !== 'appletree');
    const apple = children.filter((c: any) => !c.canceled && c.class === 'appletree');

    if (nonApple.length > 0) {
      regCount++;
      const childTotal = nonApple.reduce((s: number, c: any) => s + (c.price || 0), 0);
      sumChildPrices += childTotal;
      childCount += nonApple.length;
    }

    appletreeCount += apple.length;
    appletreeSum += apple.reduce((s: number, c: any) => s + (c.price || 0), 0);

    // reg.total_amount is the full registration total (may include appletree)
    grandTotal += reg.total_amount || 0;
  }

  // Also compute sum using reg.total_amount for registrations that have non-appletree kids
  for (const reg of registrations) {
    const children = reg.children || [];
    const hasNonApple = children.some((c: any) => !c.canceled && c.class !== 'appletree');
    if (hasNonApple) {
      // Only count non-appletree child prices from this registration
      sumRegTotals += children
        .filter((c: any) => !c.canceled && c.class !== 'appletree')
        .reduce((s: number, c: any) => s + (c.price || 0), 0);
    }
  }

  console.log('=== Dashboard (non-appletree) ===');
  console.log(`Registrations: ${regCount}`);
  console.log(`Children: ${childCount}`);
  console.log(`Sum of child prices: $${sumChildPrices}`);
  console.log(`Sum (method 2): $${sumRegTotals}`);
  console.log('');
  console.log('=== Apple Tree ===');
  console.log(`Children: ${appletreeCount}`);
  console.log(`Sum of child prices: $${appletreeSum}`);
  console.log('');
  console.log('=== Grand total (all reg.total_amount): $${grandTotal} ===');
  console.log(`Grand total (all reg.total_amount): $${grandTotal}`);
  console.log(`Sum of ALL child prices: $${sumChildPrices + appletreeSum}`);
  console.log('');

  // Check for mismatches between reg.total_amount and sum of child prices
  console.log('=== Mismatch check (reg.total_amount vs sum of child prices) ===');
  let mismatches = 0;
  for (const reg of registrations) {
    const children = reg.children || [];
    const childSum = children.filter((c: any) => !c.canceled).reduce((s: number, c: any) => s + (c.price || 0), 0);
    const regTotal = reg.total_amount || 0;
    if (childSum !== regTotal) {
      mismatches++;
      console.log(`  MISMATCH: ${reg.parent_name} (${reg.id})`);
      console.log(`    reg.total_amount: $${regTotal}, sum of child prices: $${childSum}`);
      console.log(`    Children: ${children.map((c: any) => `${c.first_name} $${c.price} ${c.canceled ? '(canceled)' : ''} [${c.class || 'regular'}]`).join(', ')}`);
    }
  }
  if (mismatches === 0) {
    console.log('  No mismatches found!');
  } else {
    console.log(`\n  ${mismatches} mismatch(es) found.`);
  }
}

verify().then(() => process.exit(0)).catch(console.error);
