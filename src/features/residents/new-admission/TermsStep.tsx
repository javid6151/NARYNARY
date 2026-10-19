/** Step 4: admission date, rent, deposit, setup fee, mess plan and lead source. */
import type { Dispatch, SetStateAction } from 'react';
import { Field, Input, Select } from '../../../components/ui';
import type { TermsForm } from '../types';

export function TermsStep({ terms, setTerms, errs }: {
  terms: TermsForm;
  setTerms: Dispatch<SetStateAction<TermsForm>>;
  errs: Record<string, string>;
}) {
  const setT = (k: keyof TermsForm) => (e: { target: { value: string } }) => setTerms({ ...terms, [k]: e.target.value });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Admission date" required error={errs.admission_date}>
        {(id) => <Input id={id} type="date" value={terms.admission_date} onChange={setT('admission_date')} />}
      </Field>
      <Field label="Monthly rent (₹)" required error={errs.monthly_rent}>
        {(id) => <Input id={id} type="number" min={0} value={terms.monthly_rent} onChange={setT('monthly_rent')} />}
      </Field>
      <Field label="Security deposit (₹)" hint="Refundable at checkout">
        {(id) => <Input id={id} type="number" min={0} value={terms.security_deposit} onChange={setT('security_deposit')} />}
      </Field>
      <Field label="One-time setup fee (₹)">
        {(id) => <Input id={id} type="number" min={0} value={terms.setup_fee} onChange={setT('setup_fee')} />}
      </Field>
      <Field label="Mess plan">
        {(id) => (
          <Select
            id={id}
            value={terms.mess_included ? 'yes' : 'no'}
            onChange={(e) => setTerms({ ...terms, mess_included: e.target.value === 'yes' })}
          >
            <option value="yes">Included</option>
            <option value="no">Not included</option>
          </Select>
        )}
      </Field>
      <Field label="Source">
        {(id) => (
          <Select id={id} value={terms.source} onChange={setT('source')}>
            <option value="">—</option>
            <option>Walk-in</option>
            <option>Referral</option>
            <option>Online listing</option>
            <option>Broker</option>
          </Select>
        )}
      </Field>
    </div>
  );
}
