// Reads the local Supabase stack's URL and keys from `supabase status`.
// Local-development only — never point these scripts at a production project.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export function localEnv() {
  const out = execSync('npx supabase@2.121.0 status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const s = JSON.parse(out.slice(out.indexOf('{')));
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(s.API_URL)) {
    throw new Error('Refusing to run: API_URL is not a local Supabase instance');
  }
  return { url: s.API_URL, anonKey: s.ANON_KEY, serviceKey: s.SERVICE_ROLE_KEY };
}

export function adminClient(env) {
  return createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function userClient(env, email, password) {
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

export async function ensureUser(admin, email, password, fullName) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  return data.user.id;
}

export function must({ data, error }, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export const key = () => crypto.randomUUID();
