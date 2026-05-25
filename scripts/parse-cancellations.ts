/**
 * Parse VBS_registration.xlsx — Cancellation tab
 * Cross-references cancelled children against the Firestore database to
 * identify which "DB ONLY" records are cancellations vs unknown.
 *
 * Usage:
 *   npx tsx scripts/parse-cancellations.ts
 */

import 'dotenv/config';
import { readFile, utils } from 'xlsx';
import { resolve } from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const filePath = resolve(process.cwd(), 'VBS_registration.xlsx');
const workbook = readFile(filePath);

// ── Helpers ─────────────────────────────────────────────
function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

// ── Parse Cancellation tab ──────────────────────────────
type CancelledChild = {
  status: string;
  signup_date: string;
  payment_method: string;
  grade: string;
  last_name: string;
  first_name: string;
  tshirt_size: string;
  gender: string;
  parent_name: string;
  mobile: string;
  email: string;
};

function parseCancellations(): CancelledChild[] {
  const sheet = workbook.Sheets['Cancellation'];
  if (!sheet) {
    console.error('No "Cancellation" tab found in the XLSX.');
    process.exit(1);
  }
  const raw: unknown[][] = utils.sheet_to_json(sheet, { header: 1, raw: false });
  // Row 0 is title, row 1 is headers, data starts at row 2
  return raw.slice(2)
    .filter((r) => str(r[4]) || str(r[5])) // must have first or last name
    .map((r) => ({
      status: str(r[0]),
      signup_date: str(r[1]),
      payment_method: str(r[2]),
      grade: str(r[3]),
      last_name: str(r[4]),
      first_name: str(r[5]),
      tshirt_size: str(r[6]),
      gender: str(r[7]),
      parent_name: `${str(r[12])} ${str(r[11])}`.trim(), // "First Last"
      mobile: normalizePhone(str(r[13])),
      email: normalizeEmail(str(r[14])),
    }));
}

// ── Match key (same as parse-xlsx.ts) ───────────────────
function matchKey(email: string, parentName: string, phone: string): string {
  if (email) return email;
  return `${parentName}|${phone}`.toLowerCase();
}

