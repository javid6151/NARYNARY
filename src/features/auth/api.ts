/**
 * Supabase Auth calls used by the login/sign-up page. Error messages are mapped to friendly text here.
 * Roles and access are never decided here; they come from `my_access` after sign-in.
 */
import { supabase } from '../../lib/supabase';

/** Creates an email/password account. Returns `needsVerification` when email confirmation is on. */
export async function signUpWithPassword(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
  });
  return { error: error?.message ?? null, needsVerification: !error && !data.session };
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  return error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message;
}

/** Starts Google OAuth (only works where the provider is configured). */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  return error ? 'Google sign-in is not configured for this environment.' : null;
}
