/**
 * Parse VBS_registration.xlsx — RegularVBS, BeginnerVBS, 🍎 AppleTree tabs
 * Normalizes data to match the Firestore registration document format.
 *
 * Usage:
 *   npx tsx scripts/parse-xlsx.ts              # dry-run (default)
 *   npx tsx scripts/parse-xlsx.ts --upload     # sync to Firestore
 */

import 'dotenv/config';
import { readFile, utils } from 'xlsx';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase() === 'yes');
    });
  });
}

const DRY_RUN = !process.argv.includes('--upload');

const filePath = resolve(process.cwd(), 'VBS_registration.xlsx');
const workbook = readFile(filePath);

// ── Firestore document shape (core) ─────────────────────
type ChildDoc = {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  gender: string;
  date_of_birth: string;
  age: number | null;
  grade: string;
  tshirt_size: string;
  allergy_information: string | null;
  medical_notes: string | null;
  price: number;
  class: 'regular' | 'beginner' | 'appletree';
};

type RegistrationDoc = {
  parent_name: string;
  email: string;
  phone_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photo_consent: boolean;
  liability_acknowledgment: boolean;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  payment_status: string;
  payment_time: string | null;
  total_amount: number;
  registration_phase: string;
  created_at: string;
  source: 'online' | 'in_person';
  children: ChildDoc[];
  // Extra fields not in the core model but captured from spreadsheet
  extra: Record<string, string>;
};

// ── Helpers ─────────────────────────────────────────────
function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function normalizeGender(raw: string): string {
  const g = raw.toUpperCase();
  if (g === 'M' || g === 'MALE') return 'Male';
  if (g === 'F' || g === 'FEMALE') return 'Female';
  return raw;
}

function normalizeGrade(raw: string, sheet: string): string {
  if (sheet === 'BeginnerVBS') return 'Pre-K';
  const g = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (g === 'tk' || g.startsWith('tk ') || g.includes('transitional')) return 'Transitional Kindergarten';
  if (g === 'k' || g === 'kindergarten' || g === 'kinder' || g.startsWith('kg') || g.startsWith('kinder ')) return 'Kindergarten';
  if (/^(1st|first|1\b|1 )/.test(g)) return '1st Grade';
  if (/^(2nd|second|2\b|2 )/.test(g)) return '2nd Grade';
  if (/^(3rd|third|3\b|3 |3,)/.test(g)) return '3rd Grade';
  if (/^(4th|fourth|4\b|4 |4,)/.test(g)) return '4th Grade';
  if (/^(5th|fifth|5\b|5 |5,)/.test(g)) return '5th Grade';
  if (/^(6th|sixth|6\b|6 |6,)/.test(g)) return '6th Grade';
  if (g === 'pre-k' || g.startsWith('prek') || g.includes('no school')) return 'Pre-K';
  return raw;
}

