import { useAsync } from '../../lib/hooks';
import { listStock } from './api';
import type { StockRow } from './types';

/** Stock levels for a building (empty when none is selected). */
export function useStock(buildingId: string | null) {
  return useAsync(() => (!buildingId ? Promise.resolve([] as StockRow[]) : listStock(buildingId)), [buildingId]);
}
