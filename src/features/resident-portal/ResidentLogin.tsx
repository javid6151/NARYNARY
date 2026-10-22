/**
 * Dedicated Resident Portal Login for Port 5000.
 * Completely scoped to residents — redesigned with the ZIPNARY Enterprise Design System.
 */
import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ErrorBanner, Field, Input } from '../../components/ui';
import { useAuth } from '../access/useAuth';
import { claimPendingAccess, determinePortalRoute, getMyAccess } from '../access/api';
import { signInWithPassword } from '../auth/api';
import { supabase } from '../../lib/supabase';
import '../owner/owner-portal.css';

export function ResidentLogin() {
  const { refreshAccess } = useAuth();
  const [identifier, setIdentifier] = useState(() => {
    try {
      return localStorage.getItem('zipnary_last_login_id') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const err = await signInWithPassword(identifier.trim(), password);
      if (err) {
        setError(err);
        setBusy(false);
        return;
      }

      if (rememberMe) {
        try {
          localStorage.setItem('zipnary_last_login_id', identifier.trim());
        } catch {}
      } else {
        try {
          localStorage.removeItem('zipnary_last_login_id');
        } catch {}
      }

      try {
        await claimPendingAccess();
      } catch (claimErr) {
        console.warn('claimPendingAccess non-fatal:', claimErr);
      }

      await refreshAccess();

      const freshAccess = await getMyAccess();
      const { port: targetPort, path: targetPath } = await determinePortalRoute(freshAccess, true);
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const currentPort = typeof window !== 'undefined' && window.location.port ? Number(window.location.port) : 5000;

      // If this user is an Owner, Manager, Chef, or Super Admin on local dev, route to port
      if (isLocalhost && targetPort && targetPort !== currentPort) {
        const s = (await supabase.auth.getSession()).data.session;
        const hash = s ? `#access_token=${s.access_token}&refresh_token=${s.refresh_token}&token_type=bearer` : '';
        window.location.href = `http://localhost:${targetPort}${targetPath}${hash}`;
        return;
      }

      // If resident on port 5000, reload window or navigate to resident route
      window.location.href = targetPath || '/';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid Login ID or Password. Please check and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="owner-portal min-h-screen bg-[#F5F0E8] text-[#30271F] flex flex-col justify-center items-center p-4 selection:bg-[#343B2B] selection:text-white">
      <div className="w-full max-w-md">
        {/* Resident Portal Branding Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="size-12 rounded-2xl bg-[#343B2B] text-white flex items-center justify-center font-bold text-xl shadow-xs mx-auto mb-2">
            <span>Z</span>
          </div>
          <div>
            <span className="font-bold text-2xl tracking-tight text-[#30271F] block leading-tight">ZIPNARY</span>
            <span className="text-[11px] font-semibold tracking-wider text-[#77736B] uppercase">Resident Portal</span>
          </div>
          <p className="text-xs text-[#77736B] max-w-sm mx-auto">
            Access your room details, rent payment receipts, mess meals, notices and complaints.
          </p>
        </div>

        {/* Resident Login Card */}
        <div className="bg-[#FFFEFC] rounded-3xl border border-[#DED6CB] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#343B2B]" />

          <div className="mb-6 pb-4 border-b border-[#DED6CB] flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#30271F]">Resident Sign In</h1>
              <p className="text-xs text-[#77736B] mt-0.5">Enter your registered mobile or email</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]">
              <ShieldCheck className="size-3.5" />
              Resident
            </span>
          </div>

          {error && <div className="mb-4"><ErrorBanner error={error} /></div>}
          {info && (
            <div className="mb-4 p-3 rounded-xl bg-[#EBF0E6] border border-[#CAD7BF] text-xs text-[#2F5233] leading-relaxed">
              {info}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <Field label="Mobile Number or Email" required>
              {(id) => (
                <Input
                  id={id}
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 9876543210 or resident@email.com"
                  autoComplete="username"
                  className="h-11 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
                  required
                />
              )}
            </Field>

            <Field label="Password / PIN" required>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
                  required
                />
              )}
            </Field>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-1.5 text-xs text-[#59534B] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-3.5 rounded border-[#DED6CB] text-[#343B2B] focus:ring-[#343B2B] cursor-pointer"
                />
                <span>Save login details</span>
              </label>
              <button
                type="button"
                onClick={() => setInfo('If you forgot your password or PIN, please ask your PG manager to reset it for you.')}
                className="text-[#343B2B] hover:underline font-medium cursor-pointer"
              >
                Forgot PIN?
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-full bg-[#343B2B] hover:bg-[#252B1E] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 mt-2"
            >
              <span>{busy ? 'Authenticating…' : 'Sign In to Resident Portal'}</span>
              <ArrowRight className="size-4" />
            </button>
          </form>

          <div className="pt-6 border-t border-[#DED6CB] text-center text-xs text-[#77736B] mt-6 space-y-1">
            <p>Staying at a PG managed by Zipnary?</p>
            <p className="text-[11.5px] text-[#77736B]">
              Your PG manager creates your resident account during admission.
            </p>
          </div>
        </div>

        {/* Quick Footer */}
        <p className="text-center text-[11px] text-[#77736B] mt-6">
          Zipnary Resident Portal • Port 5000
        </p>
      </div>
    </div>
  );
}