function normalizeTshirt(raw: string): string {
  const s = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (s.startsWith('3Y')) return '3Y';
  if (s.startsWith('4Y')) return '4Y';
  if (s.startsWith('5Y')) return '5Y';
  if (s.startsWith('XS')) return 'XS';
  if (s.startsWith('ADULT S')) return 'Adult S';
  if (s.startsWith('ADULT M')) return 'Adult M';
  if (s.startsWith('XL')) return 'XL';
  if (s === 'S' || s.startsWith('S ') || s.startsWith('S(')) return 'S';
  if (s === 'M' || s.startsWith('M ') || s.startsWith('M(')) return 'M';
  if (s === 'L' || s.startsWith('L ') || s.startsWith('L(')) return 'L';
  return raw;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function normalizeDob(raw: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  return raw;
}

function normalizeCreatedAt(raw: string): string {
  if (!raw) return new Date().toISOString();
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(`${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}T12:00:00Z`).toISOString();
  return new Date(raw).toISOString();
}

function normalizeAllergy(raw: string): string | null {
  if (!raw) return null;
  if (/^(none|no|nope|na|n\/a|x|-)$/i.test(raw.trim())) return null;
  return raw;
}

function calculatePrice(grade: string): number {
  return grade === 'Pre-K' ? 40 : 70; // early bird pricing
}

// ── Raw row (captures all columns) ──────────────────────
type RawRow = {
  // Core fields
  signupDate: string;
  paymentMethod: string;
  gradeRaw: string;
  lastName: string;
  firstName: string;
  tshirtRaw: string;
  dob: string;
  genderRaw: string;
  friends: string;
  allergiesRaw: string;
  parentName: string;
  mobile: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  homeChurch: string;
  notes: string;
  sheet: string;
  // Extra sheet-specific fields
  pkJk: string;              // RegularVBS col 2, BeginnerVBS col 2
  months: string;            // BeginnerVBS col 3
  gradeAndAge: string;       // AppleTree col 2 (raw "Grade Completed and Age")
};

function parseRegularVBS(): RawRow[] {
  const sheet = workbook.Sheets['RegularVBS'];
  if (!sheet) return [];
  const raw: unknown[][] = utils.sheet_to_json(sheet, { header: 1, raw: false });
  return raw.slice(2)
    .filter((r) => str(r[4]) || str(r[5]))
    .map((r) => ({
      signupDate: str(r[0]), paymentMethod: str(r[1]), gradeRaw: str(r[3]),
      lastName: str(r[4]), firstName: str(r[5]), tshirtRaw: str(r[6]),
      dob: str(r[7]), genderRaw: str(r[8]), friends: str(r[9]),
      allergiesRaw: str(r[10]), parentName: str(r[11]), mobile: str(r[12]),
      email: str(r[13]), address: str(r[14]), emergencyName: str(r[15]),
      emergencyRelationship: str(r[16]), emergencyPhone: str(r[17]),
      homeChurch: str(r[18]), notes: str(r[19]), sheet: 'RegularVBS',
      pkJk: str(r[2]), months: '', gradeAndAge: '',
    }));
}

function parseBeginnerVBS(): RawRow[] {
  const sheet = workbook.Sheets['BeginnerVBS'];
  if (!sheet) return [];
  const raw: unknown[][] = utils.sheet_to_json(sheet, { header: 1, raw: false });
  return raw.slice(6)
    .filter((r) => str(r[4]) || str(r[5]))
    .map((r) => ({
      signupDate: str(r[0]), paymentMethod: str(r[1]), gradeRaw: 'Pre-K',
      lastName: str(r[4]), firstName: str(r[5]), tshirtRaw: str(r[6]),
      dob: str(r[9]), genderRaw: str(r[7]), friends: str(r[8]),
      allergiesRaw: str(r[10]), parentName: str(r[11]), mobile: str(r[12]),
      email: str(r[13]), address: str(r[14]), emergencyName: str(r[15]),
      emergencyRelationship: str(r[16]), emergencyPhone: str(r[17]),
      homeChurch: str(r[18]), notes: str(r[19]), sheet: 'BeginnerVBS',
      pkJk: str(r[2]), months: str(r[3]), gradeAndAge: '',
    }));
}

function parseAppleTree(): RawRow[] {
  const sheet = workbook.Sheets['🍎 AppleTree'];
  if (!sheet) return [];
  const raw: unknown[][] = utils.sheet_to_json(sheet, { header: 1, raw: false });
  return raw.slice(8)
    .filter((r) => str(r[3]) || str(r[4]))
    .map((r) => ({
      signupDate: str(r[0]), paymentMethod: str(r[1]), gradeRaw: str(r[2]),
      lastName: str(r[3]), firstName: str(r[4]), tshirtRaw: str(r[5]),
      dob: str(r[6]), genderRaw: str(r[7]), friends: str(r[8]),
      allergiesRaw: str(r[9]), parentName: str(r[10]), mobile: str(r[11]),
      email: str(r[12]), address: str(r[13]), emergencyName: str(r[14]),
      emergencyRelationship: str(r[15]), emergencyPhone: str(r[16]),
      homeChurch: str(r[17]), notes: str(r[18]), sheet: '🍎 AppleTree',
      pkJk: '', months: '', gradeAndAge: str(r[2]),
    }));
}

// ── Build extra fields map ──────────────────────────────
function buildExtra(row: RawRow): Record<string, string> {
  const extra: Record<string, string> = {};
  if (row.paymentMethod) extra.payment_method = row.paymentMethod;
  if (row.pkJk) extra.pk_jk = row.pkJk;
  if (row.months) extra.months = row.months;
  if (row.gradeAndAge) extra.grade_and_age = row.gradeAndAge;
  if (row.address) extra.address = row.address;
  if (row.emergencyRelationship) extra.emergency_contact_relationship = row.emergencyRelationship;
  if (row.homeChurch) extra.home_church = row.homeChurch;
  if (row.notes) extra.notes = row.notes;
  extra.source_sheet = row.sheet;
  return extra;
}

// ── Group by parent and build Firestore docs ────────────
function buildRegistrations(rows: RawRow[]): RegistrationDoc[] {
  const groups = new Map<string, { parent: RawRow; children: RawRow[] }>();

  for (const row of rows) {
    const key = row.email
      ? row.email.toLowerCase().trim()
      : `${row.parentName}|${row.mobile}`.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, { parent: row, children: [] });
    }
    groups.get(key)!.children.push(row);
  }

  const docs: RegistrationDoc[] = [];

  for (const [, group] of groups) {
    const { parent } = group;

    // Merge extra fields from all children rows (parent-level extras come from first row)
    const mergedExtra = buildExtra(parent);

    const children: ChildDoc[] = group.children.map((row) => {
      const grade = normalizeGrade(row.gradeRaw, row.sheet);
      const dob = normalizeDob(row.dob);
      return {
        first_name: row.firstName,
        last_name: row.lastName,
        preferred_name: null,
        gender: normalizeGender(row.genderRaw),
        date_of_birth: dob,
        age: dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
        grade,
        tshirt_size: normalizeTshirt(row.tshirtRaw),
        allergy_information: normalizeAllergy(row.allergiesRaw),
        medical_notes: row.friends || null,
        price: calculatePrice(grade),
        class: row.sheet === 'BeginnerVBS' ? 'beginner' : row.sheet === '🍎 AppleTree' ? 'appletree' : 'regular',
      };
    });

    const totalAmount = children.reduce((sum, c) => sum + c.price, 0);

    docs.push({
      parent_name: parent.parentName,
      email: parent.email ? parent.email.toLowerCase().trim() : '',
      phone_number: normalizePhone(parent.mobile),
      emergency_contact_name: parent.emergencyName,
      emergency_contact_phone: normalizePhone(parent.emergencyPhone),
      photo_consent: true,
      liability_acknowledgment: true,
      paypal_order_id: null,
      paypal_capture_id: null,
      payment_status: 'completed',
      payment_time: null,
      total_amount: totalAmount,
      registration_phase: 'early',
      created_at: normalizeCreatedAt(parent.signupDate),
      source: 'in_person',
      children,
      extra: mergedExtra,
    });
  }

  return docs;
}

