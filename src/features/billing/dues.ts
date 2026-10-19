import type { OpenCharge } from './types';

export interface ResidentDues {
  id: string;
  name: string;
  phone: string;
  /** Sum of open balances. */
  total: number;
  /** Part of `total` whose due date is before today. */
  overdue: number;
  /** Earliest due date among open charges. */
  oldest: string;
  /** Number of open charges. */
  count: number;
}

/** Groups open charges per resident; most overdue first, then largest total. */
export function groupDuesByResident(charges: OpenCharge[], today: string, search: string): ResidentDues[] {
  const m = new Map<string, ResidentDues>();
  for (const c of charges) {
    const e = m.get(c.resident_id) ?? {
      id: c.resident_id,
      name: c.residents.full_name,
      phone: c.residents.phone,
      total: 0,
      overdue: 0,
      oldest: c.due_date,
      count: 0,
    };
    e.total += Number(c.balance);
    e.count++;
    if (c.due_date < today) e.overdue += Number(c.balance);
    if (c.due_date < e.oldest) e.oldest = c.due_date;
    m.set(c.resident_id, e);
  }
  return [...m.values()]
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total);
}
