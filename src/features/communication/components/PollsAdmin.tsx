/** Staff polls for the selected building: results, close a poll, and create a new one (residents are notified). */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDateTime } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Card, Drawer, Empty, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { closePoll, createPoll, listPolls } from '../../community/api';

export function PollsAdmin({ onToast }: { onToast: (m: string) => void }) {
  const { buildingId, building } = useBuilding();
  const st = useAsync(() => listPolls(buildingId), [buildingId]);
  const [create, setCreate] = useState(false);
  const close = useMutation((id: string) => closePoll(id));

  const newButton = (
    <Button size="sm" onClick={() => setCreate(true)}>
      <Plus className="size-4" />
      New poll
    </Button>
  );

  return (
    <Card title={`Polls — ${building?.name ?? ''}`} action={newButton}>
      <ErrorBanner error={close.error} />
      <Async state={st}>
        {(polls) =>
          polls.length === 0 ? (
            <Empty title="No polls yet">Ask residents a question — they vote from the resident app.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {polls.map((p) => (
                <li key={p.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.question}</p>
                      <p className="text-[12px] text-muted">
                        {fmtDateTime(p.created_at)} · {p.building_id ? 'This building' : 'All buildings'} · {p.total_votes} votes
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={p.status === 'open' ? 'active' : 'closed'}>{p.status === 'open' ? 'Open' : 'Closed'}</Badge>
                      {p.status === 'open' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          busy={close.busy}
                          onClick={async () => {
                            if ((await close.run(p.id)) !== undefined) {
                              onToast('Poll closed');
                              st.reload();
                            }
                          }}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[13px] max-w-lg">
                    {p.options.map((o) => {
                      const pct = p.total_votes ? Math.round((o.votes / p.total_votes) * 100) : 0;
                      return (
                        <li key={o.id}>
                          <div className="flex justify-between">
                            <span>{o.label}</span>
                            <span className="tabular text-muted">
                              {o.votes} · {pct}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-subtle overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
      {create && (
        <NewPollDrawer
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false);
            onToast('Poll published — residents notified');
            st.reload();
          }}
        />
      )}
    </Card>
  );
}

function NewPollDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { staff } = useAuth();
  const { buildingId, building } = useBuilding();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [scope, setScope] = useState<'building' | 'all'>('building');
  const [closes, setCloses] = useState('');
  const m = useMutation(() =>
    createPoll({
      buildingId: scope === 'all' ? null : buildingId,
      question,
      options: options.map((o) => o.trim()).filter(Boolean),
      closesAt: closes ? new Date(closes).toISOString() : null,
    }),
  );
  const filled = options.filter((o) => o.trim()).length;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={question.trim().length < 5 || filled < 2}
        onClick={async () => {
          if (await m.run()) onDone();
        }}
      >
        Publish poll
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title="New poll" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Question" required>
        {(id) => <Input id={id} maxLength={200} value={question} onChange={(e) => setQuestion(e.target.value)} />}
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-ink-2 mb-1">Options (2–6)</legend>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={`Option ${i + 1}`}
              maxLength={100}
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {options.length > 2 && (
              <button
                type="button"
                aria-label={`Remove option ${i + 1}`}
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="p-2 rounded-md text-bad hover:bg-bad-bg cursor-pointer"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ''])}>
            <Plus className="size-4" />
            Add option
          </Button>
        )}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Send to">
          {(id) => (
            <Select id={id} value={scope} onChange={(e) => setScope(e.target.value as 'building' | 'all')}>
              <option value="building">{building?.name}</option>
              {staff?.role === 'owner' && <option value="all">All buildings</option>}
            </Select>
          )}
        </Field>
        <Field label="Closes at" hint="Optional">
          {(id) => <Input id={id} type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />}
        </Field>
      </div>
    </Drawer>
  );
}
