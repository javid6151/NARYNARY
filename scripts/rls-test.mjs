// Security / integrity tests against the local stack (run after `npm run seed:dev`).
// Covers the agents.md checklist: tenant isolation, building scope, role limits,
// resident privacy, concurrent bed allocation, idempotent retries, suspension.
import { createClient } from '@supabase/supabase-js';
import { localEnv, adminClient, userClient, key } from './local-env.mjs';

const env = localEnv();
const admin = adminClient(env);
const PW = 'Password123!';
const c = {
  owner: await userClient(env, 'owner@zipnary.test', PW),
  manager: await userClient(env, 'manager@zipnary.test', PW),
  chef: await userClient(env, 'chef@zipnary.test', PW),
  owner2: await userClient(env, 'owner@sunrise.test', PW),
  rahul: await userClient(env, 'rahul@resident.test', PW),
  amit: await userClient(env, 'amit@resident.test', PW),
  platform: await userClient(env, 'admin@zipco.test', PW),
};
const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } });

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '—', e.message); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const rows = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
const fails = async (q, code) => {
  const { error } = await q;
  assert(error, 'expected an error but call succeeded');
  if (code) assert(error.message.startsWith(code) || error.code === '42501', `expected ${code}, got "${error.message}"`);
};

const hm = (await admin.from('tenants').select('id').eq('business_name', 'Zipnary PG & Hostels').single()).data.id;
const yvr = (await admin.from('buildings').select('id').eq('name', 'YVR PG').single()).data.id;
const aBlock = (await admin.from('buildings').select('id').eq('name', 'A Block').single()).data.id;
const amitRes = (await admin.from('residents').select('id').eq('email', 'amit@resident.test').single()).data.id;
const rahulRes = (await admin.from('residents').select('id').eq('email', 'rahul@resident.test').single()).data.id;

console.log('Tenant isolation');
await t('other tenant owner sees none of Zipnary buildings', async () => {
  const d = await rows(c.owner2.from('buildings').select('id').eq('tenant_id', hm)); assert(d.length === 0, `saw ${d.length}`);
});
await t('other tenant owner sees no Zipnary residents/payments/expenses', async () => {
  for (const tbl of ['residents', 'payment_transactions', 'expenses', 'rent_charges', 'inventory_transactions', 'complaints']) {
    const d = await rows(c.owner2.from(tbl).select('id').eq('tenant_id', hm)); assert(d.length === 0, `${tbl}: ${d.length}`);
  }
});
await t('other tenant owner cannot record payment for Zipnary resident (manipulated id)', () =>
  fails(c.owner2.rpc('record_payment', { p_resident: amitRes, p_amount: 100, p_method: 'cash', p_reference: null,
    p_paid_at: new Date().toISOString(), p_allocations: null, p_idempotency_key: key() }), 'NOT_FOUND'));
await t('other tenant owner cannot read Zipnary building layout', () =>
  fails(c.owner2.rpc('building_layout', { p_building: yvr }), 'NOT_FOUND'));
await t('other tenant owner cannot create admission on Zipnary bed', async () => {
  const bed = (await admin.from('beds').select('id').eq('building_id', yvr).limit(1).single()).data.id;
  await fails(c.owner2.rpc('create_admission', { p_bed: bed, p_resident: { full_name: 'X Y', phone: '9999999999' },
    p_terms: { admission_date: '2026-10-18', monthly_rent: 1 }, p_idempotency_key: key() }), 'NOT_FOUND');
});

console.log('Building scope (manager)');
await t('manager sees only assigned building', async () => {
  const d = await rows(c.manager.from('buildings').select('id')); assert(d.length === 1 && d[0].id === yvr, JSON.stringify(d));
});
await t('manager cannot read unassigned building rooms', async () => {
  const d = await rows(c.manager.from('rooms').select('id').eq('building_id', aBlock)); assert(d.length === 0, `saw ${d.length}`);
});
await t('manager cannot create room in unassigned building', async () => {
  const f = (await admin.from('floors').select('id').eq('building_id', aBlock).limit(1).single()).data.id;
  await fails(c.manager.rpc('create_room_with_beds', { p_floor: f, p_room_number: 'Z1', p_capacity: 1, p_monthly_rent: 1 }), 'NOT_FOUND');
});
await t('manager cannot approve admissions (owner only)', async () => {
  const a = (await admin.from('admissions').select('id').eq('status', 'pending_review').limit(1).single()).data.id;
  await fails(c.manager.rpc('review_admission', { p_admission: a, p_decision: 'approve' }), 'NOT_FOUND');
});
await t('manager cannot invite staff', () =>
  fails(c.manager.rpc('invite_staff_account', { p_email: 'x@y.test', p_role: 'chef', p_name: 'X', p_building_ids: [yvr] }), 'FORBIDDEN'));

