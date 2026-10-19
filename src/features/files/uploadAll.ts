import { ApiError } from '../../lib/api';
import { fileError } from './rules';

/** Validates every file first so a bad file never leaves a half-uploaded selection, then uploads in order. */
export async function uploadAll(files: File[], upload: (f: File) => Promise<unknown>) {
  const bad = files.map(fileError).filter(Boolean);
  if (bad.length) throw new ApiError('VALIDATION_ERROR', bad.join(' '));
  for (const f of files) await upload(f);
  return true;
}
