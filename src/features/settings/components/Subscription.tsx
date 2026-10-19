/** Read-only view of the tenant's plan, status, trial end and usage against limits. */
import { useAsync } from '../../../lib/hooks';
import { fmtDate, inr } from '../../../lib/format';
import { Async, Badge, Card } from '../../../components/ui';
import { getSubscription, listCountedResidentIds } from '../api';

export function Subscription() {
  const st = useAsync(() => getSubscription(), []);
  const residents = useAsync(() => listCountedResidentIds(), []);
  return (
    <Card title="Subscription">
      <Async state={st}>
        {(x) => {
          if (!x) return <p className="text-[13px] text-muted">No subscription found.</p>;
          return (
            <dl className="grid sm:grid-cols-2 gap-y-3 text-[13px] max-w-xl">
              <dt className="text-muted">Plan</dt>
              <dd>
                {x.subscription_plans.name} · {inr(x.price_override ?? x.subscription_plans.monthly_price)} / month
              </dd>
              <dt className="text-muted">Status</dt>
              <dd><Badge status={x.status} /></dd>
              {x.trial_end && (
                <>
                  <dt className="text-muted">Trial ends</dt>
                  <dd>{fmtDate(x.trial_end)}</dd>
                </>
              )}
              <dt className="text-muted">Residents</dt>
              <dd>{(residents.data ?? []).length} / {x.resident_limit}</dd>
              <dt className="text-muted">Managers / chefs allowed</dt>
              <dd>{x.manager_limit} / {x.chef_limit}</dd>
            </dl>
          );
        }}
      </Async>
      <p className="text-[12px] text-muted mt-4">Plan changes are handled by ZIPCO Solutions support.</p>
    </Card>
  );
}
