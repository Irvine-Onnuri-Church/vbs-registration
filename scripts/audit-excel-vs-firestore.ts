/**
 * Cross-check every child from the Excel against Firestore.
 * Reports any children in Excel that are missing from Firestore.
 *
 * Usage: npx tsx scripts/audit-excel-vs-firestore.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load env
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

// Init Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

interface ExcelChild {
  first_name: string;
  last_name: string;
  grade: string;
  parent_email: string;
  parent_name: string;
  payment_method: string;
  sheet: string;
  row: number;
}

function normalize(s: string): string {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function main() {
  // Read Excel
  const wb = XLSX.readFile('VBS_registration.xlsx');

  const excelChildren: ExcelChild[] = [];

  // Parse RegularVBS (header at row index 1)
  const regularWs = wb.Sheets['RegularVBS'];
  const regularData: any[][] = XLSX.utils.sheet_to_json(regularWs, { header: 1 });
  // Header: row index 1 → ["사인업 날짜","Payment Method","PK/ JK","Current Grade","Last Name","First Name","T-shirt Size","Date of Birth","Gender","Friends to be with","Allergies/ Other medical conditions","Name of Parent","Mobile","Email",...]
  for (let i = 2; i < regularData.length; i++) {
    const row = regularData[i];
    if (!row || !row[4] || !row[5]) continue; // skip empty rows
    const lastName = String(row[4] || '').trim();
    const firstName = String(row[5] || '').trim();
    if (!lastName && !firstName) continue;
    excelChildren.push({
      first_name: firstName,
      last_name: lastName,
      grade: String(row[3] || '').trim(),
      parent_email: String(row[13] || '').trim(),
      parent_name: String(row[11] || '').trim(),
      payment_method: String(row[1] || '').trim(),
      sheet: 'RegularVBS',
      row: i + 1, // 1-indexed for display
    });
  }

  // Parse BeginnerVBS (header at row index 5)
  const beginnerWs = wb.Sheets['BeginnerVBS'];
  const beginnerData: any[][] = XLSX.utils.sheet_to_json(beginnerWs, { header: 1 });
  // Header at row 5: ["사인업 날짜","Payment Method","PK/ JK","Months (개월수)","Last Name","First Name","T-shirt Size","Gender","Friends to be with","Date of Birth","Allergies/ Other medical conditions","Name of Parent","Mobile","Email",...]
  for (let i = 6; i < beginnerData.length; i++) {
    const row = beginnerData[i];
    if (!row || !row[4] || !row[5]) continue;
    const lastName = String(row[4] || '').trim();
    const firstName = String(row[5] || '').trim();
    if (!lastName && !firstName) continue;
    excelChildren.push({
      first_name: firstName,
      last_name: lastName,
      grade: 'Pre-K',
      parent_email: String(row[13] || '').trim(),
      parent_name: String(row[11] || '').trim(),
      payment_method: String(row[1] || '').trim(),
      sheet: 'BeginnerVBS',
      row: i + 1,
    });
  }

  // Also check AppleTree
  const appleWs = wb.Sheets['🍎 AppleTree'];
  if (appleWs) {
    const appleData: any[][] = XLSX.utils.sheet_to_json(appleWs, { header: 1 });
    // Find header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(20, appleData.length); i++) {
      if (appleData[i]?.some((c: any) => String(c).includes('Last Name') || String(c).includes('First Name'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx >= 0) {
      const header = appleData[headerIdx];
      const lastNameCol = header.findIndex((c: any) => String(c).includes('Last Name'));
      const firstNameCol = header.findIndex((c: any) => String(c).includes('First Name'));
      const emailCol = header.findIndex((c: any) => String(c).toLowerCase().includes('email'));
      const parentCol = header.findIndex((c: any) => String(c).includes('Parent') || String(c).includes('Name of'));
      const paymentCol = header.findIndex((c: any) => String(c).includes('Payment'));

      for (let i = headerIdx + 1; i < appleData.length; i++) {
        const row = appleData[i];
        if (!row) continue;
        const lastName = String(row[lastNameCol] || '').trim();
        const firstName = String(row[firstNameCol] || '').trim();
        if (!lastName && !firstName) continue;
        excelChildren.push({
          first_name: firstName,
          last_name: lastName,
          grade: 'AppleTree',
          parent_email: emailCol >= 0 ? String(row[emailCol] || '').trim() : '',
          parent_name: parentCol >= 0 ? String(row[parentCol] || '').trim() : '',
          payment_method: paymentCol >= 0 ? String(row[paymentCol] || '').trim() : '',
          sheet: 'AppleTree',
          row: i + 1,
        });
      }
    }
  }

  console.log(`\nExcel children found: ${excelChildren.length}`);
  console.log(`  RegularVBS: ${excelChildren.filter(c => c.sheet === 'RegularVBS').length}`);
  console.log(`  BeginnerVBS: ${excelChildren.filter(c => c.sheet === 'BeginnerVBS').length}`);
  console.log(`  AppleTree: ${excelChildren.filter(c => c.sheet === 'AppleTree').length}`);

  // Fetch all Firestore registrations
  const snapshot = await db.collection('registrations').get();
  const firestoreChildren: { first_name: string; last_name: string; parent_email: string; canceled: boolean }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email = (data.email || '').toLowerCase().trim();
    for (const child of (data.children || [])) {
      firestoreChildren.push({
        first_name: normalize(child.first_name || ''),
        last_name: normalize(child.last_name || ''),
        parent_email: email,
        canceled: !!child.canceled,
      });
    }
  }

  console.log(`\nFirestore children: ${firestoreChildren.length} (${firestoreChildren.filter(c => !c.canceled).length} active, ${firestoreChildren.filter(c => c.canceled).length} canceled)`);

  // Cross-check: find Excel children missing from Firestore
  const missing: ExcelChild[] = [];
  const canceledInDb: ExcelChild[] = [];

  for (const exChild of excelChildren) {
    const normFirst = normalize(exChild.first_name);
    const normLast = normalize(exChild.last_name);
    const normEmail = normalize(exChild.parent_email);

    // Try matching by name + email
    let match = firestoreChildren.find(
      fc => fc.first_name === normFirst && fc.last_name === normLast && fc.parent_email === normEmail
    );

    // Fallback: match by name only (in case email differs)
    if (!match) {
      match = firestoreChildren.find(
        fc => fc.first_name === normFirst && fc.last_name === normLast
      );
    }

    if (!match) {
      missing.push(exChild);
    } else if (match.canceled) {
      canceledInDb.push(exChild);
    }
  }

  // Report
  if (missing.length === 0) {
    console.log('\n✅ All Excel children exist in Firestore!');
  } else {
    console.log(`\n❌ MISSING FROM FIRESTORE (${missing.length} children):`);
    console.log('─'.repeat(100));
    console.log(`${'Row'.padEnd(5)} ${'Sheet'.padEnd(12)} ${'Name'.padEnd(25)} ${'Grade'.padEnd(8)} ${'Parent'.padEnd(25)} ${'Email'.padEnd(30)} ${'Payment'}`);
    console.log('─'.repeat(100));
    for (const c of missing) {
      console.log(`${String(c.row).padEnd(5)} ${c.sheet.padEnd(12)} ${(c.first_name + ' ' + c.last_name).padEnd(25)} ${c.grade.padEnd(8)} ${c.parent_name.padEnd(25)} ${c.parent_email.padEnd(30)} ${c.payment_method}`);
    }
  }

  if (canceledInDb.length > 0) {
    console.log(`\n⚠️  CANCELED IN FIRESTORE but in Excel (${canceledInDb.length}):`);
    for (const c of canceledInDb) {
      console.log(`  Row ${c.row} (${c.sheet}): ${c.first_name} ${c.last_name} — ${c.parent_email}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
