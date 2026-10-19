/**
 * Add/edit one meal's menu. Changing an existing menu for today or tomorrow is a "last-minute change":
 * it needs a reason and residents are notified.
 */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { addDays, fmtDate, isoDate } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input, Textarea } from '../../../components/ui';
import { upsertMealMenu } from '../api';
import { MEALS } from '../meals';
import type { MealType, Menu } from '../types';

export function MenuDrawer({ buildingId, date, meal, menu, onClose, onSaved }: {
  buildingId: string;
  date: string;
  meal: MealType;
  /** Existing menu, if any. */
  menu?: Menu;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const meta = MEALS.find((m) => m.id === meal)!;
  const [items, setItems] = useState(menu?.items ?? '');
  const [s, setS] = useState(menu?.serving_start?.slice(0, 5) ?? meta.start);
  const [e, setE] = useState(menu?.serving_end?.slice(0, 5) ?? meta.end);
  const [reason, setReason] = useState('');
  const lastMinute = !!menu && date <= addDays(isoDate(), 1);
  const itemsChanged = items !== menu?.items;
  const m = useMutation(() =>
    upsertMealMenu({
      buildingId,
      date,
      mealType: meal,
      items,
      servingStart: s,
      servingEnd: e,
      changeReason: reason || null,
    }),
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={!items.trim() || (lastMinute && itemsChanged && !reason)}
        onClick={async () => {
          if (await m.run()) onSaved(lastMinute && itemsChanged ? 'Menu updated — residents notified' : 'Menu saved');
        }}
      >
        {lastMinute ? 'Update & notify residents' : 'Save menu'}
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title={`${meta.label} — ${fmtDate(date)}`} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Menu items" required hint="Comma separated, e.g. Rice, Dal, Mixed Veg, Curd">
        {(id) => <Textarea id={id} value={items} onChange={(x) => setItems(x.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Serving from">{(id) => <Input id={id} type="time" value={s} onChange={(x) => setS(x.target.value)} />}</Field>
        <Field label="Serving until">{(id) => <Input id={id} type="time" value={e} onChange={(x) => setE(x.target.value)} />}</Field>
      </div>
      {lastMinute && (
        <Field label="Reason for change" required={itemsChanged} hint="Shown to residents in the change notification">
          {(id) => (
            <Input id={id} value={reason} onChange={(x) => setReason(x.target.value)} placeholder="e.g. Vegetable not available" />
          )}
        </Field>
      )}
    </Drawer>
  );
}
