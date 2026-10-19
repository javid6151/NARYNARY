/** Polls from the PG office: tap an option to vote (changeable until the poll closes); results show as bars. */
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { fmtDateTime, relTime } from '../../../lib/format';
import { Async, Badge, Empty, ErrorBanner, Toast } from '../../../components/ui';
import { listPolls, votePoll } from '../../community/api';
import { TopBar } from '../ui/Headers';

export function PollsScreen() {
  const st = useAsync(() => listPolls(), []);
  const vote = useMutation((pollId: string, optionId: string) => votePoll(pollId, optionId));
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <TopBar title="Polls" back="/resident/community" />
      <ErrorBanner error={vote.error} />
      <Async state={st}>
        {(polls) =>
          polls.length === 0 ? (
            <Empty title="No polls yet">The PG office will post polls here.</Empty>
          ) : (
            <ul className="space-y-3">
              {polls.map((poll) => {
                const open = poll.status === 'open';
                return (
                  <li key={poll.id} className="bg-white border border-line rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[14.5px]">{poll.question}</p>
                      <Badge status={open ? 'active' : 'closed'}>{open ? 'Open' : 'Closed'}</Badge>
                    </div>
                    <p className="text-[12px] text-muted mt-0.5">
                      {relTime(poll.created_at)} · {poll.total_votes} vote{poll.total_votes === 1 ? '' : 's'}
                      {poll.closes_at && open ? ` · closes ${fmtDateTime(poll.closes_at)}` : ''}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {poll.options.map((o) => {
                        const pct = poll.total_votes ? Math.round((o.votes / poll.total_votes) * 100) : 0;
                        const mine = poll.my_option === o.id;
                        return (
                          <li key={o.id}>
                            <button
                              disabled={!open || vote.busy}
                              onClick={async () => {
                                if ((await vote.run(poll.id, o.id)) !== undefined) {
                                  setToast('Vote saved');
                                  st.reload();
                                }
                              }}
                              aria-pressed={mine}
                              className={cx(
                                'relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-[13.5px] cursor-pointer disabled:cursor-default',
                                mine ? 'border-brand-500' : 'border-line',
                              )}
                            >
                              <span className="absolute inset-y-0 left-0 bg-brand-50" style={{ width: `${pct}%` }} aria-hidden />
                              <span className="relative flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  {mine && <CheckCircle2 className="size-4 text-brand-600" aria-hidden />}
                                  {o.label}
                                </span>
                                <span className="tabular text-muted">{pct}%</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