// ── Match key: email (primary) or parent_name|phone (fallback) ──
function matchKey(doc: RegistrationDoc): string {
  if (doc.email) return doc.email.toLowerCase().trim();
  return `${doc.parent_name}|${doc.phone_number}`.toLowerCase();
}

function matchKeyFromFirestore(data: FirebaseFirestore.DocumentData): string {
  const email = (data.email || '').toLowerCase().trim();
  if (email) return email;
  return `${data.parent_name || ''}|${data.phone_number || ''}`.toLowerCase();
}

// ── Firebase init (only when uploading) ─────────────────
function getDb() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (!serviceAccount.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set or invalid. Check your .env file.');
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

// ── Diff against Firestore ──────────────────────────────
type MergePayload = {
  source: 'online';
  extra: Record<string, string>;
  children: { class: 'regular' | 'beginner' | 'appletree' }[];
};

type SyncPlan = {
  toCreate: { key: string; doc: RegistrationDoc }[];
  toMerge: { key: string; doc: RegistrationDoc; existingId: string; existingData: FirebaseFirestore.DocumentData; merge: MergePayload }[];
  dbOnly: { key: string; id: string; data: FirebaseFirestore.DocumentData }[];
};

async function buildSyncPlan(registrations: RegistrationDoc[]): Promise<SyncPlan> {
  const db = getDb();
  const snapshot = await db.collection('registrations').get();

  const existingByKey = new Map<string, { id: string; data: FirebaseFirestore.DocumentData }>();
  snapshot.docs.forEach((doc) => {
    const key = matchKeyFromFirestore(doc.data());
    existingByKey.set(key, { id: doc.id, data: doc.data() });
  });

  const toCreate: SyncPlan['toCreate'] = [];
  const toMerge: SyncPlan['toMerge'] = [];

  for (const doc of registrations) {
    const key = matchKey(doc);
    const existing = existingByKey.get(key);
    if (existing) {
      // Build merge payload: patch source, extra, and class onto each child
      const merge: MergePayload = {
        source: 'online',
        extra: doc.extra,
        children: doc.children.map((c) => ({ class: c.class })),
      };
      toMerge.push({ key, doc, existingId: existing.id, existingData: existing.data, merge });
      existingByKey.delete(key);
    } else {
      toCreate.push({ key, doc });
    }
  }

  const dbOnly: SyncPlan['dbOnly'] = [];
  for (const [key, { id, data }] of existingByKey) {
    dbOnly.push({ key, id, data });
  }

  return { toCreate, toMerge, dbOnly };
}

async function executeSyncPlan(plan: SyncPlan) {
  const db = getDb();
  const collection = db.collection('registrations');
  let batch = db.batch();
  let batchCount = 0;

  const flush = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const { doc } of plan.toCreate) {
    batch.set(collection.doc(), doc);
    batchCount++;
    if (batchCount >= 450) await flush();
  }

  for (const { existingId, existingData, merge } of plan.toMerge) {
    // Patch class onto each existing child by index, add source and extra
    const updatedChildren = (existingData.children || []).map(
      (child: Record<string, unknown>, i: number) => ({
        ...child,
        class: merge.children[i]?.class ?? child.class,
      })
    );
    batch.update(collection.doc(existingId), {
      source: merge.source,
      extra: merge.extra,
      children: updatedChildren,
    });
    batchCount++;
    if (batchCount >= 450) await flush();
  }

  await flush();
}

