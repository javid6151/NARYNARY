/** "Under review" card with the submitted summary and a manual status refresh. */
import { useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { fmtDateTime } from '../../../lib/format';
import { Button, Card } from '../../../components/ui';
import type { OnboardingRequest } from '../types';

export function PendingReview({ req, tenantCode, onRefresh }: {
  req: OnboardingRequest;
  /** The business's unique ID, assigned when the application was submitted. */
  tenantCode?: string;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <div className="flex gap-4">
        <span className="size-12 rounded-full bg-warn-bg text-warn grid place-items-center shrink-0">
          <Clock className="size-6" />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg">Your application is under review</h1>
          <p className="text-[13px] text-ink-2 mt-1">
            The ZIPCO team verifies every PG business before enabling management features. You’ll get access as soon as it’s approved.
          </p>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-[13px]">
            <dt className="text-muted">Business</dt>
            <dd>{req.business_details.business_name}</dd>
            {tenantCode && (
              <>
                <dt className="text-muted">Business ID</dt>
                <dd className="tabular">{tenantCode}</dd>
              </>
            )}
            <dt className="text-muted">Submitted</dt>
            <dd>{fmtDateTime(req.created_at)}</dd>
            <dt className="text-muted">Buildings</dt>
            <dd>{req.business_details.buildings.map((b) => b.name).join(', ')}</dd>
            <dt className="text-muted">Phone</dt>
            <dd>{req.contact_details.phone}</dd>
          </dl>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              await onRefresh();
              setBusy(false);
            }}
          >
            <RefreshCw className="size-4" />
            Check status
          </Button>
        </div>
      </div>
    </Card>
  );
}
