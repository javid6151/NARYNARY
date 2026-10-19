/** Vendors tab: list of vendors/service providers with add and edit. */
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Card, Empty, Table, Td, Toast } from '../../../components/ui';
import { listVendors } from '../api';
import type { Vendor } from '../types';
import { VendorDrawer } from './VendorDrawer';

export function Vendors() {
  const { tenantId } = useBuilding();
  const st = useAsync(() => listVendors(), []);
  /** `{}` = adding a new vendor. */
  const [edit, setEdit] = useState<Partial<Vendor> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const addButton = (
    <Button size="sm" onClick={() => setEdit({})}>
      <Plus className="size-4" />
      Add vendor
    </Button>
  );

  return (
    <Card title="Vendors & service providers" action={addButton}>
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No vendors yet" />
          ) : (
            <Table head={['Vendor', 'Services', 'Contact', 'Phone', 'Status', '']}>
              {rows.map((v) => (
                <tr key={v.id}>
                  <Td className="font-medium">{v.name}</Td>
                  <Td>{v.service_categories.join(', ') || '—'}</Td>
                  <Td>{v.contact_person ?? '—'}</Td>
                  <Td className="tabular">{v.phone ?? '—'}</Td>
                  <Td><Badge status={v.is_active ? 'active' : 'inactive'} /></Td>
                  <Td>
                    <Button variant="ghost" size="sm" onClick={() => setEdit(v)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </Table>
          )
        }
      </Async>
      {edit && (
        <VendorDrawer
          v={edit}
          tenantId={tenantId!}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            setToast('Vendor saved');
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}
