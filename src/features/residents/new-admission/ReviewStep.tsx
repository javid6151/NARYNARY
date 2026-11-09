/** Step 5: summary before submitting the admission for owner approval. */
import type { ApiError } from '../../../lib/api';
import { inr } from '../../../lib/format';
import { ErrorBanner } from '../../../components/ui';
import type { ResidentForm, TermsForm } from '../types';

export function ReviewStep({ res, terms, location, docCount, error }: {
  res: ResidentForm;
  terms: TermsForm;
  /** "Floor · Room · Bed" label. */
  location: string;
  docCount: number;
  error: ApiError | null;
}) {
  const disc = Number(terms.discount || 0);
  const stdDues = Number(terms.monthly_rent || 0) + Number(terms.security_deposit || 0) + Number(terms.setup_fee || 0);
  const netPayable = Math.max(0, stdDues - disc);

  const rows: [string, string][] = [
    ['Resident', res.full_name],
    ['Mobile', res.phone],
    ['Email', res.email || '—'],
    ['Bed', location],
    ['Admission date', terms.admission_date],
    ['Monthly rent', inr(terms.monthly_rent)],
    ['Security deposit', inr(terms.security_deposit)],
    ['Setup fee', inr(terms.setup_fee)],
    ...(disc > 0 ? ([['Admission discount', `- ${inr(disc)}`]] as [string, string][]) : []),
    ['Net Joining Total', inr(netPayable)],
    ['Mess', terms.mess_included ? 'Included' : 'Not included'],
    [
      'Admission fee payment',
      terms.payment_status === 'paid'
        ? (terms.payment_method === 'upi'
            ? `Paid ${inr(netPayable)} via UPI (UTR: ${terms.payment_reference || '—'})`
            : `Paid ${inr(netPayable)} in Cash${terms.payment_reference ? ` (Receipt: ${terms.payment_reference})` : ''}`)
        : `Not Paid (Reminder: ${terms.reminder_date || 'Not set'})`,
    ],
    ['Portal Password', res.portal_password || '—'],
    ['Documents', docCount ? `${docCount} file(s)` : 'None'],
  ];
  return (
    <div className="space-y-4 text-[13px]">
      <dl className="grid grid-cols-2 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-lg bg-ok-bg text-ok px-3 py-2">
        Direct admission: bed is allocated immediately and resident portal access is activated.
      </p>
      <ErrorBanner error={error} />
    </div>
  );
}
