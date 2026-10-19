/** Preview table of a generated report (first 500 rows; the export includes all). */
import { fmtDateTime } from '../../../lib/format';
import { Empty, Loading } from '../../../components/ui';
import type { ReportRow } from '../definitions';

const PREVIEW_ROWS = 500;

export function ReportPreview({ busy, rows, context, generatedAt }: {
  busy: boolean;
  /** null = not generated yet. */
  rows: ReportRow[] | null;
  /** "Business · Building · period" caption. */
  context: string;
  generatedAt: string | null;
}) {
  if (busy) return <Loading />;
  if (rows === null) return <p className="text-[13px] text-muted mt-2">Set filters and generate to preview.</p>;
  if (rows.length === 0) return <Empty title="No records for these filters" />;
  const cols = Object.keys(rows[0]);
  return (
    <div className="mt-2">
      <p className="text-[12px] text-muted mb-3">
        {context} · {rows.length} records · generated {fmtDateTime(generatedAt)}
      </p>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-subtle text-left text-muted">
              {cols.map((c) => <th key={c} className="px-4 py-2 font-medium whitespace-nowrap">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
              <tr key={i}>
                {cols.map((c) => <td key={c} className="px-4 py-2 tabular">{r[c] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PREVIEW_ROWS && (
        <p className="text-[12px] text-muted mt-2">Showing first {PREVIEW_ROWS} rows; the export includes all {rows.length}.</p>
      )}
    </div>
  );
}
