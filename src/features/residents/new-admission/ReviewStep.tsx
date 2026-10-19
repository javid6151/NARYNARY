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
  const rows: [string, string][] = [
    ['Resident', res.full_name],
    ['Mobile', res.phone],
    ['Email', res.email || '—'],
    ['Bed', location],
    ['Admission date', terms.admission_date],
    ['Monthly rent', inr(terms.monthly_rent)],
    ['Security deposit', inr(terms.security_deposit)],
    ['Setup fee', inr(terms.setup_fee)],
    ['Mess', terms.mess_included ? 'Included' : 'Not included'],
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
      <p className="rounded-lg bg-info-bg text-info px-3 py-2">
        The request goes to the owner for approval. The bed is held for this admission and allocated on approval, when first-month
        charges are created.
      </p>
      <ErrorBanner error={error} />
    </div>
  );
}