console.log('Chef restrictions');
await t('chef cannot read residents, KYC docs, payments, charges, expenses, staff salaries', async () => {
  for (const tbl of ['residents', 'resident_documents', 'payment_transactions', 'rent_charges', 'expenses', 'staff_members', 'admissions']) {
    const d = await rows(c.chef.from(tbl).select('id')); assert(d.length === 0, `${tbl}: ${d.length}`);
  }
});
await t('chef can read kitchen stock and meal counts', async () => {
  const s = await rows(c.chef.from('inventory_stock').select('item_id').eq('building_id', yvr)); assert(s.length > 0, 'no stock');
  const { data, error } = await c.chef.rpc('meal_count_summary', { p_building: yvr, p_date: new Date().toISOString().slice(0, 10) });
  assert(!error && data.total_residents > 0, error?.message);
});
await t('chef cannot post stock adjustments (owner/manager only)', async () => {
  const item = (await admin.from('inventory_items').select('id').eq('tenant_id', hm).limit(1).single()).data.id;
  await fails(c.chef.rpc('inventory_move', { p_building: yvr, p_item: item, p_action: 'adjust_in', p_qty: 1, p_unit_cost: null,
    p_vendor: null, p_notes: null, p_idempotency_key: key() }), 'NOT_FOUND');
});

console.log('Resident privacy');
await t("resident sees only own charges and payments", async () => {
  const ch = await rows(c.rahul.from('rent_charges').select('resident_id'));
  assert(ch.length > 0 && ch.every((x) => x.resident_id === rahulRes), 'saw other residents');
  const p = await rows(c.rahul.from('payment_transactions').select('resident_id').eq('resident_id', amitRes));
  assert(p.length === 0, 'saw amit payments');
});
await t('resident cannot read other residents profiles', async () => {
  const d = await rows(c.rahul.from('residents').select('id')); assert(d.length === 1 && d[0].id === rahulRes, `saw ${d.length}`);
});
await t('resident cannot read staff chat or expenses', async () => {
  const ch = await rows(c.rahul.from('chat_channels').select('kind'));
  assert(ch.length > 0 && !ch.some((x) => x.kind === 'staff'), 'staff channel visible');
  const e = await rows(c.rahul.from('expenses').select('id')); assert(e.length === 0, 'expenses visible');
});
await t('resident cannot change own status / link (protected columns)', () =>
  fails(c.rahul.from('residents').update({ status: 'blocked' }).eq('id', rahulRes)));
await t('resident cannot grant self platform admin', () =>
  fails(c.rahul.from('platform_admins').insert({ user_id: '00000000-0000-0000-0000-000000000000' })));
await t('resident cannot insert membership', () =>
  fails(c.rahul.from('tenant_memberships').insert({ tenant_id: hm, role: 'owner', invite_email: 'a@b.c' })));

console.log('Anonymous access');
await t('anon reads nothing', async () => {
  const { data, error } = await anon.from('buildings').select('id');
  assert(error || (data ?? []).length === 0, 'anon read buildings');
});

