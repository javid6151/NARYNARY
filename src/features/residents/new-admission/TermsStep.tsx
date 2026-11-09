/** Step 4: admission date, rent, deposit, setup fee, mess plan, source, and initial payment status. */
import type { Dispatch, SetStateAction } from 'react';
import { Field, Input, Select } from '../../../components/ui';
import { cx } from '../../../lib/cx';
import { inr } from '../../../lib/format';
import type { TermsForm } from '../types';

export function TermsStep({ terms, setTerms, errs }: {
  terms: TermsForm;
  setTerms: Dispatch<SetStateAction<TermsForm>>;
  errs: Record<string, string>;
}) {
  const setT = (k: keyof TermsForm) => (e: { target: { value: string } }) => setTerms({ ...terms, [k]: e.target.value });

  const stdDues = Number(terms.monthly_rent || 0) + Number(terms.security_deposit || 0) + Number(terms.setup_fee || 0);
  const disc = Math.max(0, Number(terms.discount || 0));
  const netPayable = Math.max(0, stdDues - disc);

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

      {/* Standard Payment + Give Discount Summary Box */}
      <div className="sm:col-span-2 rounded-xl border border-line bg-subtle/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-ink uppercase tracking-wider">Joining Dues & Concession</span>
          <span className="text-xs text-muted">Standard admission charges</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-white rounded-lg p-2.5 border border-line shadow-2xs">
            <span className="text-muted block text-[11px]">1st Month Rent</span>
            <span className="font-bold tabular text-ink">{inr(Number(terms.monthly_rent || 0))}</span>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-line shadow-2xs">
            <span className="text-muted block text-[11px]">Security Deposit</span>
            <span className="font-bold tabular text-ink">{inr(Number(terms.security_deposit || 0))}</span>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-line shadow-2xs">
            <span className="text-muted block text-[11px]">Setup Fee</span>
            <span className="font-bold tabular text-ink">{inr(Number(terms.setup_fee || 0))}</span>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-line shadow-2xs">
            <span className="text-muted block text-[11px]">Gross Total</span>
            <span className="font-bold tabular text-ink">{inr(stdDues)}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-line/80 items-end">
          <Field label="Give Admission Discount (₹)" hint="Concession applied on joining dues (excluded from profit)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                placeholder="e.g. 1000"
                value={terms.discount || ''}
                onChange={setT('discount')}
              />
            )}
          </Field>
          <div className="p-3 bg-white rounded-xl border border-brand-200 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted">Net Payable on Admission:</p>
              <p className="text-lg font-bold text-brand-700 tabular">{inr(netPayable)}</p>
            </div>
            {disc > 0 && (
              <span className="text-xs font-semibold text-ok bg-ok-bg px-2 py-0.5 rounded-md">
                - {inr(disc)} Off
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Initial Fee Payment Status & Reminder */}
      <div className="sm:col-span-2 pt-1 border-t border-line">
        <div className="rounded-xl border border-line bg-surface-subtle p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-ink">Admission Fee Payment</h4>
              <p className="text-[12px] text-muted">
                Has the resident paid their net joining dues ({inr(netPayable)}) today?
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
                ✓ Paid ({inr(netPayable)})
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
