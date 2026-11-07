import { useState, type FormEvent } from 'react';
import { User, Phone, Mail, Shield, Building2, KeyRound, CheckCircle2, Lock, Save } from 'lucide-react';
import { Button, Card, Field, Input, Avatar, ErrorBanner } from '../../../components/ui';
import { useAuth } from '../../access/useAuth';
import { supabase } from '../../../lib/supabase';
import { PHONE_RE } from '../../../lib/validation';

export function ProfileSettings({ onToast }: { onToast: (m: string) => void }) {
  const { session, access, staff, profile, updateProfile } = useAuth();

  const currentFullName =
    profile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    '';
  const currentPhone =
    profile?.phone ||
    session?.user?.user_metadata?.phone ||
    '';

  const [fullName, setFullName] = useState(currentFullName);
  const [phone, setPhone] = useState(currentPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password management
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  const businessName = staff?.tenant_name || access?.owned_tenant?.business_name || 'PG Business';
  const tenantCode = staff?.tenant_code || access?.owned_tenant?.tenant_code || '—';
  const userEmail = profile?.email || session?.user?.email || '—';

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setSavedSuccess(true);
      onToast(`Owner profile updated successfully to "${fullName.trim()}"!`);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPassError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match. Please re-enter.');
      return;
    }

    setPassBusy(true);
    setPassError(null);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      onToast('Login password successfully updated!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPassError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPassBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Profile Hero Card */}
      <div className="p-6 rounded-2xl bg-[#FFFEFC] border border-[#DED6CB] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar name={fullName || currentFullName || 'Owner'} size={56} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[#30271F] truncate">
                {fullName || currentFullName || 'Owner'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]">
                <Shield className="size-3" />
                PG Owner & Admin
              </span>
            </div>
            <p className="text-xs text-[#77736B] mt-0.5 truncate">
              {businessName} · Account ID: <span className="tabular font-medium text-[#30271F]">{tenantCode}</span>
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EBF0E6] text-[#343B2B] text-xs font-semibold border border-[#CAD7BF] animate-in fade-in duration-200">
            <CheckCircle2 className="size-4" />
            <span>Changes saved live</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Editable Personal Information (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Personal Information">
            <p className="text-xs text-[#77736B] -mt-2 mb-5">
              Update your personal name and contact details. Your name appears in dashboard greetings, official notices, and receipts.
            </p>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <ErrorBanner error={error} />

              <Field
                label="Full Name (Owner Name)"
                required
                hint="Your personal name provided at enrollment. Visible in the Dashboard welcome greeting."
              >
                {(id) => (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#77736B]" />
                    <Input
                      id={id}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. JAVID"
                      className="pl-9 font-medium"
                      required
                    />
                  </div>
                )}
              </Field>

              <Field
                label="Mobile Phone Number"
                hint="Used for account recovery, notifications, and emergency tenant contact."
              >
                {(id) => (
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#77736B]" />
                    <Input
                      id={id}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="pl-9 tabular font-medium"
                    />
                  </div>
                )}
              </Field>

              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" busy={busy}>
                  <Save className="size-4" />
                  Save Profile Changes
                </Button>
                {fullName !== currentFullName && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFullName(currentFullName);
                      setPhone(currentPhone);
                      setError(null);
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* 3. Password & Credentials */}
          <Card title="Change Login Password">
            <p className="text-xs text-[#77736B] -mt-2 mb-5">
              Ensure your account uses a strong password of at least 8 characters.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <ErrorBanner error={passError} />

              <Field label="New Password" required>
                {(id) => (
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#77736B]" />
                    <Input
                      id={id}
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pl-9"
                      required
                    />
                  </div>
                )}
              </Field>

              <Field label="Confirm New Password" required>
                {(id) => (
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#77736B]" />
                    <Input
                      id={id}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="pl-9"
                      required
                    />
                  </div>
                )}
              </Field>

              <div className="pt-2">
                <Button type="submit" variant="secondary" busy={passBusy}>
                  Update Password
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* 4. Business & Account Summary Sidebar (1 Col) */}
        <div className="space-y-6">
          <Card title="Account & Business Details">
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[#77736B] block mb-1">Primary Login Email</span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F5F0E8] border border-[#DED6CB]">
                  <Mail className="size-4 text-[#77736B] shrink-0" />
                  <span className="font-semibold text-[#30271F] truncate">{userEmail}</span>
                  <Lock className="size-3.5 text-[#77736B] ml-auto shrink-0" aria-label="Primary Auth Login" />
                </div>
              </div>

              <div>
                <span className="text-[#77736B] block mb-1">PG Business Name</span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F5F0E8] border border-[#DED6CB]">
                  <Building2 className="size-4 text-[#77736B] shrink-0" />
                  <span className="font-semibold text-[#30271F] truncate">{businessName}</span>
                </div>
              </div>

              <div>
                <span className="text-[#77736B] block mb-1">Permanent Tenant Code</span>
                <div className="p-2.5 rounded-xl bg-[#F5F0E8] border border-[#DED6CB] font-mono font-bold text-[#30271F]">
                  {tenantCode}
                </div>
              </div>

              <div className="pt-3 border-t border-[#DED6CB]">
                <span className="text-[#77736B] block mb-1">Administrative Permissions</span>
                <div className="p-3 rounded-xl bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF] text-[11.5px] leading-relaxed">
                  <strong>Full Tenant Ownership:</strong> Unrestricted access to admissions, billing, inventory, expenses, reports, staff management, and building configurations.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
