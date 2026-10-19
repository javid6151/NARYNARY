/** Step 2: resident contact and personal details. */
import type { Dispatch, SetStateAction } from 'react';
import { Field, Input, Select } from '../../../components/ui';
import type { ResidentForm } from '../types';

export function DetailsStep({ res, setRes, errs }: {
  res: ResidentForm;
  setRes: Dispatch<SetStateAction<ResidentForm>>;
  errs: Record<string, string>;
}) {
  const setR = (k: keyof ResidentForm) => (e: { target: { value: string } }) => setRes({ ...res, [k]: e.target.value });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Full name" required error={errs.full_name}>
        {(id) => <Input id={id} value={res.full_name} onChange={setR('full_name')} />}
      </Field>
      <Field label="Mobile number" required error={errs.phone}>
        {(id) => <Input id={id} value={res.phone} onChange={setR('phone')} inputMode="tel" placeholder="+91 98765 43210" />}
      </Field>
      <Field label="Email" error={errs.email} hint="Optional: Used for notices & updates">
        {(id) => <Input id={id} type="email" value={res.email} onChange={setR('email')} />}
      </Field>
      <Field
        label="Portal Password (Unique for this resident)"
        hint="Resident uses Mobile Number as ID and this unique password to log in"
        error={errs.portal_password}
      >
        {(id) => (
          <div className="flex gap-2">
            <Input
              id={id}
              value={res.portal_password || ''}
              onChange={setR('portal_password')}
              placeholder="e.g. Res@9842"
            />
            <button
              type="button"
              onClick={() => {
                const randomPass = 'Res#' + Math.floor(1000 + Math.random() * 9000);
                setRes({ ...res, portal_password: randomPass });
              }}
              className="px-3 py-1.5 text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100 whitespace-nowrap cursor-pointer"
            >
              Generate
            </button>
          </div>
        )}
      </Field>
      <Field label="Date of birth">
        {(id) => <Input id={id} type="date" value={res.date_of_birth} onChange={setR('date_of_birth')} />}
      </Field>
      <Field label="Gender">
        {(id) => (
          <Select id={id} value={res.gender} onChange={setR('gender')}>
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        )}
      </Field>
      <Field label="Occupation">
        {(id) => <Input id={id} value={res.occupation} onChange={setR('occupation')} placeholder="Student / Working professional" />}
      </Field>
      <Field label="Emergency contact name">
        {(id) => <Input id={id} value={res.emergency_contact_name} onChange={setR('emergency_contact_name')} />}
      </Field>
      <Field label="Emergency contact number" error={errs.emergency_contact_phone}>
        {(id) => <Input id={id} value={res.emergency_contact_phone} onChange={setR('emergency_contact_phone')} inputMode="tel" />}
      </Field>
    </div>
  );
}
