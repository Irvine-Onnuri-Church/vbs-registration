import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: children, error } = await supabase
    .from('children')
    .select('*, registrations(email, created_at, paypal_order_id)')
    .ilike('first_name', '%jayden%');

  if (error) { console.error(error); return; }

  console.log(`Found ${children?.length ?? 0} children matching "jayden":`);
  for (const c of (children || [])) {
    console.log(`  ${c.first_name} ${c.last_name} (grade: ${c.grade})`);
    console.log(`    Registration: ${(c as any).registrations?.email}`);
    console.log(`    Created: ${(c as any).registrations?.created_at}`);
    console.log(`    PayPal: ${(c as any).registrations?.paypal_order_id}`);
    console.log();
  }

  const { data: regs } = await supabase
    .from('registrations')
    .select('*, children(*)')
    .eq('email', 'pianist.hur@gmail.com');

  console.log(`\nRegistrations for pianist.hur@gmail.com: ${regs?.length ?? 0}`);
  for (const r of (regs || [])) {
    console.log(`  Reg ID: ${r.id} | Created: ${r.created_at} | PayPal: ${r.paypal_order_id}`);
    for (const c of (r.children || [])) {
      console.log(`    Child: ${c.first_name} ${c.last_name} (grade: ${c.grade})`);
    }
  }
}

main().catch(console.error);
