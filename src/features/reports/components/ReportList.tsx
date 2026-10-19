/** Left-hand list of available reports. */
import { Card } from '../../../components/ui';
import { cx } from '../../../lib/cx';
import type { ReportDef } from '../definitions';

export function ReportList({ defs, selectedId, onSelect }: {
  defs: ReportDef[];
  selectedId: string;
  onSelect: (r: ReportDef) => void;
}) {
  return (
    <Card title="Report categories" pad={false}>
      <ul className="p-2 space-y-0.5 print:hidden">
        {defs.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r)}
              className={cx(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer',
                selectedId === r.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-subtle',
              )}
            >
              <r.icon className="size-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13px] font-medium">{r.title}</span>
                <span className="block text-[12px] text-muted">{r.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