console.log('Concurrency & idempotency');
await t('two concurrent admissions on the same bed: only one succeeds', async () => {
  const layout = (await c.owner.rpc('building_layout', { p_building: yvr })).data;
  const free = layout.flatMap((f) => f.rooms.flatMap((r) => r.beds)).find((b) => !b.resident_id && !b.pending_admission);
  const mk = (n) => c.owner.rpc('create_admission', { p_bed: free.bed_id, p_resident: { full_name: `Race ${n}`, phone: '9000000000' },
    p_terms: { admission_date: new Date().toISOString().slice(0, 10), monthly_rent: 5000 }, p_idempotency_key: key() });
  const res = await Promise.all([mk(1), mk(2)]);
  const ok = res.filter((r) => !r.error);
  assert(ok.length === 1, `succeeded: ${ok.length}`);
  // concurrent approvals of the same admission are also safe
  const ap = await Promise.all([1, 2].map(() => c.owner.rpc('review_admission', { p_admission: ok[0].data, p_decision: 'approve' })));
  const assignments = (await admin.from('resident_room_assignments').select('id').eq('bed_id', free.bed_id).is('end_at', null)).data;
  assert(assignments.length === 1, `assignments: ${assignments.length}; ${ap.map((x) => x.error?.message).join(',')}`);
});
await t('retried payment with same idempotency key records once', async () => {
  const k = key();
  const args = { p_resident: amitRes, p_amount: 10, p_method: 'cash', p_reference: null, p_paid_at: new Date().toISOString(), p_allocations: null, p_idempotency_key: k };
  const [a, b] = await Promise.all([c.owner.rpc('record_payment', args), c.owner.rpc('record_payment', args)]);
  assert(!a.error && !b.error, a.error?.message || b.error?.message);
  assert(a.data.payment_id === b.data.payment_id, 'different payments');
});
await t('allocation larger than charge balance is rejected', async () => {
  const ch = (await admin.from('rent_charge_balances').select('id,balance').eq('resident_id', amitRes).limit(1).single()).data;
  await fails(c.owner.rpc('record_payment', { p_resident: amitRes, p_amount: 999999, p_method: 'cash', p_reference: null,
    p_paid_at: new Date().toISOString(), p_allocations: [{ rent_charge_id: ch.id, amount: Number(ch.balance) + 1 }], p_idempotency_key: key() }), 'VALIDATION_ERROR');
});
await t('retried inventory movement with same key posts once', async () => {
  const item = (await admin.from('inventory_items').select('id').eq('name', 'Rice').eq('tenant_id', hm).single()).data.id;
  const before = (await admin.from('inventory_transactions').select('id', { count: 'exact', head: true }).eq('item_id', item)).count;
  const k = key();
  const args = { p_building: yvr, p_item: item, p_action: 'issue', p_qty: 0.5, p_unit_cost: null, p_vendor: null, p_notes: null, p_idempotency_key: k };
  await c.chef.rpc('inventory_move', args); await c.chef.rpc('inventory_move', args);
  const after = (await admin.from('inventory_transactions').select('id', { count: 'exact', head: true }).eq('item_id', item)).count;
  assert(after - before === 2, `rows added ${after - before} (expected 2 for one issue)`);
});
await t('stock cannot go negative', async () => {
  const item = (await admin.from('inventory_items').select('id').eq('name', 'Rice').eq('tenant_id', hm).single()).data.id;
  await fails(c.chef.rpc('inventory_move', { p_building: yvr, p_item: item, p_action: 'wastage', p_qty: 100000, p_unit_cost: null,
    p_vendor: null, p_notes: null, p_idempotency_key: key() }), 'BUSINESS_RULE_VIOLATION');
});
await t('room capacity cannot drop below occupied beds', async () => {
  const room = (await admin.from('rooms').select('id').eq('building_id', yvr).eq('room_number', '101').single()).data.id;
  await fails(c.owner.rpc('room_update_capacity', { p_room: room, p_capacity: 1, p_monthly_rent: null }), 'BUSINESS_RULE_VIOLATION');
});

