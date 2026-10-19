/** Meal response cutoffs (residents must mark "not eating" before these times) and review toggle. */
import { useEffect, useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { label } from '../../../lib/format';
import { Async, Button, Card, ErrorBanner, Field, Input } from '../../../components/ui';
import { getMealSettings, saveMealSettings } from '../api';
import type { MealSettings } from '../types';

export function MealRules({ onToast }: { onToast: (m: string) => void }) {
  const st = useAsync(() => getMealSettings(), []);
  const [f, setF] = useState<MealSettings | null>(null);
  useEffect(() => {
    if (st.data) setF(st.data);
  }, [st.data]);
  const m = useMutation(() => saveMealSettings(f!));
  return (
    <Card title="Meal response cutoffs">
      <Async state={st}>
        {() =>
          f && (
            <div className="space-y-4 max-w-xl">
              <p className="text-[13px] text-muted">
                Residents who won’t eat a meal must mark it before the cutoff on that day. Everyone else is counted as eating.
              </p>
              <ErrorBanner error={m.error} />
              <div className="grid sm:grid-cols-3 gap-3">
                {(['breakfast', 'lunch', 'dinner'] as const).map((k) => (
                  <Field key={k} label={`${label(k)} cutoff`}>
                    {(id) => (
                      <Input
                        id={id}
                        type="time"
                        value={f[`${k}_cutoff`].slice(0, 5)}
                        onChange={(e) => setF({ ...f, [`${k}_cutoff`]: e.target.value })}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={f.allow_reviews} onChange={(e) => setF({ ...f, allow_reviews: e.target.checked })} />
                Allow residents to rate meals
              </label>
              <Button
                busy={m.busy}
                onClick={async () => {
                  if (await m.run()) onToast('Meal rules saved');
                }}
              >
                Save
              </Button>
            </div>
          )
        }
      </Async>
    </Card>
  );
}
