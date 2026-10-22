import { useState } from 'react';
import { Check, Copy, KeyRound, Share2, X } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, inr } from '../../../lib/format';
import { Async, Avatar, Badge, Button, Card, Drawer, ErrorBanner, Field, Input, Textarea } from '../../../components/ui';
import { ResidentDocuments } from '../../files/components/ResidentDocuments';
import { listAdmissionCharges, reviewAdmission, setResidentPortalPassword } from '../api';
import type { AdmissionCharge, AdmissionRow } from '../types';

export function AdmissionDrawer({ row, canApprove, onClose, onDone }: {
  row: AdmissionRow | null;
  /** Only owners approve; managers see "Waiting for the owner’s approval". */
  canApprove: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [portalPass, setPortalPass] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ password: string; copied: boolean } | null>(null);

  const m = useMutation((decision: 'approve' | 'reject') => reviewAdmission(row!.id, decision, notes || null));
  const portalMutation = useMutation(async (password: string) => {
    if (!row) return;
    await setResidentPortalPassword({
      residentId: row.residents.id,
      phone: row.residents.phone,
      email: row.residents.email || undefined,
      fullName: row.residents.full_name,
      password,
    });
    setCreatedCreds({ password, copied: false });
    onDone('Resident portal password saved and access activated!');
  });

  const charges = useAsync(
    () => (row && row.status !== 'pending_review' ? listAdmissionCharges(row.id) : Promise.resolve([] as AdmissionCharge[])),
    [row?.id, row?.status],
  );
  if (!row) return null;
  const r = row.residents;
  const pending = row.status === 'pending_review';
  const total = Number(row.monthly_rent) + Number(row.security_deposit) + Number(row.setup_fee);
  const decide = async (decision: 'approve' | 'reject', msg: string) => {
    if ((await m.run(decision)) !== undefined) {
      onDone(msg);
      onClose();
    }
  };

  const defaultPassword = `Pass${(r.phone || '1234').replace(/\D/g, '').slice(-4)}!`;

  const footer = pending && canApprove ? (
    <>
      <Button variant="danger" busy={m.busy} onClick={() => decide('reject', 'Admission rejected')}>
        <X className="size-4" />
        Reject
      </Button>
      <Button variant="success" busy={m.busy} onClick={() => decide('approve', 'Admission approved — bed allocated and charges created')}>
        <Check className="size-4" />
        Approve & allocate bed
      </Button>
    </>
  ) : undefined;

  const summary: [string, string][] = [
    ['Building', row.buildings.name],
    ['Floor', row.floors.name ?? ''],
    ['Room / Bed', `Room ${row.rooms.room_number} / ${row.beds.bed_label}`],
    ['Admission date', fmtDate(row.admission_date)],
    ['Rent (monthly)', inr(row.monthly_rent)],
    ['Security deposit', inr(row.security_deposit)],
    ['Setup fee', inr(row.setup_fee)],
    ['Mess', row.mess_included ? 'Included' : 'Not included'],
    ['Occupation', r.occupation ?? '—'],
    ['ID (last 4)', r.id_number_last4 ? `XXXX ${r.id_number_last4}` : '—'],
    ['Source', row.source ?? '—'],
  ];

  return (
    <Drawer open onClose={onClose} title="Admission details" wide footer={footer}>
      <div className="flex items-center gap-4">
        <Avatar name={r.full_name} size={56} />
        <div>
          <p className="text-lg font-semibold">{r.full_name}</p>
          <p className="text-[13px] text-muted">
            {r.phone}
            {r.email ? ` · ${r.email}` : ''}
          </p>
          <div className="mt-1">
            <Badge status={row.status}>{pending ? 'Pending approval' : undefined}</Badge>
          </div>
        </div>
      </div>
      <ErrorBanner error={m.error} />
      <Card title="Request summary">
        <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
          {summary.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {pending && (
          <p className="text-[12px] text-muted mt-3">
            On approval: first month (pro-rated) + deposit + setup fee = up to {inr(total)} is billed.
          </p>
        )}
      </Card>
      <Card title="KYC documents">
        <ResidentDocuments residentId={r.id} canEdit={row.status !== 'rejected'} />
      </Card>
      {!pending && (
        <Card title="Charges">
          <Async state={charges}>
            {(cs) =>
              cs.length === 0 ? (
                <p className="text-[13px] text-muted">No charges.</p>
              ) : (
                <ul className="divide-y divide-line text-[13px]">
                  {cs.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1">{c.description}</span>
                      <span className="tabular">{inr(c.amount)}</span>
                      <Badge status={c.status} />
                    </li>
                  ))}
                </ul>
              )
            }
          </Async>
        </Card>
      )}
      {pending && canApprove && (
        <Field label="Review notes (optional)">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. KYC verified in person" />}
        </Field>
      )}
      {pending && !canApprove && <p className="text-[13px] text-muted">Waiting for the owner’s approval.</p>}
      
      {/* Resident Portal Access Card */}
      {row.status === 'approved' && (
        <Card title="Resident Portal Access & Password (Port 5000)">
          <div className="space-y-3 text-[13px]">
            {createdCreds ? (
              <div className="p-3.5 rounded-xl bg-ok-bg/50 border border-ok/30 space-y-2.5">
                <div className="flex items-center gap-2 text-ok font-semibold">
                  <Check className="size-4" />
                  Portal Access Saved Live!
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-line font-mono text-xs space-y-1">
                  <div>Portal: <b>http://localhost:5000</b></div>
                  <div>Mobile (Login ID): <b>{r.phone}</b></div>
                  <div>Password: <b className="text-brand-700">{createdCreds.password}</b></div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Resident Portal Login: http://localhost:5000\nMobile: ${r.phone}\nPassword: ${createdCreds.password}`
                      );
                      setCreatedCreds({ ...createdCreds, copied: true });
                    }}
                  >
                    {createdCreds.copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {createdCreds.copied ? 'Copied!' : 'Copy Login Details'}
                  </Button>
                  <a
                    className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hello ${r.full_name}! Your resident portal account is active.\n\nLogin URL: http://localhost:5000\nMobile: ${r.phone}\nPassword: ${createdCreds.password}`
                    )}`}
                  >
                    <Share2 className="size-3.5" />
                    WhatsApp
                  </a>
                </div>
              </div>
            ) : r.user_id ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-ok-bg text-ok">
                  <span className="font-medium">Active Portal Account</span>
                  <Badge status="active">Login Enabled</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter new password"
                    value={portalPass}
                    onChange={(e) => setPortalPass(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    busy={portalMutation.busy}
                    onClick={() => portalMutation.run(portalPass.trim() || defaultPassword)}
                  >
                    Reset Password
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted text-xs">
                  This resident does not have portal access yet. Enter or generate a password below to enable their login on <b>Port 5000</b>.
                </p>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter or generate password"
                    value={portalPass || defaultPassword}
                    onChange={(e) => setPortalPass(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                      let code = '';
                      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                      setPortalPass(`Zip@${code}`);
                    }}
                  >
                    Random
                  </Button>
                </div>
                <ErrorBanner error={portalMutation.error} />
                <Button
                  size="sm"
                  busy={portalMutation.busy}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white"
                  onClick={() => portalMutation.run(portalPass.trim() || defaultPassword)}
                >
                  <KeyRound className="size-3.5" />
                  Grant Portal Access & Save Password
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
      {row.review_notes && <p className="text-[13px] text-muted">Review notes: {row.review_notes}</p>}
    </Drawer>
  );
}
