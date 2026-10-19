/**
 * Sign-in and sign-up page (email/password, plus Google where configured).
 * After sign-in, AuthProvider loads the user's access and the router sends them to their portal.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LineChart, Lock, ShieldCheck, KeyRound, type LucideIcon } from 'lucide-react';
import { Button, ErrorBanner, Field, Input } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { CURRENT_PORTAL } from '../../lib/portals';
import { signInWithGoogle, signInWithPassword, signUpWithPassword } from './api';
import { SuperAdminPasswordModal } from '../platform/components/SuperAdminPasswordModal';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: 'Secure & private', text: 'Each business’s data is isolated and access is role-based.' },
  { icon: Building2, title: 'Complete management', text: 'Buildings, rooms, residents, payments, mess and staff in one place.' },
  { icon: LineChart, title: 'Real-time insights', text: 'Occupancy, collections and expenses as they happen.' },
  { icon: Lock, title: 'Data protection', text: 'Documents are private; every sensitive action is audited.' },
];

export default function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const isPlatformPortal =
    CURRENT_PORTAL?.id === 'platform' ||
    (typeof window !== 'undefined' &&
      (window.location.port === '1000' || window.location.pathname.startsWith('/platform')));

  const [email, setEmail] = useState(isPlatformPortal ? 'zipco@gmail.com' : '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    if (isPlatformPortal) {
      if (email.trim().toLowerCase() !== 'zipco@gmail.com') {
        setError('Strict Access Policy: Only the authorized Super Admin account (zipco@gmail.com) is permitted to sign in to this portal.');
        setBusy(false);
        return;
      }
    }

    if (signup) {
      if (isPlatformPortal) {
        setError('Super Admin accounts are strictly provisioned and cannot be registered publicly.');
        setBusy(false);
        return;
      }
      if (password.length < 8) {
        setError('Use at least 8 characters for your password.');
        setBusy(false);
        return;
      }
      const r = await signUpWithPassword(email.trim(), password, name.trim());
      if (r.error) setError(r.error);
      else if (r.needsVerification) setInfo('Check your email to verify your account, then sign in.');
    } else {
      const err = await signInWithPassword(email.trim(), password);
      if (err) setError(err);
    }
    setBusy(false);
  };

  const google = async () => {
    const err = await signInWithGoogle();
    if (err) setError(err);
  };

  return (
    <div className="min-h-full grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-nav text-nav-text p-12">
        <Logo dark subtitle={isPlatformPortal ? 'ZIPCO Super Admin' : 'PG & Hostel Management'} />
        <ul className="space-y-7 max-w-sm">
          {FEATURES.map(({ icon: I, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="size-10 rounded-lg bg-white/5 grid place-items-center shrink-0">
                <I className="size-5 text-white" aria-hidden />
              </span>
              <div>
                <p className="text-white font-medium">{title}</p>
                <p className="text-[13px] mt-0.5">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[12px]">© {new Date().getFullYear()} ZIPCO Solutions</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-white">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
          <div className="lg:hidden mb-6">
            <Logo subtitle={isPlatformPortal ? 'ZIPCO Super Admin' : 'PG & Hostel Management'} />
          </div>
          <div>
            <p className="text-[12px] font-medium text-brand-600 mb-1">
              {isPlatformPortal ? 'ZIPCO Super Admin Portal' : CURRENT_PORTAL ? `${CURRENT_PORTAL.label} portal` : 'SaaS portal'}
            </p>
            <h1 className="text-2xl font-semibold">
              {signup ? 'Create your account' : isPlatformPortal ? 'Super Admin Login' : 'Welcome back'}
            </h1>
            <p className="text-[13px] text-muted mt-1">
              {isPlatformPortal
                ? 'Sign in with your master Super Admin credentials (zipco@gmail.com).'
                : signup
                ? 'PG owners register here. Residents and staff: sign up with the email your PG has on file.'
                : 'Sign in to your owner, staff, kitchen or resident portal.'}
            </p>
          </div>
          <ErrorBanner error={error} />
          {info && <div role="status" className="rounded-lg bg-ok-bg text-ok text-[13px] px-3 py-2">{info}</div>}
          {signup && !isPlatformPortal && (
            <Field label="Full name" required>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
            </Field>
          )}
          <Field
            label={isPlatformPortal ? 'Super Admin Email' : CURRENT_PORTAL?.id === 'resident' ? 'Mobile Number (User ID)' : signup ? 'Email' : 'Mobile Number or Email'}
            required
            hint={isPlatformPortal ? 'Master Administrator: zipco@gmail.com' : CURRENT_PORTAL?.id === 'resident' && !signup ? 'Sign in with your registered mobile number and unique password' : undefined}
          >
            {(id) => (
              <Input
                id={id}
                type={isPlatformPortal || signup ? 'email' : 'text'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder={isPlatformPortal ? 'zipco@gmail.com' : CURRENT_PORTAL?.id === 'resident' ? 'Enter 10-digit mobile number' : signup ? 'name@example.com' : 'Mobile number or email'}
                required
              />
            )}
          </Field>
          <div>
            <Field label="Password" required hint={signup ? 'At least 8 characters' : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  placeholder={isPlatformPortal ? 'Enter password (zipcozipco)' : '••••••••'}
                  required
                />
              )}
            </Field>
            {isPlatformPortal && (
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="text-[12px] text-brand-600 hover:text-brand-700 font-medium cursor-pointer inline-flex items-center gap-1 hover:underline"
                >
                  <KeyRound className="size-3.5" />
                  Forgot or change password?
                </button>
              </div>
            )}
          </div>
          <Button type="submit" busy={busy} className="w-full">
            {signup && !isPlatformPortal ? 'Create account' : 'Sign in'}
          </Button>

          {!isPlatformPortal && (
            <>
              <div className="relative text-center text-[12px] text-muted before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-line">
                <span className="relative bg-white px-2">or</span>
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={google}>
                Continue with Google
              </Button>
              <p className="text-center text-[13px] text-muted">
                {signup ? (
                  <>
                    Already have an account? <Link className="text-brand-600 font-medium" to="/login">Sign in</Link>
                  </>
                ) : (
                  <>
                    New here? <Link className="text-brand-600 font-medium" to="/signup">Create an account</Link>
                  </>
                )}
              </p>
            </>
          )}
        </form>
      </div>

      <SuperAdminPasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onPasswordChanged={() => {
          setShowPasswordModal(false);
          setInfo('Super Admin password successfully updated! You can now sign in with your new password.');
        }}
      />
    </div>
  );
}

