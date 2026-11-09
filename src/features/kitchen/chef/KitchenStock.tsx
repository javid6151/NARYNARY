/**
 * Chef stock screen: unified available stock levels per ingredient and movement history.
 * No store/kitchen transfers or issue/return workflows.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useMemo, useState } from 'react';
import { History, Package, Search } from 'lucide-react';
import { num } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Empty, Input, Tabs } from '../../../components/ui';
import { BuildingPicker } from '../../../components/BuildingPicker';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { stockStatus } from '../stock';
import { useStock } from '../useStock';
import { MovementHistory } from '../components/MovementHistory';
import { ItemAvatar } from './ui/ItemAvatar';
import { KitchenTopBar } from './ui/KitchenHeaders';

export function KitchenStock() {
  const { buildingId } = useBuilding();
  const st = useStock(buildingId);
  const [tab, setTab] = useState<'levels' | 'history'>('levels');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => st.data ?? [], [st.data]);
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <>
      <KitchenTopBar title="Hostel Inventory Stock" />

      <SectionPromoBanner
        fromTop
        className="!-mt-4 sm:!-mt-4 lg:!-mt-4"
        eyebrow="PANTRY & INVENTORY"
        title="Stock Levels & Consumption Audit."
        subtitle="Track pantry ingredient balances, unit levels, and permanent movement ledgers."
        imageSrc="/owner-assets/inventory-hero.jpg"
        statsBadge={rows.length > 0 ? `${rows.length} Monitored Items` : undefined}
        primaryAction={{
          label: tab === 'levels' ? 'View Movements' : 'Available Stock',
          onClick: () => setTab(tab === 'levels' ? 'history' : 'levels'),
          icon: tab === 'levels' ? History : Package,
        }}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <BuildingPicker />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'levels', label: 'Available Stock' },
          { id: 'history', label: 'Usage & Movements' },
        ]}
      />

      {tab === 'levels' ? (
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Search ingredient</span>
            <Search className="size-4 text-[#77736B] absolute left-3.5 top-3.5" aria-hidden />
            <Input
              placeholder="Search ingredient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-[#FFFEFC] border-[#DED6CB]"
            />
          </label>

          <Async state={st}>
            {() =>
              filtered.length === 0 ? (
                <Empty title="No ingredients found" />
              ) : (
                <ul className="space-y-2.5">
                  {filtered.map((r) => {
                    const expected = Number(r.expected_qty ?? (Number(r.store_qty ?? 0) + Number(r.kitchen_qty ?? 0)));
                    return (
                      <li
                        key={r.item_id}
                        className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs hover:border-[#343B2B]/30 transition-colors"
                      >
                        <ItemAvatar name={r.name} category={r.category} size={46} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-[#30271F] text-[15px] truncate">{r.name}</p>
                            <Badge status={stockStatus(r)} />
                          </div>
                          <p className="text-[12px] text-[#77736B]">
                            Category: <span className="text-[#30271F] font-semibold">{r.category}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="block font-bold text-[#343B2B] text-[16px] tabular">
                            {num(expected, 3)} {r.base_unit}
                          </span>
                          <span className="text-[11px] text-[#77736B]">Available stock</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            }
          </Async>
        </div>
      ) : (
        <MovementHistory buildingId={buildingId} />
      )}
    </>
  );
}
