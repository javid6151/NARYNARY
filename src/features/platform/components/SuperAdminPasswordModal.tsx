import { useState, type FormEvent } from 'react';
import { KeyRound, Mail, X } from 'lucide-react';
import { Button, ErrorBanner, Field, Input } from '../../../components/ui';
import { changeSuperAdminPassword, sendSuperAdminResetEmail } from '../../auth/api';

interface SuperAdminPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onPasswordChanged?: () => void;
}

export function SuperAdminPasswordModal({ open, onClose, onPasswordChanged }: SuperAdminPasswordModalProps) {
  const [tab, setTab] = useState<'previous' | 'email'>('previous');
  const [previousPassword, setPreviousPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);

  if (!open) return null;

  const handlePreviousSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);

    if (!previousPassword) {
      setError('Please enter your previous (current) password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await changeSuperAdminPassword(previousPassword, newPassword);
      setSuccess(res.message || 'Super Admin password updated successfully!');
      setPreviousPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onPasswordChanged) onPasswordChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please verify your previous password.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmail = async () => {
    if (busy) return;
    setError(null);
    setSuccess(null);
    setRecoveryLink(null);
    setBusy(true);

    try {
      const res = await sendSuperAdminResetEmail();
      setSuccess(res.message || 'Password reset email dispatched to shaikjavid6151@gmail.com.');
      if (res.recoveryUrl) {
        setRecoveryLink(res.recoveryUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-line animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#DED6CB]">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-[#30271F]">Super Admin Password</h2>
              <p className="text-[12px] text-[#77736B]">Account: zipco@gmail.com</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-[#77736B] hover:bg-[#ECE5DA] hover:text-[#30271F] cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 bg-[#ECE5DA] p-1 rounded-xl mt-4 mb-4 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => { setTab('previous'); setError(null); setSuccess(null); }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'previous'
                ? 'bg-[#FFFEFC] text-[#30271F] shadow-2xs font-semibold'
                : 'text-[#77736B] hover:text-[#30271F]'
            }`}
          >
            Use Previous Password
          </button>
          <button
            type="button"
            onClick={() => { setTab('email'); setError(null); setSuccess(null); }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              tab === 'email'
                ? 'bg-[#FFFEFC] text-[#30271F] shadow-2xs font-semibold'
                : 'text-[#77736B] hover:text-[#30271F]'
            }`}
          >
            Send Email
          </button>
        </div>

        <ErrorBanner error={error} />

        {success && (
          <div role="status" className="mb-4 rounded-xl bg-[#EBF0E6] text-[#2F5233] text-[13px] px-3.5 py-3 border border-[#CAD7BF]">
            {success}
            {recoveryLink && (
              <div className="mt-2 pt-2 border-t border-[#CAD7BF]">
                <a
                  href={recoveryLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline hover:brightness-110 text-[#2F5233]"
                >
                  Click here to complete password reset ↗
                </a>
              </div>
            )}
          </div>
        )}

        {tab === 'previous' ? (
          <form onSubmit={handlePreviousSubmit} className="space-y-3.5" noValidate>
            <Field label="Previous (Current) Password" required>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  placeholder="Enter current password (e.g. zipcozipco)"
                  value={previousPassword}
                  onChange={(e) => setPreviousPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              )}
            </Field>

            <Field label="New Password" required hint="At least 6 characters">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              )}
            </Field>

            <Field label="Confirm New Password" required>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              )}
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Update Password
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#F5F0E8] border border-[#DED6CB] p-4 text-[13px] text-[#30271F]">
              <div className="flex items-start gap-2.5">
                <Mail className="size-5 text-[#343B2B] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#30271F]">Registered Super Admin Recovery Email</p>
                  <p className="text-[#343B2B] font-mono text-[13px] mt-1 bg-[#FFFEFC] px-2.5 py-1 rounded-md inline-block border border-[#DED6CB]">
                    shaikjavid6151@gmail.com
                  </p>
                  <p className="text-[12px] text-[#77736B] mt-2">
                    A secure password reset authorization link will be generated and dispatched to this address.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" busy={busy} onClick={handleSendEmail}>
                Send Reset Link
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
