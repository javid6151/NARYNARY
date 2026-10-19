/** Numbered step pills for the admission wizard (done steps show a check). */
import { Check } from 'lucide-react';
import { cx } from '../../../lib/cx';

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 mb-5" aria-label="Steps">
      {steps.map((s, i) => (
        <li
          key={s}
          className={cx(
            'flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-[13px] border',
            i === current
              ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
              : i < current
                ? 'border-line bg-white text-ink-2'
                : 'border-line bg-white text-muted',
          )}
          aria-current={i === current ? 'step' : undefined}
        >
          <span
            className={cx(
              'size-6 rounded-full grid place-items-center text-[12px]',
              i < current ? 'bg-ok text-white' : i === current ? 'bg-brand-600 text-white' : 'bg-subtle',
            )}
          >
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}
