/**
 * Sign-in and sign-up page (email/password, plus Google where configured).
 * After sign-in, AuthProvider loads the user's access and the router sends them to their portal.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, LineChart, Lock, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Button, ErrorBanner, Field, Input } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { CURRENT_PORTAL } from '../../lib/portals';
import { signInWithGoogle, signInWithPassword, signUpWithPassword } from './api';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: 'Secure & private', text: 'Each business’s data is isolated and access is role-based.' },
  { icon: Building2, title: 'Complete management', text: 'Buildings, rooms, residents, payments, mess and staff in one place.' },
  { icon: LineChart, title: 'Real-time insights', text: 'Occupancy, collections and expenses as they happen.' },
  { icon: Lock, title: 'Data protection', text: 'Documents are private; every sensitive action is audited.' },
];

export default function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const signup = mode === 'signup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    if (signup) {
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
        <Logo dark subtitle="PG & Hostel Management" />
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
            <Logo subtitle="PG & Hostel Management" />
          </div>
          <div>
            {CURRENT_PORTAL && <p className="text-[12px] font-medium text-brand-600 mb-1">{CURRENT_PORTAL.label} portal</p>}
            <h1 className="text-2xl font-semibold">{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="text-[13px] text-muted mt-1">
              {signup
                ? 'PG owners register here. Residents and staff: sign up with the email your PG has on file.'
                : 'Sign in to your owner, staff, kitchen or resident portal.'}
            </p>
          </div>
          <ErrorBanner error={error} />
          {info && <div role="status" className="rounded-lg bg-ok-bg text-ok text-[13px] px-3 py-2">{info}</div>}
          {signup && (
            <Field label="Full name" required>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
            </Field>
          )}
          <Field label="Email" required>
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}
          </Field>
          <Field label="Password" required hint={signup ? 'At least 8 characters' : undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
              />
            )}
          </Field>
          <Button type="submit" busy={busy} className="w-full">{signup ? 'Create account' : 'Sign in'}</Button>
          <div className="relative text-center text-[12px] text-muted before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-line">
            <span className="relative bg-white px-2">or</span>
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={google}>Continue with Google</Button>
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
        </form>
      </div>
    </div>
  );
}
