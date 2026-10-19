import { FileText, Image as ImageIcon } from 'lucide-react';

/** Image icon for image MIME types, document icon otherwise. */
export function FileIcon({ mime }: { mime: string }) {
  return mime.startsWith('image/')
    ? <ImageIcon className="size-4 text-muted shrink-0" aria-hidden />
    : <FileText className="size-4 text-muted shrink-0" aria-hidden />;
}