// ── Run ─────────────────────────────────────────────────
const allRows = [...parseRegularVBS(), ...parseBeginnerVBS(), ...parseAppleTree()];
const registrations = buildRegistrations(allRows);

const regularCount = allRows.filter((r) => r.sheet === 'RegularVBS').length;
const beginnerCount = allRows.filter((r) => r.sheet === 'BeginnerVBS').length;
const appleTreeCount = allRows.filter((r) => r.sheet === '🍎 AppleTree').length;

console.log(`\n${'='.repeat(60)}`);
console.log(`  ${DRY_RUN ? 'DRY RUN MODE — no data will be uploaded' : 'UPLOAD MODE — will sync to Firestore'}`);
console.log(`${'='.repeat(60)}\n`);

console.log(`Parsed ${allRows.length} children across ${registrations.length} families\n`);
console.log(`  RegularVBS:  ${regularCount} children`);
console.log(`  BeginnerVBS: ${beginnerCount} children`);
console.log(`  AppleTree:   ${appleTreeCount} children\n`);

// ── Print every registration ────────────────────────────
console.log(`${'━'.repeat(60)}`);
console.log(`  ALL REGISTRATION DOCUMENTS (${registrations.length})`);
console.log(`${'━'.repeat(60)}\n`);

registrations.forEach((doc, i) => {
  console.log(`[${i + 1}/${registrations.length}] ${doc.parent_name} <${doc.email || '(no email)'}>`);
  console.log(`    Phone: ${doc.phone_number || '(none)'}`);
  console.log(`    Emergency: ${doc.emergency_contact_name || '(none)'} ${doc.emergency_contact_phone || ''}`);
  console.log(`    Status: ${doc.payment_status} | Phase: ${doc.registration_phase} | Total: $${doc.total_amount}`);
  console.log(`    Created: ${doc.created_at}`);

  // Extra fields
  const extras = Object.entries(doc.extra).filter(([, v]) => v);
  if (extras.length > 0) {
    console.log(`    Extra: ${extras.map(([k, v]) => `${k}=${v}`).join(' | ')}`);
  }

  console.log(`    Children (${doc.children.length}):`);
  doc.children.forEach((c, ci) => {
    console.log(`      ${ci + 1}. ${c.first_name} ${c.last_name}`);
    console.log(`         Grade: ${c.grade} | Gender: ${c.gender} | DOB: ${c.date_of_birth || '(none)'} | Age: ${c.age ?? '?'}`);
    console.log(`         T-Shirt: ${c.tshirt_size || '(none)'} | Class: ${c.class} | Price: $${c.price}`);
    if (c.allergy_information) console.log(`         Allergies: ${c.allergy_information}`);
    if (c.medical_notes) console.log(`         Friends: ${c.medical_notes}`);
  });
  console.log('');
});

