/**
 * Upcoming birthdays in the building (next 30 days). Only residents who opted in are listed, and
 * only their first name, room and day are shown. The resident can opt in or out here.
 */
import { useState } from 'react';
import { Cake } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { Async, Card, Empty, ErrorBanner } from '../../../components/ui';
import { listBirthdays, setShareBirthday } from '../../community/api';
import type { ResidentProfile } from '../types';
import { TopBar } from '../ui/Headers';

export function BirthdaysScreen({ p, onProfileChanged }: { p: ResidentProfile; onProfileChanged: () => void }) {
  const st = useAsync(() => listBirthdays(), []);
  const [share, setShare] = useState(p.share_birthday);
  const m = useMutation((v: boolean) => setShareBirthday(v));
  return (
    <>
      <TopBar title="Birthdays" back="/resident/community" />
      <Card>
        <label className="flex items-start gap-3 text-[13.5px]">
          <input
            type="checkbox"
            className="mt-1"
            checked={share}
            disabled={m.busy || !p.has_birthday}
            onChange={async (e) => {
              const v = e.target.checked;
              if ((await m.run(v)) !== undefined) {
                setShare(v);
                st.reload();
                onProfileChanged();
              }
            }}
          />
          <span>
            <span className="font-medium">Show my birthday to my building</span>
            <span className="block text-[12.5px] text-muted">
              {p.has_birthday
                ? 'Only your first name, room and the day are shown — never your year of birth.'
                : 'The PG office has no date of birth on file for you. Ask them to add it first.'}
            </span>
          </span>
        </label>
        <ErrorBanner error={m.error} />
      </Card>
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No birthdays in the next 30 days" />
          ) : (
            <ul className="space-y-2">
              {rows.map((b, i) => (
                <li key={i} className="bg-white border border-line rounded-2xl p-3 flex items-center gap-3">
                  <span className="size-11 rounded-full bg-bad-bg text-bad grid place-items-center">
                    <Cake className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-[14px]">{b.first_name}</span>
                    <span className="text-[12.5px] text-muted">Room {b.room_number}</span>
                  </span>
                  <span className="text-right text-[13px]">
                    <span className="block font-medium">{b.birthday}</span>
                    <span className="text-[12px] text-muted">{b.days_away === 0 ? 'Today 🎉' : `in ${b.days_away} days`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </>
  );
}
