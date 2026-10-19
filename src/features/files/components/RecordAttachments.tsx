/** Invoice / photo attachments card for an expense or maintenance request (owner/manager only). */
import { useState } from 'react';
import type { ApiError } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDateTime } from '../../../lib/format';
import { Async, Button, Card, ErrorBanner } from '../../../components/ui';
import { listRecordAttachments, openFile, uploadFile } from '../api';
import { fmtBytes, type UploadKind } from '../rules';
import type { StoredFile } from '../types';
import { uploadAll } from '../uploadAll';
import { FileIcon } from './FileIcon';
import { UploadButton } from './UploadButton';

export function RecordAttachments({ kind, recordId, title }: {
  kind: Exclude<UploadKind, 'resident_document'>;
  recordId: string;
  title: string;
}) {
  const st = useAsync(() => listRecordAttachments(kind, recordId), [recordId]);
  const up = useMutation((files: File[]) => uploadAll(files, (f) => uploadFile(kind, recordId, f)));
  const [openErr, setOpenErr] = useState<ApiError | null>(null);
  const open = async (r: StoredFile) => {
    setOpenErr(null);
    try {
      await openFile(kind, r.storage_path);
    } catch (e) {
      setOpenErr(e as ApiError);
    }
  };

  const attach = (
    <UploadButton
      label="Attach"
      busy={up.busy}
      onFiles={async (f) => {
        await up.run(f);
        st.reload();
      }}
    />
  );

  return (
    <Card title={title} action={attach}>
      <div className="space-y-2">
        <ErrorBanner error={up.error ?? openErr} />
        <Async state={st} rows={1}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-[13px] text-muted">No files attached. PDF, JPG, PNG or WEBP up to 5 MB.</p>
            ) : (
              <ul className="divide-y divide-line text-[13px]">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <FileIcon mime={r.mime_type} />
                    <span className="flex-1 min-w-0 truncate">
                      {r.file_name ?? 'Attachment'}
                      <span className="text-muted"> · {fmtBytes(r.size_bytes)} · {fmtDateTime(r.uploaded_at)}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => open(r)}>Open</Button>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      </div>
    </Card>
  );
}
