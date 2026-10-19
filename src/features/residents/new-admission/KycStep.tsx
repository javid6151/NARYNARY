/**
 * Step 3: ID type, last 4 ID characters (never the full number) and optional document copies.
 * Files are only held in the browser here; they are uploaded after the admission is created.
 */
import { useRef, type Dispatch, type SetStateAction } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button, Field, Input, Select } from '../../../components/ui';
import { ACCEPT, DOC_TYPES, fmtBytes } from '../../files/rules';
import type { PendingDoc, ResidentForm } from '../types';

export function KycStep({ res, setRes, errs, docs, setDocs, docType, setDocType, isUploaded, maxDocs, onAddFiles }: {
  res: ResidentForm;
  setRes: Dispatch<SetStateAction<ResidentForm>>;
  errs: Record<string, string>;
  docs: PendingDoc[];
  setDocs: (docs: PendingDoc[]) => void;
  docType: string;
  setDocType: (t: string) => void;
  /** True for files already uploaded by an earlier (partly failed) submit. */
  isUploaded: (f: File) => boolean;
  maxDocs: number;
  onAddFiles: (files: File[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const setR = (k: keyof ResidentForm) => (e: { target: { value: string } }) => setRes({ ...res, [k]: e.target.value });

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <p className="sm:col-span-2 text-[13px] text-muted">
        Verify the original ID in person. Only the last 4 characters are stored — never the full ID number.
      </p>
      <Field label="ID type">
        {(id) => (
          <Select id={id} value={res.id_type} onChange={setR('id_type')}>
            <option value="aadhaar">Aadhaar</option>
            <option value="pan">PAN</option>
            <option value="passport">Passport</option>
            <option value="driving_licence">Driving licence</option>
          </Select>
        )}
      </Field>
      <Field label="Last 4 characters of ID" error={errs.id_number_last4}>
        {(id) => <Input id={id} maxLength={4} value={res.id_number_last4} onChange={setR('id_number_last4')} placeholder="5678" />}
      </Field>
      <div className="sm:col-span-2 rounded-lg border border-line p-3 space-y-3">
        <p className="text-[13px] font-medium">Document copies (optional)</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Document type" className="w-48">
            {(id) => (
              <Select id={id} value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            )}
          </Field>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (f.length) onAddFiles(f);
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={docs.length >= maxDocs}>
            <Upload className="size-4" />
            Choose files
          </Button>
        </div>
        {errs.docs && <p className="text-[12px] text-bad" role="alert">{errs.docs}</p>}
        <p className="text-[12px] text-muted">
          PDF, JPG, PNG or WEBP up to 5 MB each. Stored privately and uploaded when you submit. Mask the first 8 Aadhaar digits where
          possible.
        </p>
        {docs.length > 0 && (
          <ul className="divide-y divide-line text-[13px]">
            {docs.map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <FileText className="size-4 text-muted shrink-0" aria-hidden />
                <span className="flex-1 min-w-0 truncate">
                  <b className="font-medium">{DOC_TYPES.find((t) => t.id === d.type)?.label}</b> · {d.file.name} · {fmtBytes(d.file.size)}
                </span>
                {isUploaded(d.file) ? (
                  <span className="text-[12px] text-ok">Uploaded</span>
                ) : (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-subtle cursor-pointer"
                    aria-label={`Remove ${d.file.name}`}
                    onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
