/** Row shapes for stored files. Only rows with `uploaded_at` set are returned by the api. */

export interface StoredFile {
  id: string;
  file_name: string | null;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  uploaded_at: string;
}

export interface DocumentFile extends StoredFile {
  document_type: string;
  /** pending | verified | rejected */
  verification_status: string;
  verified_at: string | null;
  review_note: string | null;
}
