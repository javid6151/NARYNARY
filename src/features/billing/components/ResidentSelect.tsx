/** Picker of active residents in the selected building, showing bed and amount due. */
import { useAsync } from '../../../lib/hooks';
import { inr } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Field, Select } from '../../../components/ui';
import { listBillingResidents } from '../api';

export function ResidentSelect({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const { buildingId } = useBuilding();
  const st = useAsync(() => listBillingResidents(buildingId), [buildingId]);
  const rows = st.data ?? [];
  return (
    <Field label="Resident" required>
      {(id) => (
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value, rows.find((r) => r.id === e.target.value)?.full_name ?? '')}
        >
          <option value="">Select resident</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name} — {r.bed_label} (due {inr(r.outstanding)})
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
