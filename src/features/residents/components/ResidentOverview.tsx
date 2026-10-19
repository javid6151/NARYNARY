/** Overview tab of the resident drawer: rent/outstanding/check-in tiles and personal details + portal credentials. */
import { useState } from 'react';
import { KeyRound, MessageCircle, Copy, Check } from 'lucide-react';
import { fmtDate, inr, label } from '../../../lib/format';
import { Button, Confirm, Field, Input } from '../../../components/ui';
import { setResidentPassword } from '../../auth/api';
import type { ResidentDetails, ResidentRow } from '../types';

export function ResidentOverview({ r, details: x }: { r: ResidentRow; details: ResidentDetails }) {
  const [openPassModal, setOpenPassModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const facts: [string, string | null][] = [
    ['Email', x.email],
    ['Gender', label(x.gender)],
    ['Date of birth', fmtDate(x.date_of_birth)],
    ['Occupation', x.occupation],
    ['Emergency contact', [x.emergency_contact_name, x.emergency_contact_phone].filter(Boolean).join(' · ')],
    ['ID (last 4)', x.id_number_last4 ? `XXXX ${x.id_number_last4}` : null],
    ['Portal Status', r.has_login ? 'Activated' : 'Ready to activate'],
  ];

  const portalUrl = 'http://localhost:5000/login';

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) return;
    setBusy(true);
    setMsg(null);
    try {
      await setResidentPassword({
        residentId: r.id,
        phone: r.phone,
        email: x.email || undefined,
        fullName: r.full_name,
        password: newPassword,
      });
      setMsg(`Unique portal password updated for ${r.full_name}!`);
      setOpenPassModal(false);
      setNewPassword('');
    } catch (err: any) {
      setMsg(`Error: ${err.message || 'Could not update password'}`);
    } finally {
      setBusy(false);
    }
  };

  const shareText = `Hi ${r.full_name},\n\nHere are your Zipnary PG Resident Portal login details:\n• Portal URL: ${portalUrl}\n• Login ID (Mobile Number): ${r.phone}\n\nYou can log in to view rent dues, pay online, see food menus, and raise complaints.`;
  const cleanPhone = r.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareText)}`;

  const copyCredentials = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] text-muted">Monthly rent</p>
          <p className="font-semibold tabular">{inr(r.monthly_rent)}</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] text-muted">Outstanding</p>
          <p className="font-semibold tabular text-bad">{inr(r.outstanding)}</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] text-muted">Check-in</p>
          <p className="font-semibold">{fmtDate(r.admission_date)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v || '—'}</dd>
          </div>
        ))}
      </dl>

      {/* Resident Portal Access Card */}
      <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-brand-700" />
            <h3 className="text-sm font-semibold text-brand-900">Resident Portal Access</h3>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
            Port 5000
          </span>
        </div>

        <div className="text-[13px] space-y-1">
          <p className="text-ink">
            <span className="text-muted">Login ID (Mobile):</span> <strong className="font-mono">{r.phone}</strong>
          </p>
          <p className="text-muted text-[12px]">
            Residents use their registered mobile number as User ID and a unique password to sign in.
          </p>
        </div>

        {msg && <p className="text-xs text-ok font-medium">{msg}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setNewPassword('Res#' + Math.floor(1000 + Math.random() * 9000));
              setOpenPassModal(true);
            }}
          >
            <KeyRound className="size-3.5" />
            Set Unique Password
          </Button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer h-8 px-3 text-[13px] bg-ok text-white hover:brightness-110"
          >
            <MessageCircle className="size-3.5" />
            Send via WhatsApp
          </a>

          <Button size="sm" variant="ghost" onClick={copyCredentials}>
            {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy info'}
          </Button>
        </div>
      </div>

      <Confirm
        open={openPassModal}
        title={`Set Unique Password for ${r.full_name}`}
        body="Assign a unique login password for this resident. They can use their mobile number and this password to log in to the Resident Portal."
        confirmLabel="Save Unique Password"
        busy={busy}
        onConfirm={handleSetPassword}
        onClose={() => setOpenPassModal(false)}
      >
        <Field label="Unique Password" required hint="At least 6 characters">
          {(id) => (
            <div className="flex gap-2">
              <Input
                id={id}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter or generate unique password"
              />
              <button
                type="button"
                onClick={() => setNewPassword('Res#' + Math.floor(1000 + Math.random() * 9000))}
                className="px-2.5 py-1 text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100"
              >
                Generate
              </button>
            </div>
          )}
        </Field>
      </Confirm>
    </div>
  );
}
