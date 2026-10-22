/**
 * Reports page: pick a report, set the period (for dated reports), generate a preview,
 * then export to CSV or print to PDF. Exports contain only data the user can already see.
 */
import { useState } from 'react';
import { Download, FileBarChart, Printer } from 'lucide-react';
import { toApiError, type ApiError } from '../../lib/api';
import { downloadCsv, isoDate } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { REPORTS, type ReportRow } from './definitions';
import { ReportList } from './components/ReportList';
import { ReportPreview } from './components/ReportPreview';

export default function Reports() {
  const { staff } = useAuth();
  const { buildingId, building } = useBuilding();
  const defs = REPORTS.filter((r) => !r.ownerOnly || staff?.role === 'owner');
  const [sel, setSel] = useState(defs[0]);
  const [from, setFrom] = useState(isoDate().slice(0, 8) + '01');
  const [to, setTo] = useState(isoDate());
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const run = async () => {
    if (!buildingId) return;
    if (sel.dated && from > to) {
      setError(toApiError({ message: 'VALIDATION_ERROR: “From” must be before “To”' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setRows(await sel.run(buildingId, from, to));
      setGeneratedAt(new Date().toISOString());
    } catch (e) {
      setError(e as ApiError);
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  const fileName = `${sel.id}-${building?.name}-${sel.dated ? `${from}_${to}` : isoDate()}.csv`;
  const context = `${staff?.tenant_name} · ${building?.name}${sel.dated ? ` · ${from} to ${to}` : ''}`;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Choose a report, apply filters, preview and export. Exports contain only data you’re allowed to see."
        actions={<BuildingPicker />}
      />

      <SectionPromoBanner
        eyebrow="BUSINESS INTELLIGENCE"
        title="Authoritative Reports, Permanent Audit History."
        subtitle="Export comprehensive ledgers for revenue, resident check-ins, mess headcount, and property occupancy."
        imageSrc="/owner-assets/payments-hero.jpg"
        statsBadge={`${defs.length} Report Categories`}
        primaryAction={{
          label: `Generate ${sel.title}`,
          onClick: run,
          icon: FileBarChart,
        }}
      />
      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <ReportList
          defs={defs}
          selectedId={sel.id}
          onSelect={(r) => {
            setSel(r);
            setRows(null);
          }}
        />
        <div className="space-y-5 min-w-0">
          <Card title={sel.title}>
            <div className="flex flex-wrap items-end gap-3 print:hidden">
              {sel.dated && (
                <>
                  <Field label="From">
                    {(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />}
                  </Field>
                  <Field label="To">
                    {(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />}
                  </Field>
                </>
              )}
              <Button busy={busy} onClick={run}>
                <FileBarChart className="size-4" />
                Generate report
              </Button>
              {rows && rows.length > 0 && (
                <>
                  <Button variant="secondary" onClick={() => downloadCsv(fileName, rows)}>
                    <Download className="size-4" />
                    CSV / Excel
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Printer className="size-4" />
                    Print / PDF
                  </Button>
                </>
              )}
            </div>
            <div className="mt-4">
              <ErrorBanner error={error} />
            </div>
            <ReportPreview busy={busy} rows={rows} context={context} generatedAt={generatedAt} />
          </Card>
        </div>
      </div>
    </>
  );
}
