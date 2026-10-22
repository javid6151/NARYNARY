/**
 * Public ZIPNARY SaaS Marketing Website (`/`).
 * Explains the SaaS product, features, role portals, and provides an integrated sign-in
 * and sign-up card right on the home page.
 * Redesigned with the ZIPNARY Enterprise Design System (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, Users, UtensilsCrossed, Wrench, ArrowRight, CheckCircle2,
  Smartphone, Sparkles, ChevronRight, BedDouble, Receipt, ShieldCheck,
  Lock, Star, ShieldAlert
} from 'lucide-react';
import { Button, ErrorBanner, Field, Input } from '../../components/ui';
import { useAuth } from '../access/useAuth';
import { claimPendingAccess, determinePortalRoute, getMyAccess } from '../access/api';
import { signInWithPassword, signUpWithPassword } from '../auth/api';
import { BRAND } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import '../owner/owner-portal.css';

export default function LandingPage() {
  const { session, homePath, staff, resident, chef, access, refreshAccess, signOut } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: Sign In or Sign Up
  const [tab, setTab] = useState<'signin' | 'signup'>(() =>
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin',
  );

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setTab('signup');
    }
  }, [searchParams]);

  const [identifier, setIdentifier] = useState(() => {
    try {
      return localStorage.getItem('zipnary_last_login_id') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
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
      const currentPort = typeof window !== 'undefined' && window.location.port ? Number(window.location.port) : 5000;

      if (currentPort !== targetPort && targetPort) {
        const s = (await supabase.auth.getSession()).data.session;
        const hash = s ? `#access_token=${s.access_token}&refresh_token=${s.refresh_token}&token_type=bearer` : '';
        window.location.href = `http://localhost:${targetPort}${targetPath}${hash}`;
      } else {
        nav(targetPath, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid Login ID or Password. Please check and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    if (signupPassword.length < 8) {
      setError('Use at least 8 characters for your password.');
      setBusy(false);
      return;
    }

    try {
      const r = await signUpWithPassword(signupEmail.trim(), signupPassword, name.trim());
      if (r.error) {
        setError(r.error);
      } else if (r.needsVerification) {
        setInfo('Check your email to verify your account, then sign in.');
      } else {
        try {
          localStorage.setItem('zipnary_last_login_id', signupEmail.trim());
        } catch {}
        await refreshAccess();
        nav('/onboarding', { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const getPortalLabel = () => {
    if (access?.is_platform_admin) return 'Platform Super Admin';
    if (staff?.role === 'owner') return 'Owner Portal';
    if (staff?.role === 'manager') return 'Manager Portal';
    if (chef) return 'Kitchen Portal';
    if (resident) return 'Resident Portal';
    return 'My Portal';
  };

  return (
    <div className="owner-portal min-h-screen bg-[#F5F0E8] text-[#30271F] flex flex-col font-sans selection:bg-[#343B2B] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#343B2B] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                <span>Z</span>
              </div>
              <div>
                <span className="font-bold text-[17px] tracking-tight text-[#30271F] block leading-tight">ZIPNARY</span>
                <span className="text-[10px] font-semibold tracking-wider text-[#77736B] uppercase">PG & Hostel SaaS</span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-[13.5px] font-medium text-[#59534B]">
              <a href="#features" className="hover:text-[#30271F] transition-colors">Features</a>
              <a href="#portals" className="hover:text-[#30271F] transition-colors">Portals</a>
              <a href="#capabilities" className="hover:text-[#30271F] transition-colors">Capabilities</a>
              <a href="#security" className="hover:text-[#30271F] transition-colors">Enterprise Security</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => nav(homePath)}
                  className="rounded-full bg-[#343B2B] hover:bg-[#252B1E] text-white px-5 py-2 text-xs font-semibold shadow-xs flex items-center gap-2"
                >
                  <span>Go to {getPortalLabel()}</span>
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                  }}
                  className="rounded-full bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] border border-[#DED6CB] text-xs h-9 px-4 shadow-2xs"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <a
                  href="#login-section"
                  onClick={() => { setTab('signin'); setError(null); setInfo(null); }}
                  className="text-xs font-semibold text-[#59534B] hover:text-[#30271F] px-3 py-1.5 transition-colors hidden sm:inline-block cursor-pointer"
                >
                  Sign In
                </a>
                <a
                  href="#login-section"
                  onClick={() => { setTab('signup'); setError(null); setInfo(null); }}
                >
                  <button className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-[#343B2B] hover:bg-[#252B1E] text-white shadow-xs cursor-pointer transition-all">
                    <span>Register PG Business</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Integrated Direct Login Form */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-[#DED6CB] bg-gradient-to-b from-[#FAF6F0] via-[#F5F0E8] to-[#ECE5DA]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
            
            {/* Left Column: Product Value Proposition */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF0E6] border border-[#CAD7BF] text-[#343B2B] text-xs font-semibold tracking-wide shadow-2xs">
                <Sparkles className="size-3.5 text-[#343B2B]" />
                <span>Next-Generation PG & Hostel Operating System</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#30271F] leading-[1.14]">
                Manage Your PG Business <br />
                <span className="text-[#343B2B]">Smarter, Faster & Stress-Free.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#59534B] max-w-2xl leading-relaxed">
                Automate bed occupancy, rent collection, digital admissions with Aadhaar KYC, mess attendance, and resident complaints.
                Purpose-built separate portals for <b className="text-[#30271F]">Owners</b>, <b className="text-[#30271F]">Managers</b>, <b className="text-[#30271F]">Chefs</b>, and <b className="text-[#30271F]">Residents</b>.
              </p>

              {/* Value metrics chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] shadow-2xs">
                  <p className="text-xl sm:text-2xl font-bold text-[#343B2B]">100%</p>
                  <p className="text-xs text-[#77736B] mt-0.5 font-medium">Automated Rent & Receipts</p>
                </div>
                <div className="p-4 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] shadow-2xs">
                  <p className="text-xl sm:text-2xl font-bold text-[#2F5233]">Paperless</p>
                  <p className="text-xs text-[#77736B] mt-0.5 font-medium">Digital KYC & Admissions</p>
                </div>
                <div className="p-4 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] shadow-2xs col-span-2 sm:col-span-1">
                  <p className="text-xl sm:text-2xl font-bold text-[#343B2B]">Real-time</p>
                  <p className="text-xs text-[#77736B] mt-0.5 font-medium">Bed Occupancy & Dues</p>
                </div>
              </div>

              {/* Photographic Card Preview */}
              <div className="relative rounded-2xl overflow-hidden border border-[#DED6CB] shadow-sm bg-[#FFFEFC] p-3 flex items-center gap-4">
                <img
                  src="/owner-assets/lounge-promo.jpg"
                  alt="Hostel community lounge"
                  className="w-28 h-20 rounded-xl object-cover shrink-0"
                />
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#343B2B] mb-1">
                    <Star className="size-3.5 fill-[#343B2B]" />
                    <span>Multi-Building PG Enterprise Suite</span>
                  </div>
                  <p className="text-xs text-[#59534B] leading-relaxed">
                    Over 15+ specialized management modules out of the box with zero setup fees and automatic cloud sync.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#login-section"
                  onClick={() => { setTab('signup'); setError(null); setInfo(null); }}
                >
                  <button className="h-12 px-6 rounded-full bg-[#343B2B] hover:bg-[#252B1E] text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all">
                    <span>Start 90-Day Free Trial</span>
                    <ArrowRight className="size-4" />
                  </button>
                </a>
                <a
                  href="#portals"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#343B2B] bg-[#FFFEFC] hover:bg-[#ECE5DA] border border-[#DED6CB] px-5 py-3 rounded-full shadow-2xs transition-colors"
                >
                  Explore 4 Portals <ChevronRight className="size-4" />
                </a>
              </div>
            </div>

            {/* Right Column: Embedded Home Page Login System */}
            <div id="login-section" className="lg:col-span-5">
              <div className="bg-[#FFFEFC] rounded-3xl border border-[#DED6CB] shadow-xl p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-[#343B2B]" />

                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-[#30271F]">
                      {tab === 'signin' ? 'Sign in to Zipnary' : 'Create PG Account'}
                    </h2>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]">
                      {tab === 'signin' ? 'All Portals' : '90-Day Free Trial'}
                    </span>
                  </div>
                  <p className="text-xs text-[#77736B] mt-1">
                    {tab === 'signin'
                      ? 'Enter your registered email or mobile number to access your portal.'
                      : 'Register your PG business to start your 90-day free trial.'}
                  </p>
                </div>

                {/* Direct Tabs for Sign In and Sign Up */}
                <div className="grid grid-cols-2 gap-1 bg-[#ECE5DA] p-1 rounded-2xl mb-5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => { setTab('signin'); setError(null); setInfo(null); }}
                    className={`py-2 rounded-xl text-center transition-all cursor-pointer ${
                      tab === 'signin'
                        ? 'bg-[#FFFEFC] text-[#30271F] shadow-2xs font-semibold'
                        : 'text-[#77736B] hover:text-[#30271F]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTab('signup'); setError(null); setInfo(null); }}
                    className={`py-2 rounded-xl text-center transition-all cursor-pointer ${
                      tab === 'signup'
                        ? 'bg-[#FFFEFC] text-[#30271F] shadow-2xs font-semibold'
                        : 'text-[#77736B] hover:text-[#30271F]'
                    }`}
                  >
                    Register PG
                  </button>
                </div>

                {error && (
                  <div className="mb-4">
                    <ErrorBanner error={error} />
                  </div>
                )}
                {info && (
                  <div role="status" className="mb-4 rounded-xl bg-[#EBF0E6] text-[#2F5233] text-xs px-3.5 py-2.5 border border-[#CAD7BF]">
                    {info}
                  </div>
                )}

                {tab === 'signin' ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <Field label="Email or Mobile Number" required>
                      {(id) => (
                        <Input
                          id={id}
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="e.g. name@example.com or 9876543210"
                          autoComplete="username"
                          className="h-11 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
                          required
                        />
                      )}
                    </Field>

                    <Field label="Password" required>
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
                        onClick={() => setInfo('To reset your password, contact your PG Owner or platform administrator.')}
                        className="text-[#343B2B] hover:underline font-medium cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full h-11 rounded-full bg-[#343B2B] hover:bg-[#252B1E] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 mt-2"
                    >
                      <span>{busy ? 'Authenticating…' : 'Sign In to Portal'}</span>
                      <ArrowRight className="size-4" />
                    </button>

                    <div className="pt-4 border-t border-[#DED6CB] text-center text-xs text-[#77736B] space-y-2">
                      <p>
                        New to Zipnary?{' '}
                        <button
                          type="button"
                          onClick={() => { setTab('signup'); setError(null); setInfo(null); }}
                          className="text-[#343B2B] font-semibold hover:underline cursor-pointer"
                        >
                          Register your PG (90-Day Free Trial)
                        </button>
                      </p>
                      <p className="text-[11.5px] text-[#77736B]">
                        Residents: Contact your PG manager for your login PIN or mobile credentials.
                      </p>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <Field label="Full Name or Business Name" required>
                      {(id) => (
                        <Input
                          id={id}
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Sri Balaji PG or Rahul Sharma"
                          autoComplete="name"
                          className="h-11 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
                          required
                        />
                      )}
                    </Field>

                    <Field label="Email Address" required>
                      {(id) => (
                        <Input
                          id={id}
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="owner@example.com"
                          autoComplete="email"
                          className="h-11 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
                          required
                        />
                      )}
                    </Field>

                    <Field label="Password" required hint="At least 8 characters">
                      {(id) => (
                        <Input
                          id={id}
                          type="password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="h-11 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
                          required
                        />
                      )}
                    </Field>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full h-11 rounded-full bg-[#343B2B] hover:bg-[#252B1E] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 mt-2"
                    >
                      <span>{busy ? 'Creating account…' : 'Start 90-Day Free Trial'}</span>
                      <ArrowRight className="size-4" />
                    </button>

                    <div className="pt-4 border-t border-[#DED6CB] text-center text-xs text-[#77736B] space-y-2">
                      <p>
                        Already registered?{' '}
                        <button
                          type="button"
                          onClick={() => { setTab('signin'); setError(null); setInfo(null); }}
                          className="text-[#343B2B] font-semibold hover:underline cursor-pointer"
                        >
                          Sign In to your account
                        </button>
                      </p>
                      <p className="text-[11.5px] text-[#77736B]">
                        Residents & Staff: Sign up with the email your PG has on file.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* The 4 Distinct Role Portals Breakdown */}
      <section id="portals" className="py-16 md:py-24 border-b border-[#DED6CB] bg-[#FFFEFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-[#343B2B] uppercase">Dedicated Role Architecture</h2>
            <p className="text-3xl font-extrabold tracking-tight text-[#30271F]">Four Distinct Portals. Zero Confusion.</p>
            <p className="text-[#77736B] text-sm sm:text-base">
              Each team member and resident gets their own scoped workspace tailored exactly to their operational needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Owner Portal Card */}
            <div className="rounded-2xl bg-[#F5F0E8] border border-[#DED6CB] hover:border-[#343B2B] transition-all shadow-2xs flex flex-col justify-between overflow-hidden group">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/owner-assets/buildings-hero.jpg"
                  alt="Owner building management"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-[#343B2B] text-white shadow-xs">
                  Port 2000 · /owner
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-8 rounded-lg bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                      <Building2 className="size-4" />
                    </div>
                    <h3 className="text-base font-bold text-[#30271F]">PG Owner Console</h3>
                  </div>
                  <p className="text-xs text-[#77736B] leading-relaxed">
                    Full control over your PG business across all buildings. View revenue, collections, expenses, subscriptions, and team access.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-[#59534B]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Financial Reports & Cashflow</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Multi-building Analytics</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Manager & Chef Invitations</li>
                  </ul>
                </div>
                <div className="pt-5 border-t border-[#DED6CB] mt-5">
                  <Link
                    to="/owner"
                    className="w-full py-2 px-3 rounded-full bg-[#FFFEFC] hover:bg-[#343B2B] text-[#30271F] hover:text-white border border-[#DED6CB] text-xs font-semibold text-center block transition-colors"
                  >
                    Owner Overview →
                  </Link>
                </div>
              </div>
            </div>

            {/* Manager Portal Card */}
            <div className="rounded-2xl bg-[#F5F0E8] border border-[#DED6CB] hover:border-[#343B2B] transition-all shadow-2xs flex flex-col justify-between overflow-hidden group">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/owner-assets/hero-interior.jpg"
                  alt="Hostel manager reception"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-[#343B2B] text-white shadow-xs">
                  Port 3000 · /manager
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-8 rounded-lg bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                      <Users className="size-4" />
                    </div>
                    <h3 className="text-base font-bold text-[#30271F]">Manager Console</h3>
                  </div>
                  <p className="text-xs text-[#77736B] leading-relaxed">
                    Daily ground operations for assigned buildings: seamless resident admissions, bed allocations, rent recording, and complaints.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-[#59534B]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Fast Digital Admissions</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Instant Payment Receipts</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Maintenance Helpdesk</li>
                  </ul>
                </div>
                <div className="pt-5 border-t border-[#DED6CB] mt-5">
                  <Link
                    to="/manager"
                    className="w-full py-2 px-3 rounded-full bg-[#FFFEFC] hover:bg-[#343B2B] text-[#30271F] hover:text-white border border-[#DED6CB] text-xs font-semibold text-center block transition-colors"
                  >
                    Manager Console →
                  </Link>
                </div>
              </div>
            </div>

            {/* Chef Portal Card */}
            <div className="rounded-2xl bg-[#F5F0E8] border border-[#DED6CB] hover:border-[#343B2B] transition-all shadow-2xs flex flex-col justify-between overflow-hidden group">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/owner-assets/food-hero.jpg"
                  alt="Kitchen and dining operations"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-[#343B2B] text-white shadow-xs">
                  Port 4000 · /chef
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-8 rounded-lg bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                      <UtensilsCrossed className="size-4" />
                    </div>
                    <h3 className="text-base font-bold text-[#30271F]">Kitchen & Mess</h3>
                  </div>
                  <p className="text-xs text-[#77736B] leading-relaxed">
                    Real-time resident meal headcount, daily menu scheduling, cutoff times, meal reviews, and pantry grocery stock tracking.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-[#59534B]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Live Eating Headcount</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Menu Scheduling & Cutoffs</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Ingredient Stock Ledger</li>
                  </ul>
                </div>
                <div className="pt-5 border-t border-[#DED6CB] mt-5">
                  <Link
                    to="/chef"
                    className="w-full py-2 px-3 rounded-full bg-[#FFFEFC] hover:bg-[#343B2B] text-[#30271F] hover:text-white border border-[#DED6CB] text-xs font-semibold text-center block transition-colors"
                  >
                    Kitchen Portal →
                  </Link>
                </div>
              </div>
            </div>

            {/* Resident Portal Card */}
            <div className="rounded-2xl bg-[#F5F0E8] border border-[#DED6CB] hover:border-[#343B2B] transition-all shadow-2xs flex flex-col justify-between overflow-hidden group">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/owner-assets/residents-hero.jpg"
                  alt="Resident community stay"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-[#343B2B] text-white shadow-xs">
                  Port 5000 · /resident
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-8 rounded-lg bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                      <Smartphone className="size-4" />
                    </div>
                    <h3 className="text-base font-bold text-[#30271F]">Resident Mobile App</h3>
                  </div>
                  <p className="text-xs text-[#77736B] leading-relaxed">
                    Mobile-optimized resident app. View room assignment, pay dues, download receipts, check today’s mess menu, and log complaints.
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-[#59534B]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Rent & PDF Receipts</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Daily Food Menu & Ratings</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-[#2F5233] shrink-0" /> Helpdesk Complaint Status</li>
                  </ul>
                </div>
                <div className="pt-5 border-t border-[#DED6CB] mt-5">
                  <Link
                    to="/resident"
                    className="w-full py-2 px-3 rounded-full bg-[#FFFEFC] hover:bg-[#343B2B] text-[#30271F] hover:text-white border border-[#DED6CB] text-xs font-semibold text-center block transition-colors"
                  >
                    Resident Stay →
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Feature Capabilities Showcase */}
      <section id="capabilities" className="py-16 md:py-24 border-b border-[#DED6CB] bg-[#F5F0E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-[#343B2B] uppercase">Comprehensive SaaS Suite</h2>
            <p className="text-3xl font-extrabold tracking-tight text-[#30271F]">Everything You Need to Scale Your PG Chain</p>
            <p className="text-[#77736B] text-sm sm:text-base">
              Engineered specifically for Indian PG, co-living and hostel businesses from single properties to large multi-building chains.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] space-y-3 shadow-2xs">
              <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                <BedDouble className="size-5" />
              </div>
              <h3 className="text-base font-bold text-[#30271F]">Bed & Room Allocation Matrix</h3>
              <p className="text-xs text-[#77736B] leading-relaxed">
                Visual color-coded occupancy view. Instant checks for vacant beds, room sharing capacities, and security deposit tracking.
              </p>
            </div>

            <div className="p-6 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] space-y-3 shadow-2xs">
              <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                <Receipt className="size-5" />
              </div>
              <h3 className="text-base font-bold text-[#30271F]">Automated Invoicing & Dues</h3>
              <p className="text-xs text-[#77736B] leading-relaxed">
                Billing cycles run on the 1st of each month. Automatic receipts generated and overdue tracking with single-tap reminders.
              </p>
            </div>

            <div className="p-6 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] space-y-3 shadow-2xs">
              <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                <Wrench className="size-5" />
              </div>
              <h3 className="text-base font-bold text-[#30271F]">Maintenance & Helpdesk</h3>
              <p className="text-xs text-[#77736B] leading-relaxed">
                Residents raise tickets with category and priority. Managers assign technicians, log expenses, and update resolution notes.
              </p>
            </div>

            <div className="p-6 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] space-y-3 shadow-2xs">
              <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                <UtensilsCrossed className="size-5" />
              </div>
              <h3 className="text-base font-bold text-[#30271F]">Kitchen Mess & Inventory</h3>
              <p className="text-xs text-[#77736B] leading-relaxed">
                Real-time meal opt-in counts prevent food waste. Track grocery stock levels, log purchase expenses, and reconcile usage.
              </p>
            </div>

            <div className="p-6 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] space-y-3 shadow-2xs">
              <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="text-base font-bold text-[#30271F]">Digital KYC & Aadhaar Records</h3>
              <p className="text-xs text-[#77736B] leading-relaxed">
                Collect resident ID proofs, emergency contact information, and signed admission agreements in secure private storage.
              </p>
            </div>

            <div className="p-6 bg-[#FFFEFC] rounded-2xl border border-[#DED6CB] space-y-3 shadow-2xs">
              <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
                <ShieldAlert className="size-5" />
              </div>
              <h3 className="text-base font-bold text-[#30271F]">Audit Ledger & Multi-Tenancy</h3>
              <p className="text-xs text-[#77736B] leading-relaxed">
                Strict PostgreSQL Row-Level Security (RLS) ensures total tenant isolation. Every staff action and financial change is permanently audited.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Trust & Call to Action Section */}
      <section id="security" className="py-16 md:py-20 border-b border-[#DED6CB] bg-[#FFFEFC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF0E6] border border-[#CAD7BF] text-[#343B2B] text-xs font-semibold">
            <Lock className="size-3.5 text-[#343B2B]" />
            <span>Bank-Grade Data Isolation & Encryption</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#30271F] tracking-tight">
            Ready to upgrade your PG & Hostel operations?
          </h2>

          <p className="text-sm sm:text-base text-[#59534B] max-w-2xl mx-auto leading-relaxed">
            Start your 90-day free trial today. Onboard your buildings, invite managers and chefs, and streamline resident stays with zero upfront commitment.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <a
              href="#login-section"
              onClick={() => { setTab('signup'); setError(null); setInfo(null); }}
            >
              <button className="h-12 px-7 rounded-full bg-[#343B2B] hover:bg-[#252B1E] text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all">
                <span>Start 90-Day Free Trial</span>
                <ArrowRight className="size-4" />
              </button>
            </a>
            <a
              href="#login-section"
              onClick={() => { setTab('signin'); setError(null); setInfo(null); }}
            >
              <button className="h-12 px-7 rounded-full bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] border border-[#DED6CB] text-xs font-semibold shadow-2xs cursor-pointer transition-colors">
                <span>Sign In to Existing PG</span>
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#FFFEFC] border-t border-[#DED6CB] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#DED6CB]">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#343B2B] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  <span>Z</span>
                </div>
                <span className="font-bold text-base text-[#30271F]">{BRAND} Solutions</span>
              </div>
              <p className="text-xs text-[#77736B] max-w-sm leading-relaxed">
                Next-generation PG & Hostel management software for modern coliving operators. Built with enterprise multi-tenancy, Row-Level Security, and dedicated role portals.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-[#30271F] uppercase tracking-wider text-[11px]">Role Workspaces</p>
              <ul className="space-y-1.5 text-[#59534B]">
                <li><Link to="/owner" className="hover:text-[#343B2B]">Owner Console (Port 2000)</Link></li>
                <li><Link to="/manager" className="hover:text-[#343B2B]">Manager Operations (Port 3000)</Link></li>
                <li><Link to="/chef" className="hover:text-[#343B2B]">Kitchen & Mess (Port 4000)</Link></li>
                <li><Link to="/resident" className="hover:text-[#343B2B]">Resident App (Port 5000)</Link></li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-[#30271F] uppercase tracking-wider text-[11px]">Platform</p>
              <ul className="space-y-1.5 text-[#59534B]">
                <li><a href="#login-section" onClick={() => setTab('signin')} className="hover:text-[#343B2B]">Sign In</a></li>
                <li><a href="#login-section" onClick={() => setTab('signup')} className="hover:text-[#343B2B]">Start 90-Day Free Trial</a></li>
                <li><Link to="/platformadmin" className="hover:text-[#343B2B]">Super Admin Portal (Port 1000)</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#77736B]">
            <p>© {new Date().getFullYear()} {BRAND} Solutions SaaS. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-[#2F5233]" />
              <span>Multi-Tenant Architecture with PostgreSQL Row-Level Security</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
