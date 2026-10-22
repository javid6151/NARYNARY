/**
 * Loads the buildings the user can access and remembers which one is selected.
 * Hiding a building here is convenience only; RLS is what enforces building scope.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { listActiveBuildings, toSlug } from './api';
import { BUILDING_STORAGE_KEY, BuildingContext, type BuildingCtx } from './useBuilding';
import type { Building } from './types';

export function BuildingProvider({ children }: { children: ReactNode }) {
  const { pgSlug } = useParams<{ pgSlug?: string }>();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [selected, setSel] = useState<string | 'all'>(() => {
    try {
      return sessionStorage.getItem(BUILDING_STORAGE_KEY) || localStorage.getItem(BUILDING_STORAGE_KEY) || 'all';
    } catch {
      return 'all';
    }
  });

  // Real-time listener: Auto-reloads buildings whenever a new building is approved or changed
  useEffect(() => {
    const channel = supabase
      .channel('buildings-active-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buildings' },
        () => {
          setTick((t) => t + 1);
        }
      )
      .subscribe();

  return () => {
      channel.unsubscribe();
    };
  }, []);

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
    // If pgSlug is present in the route URL, match it directly against building names
    const buildingBySlug = pgSlug ? buildings.find((b) => toSlug(b.name) === pgSlug) : null;
    const valid = buildingBySlug
      ? buildingBySlug.id
      : selected === 'all' || buildings.some((b) => b.id === selected)
      ? selected
      : 'all';
    const building = buildingBySlug ?? buildings.find((b) => b.id === valid) ?? buildings[0] ?? null;
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
  }, [buildings, loading, selected, pgSlug]);

  return <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>;
}