console.log('Private file storage');
const PDF = () => new Blob(['%PDF-1.4\n% zipnary rls test\n%%EOF\n'], { type: 'application/pdf' });
async function upload(client, kind, record, extra = {}) {
  const { data: slot, error } = await client.rpc('begin_upload', { p_kind: kind, p_record: record, p_mime: 'application/pdf',
    p_size: 64, p_file_name: 'test.pdf', p_document_type: kind === 'resident_document' ? 'id_proof' : null, ...extra });
  if (error) throw new Error(`begin_upload: ${error.message}`);
  const up = await client.storage.from(slot.bucket).upload(slot.path, PDF(), { contentType: 'application/pdf', upsert: false });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  const done = await client.rpc('complete_upload', { p_kind: kind, p_id: slot.id });
  if (done.error) throw new Error(`complete_upload: ${done.error.message}`);
  return slot;
}
const canRead = async (client, f) => {
  const s = await client.storage.from(f.bucket).createSignedUrl(f.path, 60);
  const d = await client.storage.from(f.bucket).download(f.path);
  return !s.error || !d.error;
};
const expenseId = (await admin.from('expenses').select('id').eq('building_id', yvr).limit(1).single()).data.id;
const maintId = (await admin.from('maintenance_requests').select('id').eq('building_id', yvr).limit(1).single()).data.id;
const files = {};
await t('owner uploads KYC doc, invoice and maintenance photo to server-generated paths', async () => {
  files.doc = await upload(c.owner, 'resident_document', rahulRes);
  files.invoice = await upload(c.owner, 'expense_invoice', expenseId);
  files.photo = await upload(c.manager, 'maintenance_attachment', maintId);
  assert(files.doc.path.startsWith(`${hm}/${yvr}/${rahulRes}/`), files.doc.path);
  assert(/\.pdf$/.test(files.invoice.path), files.invoice.path);
});
await t('owner and assigned manager can open files via short-lived signed URL', async () => {
  for (const f of Object.values(files)) {
    const s = await c.owner.storage.from(f.bucket).createSignedUrl(f.path, 60);
    assert(!s.error, s.error?.message);
    const res = await fetch(s.data.signedUrl); assert(res.ok, `fetch ${res.status}`);
    assert(await canRead(c.manager, f), `manager cannot read ${f.bucket}`);
  }
});
await t('other tenant owner cannot read or sign any Zipnary object', async () => {
  for (const f of Object.values(files)) assert(!(await canRead(c.owner2, f)), `owner2 read ${f.bucket}`);
  const d = await rows(c.owner2.from('resident_documents').select('id').eq('tenant_id', hm)); assert(d.length === 0, 'doc rows visible');
});
await t('chef cannot read KYC documents, invoices or maintenance files', async () => {
  for (const f of Object.values(files)) assert(!(await canRead(c.chef, f)), `chef read ${f.bucket}`);
  const d = await rows(c.chef.from('expense_attachments').select('id')); assert(d.length === 0, 'invoice rows visible');
});
await t('resident reads own document; another resident cannot', async () => {
  assert(await canRead(c.rahul, files.doc), 'rahul cannot read own document');
  assert(!(await canRead(c.amit, files.doc)), 'amit read rahul document');
  assert(!(await canRead(c.rahul, files.invoice)), 'resident read invoice');
});
await t('anonymous user cannot read objects', async () => {
  for (const f of Object.values(files)) assert(!(await canRead(anon, f)), `anon read ${f.bucket}`);
});
await t('direct upload to a self-chosen path is rejected (no metadata row)', async () => {
  const { error } = await c.owner.storage.from('resident-documents').upload(`${hm}/${yvr}/${rahulRes}/${key()}.pdf`, PDF(), { contentType: 'application/pdf' });
  assert(error, 'upload succeeded');
});
await t('other tenant owner cannot upload into a path issued to Zipnary owner', async () => {
  const { data: slot } = await c.owner.rpc('begin_upload', { p_kind: 'expense_invoice', p_record: expenseId, p_mime: 'application/pdf', p_size: 64 });
  const { error } = await c.owner2.storage.from(slot.bucket).upload(slot.path, PDF(), { contentType: 'application/pdf' });
  assert(error, 'owner2 upload succeeded');
});
await t('other tenant / chef cannot request upload slots for Zipnary records', async () => {
  await fails(c.owner2.rpc('begin_upload', { p_kind: 'expense_invoice', p_record: expenseId, p_mime: 'application/pdf', p_size: 64 }), 'NOT_FOUND');
  await fails(c.chef.rpc('begin_upload', { p_kind: 'resident_document', p_record: rahulRes, p_mime: 'application/pdf', p_size: 64, p_document_type: 'id_proof' }), 'NOT_FOUND');
});
await t('disallowed type, oversize file and mismatched content are rejected', async () => {
  await fails(c.owner.rpc('begin_upload', { p_kind: 'expense_invoice', p_record: expenseId, p_mime: 'text/html', p_size: 64 }), 'VALIDATION_ERROR');
  await fails(c.owner.rpc('begin_upload', { p_kind: 'expense_invoice', p_record: expenseId, p_mime: 'application/pdf', p_size: 5242881 }), 'VALIDATION_ERROR');
  const { data: slot } = await c.owner.rpc('begin_upload', { p_kind: 'expense_invoice', p_record: expenseId, p_mime: 'application/pdf', p_size: 64 });
  const big = await c.owner.storage.from(slot.bucket).upload(slot.path, new Blob([new Uint8Array(5242881)], { type: 'application/pdf' }), { contentType: 'application/pdf' });
  assert(big.error, 'storage accepted a >5 MB object');
  const html = await c.owner.storage.from(slot.bucket).upload(slot.path, new Blob(['<script>'], { type: 'text/html' }), { contentType: 'text/html' });
  assert(html.error, 'storage accepted text/html');
  const png = await c.owner.storage.from(slot.bucket).upload(slot.path, new Blob(['x'], { type: 'image/png' }), { contentType: 'image/png' });
  assert(!png.error, png.error?.message);
  await fails(c.owner.rpc('complete_upload', { p_kind: 'expense_invoice', p_id: slot.id }), 'VALIDATION_ERROR');
});
await t('chef / other tenant cannot verify a KYC document', async () => {
  const id = files.doc.id;
  await fails(c.chef.rpc('review_resident_document', { p_document: id, p_decision: 'verified' }), 'NOT_FOUND');
  await fails(c.owner2.rpc('review_resident_document', { p_document: id, p_decision: 'verified' }), 'NOT_FOUND');
  const r = await c.owner.rpc('review_resident_document', { p_document: id, p_decision: 'verified' }); assert(!r.error, r.error?.message);
});

