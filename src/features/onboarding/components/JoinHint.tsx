/** Tells residents/managers/chefs not to apply, and lets them re-check access after their PG adds them. */
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui';

export function JoinHint({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-white p-4 text-[13px] text-ink-2 flex flex-wrap items-center gap-3 justify-between">
      <p>
        <b>Resident, manager or chef?</b> You don’t need to apply. Ask your PG to add this email address, then refresh.
      </p>
      <Button
        variant="secondary"
        size="sm"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          await onRefresh();
          setBusy(false);
        }}
      >
        <RefreshCw className="size-4" />
        Refresh access
      </Button>
    </div>
  );
}
