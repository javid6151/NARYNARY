import { Building2 } from 'lucide-react';
import { useBuilding } from '../features/access/useBuilding';
import { Select } from './ui';

/** Building selector. `allowAll` only on pages that aggregate across buildings. */
export function BuildingPicker({ allowAll = false }: { allowAll?: boolean }) {
  const { buildings, selected, setSelected, buildingId } = useBuilding();
  if (buildings.length <= 1 && !allowAll) return null;
  const value = allowAll ? selected : buildingId ?? '';
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Building</span>
      <Building2 className="size-4 text-muted absolute left-3 pointer-events-none" aria-hidden />
      <Select value={value} onChange={(e) => setSelected(e.target.value)} className="pl-9 min-w-44 w-auto">
        {allowAll && buildings.length > 1 && <option value="all">All buildings</option>}
        {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
    </label>
  );
}
