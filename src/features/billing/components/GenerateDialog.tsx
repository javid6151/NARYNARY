/** Confirm dialog to generate a month's rent charges for a building (safe to re-run). */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { isoDate } from '../../../lib/format';
import { Confirm, ErrorBanner, Field, Input } from '../../../components/ui';
import { generateMonthlyCharges } from '../api';

export function GenerateDialog({ open, buildingId, onClose, onDone }: {
  open: boolean;
  buildingId: string;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [month, setMonth] = useState(isoDate().slice(0, 7));
  const m = useMutation(() => generateMonthlyCharges(buildingId, month + '-01'));
  return (
    <Confirm
      open={open}
      title="Generate monthly rent"
      confirmLabel="Generate"
      busy={m.busy}
      onClose={onClose}
      body={
        'Creates one rent charge per active resident for the selected month. ' +
        'Residents already billed for that month are skipped, so it’s safe to run again.'
      }
      onConfirm={async () => {
        const n = await m.run();
        if (n !== undefined) onDone(`${n} rent charge${n === 1 ? '' : 's'} created`);
      }}
    >
      <ErrorBanner error={m.error} />
      <Field label="Month">{(id) => <Input id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
    </Confirm>
  );
}
