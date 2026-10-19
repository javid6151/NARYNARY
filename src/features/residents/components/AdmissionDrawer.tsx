/**
 * Admission details drawer: summary, KYC documents, resulting charges, owner approve/reject,
 * and (once approved) portal activation help via a WhatsApp click-to-chat link. No passwords are sent.
 */
import { useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, inr } from '../../../lib/format';
import { Async, Avatar, Badge, Button, Card, Drawer, ErrorBanner, Field, Textarea } from '../../../components/ui';
import { ResidentDocuments } from '../../files/components/ResidentDocuments';
import { listAdmissionCharges, reviewAdmission } from '../api';
import type { AdmissionCharge, AdmissionRow } from '../types';

/** Pre-filled WhatsApp message with portal sign-up steps for an approved resident. */
function activationLink(row: AdmissionRow) {
  const r = row.residents;
  const portal = window.location.origin + '/signup';
  const text = encodeURIComponent(
    `Hi ${r.full_name}, your admission at our PG is approved (Room ${row.rooms.room_number}, Bed ${row.beds.bed_label}).\n\n` +
      `Activate your resident portal: ${portal}\nSign up with this email: ${r.email ?? '(ask us to add your email)'}\n\n` +
      'You can then view dues, pay rent, see the menu and raise complaints.',
  );
  // Indian 10-digit numbers get the 91 country code.
  const phone = r.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  return `https://wa.me/${phone}?text=${text}`;
}

export function AdmissionDrawer({ row, canApprove, onClose, onDone }: {
  row: AdmissionRow | null;
  /** Only owners approve; managers see "Waiting for the owner’s approval". */
  canApprove: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const m = useMutation((decision: 'approve' | 'reject') => reviewAdmission(row!.id, decision, notes || null));
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
      {row.status === 'approved' && (
        <Card title="Resident portal access">
          {r.user_id ? (
            <p className="text-[13px] text-ok">The resident has activated their portal account.</p>
          ) : (
            <div className="space-y-3 text-[13px]">
              <p className="text-ink-2">
                The resident activates access by signing up with{' '}
                <b>{r.email ?? 'their email (not on file — edit the resident to add one)'}</b>. No passwords are shared.
              </p>
              <a
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#1f7a4d] text-white font-medium"
                target="_blank"
                rel="noopener noreferrer"
                href={activationLink(row)}
              >
                <MessageCircle className="size-4" />
                Send activation steps on WhatsApp
              </a>
            </div>
          )}
        </Card>
      )}
      {row.review_notes && <p className="text-[13px] text-muted">Review notes: {row.review_notes}</p>}
    </Drawer>
  );
}
