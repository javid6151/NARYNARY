/** Owner's building requests awaiting ZIPCO review (hidden when there are none). */
import { useAsync } from '../../../lib/hooks';
import { Badge } from '../../../components/ui';
import { listBuildingRequests } from '../api';

export function PendingBuildings() {
  const st = useAsync(() => listBuildingRequests(), []);
  const rows = st.data ?? [];
  if (!rows.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-line bg-white p-4 text-[13px] space-y-2">
      <p className="font-medium">Building requests</p>
      {rows.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-2">
          <span>{b.name}</span>
          <Badge status={b.status} />
          {b.review_notes && <span className="text-muted">— {b.review_notes}</span>}
        </div>
      ))}
    </div>
  );
}
