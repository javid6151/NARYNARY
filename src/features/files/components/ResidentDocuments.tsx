/** KYC documents on the resident drawer: upload, open via signed URL, verify/reject (owner/manager). */
import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import type { ApiError } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDateTime, label } from '../../../lib/format';
import { Async, Badge, Button, ErrorBanner, Field, Select } from '../../../components/ui';
import { listResidentDocuments, openFile, reviewResidentDocument, uploadFile } from '../api';
import { DOC_TYPES, fmtBytes } from '../rules';
import type { DocumentFile } from '../types';
import { uploadAll } from '../uploadAll';
import { FileIcon } from './FileIcon';
import { UploadButton } from './UploadButton';

export function ResidentDocuments({ residentId, canEdit }: { residentId: string; canEdit: boolean }) {
  const st = useAsync(() => listResidentDocuments(residentId), [residentId]);
  const [docType, setDocType] = useState('id_proof');
  const up = useMutation((files: File[]) => uploadAll(files, (f) => uploadFile('resident_document', residentId, f, docType)));
  const review = useMutation((id: string, decision: 'verified' | 'rejected') => reviewResidentDocument(id, decision));
  const [openErr, setOpenErr] = useState<ApiError | null>(null);
  const open = async (r: DocumentFile) => {
    setOpenErr(null);
    try {
      await openFile('resident_document', r.storage_path);
    } catch (e) {
      setOpenErr(e as ApiError);
    }
  };
  const decide = async (id: string, decision: 'verified' | 'rejected') => {
    if ((await review.run(id, decision)) !== undefined) st.reload();
  };

  return (
    <div className="space-y-3">
      <ErrorBanner error={up.error ?? review.error ?? openErr} />
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
          <Field label="Document type" className="w-48">
            {(id) => (
              <Select id={id} value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            )}
          </Field>
          <UploadButton
            label="Upload document"
            busy={up.busy}
            onFiles={async (f) => {
              await up.run(f);
              st.reload();
            }}
          />
          <p className="w-full text-[12px] text-muted">
            PDF, JPG, PNG or WEBP up to 5 MB. Files are private and open through a link that expires in 60 seconds.
          </p>
        </div>
      )}
      <Async state={st} rows={2}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="text-[13px] text-muted flex items-center gap-2">
              <Paperclip className="size-4" aria-hidden />
              No documents uploaded.
            </p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <FileIcon mime={r.mime_type} />
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{DOC_TYPES.find((d) => d.id === r.document_type)?.label ?? label(r.document_type)}</span>
                    <span className="text-muted"> · {r.file_name ?? 'Document'} · {fmtBytes(r.size_bytes)} · {fmtDateTime(r.uploaded_at)}</span>
                  </span>
                  <Badge status={r.verification_status} />
                  <Button variant="ghost" size="sm" onClick={() => open(r)}>Open</Button>
                  {canEdit && r.verification_status === 'pending' && (
                    <>
                      <Button variant="success" size="sm" busy={review.busy} onClick={() => decide(r.id, 'verified')}>Verify</Button>
                      <Button variant="danger" size="sm" busy={review.busy} onClick={() => decide(r.id, 'rejected')}>Reject</Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </div>
  );
}
