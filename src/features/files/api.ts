/**
 * Private file storage: upload, open via signed URL, list attachments, review KYC documents.
 *
 * Upload flow (all three steps are authorized per record, not by path):
 * 1. `begin_upload` checks the caller may attach to the record and returns a server-generated
 *    path `tenant/building/record/uuid.ext`.
 * 2. The file is uploaded to that path; the storage policy only accepts paths issued in step 1.
 * 3. `complete_upload` marks the row as uploaded so it appears in lists.
 */
import { ApiError, q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { BUCKET, fileError, type UploadKind } from './rules';
import type { DocumentFile, StoredFile } from './types';

/** Uploads a file for a record and returns the new file row id. */
export async function uploadFile(kind: UploadKind, recordId: string, file: File, documentType?: string): Promise<string> {
  const err = fileError(file);
  if (err) throw new ApiError('VALIDATION_ERROR', err);
  const slot = (await rpc('begin_upload', {
    p_kind: kind,
    p_record: recordId,
    p_mime: file.type,
    p_size: file.size,
    p_file_name: file.name,
    p_document_type: documentType ?? null,
  })) as unknown as { id: string; bucket: string; path: string };
  const { error } = await supabase.storage.from(slot.bucket).upload(slot.path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new ApiError(
      'VALIDATION_ERROR',
      /size|large/i.test(error.message) ? 'File must be smaller than 5 MB' : 'Upload failed. Please try again.',
    );
  }
  await rpc('complete_upload', { p_kind: kind, p_id: slot.id });
  return slot.id;
}

/** Opens a private file through a 60-second signed URL. */
export async function openFile(kind: UploadKind, path: string) {
  // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
  const w = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(BUCKET[kind]).createSignedUrl(path, 60);
  if (error || !data) {
    w?.close();
    throw new ApiError('NOT_FOUND', 'File not found or you do not have access to it.');
  }
  if (w) {
    w.opener = null;
    w.location.href = data.signedUrl;
  } else {
    window.location.assign(data.signedUrl);
  }
}

/** Completed attachments of an expense or maintenance request, oldest first. */
export function listRecordAttachments(kind: Exclude<UploadKind, 'resident_document'>, recordId: string): Promise<StoredFile[]> {
  const columns = 'id,file_name,mime_type,size_bytes,storage_path,uploaded_at';
  const query =
    kind === 'expense_invoice'
      ? supabase.from('expense_attachments').select(columns).eq('expense_id', recordId)
      : supabase.from('maintenance_attachments').select(columns).eq('maintenance_request_id', recordId);
  // `uploaded_at` is null until `complete_upload` succeeds; those rows are hidden.
  return q(query.not('uploaded_at', 'is', null).order('uploaded_at')) as Promise<StoredFile[]>;
}

/** A resident's completed KYC documents, newest first. */
export function listResidentDocuments(residentId: string): Promise<DocumentFile[]> {
  return q(
    supabase
      .from('resident_documents')
      .select('id,document_type,file_name,mime_type,size_bytes,storage_path,uploaded_at,verification_status,verified_at,review_note')
      .eq('resident_id', residentId)
      .not('uploaded_at', 'is', null)
      .order('uploaded_at', { ascending: false }),
  ) as Promise<DocumentFile[]>;
}

/** Owner/manager marks a KYC document verified or rejected (audited server-side). */
export function reviewResidentDocument(documentId: string, decision: 'verified' | 'rejected') {
  return rpc('review_resident_document', { p_document: documentId, p_decision: decision });
}