console.log('Platform');
await t('tenant owner cannot call platform functions', () =>
  fails(c.owner.rpc('platform_set_tenant_status', { p_tenant: hm, p_status: 'active', p_reason: 'self' }), 'FORBIDDEN'));
await t('suspended tenant loses access, restored on reactivation', async () => {
  let r = await c.platform.rpc('platform_set_tenant_status', { p_tenant: hm, p_status: 'suspended', p_reason: 'test suspension' });
  assert(!r.error, r.error?.message);
  const d = await rows(c.owner.from('residents').select('id'));
  const d2 = await rows(c.rahul.from('rent_charges').select('id'));
  r = await c.platform.rpc('platform_set_tenant_status', { p_tenant: hm, p_status: 'active', p_reason: 'test complete' });
  assert(!r.error, r.error?.message);
  assert(d.length === 0 && d2.length === 0, `while suspended owner saw ${d.length}, resident saw ${d2.length}`);
  const audit = await rows(c.platform.from('audit_logs').select('id').eq('action', 'tenant.status_changed'));
  assert(audit.length >= 2, 'not audited');
});

console.log('Tenant IDs');
await t('every tenant gets a unique ZPN- code assigned by the database', async () => {
  const ts = (await admin.from('tenants').select('tenant_code')).data;
  assert(ts.length >= 2 && ts.every((x) => /^ZPN-\d{6,}$/.test(x.tenant_code)), JSON.stringify(ts));
  assert(new Set(ts.map((x) => x.tenant_code)).size === ts.length, 'duplicate tenant codes');
});
await t('owner sees only their own tenant code; other tenant sees none of it', async () => {
  const own = await rows(c.owner.from('tenants').select('id,tenant_code'));
  assert(own.length === 1 && own[0].id === hm, JSON.stringify(own));
  const other = await rows(c.owner2.from('tenants').select('id').eq('id', hm));
  assert(other.length === 0, 'other tenant can read Zipnary tenant');
});
await t('tenant code cannot be changed, even by the service role', async () => {
  const r = await c.owner.from('tenants').update({ tenant_code: 'ZPN-999999' }).eq('id', hm).select('id');
  assert(r.error || (r.data ?? []).length === 0, 'owner changed tenant code');
  const a = await admin.from('tenants').update({ tenant_code: 'ZPN-999999' }).eq('id', hm);
  assert(a.error, 'service role changed tenant code');
});

