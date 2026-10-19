import { useAsync } from '../../lib/hooks';
import { listExpenses } from './api';
import type { ExpenseRow } from './types';

/** Expenses of a building (empty when no building is selected); `filter.source` limits to one source type. */
export function useExpenses(buildingId: string | null, filter?: { source?: string }) {
  return useAsync(() => {
    if (!buildingId) return Promise.resolve([] as ExpenseRow[]);
    return listExpenses(buildingId, filter?.source);
  }, [buildingId, filter?.source]);
}
