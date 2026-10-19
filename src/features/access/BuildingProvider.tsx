/**
 * Loads the buildings the user can access and remembers which one is selected.
 * Hiding a building here is convenience only; RLS is what enforces building scope.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { listActiveBuildings } from './api';
import { BUILDING_STORAGE_KEY, BuildingContext, type BuildingCtx } from './useBuilding';
import type { Building } from './types';

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [selected, setSel] = useState<string | 'all'>(() => {
    try {
      return localStorage.getItem(BUILDING_STORAGE_KEY) || 'all';
    } catch {
      return 'all';
    }
  });

  useEffect(() => {
    let live = true;
    setLoading(true);
    listActiveBuildings()
      .then((b) => { if (live) setBuildings(b); })
      .catch(() => { if (live) setBuildings([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
    };
  }, [tick]);

  const value = useMemo<BuildingCtx>(() => {
    // A stale stored id (building removed or no longer assigned) falls back to 'all'.
    const valid = selected === 'all' || buildings.some((b) => b.id === selected) ? selected : 'all';
    const building = buildings.find((b) => b.id === valid) ?? buildings[0] ?? null;
    return {
      buildings, loading, selected: valid, building, buildingId: building?.id ?? null,
      tenantId: buildings[0]?.tenant_id ?? null,
      setSelected: (id) => {
        setSel(id);
        try {
          localStorage.setItem(BUILDING_STORAGE_KEY, id);
        } catch {
          /* storage unavailable */
        }
      },
      reload: () => setTick((t) => t + 1),
    };
  }, [buildings, loading, selected]);

  return <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>;
}