// ── Validation ──────────────────────────────────────────
console.log(`${'━'.repeat(60)}`);
console.log(`  VALIDATION`);
console.log(`${'━'.repeat(60)}\n`);

type Warning = { sheet: string; message: string };
const warnings: Warning[] = [];
registrations.forEach((doc, i) => {
  const sheet = doc.extra.source_sheet || 'Unknown';
  const label = `[${i + 1}] ${doc.parent_name}`;
  if (!doc.parent_name) warnings.push({ sheet, message: `${label}: missing parent_name` });
  if (!doc.email) warnings.push({ sheet, message: `${label}: missing email` });
  if (!doc.phone_number) warnings.push({ sheet, message: `${label}: missing phone_number` });
  if (!doc.emergency_contact_name) warnings.push({ sheet, message: `${label}: missing emergency_contact_name` });
  if (!doc.emergency_contact_phone) warnings.push({ sheet, message: `${label}: missing emergency_contact_phone` });
  doc.children.forEach((c) => {
    const childLabel = `${label} → ${c.first_name} ${c.last_name}`;
    if (!c.first_name && !c.last_name) warnings.push({ sheet, message: `${childLabel}: missing name` });
    if (!c.grade) warnings.push({ sheet, message: `${childLabel}: missing grade` });
    if (!c.tshirt_size) warnings.push({ sheet, message: `${childLabel}: missing tshirt_size` });
    if (!c.date_of_birth) warnings.push({ sheet, message: `${childLabel}: missing date_of_birth` });
    if (!c.gender) warnings.push({ sheet, message: `${childLabel}: missing gender` });
  });
});

const sheetNames = ['RegularVBS', 'BeginnerVBS', '🍎 AppleTree'];
for (const sn of sheetNames) {
  const sheetWarnings = warnings.filter((w) => w.sheet === sn);
  console.log(`  ── ${sn} (${sheetWarnings.length} warnings) ──`);
  if (sheetWarnings.length === 0) {
    console.log('  ✅ No warnings.\n');
  } else {
    sheetWarnings.forEach((w) => console.log(`    ⚠️  ${w.message}`));
    console.log('');
  }
}
console.log(`  ${warnings.length} warning(s) total.\n`);

// ── Summary ─────────────────────────────────────────────
const allGrades = new Map<string, number>();
const allSizes = new Map<string, number>();
const allPayment = new Map<string, number>();
registrations.forEach((doc) => {
  doc.children.forEach((c) => {
    allGrades.set(c.grade, (allGrades.get(c.grade) || 0) + 1);
    if (c.tshirt_size) allSizes.set(c.tshirt_size, (allSizes.get(c.tshirt_size) || 0) + 1);
  });
  const pm = doc.extra.payment_method || 'Unknown';
  allPayment.set(pm, (allPayment.get(pm) || 0) + 1);
});

console.log('Grade breakdown:');
[...allGrades.entries()].sort((a, b) => b[1] - a[1]).forEach(([g, n]) => console.log(`  ${g}: ${n}`));