// ── Firebase init ───────────────────────────────────────
function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (!serviceAccount.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set or invalid. Check your .env file.');
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

// ── Run ─────────────────────────────────────────────────
async function run() {
  const cancelled = parseCancellations();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CANCELLATION REPORT`);
  console.log(`${'='.repeat(60)}\n`);

  // Group cancelled children by family key
  const cancelledByFamily = new Map<string, CancelledChild[]>();
  for (const child of cancelled) {
    const key = matchKey(child.email, child.parent_name, child.mobile);
    if (!cancelledByFamily.has(key)) cancelledByFamily.set(key, []);
    cancelledByFamily.get(key)!.push(child);
  }

  console.log(`Cancellation tab: ${cancelled.length} children across ${cancelledByFamily.size} families\n`);

  // Status breakdown
  const statusCounts = new Map<string, number>();
  for (const child of cancelled) {
    const s = child.status || '(no status)';
    statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
  }
  console.log('  Status breakdown:');
  for (const [s, n] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s}: ${n}`);
  }

  // List all cancelled children
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  ALL CANCELLED CHILDREN (${cancelled.length})`);
  console.log(`${'━'.repeat(60)}\n`);

  cancelled.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.first_name} ${c.last_name} | ${c.grade} | ${c.status || '(no status)'} | parent: ${c.parent_name} | ${c.email}`);
  });

  // Cross-reference with Firestore
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  FIRESTORE CROSS-REFERENCE`);
  console.log(`${'━'.repeat(60)}\n`);

  const db = getDb();
  const snapshot = await db.collection('registrations').get();

  const dbByKey = new Map<string, { id: string; data: FirebaseFirestore.DocumentData }>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const email = (data.email || '').toLowerCase().trim();
    const key = email || `${data.parent_name || ''}|${data.phone_number || ''}`.toLowerCase();
    dbByKey.set(key, { id: doc.id, data });
  });

  // Check each cancelled family against DB
  type MatchResult = {
    key: string;
    cancelledChildren: CancelledChild[];
    dbId: string;
    dbData: FirebaseFirestore.DocumentData;
    dbChildren: { first_name?: string; last_name?: string; grade?: string }[];
    allChildrenCancelled: boolean;
  };

  const matched: MatchResult[] = [];
  const notInDb: { key: string; children: CancelledChild[] }[] = [];

  for (const [key, children] of cancelledByFamily) {
    const dbEntry = dbByKey.get(key);
    if (dbEntry) {
      const dbChildren = dbEntry.data.children || [];
      // Check if every child in the DB doc has a match in the cancellation list
      const cancelledNames = new Set(
        children.map((c) => `${c.first_name}|${c.last_name}`.toLowerCase())
      );
      const allChildrenCancelled = dbChildren.every(
        (dc: { first_name?: string; last_name?: string }) =>
          cancelledNames.has(`${dc.first_name || ''}|${dc.last_name || ''}`.toLowerCase())
      );
      matched.push({ key, cancelledChildren: children, dbId: dbEntry.id, dbData: dbEntry.data, dbChildren, allChildrenCancelled });
    } else {
      notInDb.push({ key, children });
    }
  }

  // Also find DB records not in any XLSX tab (the "DB ONLY" from parse-xlsx.ts)
  // Load all XLSX tabs to build the full key set
  const allSheetNames = ['RegularVBS', 'BeginnerVBS', '🍎 AppleTree'];
  const allXlsxKeys = new Set<string>();
  for (const sheetName of allSheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const raw: unknown[][] = utils.sheet_to_json(sheet, { header: 1, raw: false });
    const startRow = sheetName === 'BeginnerVBS' ? 6 : sheetName === '🍎 AppleTree' ? 8 : 2;
    const emailCol = sheetName === '🍎 AppleTree' ? 12 : 13;
    const parentFirstCol = sheetName === '🍎 AppleTree' ? 10 : 11;
    const parentLastCol = sheetName === '🍎 AppleTree' ? (undefined as unknown as number) : (undefined as unknown as number);
    void parentLastCol;
    for (const r of raw.slice(startRow)) {
      const email = normalizeEmail(str(r[emailCol]));
      if (email) { allXlsxKeys.add(email); continue; }
      const mobileCol = sheetName === '🍎 AppleTree' ? 11 : 12;
      const parentName = str(r[parentFirstCol]);
      const mobile = normalizePhone(str(r[mobileCol]));
      allXlsxKeys.add(`${parentName}|${mobile}`.toLowerCase());
    }
  }
  // Add cancellation keys too
  for (const key of cancelledByFamily.keys()) {
    allXlsxKeys.add(key);
  }

  const dbOnlyNotCancelled: { id: string; data: FirebaseFirestore.DocumentData }[] = [];
  for (const [, { id, data }] of dbByKey) {
    const email = (data.email || '').toLowerCase().trim();
    const key = email || `${data.parent_name || ''}|${data.phone_number || ''}`.toLowerCase();
    if (!allXlsxKeys.has(key)) {
      // Check if matched by cancellation
      if (!cancelledByFamily.has(key)) {
        dbOnlyNotCancelled.push({ id, data });
      }
    }
  }

  // Report: matched in DB
  if (matched.length > 0) {
    console.log(`  FOUND IN DB — ${matched.reduce((s, m) => s + m.cancelledChildren.length, 0)} cancelled children (${matched.length} families):\n`);
    for (const m of matched) {
      const icon = m.allChildrenCancelled ? '🗑️ ' : '⚠️ ';
      const note = m.allChildrenCancelled ? 'ALL children cancelled — safe to delete entire record' : 'PARTIAL — some children still active';
      console.log(`  ${icon} ${m.dbData.parent_name || '(no name)'} <${m.dbData.email || '(no email)'}> [${note}]`);
      console.log(`     DB doc ID: ${m.dbId}`);
      console.log(`     DB children: ${(m.dbChildren as { first_name?: string; last_name?: string; grade?: string }[]).map((c) => `${c.first_name} ${c.last_name} (${c.grade})`).join(', ')}`);
      console.log(`     Cancelled:   ${m.cancelledChildren.map((c) => `${c.first_name} ${c.last_name} (${c.grade}) [${c.status || 'no status'}]`).join(', ')}`);
      console.log('');
    }
  }

  // Report: not in DB
  if (notInDb.length > 0) {
    console.log(`  NOT IN DB — ${notInDb.reduce((s, n) => s + n.children.length, 0)} cancelled children (${notInDb.length} families) — already removed or never uploaded:\n`);
    for (const n of notInDb) {
      n.children.forEach((c) => {
        console.log(`    . ${c.first_name} ${c.last_name} | ${c.grade} | ${c.status || '(no status)'} | parent: ${c.parent_name}`);
      });
    }
    console.log('');
  }

  // Report: DB only (not in any XLSX tab, not in cancellation)
  if (dbOnlyNotCancelled.length > 0) {
    const dbOnlyChildren = dbOnlyNotCancelled.reduce((s, d) => s + (d.data.children || []).length, 0);
    console.log(`  UNKNOWN — ${dbOnlyChildren} children (${dbOnlyNotCancelled.length} families) in DB but not in any XLSX tab (not cancelled, not in main tabs):\n`);
    for (const { id, data } of dbOnlyNotCancelled) {
      (data.children || []).forEach((c: { first_name?: string; last_name?: string; grade?: string }) => {
        console.log(`    ? ${c.first_name || ''} ${c.last_name || ''} | ${c.grade || '?'} | parent: ${data.parent_name || '(no name)'} | doc: ${id}`);
      });
    }
    console.log('');
  }

  // Summary
  const fullCancelDocs = matched.filter((m) => m.allChildrenCancelled);
  const partialCancelDocs = matched.filter((m) => !m.allChildrenCancelled);

  console.log(`${'='.repeat(60)}`);
  console.log(`  SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Cancellation tab:     ${cancelled.length} children (${cancelledByFamily.size} families)`);
  console.log(`  Found in DB:          ${matched.reduce((s, m) => s + m.cancelledChildren.length, 0)} children (${matched.length} families)`);
  console.log(`    Full cancel:        ${fullCancelDocs.reduce((s, m) => s + m.cancelledChildren.length, 0)} children (${fullCancelDocs.length} families) — entire record can be deleted`);
  console.log(`    Partial cancel:     ${partialCancelDocs.reduce((s, m) => s + m.cancelledChildren.length, 0)} children (${partialCancelDocs.length} families) — needs manual review`);
  console.log(`  Not in DB:            ${notInDb.reduce((s, n) => s + n.children.length, 0)} children (${notInDb.length} families) — already gone`);
  console.log(`  Unknown (DB only):    ${dbOnlyNotCancelled.reduce((s, d) => s + (d.data.children || []).length, 0)} children (${dbOnlyNotCancelled.length} families)`);
  console.log(`${'='.repeat(60)}\n`);
}

run().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
