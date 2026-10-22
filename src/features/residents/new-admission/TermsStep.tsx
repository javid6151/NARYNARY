/** Step 4: admission date, rent, deposit, setup fee, mess plan, source, and initial payment status. */
import type { Dispatch, SetStateAction } from 'react';
import { Field, Input, Select } from '../../../components/ui';
import { cx } from '../../../lib/cx';
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

      {/* Initial Fee Payment Status & Reminder */}
      <div className="sm:col-span-2 pt-3 border-t border-line">
        <div className="rounded-xl border border-line bg-surface-subtle p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-ink">Admission Fee Payment</h4>
              <p className="text-[12px] text-muted">
                Has the resident paid their joining dues (deposit & setup fees) today?
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-line bg-white p-0.5 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTerms({ ...terms, payment_status: 'paid' })}
                className={cx(
                  'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  terms.payment_status === 'paid'
                    ? 'bg-ok text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                )}
              >
                ✓ Paid
              </button>
              <button
                type="button"
                onClick={() => setTerms({ ...terms, payment_status: 'not_paid' })}
                className={cx(
                  'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  terms.payment_status === 'not_paid'
                    ? 'bg-bad text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                )}
              >
                ✕ Not Paid
              </button>
            </div>
          </div>

          {terms.payment_status === 'paid' ? (
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <Field label="Payment Method">
                {(id) => (
                  <Select
                    id={id}
                    value={terms.payment_method}
                    onChange={(e) => setTerms({ ...terms, payment_method: e.target.value as 'upi' | 'cash' })}
                  >
                    <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="cash">Cash</option>
                  </Select>
                )}
              </Field>

              {terms.payment_method === 'upi' ? (
                <Field
                  label="UPI UTR Number / Reference"
                  required
                  error={errs.payment_reference}
                  hint="12-digit transaction UTR number"
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={terms.payment_reference}
                      onChange={setT('payment_reference')}
                      placeholder="e.g. 428791023847"
                    />
                  )}
                </Field>
              ) : (
                <Field
                  label="Receipt Details / Cash Memo"
                  hint="Receipt number, memo reference or collected by"
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={terms.payment_reference}
                      onChange={setT('payment_reference')}
                      placeholder="e.g. RCPT-01 or Cash in hand"
                    />
                  )}
                </Field>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <Field
                label="Payment Reminder Date"
                hint="When should staff send a reminder?"
                error={errs.reminder_date}
              >
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={terms.reminder_date}
                    onChange={setT('reminder_date')}
                  />
                )}
              </Field>
              <Field
                label="Reminder Note"
                hint="Reason or resident commitment"
              >
                {(id) => (
                  <Input
                    id={id}
                    value={terms.reminder_note}
                    onChange={setT('reminder_note')}
                    placeholder="e.g. Salary on 25th, will pay deposit"
                  />
                )}
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