console.log('\nT-shirt breakdown:');
[...allSizes.entries()].sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${s}: ${n}`));

console.log('\nPayment method breakdown:');
[...allPayment.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${p}: ${n}`));

const totalRevenue = registrations.reduce((sum, d) => sum + d.total_amount, 0);
console.log(`\nTotal revenue: $${totalRevenue}`);

// ── Sync plan & execution ───────────────────────────────
async function run() {
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  FIRESTORE SYNC ${DRY_RUN ? 'PREVIEW' : 'EXECUTING'}...`);
  console.log(`${'━'.repeat(60)}\n`);

  const plan = await buildSyncPlan(registrations);

  const totalChildren = registrations.reduce((sum, d) => sum + d.children.length, 0);
  const createChildren = plan.toCreate.reduce((sum, { doc }) => sum + doc.children.length, 0);
  const mergeChildren = plan.toMerge.reduce((sum, { doc }) => sum + doc.children.length, 0);
  const dbOnlyChildren = plan.dbOnly.reduce((sum, { data }) => sum + (data.children || []).length, 0);

  if (plan.toCreate.length > 0) {
    console.log(`  NEW — ${createChildren} children (${plan.toCreate.length} families), source: in_person`);
    plan.toCreate.forEach(({ doc }) => {
      doc.children.forEach((c) => {
        console.log(`    + ${c.first_name} ${c.last_name} | ${c.grade} | ${c.class} | parent: ${doc.parent_name}`);
      });
    });
    console.log('');
  }

  if (plan.toMerge.length > 0) {
    console.log(`  MERGE — ${mergeChildren} children (${plan.toMerge.length} families), source: online — will patch class, extra, source:`);
    plan.toMerge.forEach(({ doc }) => {
      doc.children.forEach((c) => {
        console.log(`    ~ ${c.first_name} ${c.last_name} | ${c.grade} | ${c.class} | parent: ${doc.parent_name}`);
      });
    });
    console.log('');
  }

  if (plan.dbOnly.length > 0) {
    console.log(`  DB ONLY — ${dbOnlyChildren} children (${plan.dbOnly.length} families) in DB but not in XLSX (kept as-is):`);
    plan.dbOnly.forEach(({ data }) => {
      (data.children || []).forEach((c: { first_name?: string; last_name?: string; grade?: string }) => {
        console.log(`    . ${c.first_name || ''} ${c.last_name || ''} | ${c.grade || '?'} | parent: ${data.parent_name || '(no name)'}`);
      });
    });
    console.log('');
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`  SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  XLSX:       ${totalChildren} children (${registrations.length} families)`);
  console.log(`  To create:  ${createChildren} children (${plan.toCreate.length} families) — source: in_person`);
  console.log(`  To merge:   ${mergeChildren} children (${plan.toMerge.length} families) — source: online, patch class + extra`);
  console.log(`  DB only:    ${dbOnlyChildren} children (${plan.dbOnly.length} families) — not in XLSX, kept as-is`);
  console.log(`  Revenue:    $${totalRevenue}`);
  console.log(`${'='.repeat(60)}`);

  if (DRY_RUN) {
    console.log(`\n  DRY RUN — no changes were made.`);
    console.log(`  Run with --upload to apply these changes.\n`);
  } else {
    const ok = await confirm(`\n  This will create ${createChildren} children and merge ${mergeChildren} records. Type "yes" to proceed: `);
    if (!ok) {
      console.log('  Aborted.\n');
      process.exit(0);
    }
    console.log(`\n  Applying changes...`);
    await executeSyncPlan(plan);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  SYNC COMPLETE`);
    console.log(`    Created: ${createChildren} children (${plan.toCreate.length} families)`);
    console.log(`    Merged:  ${mergeChildren} children (${plan.toMerge.length} families)`);
    console.log(`    DB only: ${dbOnlyChildren} children (${plan.dbOnly.length} families) — untouched`);
    console.log(`${'='.repeat(60)}`);
  }
}

run().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
