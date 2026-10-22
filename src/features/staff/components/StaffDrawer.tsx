/** Add/edit a staff member. Salary fields are shown to owners only. */
import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { useMutation } from '../../../lib/hooks';
import { isoDate, label } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { upsertStaffMember } from '../api';
import { STAFF_ROLES, type StaffMember } from '../types';

export function StaffDrawer({ m: s, buildingId, isOwner, onClose, onSaved }: {
  /** Existing member, or `{}` to add one. */
  m: Partial<StaffMember>;
  buildingId: string;
  isOwner: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    full_name: s.full_name ?? '',
    role: s.role ?? 'cleaning',
    phone: s.phone ?? '',
    joining_date: s.joining_date ?? isoDate(),
    monthly_salary: String(s.monthly_salary ?? ''),
    aadhar_number: s.aadhar_number ?? '',
  });
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(s.aadhar_image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const m = useMutation(() =>
    upsertStaffMember({
      id: s.id ?? null,
      buildingId,
      fullName: f.full_name,
      role: f.role,
      phone: f.phone || null,
      joiningDate: f.joining_date || null,
      // Managers don't see the salary field; keep the existing salary.
      monthlySalary: Number(f.monthly_salary || s.monthly_salary || 0),
      payDay: s.pay_day ?? 5,
      status: s.status ?? 'active',
      aadharNumber: f.aadhar_number.trim() || null,
      aadharImageUrl: existingImageUrl,
      aadharFile: aadharFile,
    }),
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.full_name.trim().length < 2}
        onClick={async () => {
          if (await m.run()) onSaved();
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title={s.id ? 'Edit staff' : 'Add staff'} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Full name" required>{(id) => <Input id={id} value={f.full_name} onChange={set('full_name')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          {(id) => (
            <Select id={id} value={f.role} onChange={set('role')}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={set('phone')} inputMode="tel" />}</Field>
        <Field label="Joining date">{(id) => <Input id={id} type="date" value={f.joining_date} onChange={set('joining_date')} />}</Field>
        {isOwner && (
          <Field label="Monthly salary (₹)">
            {(id) => <Input id={id} type="number" min={0} value={f.monthly_salary} onChange={set('monthly_salary')} />}
          </Field>
        )}
      </div>

      <div className="pt-2 border-t border-line space-y-3">
        <Field label="Aadhaar number (optional)">
          {(id) => (
            <Input
              id={id}
              value={f.aadhar_number}
              onChange={set('aadhar_number')}
              placeholder="e.g. 1234 5678 9012"
              maxLength={16}
            />
          )}
        </Field>

        <Field label="Aadhaar card image (optional)">
          {() => (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAadharFile(file);
                  }
                }}
              />
              {aadharFile ? (
                <div className="flex items-center justify-between p-2.5 bg-subtle/70 rounded-lg border border-line text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-brand-600 shrink-0" />
                    <span className="truncate font-medium">{aadharFile.name}</span>
                    <span className="text-muted text-[11px] shrink-0">
                      ({(aadharFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAadharFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-white rounded text-muted hover:text-ink cursor-pointer"
                    title="Remove selected file"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : existingImageUrl ? (
                <div className="flex items-center justify-between p-2.5 bg-subtle/70 rounded-lg border border-line text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-ok shrink-0" />
                    <a
                      href={existingImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium text-brand-600 hover:underline"
                    >
                      View uploaded Aadhaar card
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace
                    </Button>
                    <button
                      type="button"
                      onClick={() => setExistingImageUrl(null)}
                      className="p-1 hover:bg-white rounded text-muted hover:text-bad cursor-pointer"
                      title="Remove document"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center p-4 border border-dashed border-line rounded-lg hover:border-brand-600 hover:bg-brand-50/30 transition-colors cursor-pointer text-muted hover:text-brand-700"
                >
                  <Upload className="size-5 mb-1 text-muted" />
                  <span className="text-xs font-medium">Click to upload Aadhaar card</span>
                  <span className="text-[11px] text-muted">Supports JPG, PNG, WEBP or PDF (max 5MB)</span>
                </button>
              )}
            </div>
          )}
        </Field>
      </div>

      <p className="text-[12px] text-muted">To give a manager or chef a login, invite them from Settings → Team.</p>
    </Drawer>
  );
}
