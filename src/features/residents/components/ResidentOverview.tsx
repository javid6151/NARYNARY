/** Overview tab of the resident drawer: rent/outstanding/check-in tiles and personal details. */
import { fmtDate, inr, label } from '../../../lib/format';
import type { ResidentDetails, ResidentRow } from '../types';

export function ResidentOverview({ r, details: x }: { r: ResidentRow; details: ResidentDetails }) {
  const facts: [string, string | null][] = [
    ['Email', x.email],
    ['Gender', label(x.gender)],
    ['Date of birth', fmtDate(x.date_of_birth)],
    ['Occupation', x.occupation],
    ['Emergency contact', [x.emergency_contact_name, x.emergency_contact_phone].filter(Boolean).join(' · ')],
    ['ID (last 4)', x.id_number_last4 ? `XXXX ${x.id_number_last4}` : null],
    ['Portal', r.has_login ? 'Activated' : 'Not activated'],
  ];
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
    </div>
  );
}
