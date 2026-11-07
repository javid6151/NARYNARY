import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configError = !url || !anonKey
  ? 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.'
  : null;

// Public anon key only. Authorization is enforced by RLS and security-definer RPCs.
// Each local port (1000, 2000, 3000, 4000, 5000) has a completely isolated origin storage in the browser.
export const supabase = createClient<Database>(url || '', anonKey || 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

