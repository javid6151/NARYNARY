import { useState, useRef, useEffect, type FormEvent } from 'react';
import { User, Phone, Mail, Shield, Building2, KeyRound, CheckCircle2, Lock, Save, Upload, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, Avatar, ErrorBanner } from '../../../components/ui';
import { useAuth } from '../../access/useAuth';
import { supabase } from '../../../lib/supabase';
import { PHONE_RE } from '../../../lib/validation';
import { PgLogo } from '../../../components/PgLogo';

function resizeImageToSquare(file: File, maxSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(reader.result as string);

        // Center and cover-crop into square
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/png', 0.92));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileSettings({ onToast }: { onToast: (m: string) => void }) {
  const { session, access, staff, profile, updateProfile, updateTenantBranding, refreshAccess } = useAuth();

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

  // PG Branding & Logo
  const businessName = staff?.tenant_name || access?.owned_tenant?.business_name || 'PG Business';
  const tenantCode = staff?.tenant_code || access?.owned_tenant?.tenant_code || '—';
  const tenantId = staff?.tenant_id || access?.owned_tenant?.tenant_id || access?.memberships?.[0]?.tenant_id || 'd6712a4d-bb8c-494c-931d-5168afadb334';
  const userEmail = profile?.email || session?.user?.email || '—';
  const currentLogoUrl = staff?.logo_url || access?.owned_tenant?.logo_url || null;

  const [pgName, setPgName] = useState(businessName);
  const [logoPreview, setLogoPreview] = useState<string | null>(currentLogoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [brandingSuccess, setBrandingSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPgName(businessName);
  }, [businessName]);

  // Load existing logo on mount from branding API
  useEffect(() => {
    let active = true;
    if (!tenantId) return;

    fetch(`/api/tenant/branding?tenantId=${tenantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.hasLogo && data.logoUrl) {
          setLogoPreview(data.logoUrl);
        } else if (currentLogoUrl) {
          setLogoPreview(currentLogoUrl);
        }
      })
      .catch(() => {
        if (currentLogoUrl) setLogoPreview(currentLogoUrl);
      });

    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    if (currentLogoUrl) {
      setLogoPreview(currentLogoUrl);
    }
  }, [currentLogoUrl]);

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

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file (PNG, JPG, SVG, or WEBP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setLogoError('Image file must be smaller than 4 MB.');
      return;
    }

    setLogoBusy(true);
    setLogoError(null);

    try {
      // 1. Resize & crop to square 512x512 PNG data URL
      const dataUrl = await resizeImageToSquare(file, 512);

      // Instant local preview
      setLogoPreview(dataUrl);

      const tenantId =
        staff?.tenant_id ||
        access?.owned_tenant?.tenant_id ||
        access?.memberships?.[0]?.tenant_id ||
        'd6712a4d-bb8c-494c-931d-5168afadb334';

      // 2. Upload via API endpoint
      const res = await fetch('/api/tenant/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          logoData: dataUrl,
          businessName: pgName.trim() || businessName,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to upload PG logo');
      }

      const activeUrl = resData.logoUrl || dataUrl;
      setLogoPreview(activeUrl);

      // Notify all tabs and portal components immediately
      try {
        localStorage.setItem('zipco_pg_logo_ts', String(Date.now()));
        window.dispatchEvent(new CustomEvent('pg_logo_updated', { detail: { logoUrl: activeUrl } }));
      } catch {}

      // 3. Save to auth state and refresh
      try {
        await updateTenantBranding({
          logo_url: activeUrl,
          business_name: pgName.trim() || businessName,
        });
      } catch {}

      setBrandingSuccess(true);
      onToast('PG Logo uploaded successfully! Live across all staff and resident portals.');
      setTimeout(() => setBrandingSuccess(false), 4000);
      try {
        await refreshAccess();
      } catch {}
      setLogoPreview(activeUrl);
    } catch (err: unknown) {
      setLogoError(err instanceof Error ? err.message : 'Failed to update PG logo');
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (window.confirm('Remove PG logo and revert to monogram avatar?')) {
      setLogoBusy(true);
      setLogoError(null);
      try {
        const tenantId =
          staff?.tenant_id ||
          access?.owned_tenant?.tenant_id ||
          access?.memberships?.[0]?.tenant_id ||
          'd6712a4d-bb8c-494c-931d-5168afadb334';

        await fetch(`/api/tenant/branding?tenantId=${tenantId}`, {
          method: 'DELETE',
        });
        setLogoPreview(null);
        try {
          localStorage.removeItem('zipco_pg_logo_ts');
          window.dispatchEvent(new CustomEvent('pg_logo_updated', { detail: { logoUrl: null } }));
        } catch {}
        try {
          await updateTenantBranding({
            logo_url: null,
            business_name: pgName.trim() || businessName,
          });
        } catch {}
        onToast('PG Logo removed. Reverted to letter monogram avatar.');
        try {
          await refreshAccess();
        } catch {}
        setLogoPreview(null);
      } catch (err: unknown) {
        setLogoError(err instanceof Error ? err.message : 'Failed to remove PG logo');
      } finally {
        setLogoBusy(false);
      }
    }
  };

  const handleSaveBranding = async (e: FormEvent) => {
    e.preventDefault();
    if (!pgName.trim() || pgName.trim().length < 2) {
      setLogoError('Please enter a valid PG business name (at least 2 characters).');
      return;
    }

    setLogoBusy(true);
    setLogoError(null);
    try {
      const tenantId =
        staff?.tenant_id ||
        access?.owned_tenant?.tenant_id ||
        access?.memberships?.[0]?.tenant_id ||
        'd6712a4d-bb8c-494c-931d-5168afadb334';

      const res = await fetch('/api/tenant/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          businessName: pgName.trim(),
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update PG branding');

      try {
        await updateTenantBranding({
          logo_url: logoPreview,
          business_name: pgName.trim(),
        });
      } catch {}

      setBrandingSuccess(true);
      onToast(`PG branding updated successfully to "${pgName.trim()}"!`);
      setTimeout(() => setBrandingSuccess(false), 4000);
      await refreshAccess();
    } catch (err: unknown) {
      setLogoError(err instanceof Error ? err.message : 'Failed to update PG branding');
    } finally {
      setLogoBusy(false);
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

        <div className="flex items-center gap-3 self-end sm:self-center">
          <PgLogo tenantId={tenantId} logoUrl={logoPreview} name={pgName || businessName} size="md" />
          {savedSuccess && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EBF0E6] text-[#343B2B] text-xs font-semibold border border-[#CAD7BF] animate-in fade-in duration-200">
              <CheckCircle2 className="size-4" />
              <span>Changes saved live</span>
            </div>
          )}
        </div>
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

        {/* 4. PG Business Branding & Logo (1 Col) */}
        <div className="space-y-6">
          <Card title="PG Branding & Logo">
            <p className="text-xs text-[#77736B] -mt-2 mb-4">
              Your PG logo and business name are shown across all staff portals (owner, manager, chef) and resident accounts.
            </p>

            <ErrorBanner error={logoError} />

            {/* Live Logo Preview Box */}
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[#F5F0E8] border border-[#DED6CB] text-center mb-4">
              <PgLogo tenantId={tenantId} logoUrl={logoPreview} name={pgName || businessName} size="xl" className="shadow-md mb-2" />
              <p className="font-bold text-base text-[#30271F] truncate max-w-full">
                {pgName || businessName}
              </p>
              <p className="text-[11px] text-[#77736B] font-medium mt-0.5">
                {logoPreview ? 'Custom PG Logo Active' : 'Letter Monogram Avatar'}
              </p>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoSelect}
              className="hidden"
            />

            <div className="flex items-center gap-2 mb-5">
              <Button
                type="button"
                variant="secondary"
                busy={logoBusy}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 justify-center"
              >
                <Upload className="size-4" />
                <span>{logoPreview ? 'Change Logo Image' : 'Upload PG Logo'}</span>
              </Button>
              {logoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={logoBusy}
                  onClick={handleRemoveLogo}
                  className="text-bad hover:bg-bad-bg hover:text-bad"
                  title="Remove Logo"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>

            <form onSubmit={handleSaveBranding} className="space-y-4 pt-4 border-t border-[#DED6CB]">
              <Field
                label="PG Business Name"
                required
                hint="Shown in header, invoices, and resident portal."
              >
                {(id) => (
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#77736B]" />
                    <Input
                      id={id}
                      value={pgName}
                      onChange={(e) => setPgName(e.target.value)}
                      placeholder="e.g. Sunshine PG"
                      className="pl-9 font-medium"
                      required
                    />
                  </div>
                )}
              </Field>

              <div className="flex items-center gap-2">
                <Button type="submit" busy={logoBusy}>
                  <Save className="size-4" />
                  <span>Save PG Name</span>
                </Button>
                {brandingSuccess && (
                  <span className="text-xs font-semibold text-[#2F6B27] flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
                    Saved!
                  </span>
                )}
              </div>
            </form>
          </Card>

          {/* Account Details */}
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
