/**
 * Supabase Auth calls used by the login/sign-up page. Error messages are mapped to friendly text here.
 * Roles and access are never decided here; they come from `my_access` after sign-in.
 */
import { supabase } from '../../lib/supabase';

/** Creates and saves an email/password account. Ensures email is confirmed and user is logged in. */
export async function signUpWithPassword(email: string, password: string, fullName: string) {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || 'Failed to create account. Please try again.', needsVerification: false };
    }

    // Automatically sign in with the saved credentials so the session is immediately active
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      return { error: signInErr.message, needsVerification: false };
    }

    return { error: null, needsVerification: false };
  } catch {
    // Fallback to client signup if local proxy isn't reached
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null, needsVerification: !error && !data.session };
  }
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
      if (!res.ok || data.error || !data.email) {
        return data.error || 'Invalid Login ID or Password. Please check and try again.';
      }
      email = data.email;
    } catch {
      return 'Invalid Login ID or Password. Please check and try again.';
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;

  if (error.message?.toLowerCase().includes('banned') || error.code === 'user_banned') {
    return 'Your portal access has been suspended by management. Please contact your PG manager or owner.';
  }
  if (error.message?.toLowerCase().includes('rate limit')) {
    return 'Too many login attempts. Please wait a moment and try again.';
  }
  if (error.message?.toLowerCase().includes('email not confirmed')) {
    return 'Email not confirmed. Please check your inbox or verify your account.';
  }

  return 'Invalid Login ID or Password. Please check and try again.';
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

