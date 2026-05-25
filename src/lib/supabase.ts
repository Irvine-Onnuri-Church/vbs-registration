// ============================================================
// DEPRECATED — This file is no longer used by the application.
// The app has been migrated to Firebase Firestore (see firebase.ts).
// Keeping this file for reference in case a rollback to Supabase is needed.
// ============================================================

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side only — bypasses RLS for admin routes. Lazily created to avoid build-time errors.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}