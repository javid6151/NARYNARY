/** Selected-building context shape and hook. The provider lives in `BuildingProvider.tsx`. */
import { createContext, useContext } from 'react';
import type { Building } from './types';

/** localStorage key for the last selected building (cleared on sign-out). */
export const BUILDING_STORAGE_KEY = 'zp.building';

export interface BuildingCtx {
  buildings: Building[];
  loading: boolean;
  /** 'all' only where a page supports aggregation (dashboard). */
  selected: string | 'all';
  setSelected: (id: string | 'all') => void;
  /** Always a concrete building id (first accessible when 'all'). */
  buildingId: string | null;
  building: Building | null;
  tenantId: string | null;
  reload: () => void;
}

export const BuildingContext = createContext<BuildingCtx | null>(null);

export function useBuilding() {
  const c = useContext(BuildingContext);
  if (!c) throw new Error('useBuilding outside provider');
  return c;
}
