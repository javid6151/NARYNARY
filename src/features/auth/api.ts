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

/** Signs in with either email or mobile number (User ID). */
export async function signInWithPassword(identifier: string, password: string) {
  let email = identifier.trim();

  // If user entered a mobile number, resolve it to their account email
  if (!email.includes('@')) {
    try {
      const res = await fetch('/api/auth/resolve-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return data.error || 'No registered account found with this mobile number.';
      }
      email = data.email;
    } catch {
      return 'Could not verify mobile number. Please check your connection or use email.';
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  return error.message === 'Invalid login credentials' ? 'Mobile number / Email or password is incorrect.' : error.message;
}

/** Provisions or updates a unique password for a resident account. */
export async function setResidentPassword(params: {
  residentId?: string;
  phone: string;
  email?: string;
  fullName: string;
  password: string;
}) {
  const res = await fetch('/api/auth/set-resident-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to update resident password');
  }
  return data;
}

/** Starts Google OAuth (only works where the provider is configured). */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  return error ? 'Google sign-in is not configured for this environment.' : null;
}

/** Updates Super Admin password by verifying previous password. */
export async function changeSuperAdminPassword(previousPassword: string, newPassword: string) {
  const res = await fetch('/api/auth/superadmin-change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previousPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to update superadmin password');
  }
  return data;
}

/** Sends password reset email for Super Admin to master recovery email shaikjavid6151@gmail.com. */
export async function sendSuperAdminResetEmail() {
  const res = await fetch('/api/auth/superadmin-send-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to dispatch reset email');
  }
  return data;
}

