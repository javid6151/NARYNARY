/** Hidden multi-file input behind a button; hands the chosen files to `onFiles`. */
import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../../../components/ui';
import { ACCEPT } from '../rules';

export function UploadButton({ label, busy, onFiles }: { label: string; busy: boolean; onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = ''; // allow choosing the same file again
          if (f.length) onFiles(f);
        }}
      />
      <Button variant="ghost" size="sm" busy={busy} onClick={() => ref.current?.click()}>
        <Upload className="size-4" />
        {label}
      </Button>
    </>
  );
}
