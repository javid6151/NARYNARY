/**
 * Left-hand list of available reports with clean icons and chevrons matching reference design.
 */
import { ChevronRight } from 'lucide-react';
import { Card } from '../../../components/ui';
import { cx } from '../../../lib/cx';
import type { ReportDef } from '../definitions';

export function ReportList({
  defs,
  selectedId,
  onSelect,
}: {
  defs: ReportDef[];
  selectedId: string;
  onSelect: (r: ReportDef) => void;
}) {
  return (
    <Card title="Report Categories" pad={false}>
      <ul className="p-2 space-y-1 print:hidden">
        {defs.map((r) => {
          const isSelected = selectedId === r.id;
          return (
            <li key={r.id}>
              <button
                onClick={() => onSelect(r)}
                className={cx(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all',
                  isSelected
                    ? 'bg-[#EBF0E6] text-[#343B2B] font-semibold border border-[#CAD7BF] shadow-2xs'
                    : 'hover:bg-[#F5F0E8] text-[#30271F]',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cx(
                      'size-8 rounded-lg flex items-center justify-center shrink-0',
                      isSelected ? 'bg-[#343B2B] text-white' : 'bg-[#ECE5DA] text-[#30271F]',
                    )}
                  >
                    <r.icon className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12.5px] font-bold truncate">{r.title}</span>
                    <span className="block text-[11px] text-[#77736B] truncate">{r.desc}</span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-[#77736B] shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
