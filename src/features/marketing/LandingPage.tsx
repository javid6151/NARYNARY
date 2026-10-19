/**
 * Public ZIPNARY SaaS Marketing Website (`/`).
 * Explains the SaaS product, features, role portals, and provides an integrated sign-in
 * and sign-up card right on the home page.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Users, UtensilsCrossed, Wrench, ArrowRight, CheckCircle2,
  Smartphone, Sparkles, ChevronRight, BedDouble, Receipt,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Button, ErrorBanner, Field, Input } from '../../components/ui';
import { useAuth } from '../access/useAuth';
import { signInWithPassword } from '../auth/api';
import { BRAND } from '../../lib/brand';

export default function LandingPage() {
  const { session, homePath, staff, resident, chef, access } = useAuth();
  const nav = useNavigate();

  // Login form states on the homepage
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      let emailToUse = identifier.trim();

      // If user entered a mobile number, resolve it via backend API
      const cleanPhone = identifier.replace(/\D/g, '');
      if (cleanPhone.length >= 10 && !identifier.includes('@')) {
        const res = await fetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanPhone }),
        });
        const data = await res.json();
        if (data.email) {
          emailToUse = data.email;
        } else {
          throw new Error(data.error || 'No registered account found with this mobile number');
        }
      }

      await signInWithPassword(emailToUse, password);
      // Navigation is automatically handled by AuthProvider + homePath
    } catch (err: any) {
      setError(err?.message || 'Invalid login credentials. Please check your email/mobile and password.');
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
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <Logo subtitle="PG & Hostel Management SaaS" />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-[13.5px] font-medium text-ink-2">
              <a href="#features" className="hover:text-brand-700 transition-colors">Features</a>
              <a href="#portals" className="hover:text-brand-700 transition-colors">Portals</a>
              <a href="#how-it-works" className="hover:text-brand-700 transition-colors">How It Works</a>
              <a href="#faq" className="hover:text-brand-700 transition-colors">FAQ</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <Button onClick={() => nav(homePath)} className="gap-2">
                <span>Go to {getPortalLabel()}</span>
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <a
                  href="#login-section"
                  className="text-sm font-medium text-ink-2 hover:text-brand-700 px-3 py-1.5 transition-colors hidden sm:inline-block"
                >
                  Sign In
                </a>
                <Link to="/signup">
                  <Button className="shadow-xs">Register PG</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Integrated Direct Login Form */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-line bg-gradient-to-b from-white to-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Column: Product Value Proposition */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold tracking-wide">
                <Sparkles className="size-3.5 text-brand-600" />
                <span>Next-Generation PG & Hostel Operating System</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink leading-[1.15]">
                Manage Your PG Business <br />
                <span className="text-brand-700 bg-clip-text">Smarter, Faster & Stress-Free.</span>
              </h1>

              <p className="text-base sm:text-lg text-ink-2 max-w-2xl leading-relaxed">
                Automate bed occupancy, rent collection, digital admissions, mess attendance, and resident complaints.
                Purpose-built separate portals for <b>Owners</b>, <b>Managers</b>, <b>Chefs</b>, and <b>Residents</b>.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-white rounded-xl border border-line shadow-xs">
                  <p className="text-xl sm:text-2xl font-bold text-brand-700">100%</p>
                  <p className="text-xs text-muted mt-0.5">Automated Rent & Receipts</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-line shadow-xs">
                  <p className="text-xl sm:text-2xl font-bold text-ok">Paperless</p>
                  <p className="text-xs text-muted mt-0.5">Digital KYC & Admissions</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-line shadow-xs col-span-2 sm:col-span-1">
                  <p className="text-xl sm:text-2xl font-bold text-info">Real-time</p>
                  <p className="text-xs text-muted mt-0.5">Bed Occupancy & Dues</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/signup">
                  <Button size="md" className="h-12 px-6 gap-2 text-sm shadow-md">
                    <span>Start 90-Day Free Trial</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <a
                  href="#portals"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900 px-4 py-3 rounded-xl hover:bg-white transition-colors"
                >
                  Explore Portals <ChevronRight className="size-4" />
                </a>
              </div>
            </div>

            {/* Right Column: Embedded Home Page Login System */}
            <div id="login-section" className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-line shadow-xl p-6 sm:p-8 relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-800 rounded-t-2xl" />
                
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink">Sign in to Zipnary</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                      All Portals
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Enter your registered email or mobile number to access your portal.
                  </p>
                </div>

                <ErrorBanner error={error} />

                {session ? (
                  <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-3">
                    <p className="text-sm text-brand-900 font-medium">
                      You are already signed in as <span className="font-semibold">{staff?.tenant_name || 'User'}</span>.
                    </p>
                    <Button onClick={() => nav(homePath)} className="w-full">
                      Open {getPortalLabel()} →
                    </Button>
                  </div>
                ) : (
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
                          className="h-11 rounded-xl"
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
                          className="h-11 rounded-xl"
                          required
                        />
                      )}
                    </Field>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted">Role auto-detected</span>
                      <Link to="/login" className="text-brand-600 hover:text-brand-800 font-medium hover:underline">
                        Forgot password?
                      </Link>
                    </div>

                    <Button type="submit" busy={busy} size="md" className="w-full h-11 text-sm font-semibold mt-2 shadow-xs">
                      Sign In
                    </Button>

                    <div className="pt-4 border-t border-line text-center text-xs text-muted space-y-2">
                      <p>
                        New to Zipnary?{' '}
                        <Link to="/signup" className="text-brand-700 font-semibold hover:underline">
                          Register your PG (90-Day Free Trial)
                        </Link>
                      </p>
                      <p className="text-[11.5px] text-muted">
                        Residents: Contact your PG manager for your login PIN or mobile password.
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
      <section id="portals" className="py-16 md:py-24 border-b border-line bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-brand-700 uppercase">Dedicated User Experience</h2>
            <p className="text-3xl font-extrabold tracking-tight">Four Distinct Portals. Zero Confusion.</p>
            <p className="text-muted text-sm sm:text-base">
              Each team member and resident gets their own scoped workspace tailored exactly to what they need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Owner Portal Card */}
            <div className="p-6 rounded-2xl bg-canvas border border-line hover:border-brand-300 transition-all shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-brand-50 text-brand-700 grid place-items-center mb-4">
                  <Building2 className="size-6" />
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-100 text-brand-800 mb-2">
                  /owner or /:pg/owner
                </div>
                <h3 className="text-lg font-bold text-ink">PG Owner Console</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Full control over your PG business across all buildings. View revenue, collections, expenses, subscriptions, and team access.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-ink-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Financial Reports & Cashflow</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Multi-building Analytics</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Manager & Chef Invitations</li>
                </ul>
              </div>
              <div className="pt-6 border-t border-line/60 mt-6">
                <Link to="/owner" className="text-xs font-semibold text-brand-700 hover:underline inline-flex items-center gap-1">
                  Owner Overview →
                </Link>
              </div>
            </div>

            {/* Manager Portal Card */}
            <div className="p-6 rounded-2xl bg-canvas border border-line hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-blue-50 text-blue-700 grid place-items-center mb-4">
                  <Users className="size-6" />
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 mb-2">
                  /manager or /:pg/manager
                </div>
                <h3 className="text-lg font-bold text-ink">Manager Console</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Daily ground operations for assigned buildings: seamless resident admissions, bed allocations, rent recording, and complaint resolution.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-ink-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Fast Digital Admissions</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Instant Payment Receipts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Maintenance Helpdesk</li>
                </ul>
              </div>
              <div className="pt-6 border-t border-line/60 mt-6">
                <Link to="/manager" className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
                  Manager Console →
                </Link>
              </div>
            </div>

            {/* Chef Portal Card */}
            <div className="p-6 rounded-2xl bg-canvas border border-line hover:border-amber-300 transition-all shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-amber-50 text-amber-700 grid place-items-center mb-4">
                  <UtensilsCrossed className="size-6" />
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 mb-2">
                  /chef or /:pg/chef
                </div>
                <h3 className="text-lg font-bold text-ink">Kitchen & Mess</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Real-time resident meal headcount, daily menu scheduling, cutoff times, meal reviews, and pantry grocery inventory tracking.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-ink-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Live Eating Headcount</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Menu Scheduling & Cutoffs</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Ingredient Stock Management</li>
                </ul>
              </div>
              <div className="pt-6 border-t border-line/60 mt-6">
                <Link to="/chef" className="text-xs font-semibold text-amber-700 hover:underline inline-flex items-center gap-1">
                  Kitchen Portal →
                </Link>
              </div>
            </div>

            {/* Resident Portal Card */}
            <div className="p-6 rounded-2xl bg-canvas border border-line hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center mb-4">
                  <Smartphone className="size-6" />
                </div>
                <div className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 mb-2">
                  /resident or /:pg/resident
                </div>
                <h3 className="text-lg font-bold text-ink">Resident Portal</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Mobile-optimized resident app. View room assignment, pay dues, download receipts, check today’s mess menu, and request visitor passes.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-ink-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Rent & PDF Receipts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Daily Food Menu & Ratings</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-ok shrink-0" /> Helpdesk Complaint Status</li>
                </ul>
              </div>
              <div className="pt-6 border-t border-line/60 mt-6">
                <Link to="/resident" className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1">
                  Resident Stay →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section id="features" className="py-16 md:py-24 border-b border-line bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-brand-700 uppercase">Core Capabilities</h2>
            <p className="text-3xl font-extrabold tracking-tight">Everything You Need to Scale Your Hostels</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-2xl border border-line space-y-3 shadow-xs">
              <div className="size-10 rounded-lg bg-brand-50 text-brand-700 grid place-items-center">
                <BedDouble className="size-5" />
              </div>
              <h3 className="text-base font-bold">Room & Bed Allocation Matrix</h3>
              <p className="text-xs text-muted leading-relaxed">
                Color-coded occupancy view. Instant checks for vacant beds, room sharing capacities, and security deposit tracking.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-line space-y-3 shadow-xs">
              <div className="size-10 rounded-lg bg-brand-50 text-brand-700 grid place-items-center">
                <Receipt className="size-5" />
              </div>
              <h3 className="text-base font-bold">Automated Invoicing & Dues</h3>
              <p className="text-xs text-muted leading-relaxed">
                Billing cycles run on the 1st of each month. Automatic receipts generated and overdue tracking with single-tap reminders.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-line space-y-3 shadow-xs">
              <div className="size-10 rounded-lg bg-brand-50 text-brand-700 grid place-items-center">
                <Wrench className="size-5" />
              </div>
              <h3 className="text-base font-bold">Maintenance & Complaints</h3>
              <p className="text-xs text-muted leading-relaxed">
                Residents raise tickets with category and priority. Managers assign technicians, log expenses, and update resolution notes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-line py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">{BRAND}</span>
            <span>· All rights reserved. Built for professional PG & Hostel businesses.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-brand-700 transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-brand-700 transition-colors">Register PG</Link>
            <a href="#portals" className="hover:text-brand-700 transition-colors">Portals</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
