/** Owner-only feed of the latest audited actions. */
import type { AsyncState } from '../../../lib/hooks';
import { relTime } from '../../../lib/format';
import { Async, Card, Empty } from '../../../components/ui';
import { activityLabel } from '../../audit/activityLabel';

export function RecentActivity({ state }: { state: AsyncState<{ id: string; action: string; created_at: string }[]> }) {
  return (
    <Card title="Recent activity">
      <Async state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No activity yet" />
          ) : (
            <ul className="space-y-2.5 text-[13px]">
              {rows.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{activityLabel(a.action)}</span>
                  <span className="text-muted whitespace-nowrap">{relTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </Card>
  );
}
