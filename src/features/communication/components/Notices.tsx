/**
 * Notices board for staff: list, read counts, publish and archive.
 * Managers can archive only building notices; tenant-wide notices are owner-only.
 */
import { useState } from 'react';
import { Archive, Megaphone, Plus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDateTime, label } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Card, Confirm, Empty } from '../../../components/ui';
import { archiveNotice, listActiveResidentIds, listNotices } from '../api';
import type { Notice } from '../types';
import { NoticeDrawer } from './NoticeDrawer';

export function Notices({ onToast }: { onToast: (m: string) => void }) {
  const { staff } = useAuth();
  const { buildingId, building } = useBuilding();
  const st = useAsync(() => listNotices(buildingId), [buildingId]);
  const residents = useAsync(() => listActiveResidentIds(buildingId), [buildingId]);
  const [create, setCreate] = useState(false);
  const [archive, setArchive] = useState<Notice | null>(null);
  const arch = useMutation(() => archiveNotice(archive!.id));
  const total = (residents.data ?? []).length;

  const newButton = (
    <Button size="sm" onClick={() => setCreate(true)}>
      <Plus className="size-4" />
      New announcement
    </Button>
  );

  return (
    <Card title="Notices" action={newButton}>
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No notices published" />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((n) => (
                <li key={n.id} className="py-3 flex gap-3">
                  <span className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0">
                    <Megaphone className="size-4" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[14px]">
                      {n.title} {n.category === 'important' && <Badge status="high">Important</Badge>}
                    </p>
                    <p className="text-[13px] text-ink-2 mt-0.5 whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[12px] text-muted mt-1">
                      {fmtDateTime(n.published_at)} · {n.building_id ? building?.name : 'All buildings'} · {label(n.category)}
                      {n.building_id && ` · read by ${n.notice_reads[0]?.count ?? 0}/${total}`}
                    </p>
                  </div>
                  {(staff?.role === 'owner' || n.building_id) && (
                    <Button variant="ghost" size="sm" onClick={() => setArchive(n)} aria-label={`Archive ${n.title}`}>
                      <Archive className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Async>
      <NoticeDrawer
        open={create}
        onClose={() => setCreate(false)}
        onDone={() => {
          setCreate(false);
          onToast('Notice published — residents notified');
          st.reload();
        }}
      />
      <Confirm
        open={!!archive}
        title="Archive notice?"
        body="Residents will no longer see it. It stays in your records."
        confirmLabel="Archive"
        busy={arch.busy}
        onClose={() => setArchive(null)}
        onConfirm={async () => {
          if ((await arch.run()) !== undefined) {
            setArchive(null);
            st.reload();
          }
        }}
      />
    </Card>
  );
}