console.log('Resident community (migration 15)');
await t('other tenant sees none of Zipnary community posts, polls, visitor passes', async () => {
  for (const tbl of ['community_posts', 'polls', 'poll_options', 'visitor_passes']) {
    const d = await rows(c.owner2.from(tbl).select('id').eq('tenant_id', hm)); assert(d.length === 0, `${tbl}: ${d.length}`);
  }
  const s = (await c.owner2.rpc('poll_summaries', {})).data ?? [];
  assert(s.length === 0, `owner2 saw ${s.length} polls`);
});
await t('lost & found / marketplace are shared in the building; suggestions stay private', async () => {
  const amitSees = await rows(c.amit.from('community_posts').select('kind,resident_id'));
  assert(amitSees.some((p) => p.kind === 'lost_found') && amitSees.some((p) => p.kind === 'marketplace'), 'shared posts missing');
  assert(!amitSees.some((p) => p.kind === 'suggestion' && p.resident_id === rahulRes), 'amit can read rahul suggestion');
  const owner = await rows(c.owner.from('community_posts').select('kind'));
  assert(owner.some((p) => p.kind === 'suggestion'), 'owner cannot see suggestion');
});
await t('chef cannot read community posts or visitor passes', async () => {
  for (const tbl of ['community_posts', 'visitor_passes']) {
    const d = await rows(c.chef.from(tbl).select('id')); assert(d.length === 0, `${tbl}: ${d.length}`);
  }
});
await t('resident cannot approve a visitor pass or reply as staff; other resident cannot see it', async () => {
  const p = (await admin.from('visitor_passes').select('id').eq('resident_id', amitRes).limit(1).single()).data;
  await fails(c.amit.rpc('update_visitor_pass', { p_pass: p.id, p_action: 'approve' }), 'NOT_FOUND');
  const seen = await rows(c.rahul.from('visitor_passes').select('id').eq('id', p.id)); assert(seen.length === 0, 'rahul sees amit pass');
  const post = (await admin.from('community_posts').select('id').eq('resident_id', rahulRes).eq('kind', 'suggestion').single()).data;
  await fails(c.rahul.rpc('respond_community_post', { p_post: post.id, p_response: 'self reply' }), 'FORBIDDEN');
});
await t('residents cannot create polls; one vote per resident (re-vote replaces)', async () => {
  await fails(c.rahul.rpc('create_poll', { p_building: yvr, p_question: 'Resident poll?', p_options: ['a', 'b'] }), 'NOT_FOUND');
  const poll = (await admin.from('polls').select('id').eq('tenant_id', hm).limit(1).single()).data;
  const opts = (await admin.from('poll_options').select('id').eq('poll_id', poll.id).order('position')).data;
  for (const o of [opts[0], opts[1]]) { const r = await c.rahul.rpc('vote_poll', { p_poll: poll.id, p_option: o.id }); assert(!r.error, r.error?.message); }
  const votes = (await admin.from('poll_votes').select('option_id').eq('poll_id', poll.id).eq('resident_id', rahulRes)).data;
  assert(votes.length === 1 && votes[0].option_id === opts[1].id, JSON.stringify(votes));
  const other = await rows(c.amit.from('poll_votes').select('resident_id').eq('poll_id', poll.id));
  assert(other.every((v) => v.resident_id !== rahulRes), 'amit can see rahul vote');
});
await t('birthdays show only opted-in first names, never full date of birth', async () => {
  const b = (await c.amit.rpc('building_birthdays')).data ?? [];
  assert(b.length === 1 && b[0].first_name === 'Rahul' && !('date_of_birth' in b[0]) && !/\d{4}/.test(b[0].birthday), JSON.stringify(b));
  await fails(c.owner2.rpc('building_birthdays'), 'FORBIDDEN');
});
await t('chat overview lists only readable channels with unread counts', async () => {
  const ov = (await c.rahul.rpc('my_chat_overview')).data;
  assert(ov.length > 0 && ov.every((x) => x.kind !== 'staff'), 'staff channel visible to resident');
  const room = ov.find((x) => x.kind === 'room'); assert(room && room.unread >= 1, JSON.stringify(room));
  const r = await c.rahul.rpc('mark_channel_read', { p_channel: room.id }); assert(!r.error, r.error?.message);
  const after = (await c.rahul.rpc('my_chat_overview')).data.find((x) => x.id === room.id);
  assert(after.unread === 0, `unread ${after.unread}`);
  const staffCh = (await admin.from('chat_channels').select('id').eq('building_id', yvr).eq('kind', 'staff').single()).data;
  await fails(c.rahul.rpc('mark_channel_read', { p_channel: staffCh.id }), 'NOT_FOUND');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
