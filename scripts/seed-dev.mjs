// Local development seed. Creates test users and drives the real RPC workflows
// (onboarding → approval → rooms → admissions → payments → kitchen …) so the
// seeded data is produced by the same code paths the app uses.
// Usage: npm run db:reset && npm run seed:dev
import { localEnv, adminClient, userClient, ensureUser, must, key } from './local-env.mjs';

const PASSWORD = 'Password123!'; // local test credential only (documented in README)
const env = localEnv();
const admin = adminClient(env);
const log = (...a) => console.log('•', ...a);

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };

// ---------------------------------------------------------------- users
const users = {
  platform: ['admin@zipco.test', 'ZIPCO Platform Admin'],
  owner: ['owner@zipnary.test', 'Tarun N'],
  manager: ['manager@zipnary.test', 'Suresh Yadav'],
  chef: ['chef@zipnary.test', 'Ramesh Kumar'],
  owner2: ['owner@sunrise.test', 'Priya Menon'],
  rahul: ['rahul@resident.test', 'Rahul Sharma'],
  amit: ['amit@resident.test', 'Amit Patel'],
};
const ids = {};
for (const [k, [email, name]] of Object.entries(users)) ids[k] = await ensureUser(admin, email, PASSWORD, name);
log('users ready');

must(await admin.from('platform_admins').upsert({ user_id: ids.platform, status: 'active' }), 'platform admin');

const c = {};
for (const k of Object.keys(users)) c[k] = await userClient(env, users[k][0], PASSWORD);

// ---------------------------------------------------------------- onboarding + approval
must(await c.owner.rpc('submit_onboarding', {
  p_business_name: 'Zipnary PG & Hostels', p_phone: '+91 98765 40000', p_city: 'Hyderabad',
  p_buildings: [
    { name: 'YVR PG', address: 'Street No. 8, Hitech City', city: 'Hyderabad', floors: 3, approx_beds: 60 },
    { name: 'A Block', address: 'Main Road, Kukatpally', city: 'Hyderabad', floors: 2, approx_beds: 30 },
  ],
  p_notes: 'Boys PG, mess included',
}), 'submit onboarding');
must(await c.owner2.rpc('submit_onboarding', {
  p_business_name: 'Sunrise Hostels', p_phone: '+91 90000 11111', p_city: 'Bengaluru',
  p_buildings: [{ name: 'Sunrise Koramangala', address: '5th Block, Koramangala', city: 'Bengaluru', floors: 2 }],
}), 'submit onboarding 2');

const reqs = must(await c.platform.from('tenant_onboarding_requests').select('id, business_details').eq('status', 'submitted'), 'list requests');
for (const r of reqs) must(await c.platform.rpc('platform_review_onboarding', { p_request: r.id, p_decision: 'approve', p_notes: 'Verified documents' }), 'approve');
log('tenants approved:', reqs.length);

// a pending building request for the platform queue
must(await c.owner.rpc('request_building', { p_name: 'C Block', p_address: 'Near Metro Station, Miyapur', p_city: 'Hyderabad', p_details: { floors: 4 } }), 'request building');

const buildings = must(await c.owner.from('buildings').select('id,name').eq('status', 'active').order('name'), 'buildings');
const yvr = buildings.find((b) => b.name === 'YVR PG').id;
const aBlock = buildings.find((b) => b.name === 'A Block').id;

// ---------------------------------------------------------------- floors, rooms, beds
const layout = {
  [yvr]: { 1: [['101', 5, 8500], ['102', 5, 8500], ['103', 4, 9000], ['104', 4, 9000], ['105', 4, 9000], ['106', 3, 9500]],
           2: [['201', 3, 9500], ['202', 3, 9500], ['203', 2, 11000], ['204', 1, 14000]],
           3: [['301', 4, 8800], ['302', 4, 8800]] },
  [aBlock]: { 1: [['A-101', 2, 10000], ['A-102', 2, 10000]], 2: [['A-201', 3, 9000]] },
};
for (const [b, floors] of Object.entries(layout)) {
  for (const [fn, rooms] of Object.entries(floors)) {
    const floorId = must(await c.owner.rpc('create_floor', { p_building: b, p_floor_number: Number(fn), p_name: `Floor ${fn}` }), 'floor');
    for (const [num, cap, rent] of rooms) {
      must(await c.owner.rpc('create_room_with_beds', { p_floor: floorId, p_room_number: num, p_capacity: cap, p_monthly_rent: rent }), `room ${num}`);
    }
  }
}
log('rooms and beds created');

// ---------------------------------------------------------------- staff accounts
must(await c.owner.rpc('invite_staff_account', { p_email: users.manager[0], p_role: 'manager', p_name: users.manager[1], p_building_ids: [yvr] }), 'invite manager');
must(await c.owner.rpc('invite_staff_account', { p_email: users.chef[0], p_role: 'chef', p_name: users.chef[1], p_building_ids: [yvr] }), 'invite chef');
must(await c.manager.rpc('claim_pending_access'), 'manager claim');
must(await c.chef.rpc('claim_pending_access'), 'chef claim');
log('manager and chef invited + accepted');

// ---------------------------------------------------------------- admissions
const beds = must(await c.owner.from('beds').select('id,bed_label').eq('building_id', yvr).order('bed_label'), 'beds');
const bed = (label) => beds.find((x) => x.bed_label === label).id;
const people = [
  ['Rahul Sharma', '+91 98765 43210', users.rahul[0], '101-B1', 8500, 40],
  ['Amit Patel', '+91 98765 43211', users.amit[0], '101-B2', 8500, 38],
  ['Vivek Yadav', '+91 98765 43212', null, '103-B1', 9000, 35],
  ['Aditya Verma', '+91 98765 43213', null, '104-B4', 9000, 30],
  ['Sohan Singh', '+91 98765 43214', null, '105-B1', 9000, 25],
  ['Rohit Kumar', '+91 98765 43215', null, '201-B2', 9500, 20],
  ['Karan Mehta', '+91 98765 43216', null, '202-B3', 9500, 12],
  ['Arjun Nair', '+91 98765 43217', null, '203-B1', 11000, 8],
  ['Neha Gupta', '+91 98765 43218', null, '204-B1', 14000, 5],
  ['Aarav Reddy', '+91 98765 43219', null, '102-B1', 8500, 0],
];
const admissionIds = [];
for (const [name, phone, email, label, rent, ago] of people) {
  const creator = ago % 2 === 0 ? c.manager : c.owner;
  const id = must(await creator.rpc('create_admission', {
    p_bed: bed(label),
    p_resident: { full_name: name, phone, email, gender: name === 'Neha Gupta' ? 'female' : 'male', occupation: 'Student',
                  emergency_contact_name: 'Parent', emergency_contact_phone: '+91 91234 56789', id_number_last4: '5678' },
    p_terms: { admission_date: iso(daysAgo(ago)), monthly_rent: rent, security_deposit: rent * 2, setup_fee: 2000, mess_included: true, source: 'Referral' },
    p_idempotency_key: key(),
  }), `admission ${name}`);
  admissionIds.push([name, id]);
}
// approve all but the last (left pending for the approval queue)
for (const [name, id] of admissionIds.slice(0, -1)) {
  must(await c.owner.rpc('review_admission', { p_admission: id, p_decision: 'approve', p_notes: 'KYC verified' }), `approve ${name}`);
}
log('admissions created/approved');

// monthly rent for residents admitted in previous month
must(await c.owner.rpc('generate_monthly_charges', { p_building: yvr, p_month: iso(today) }), 'generate charges');

// resident logins link by verified email
must(await c.rahul.rpc('claim_pending_access'), 'rahul claim');
must(await c.amit.rpc('claim_pending_access'), 'amit claim');

// ---------------------------------------------------------------- payments
const residents = must(await c.owner.from('resident_directory').select('id,full_name,outstanding').eq('status', 'active'), 'residents');
const rid = (n) => residents.find((r) => r.full_name === n);
// share of each resident's current dues that gets paid (Neha pays nothing → overdue)
const shares = { 'Rahul Sharma': 1, 'Amit Patel': 1, 'Vivek Yadav': 1, 'Aditya Verma': 0.6, 'Sohan Singh': 1,
                 'Rohit Kumar': 1, 'Karan Mehta': 0.5, 'Arjun Nair': 1 };
const methods = ['upi', 'bank_transfer', 'cash', 'card'];
let mi = 0;
for (const [name, share] of Object.entries(shares)) {
  const r = rid(name);
  const amount = Math.round(Number(r.outstanding) * share);
  const method = methods[mi++ % methods.length];
  must(await c.owner.rpc('record_payment', {
    p_resident: r.id, p_amount: amount, p_method: method, p_reference: method === 'cash' ? null : `UTR${100000 + mi}`,
    p_paid_at: daysAgo(mi).toISOString(), p_allocations: null, p_idempotency_key: key(),
  }), `pay ${name}`);
}
log('payments recorded');

// ---------------------------------------------------------------- vendors, expenses
const cats = must(await c.owner.from('expense_categories').select('id,name'), 'categories');
const cat = (n) => cats.find((x) => x.name === n).id;
const tenantId = must(await c.owner.from('buildings').select('tenant_id').eq('id', yvr).single(), 'tenant').tenant_id;
const vendor = async (name, person, phone, cats) => must(await c.owner.from('vendors').insert({
  tenant_id: tenantId, name, contact_person: person, phone, service_categories: cats,
}).select('id').single(), `vendor ${name}`).id;
const vWater = await vendor('Sai Water Suppliers', 'Sai', '+91 90000 22222', ['Water']);
const vClean = await vendor('CleanPlus Services', 'Mahesh', '+91 90000 33333', ['Cleaning']);
const vPlumb = await vendor('Drain Masters', 'Imran', '+91 90000 44444', ['Plumbing', 'Drainage']);
const vGrocer = await vendor('Balaji Traders', 'Venkat', '+91 90000 55555', ['Groceries']);

const expense = async (title, category, amount, ago, vendorId, paid, source = 'general', sourceId = null) => must(await c.owner.rpc('create_expense', {
  p_building: yvr, p_category: cat(category), p_title: title, p_description: null, p_expense_date: iso(daysAgo(ago)),
  p_due_date: iso(daysAgo(ago - 7)), p_subtotal: amount, p_tax: 0, p_vendor: vendorId, p_source_type: source, p_source_id: sourceId,
  p_initial_payment: paid ? { amount: paid, method: 'upi', reference: `EXP${ago}` } : null, p_idempotency_key: key(),
}), `expense ${title}`);
await expense('Water bill — tanker supply', 'Water Bill', 2500, 10, vWater, 2500);
await expense('Electricity bill — main meter', 'Electricity Bill', 12850, 8, null, 800);
await expense('Weekly deep cleaning', 'Cleaning', 6800, 6, vClean, 2800);
await expense('Gas cylinder refill', 'Gas Connection', 2150, 9, null, 2150);
await expense('Internet — monthly plan', 'Internet / Wi-Fi', 1500, 4, null, 1500);
log('expenses recorded');

// ---------------------------------------------------------------- complaints & maintenance
const complaintId = must(await c.rahul.rpc('create_complaint', { p_category: 'wifi', p_title: 'WiFi not working', p_description: 'No internet in room 101 since morning.', p_priority: 'high' }), 'complaint');
must(await c.amit.rpc('create_complaint', { p_category: 'plumbing', p_title: 'Water leakage in bathroom', p_description: 'Tap leaking continuously.', p_priority: 'medium' }), 'complaint 2');
const mcats = must(await c.owner.from('maintenance_categories').select('id,name'), 'mcats');
const mcat = (n) => mcats.find((x) => x.name === n).id;
const floors = must(await c.owner.from('floors').select('id,floor_number').eq('building_id', yvr), 'floors');
const rooms = must(await c.owner.from('rooms').select('id,room_number,floor_id').eq('building_id', yvr), 'rooms');
const room = (n) => rooms.find((r) => r.room_number === n);
must(await c.manager.rpc('create_maintenance_request', {
  p_building: yvr, p_floor: room('101').floor_id, p_room: room('101').id, p_category: mcat('Internet / Wi-Fi'),
  p_title: 'Router replacement — Room 101', p_description: 'Router failing; replace with dual-band unit.', p_priority: 'high',
  p_due_at: daysAgo(-2).toISOString(), p_assigned_to: 'Suresh (Warden)', p_vendor: null, p_complaint: complaintId,
}), 'maintenance from complaint');
const drainReq = must(await c.owner.rpc('create_maintenance_request', {
  p_building: yvr, p_floor: null, p_room: null, p_category: mcat('Plumbing'), p_title: 'Kitchen drainage blockage',
  p_description: 'Kitchen sink drain is slow; needs cleaning.', p_priority: 'critical', p_due_at: daysAgo(1).toISOString(),
  p_assigned_to: null, p_vendor: vPlumb, p_complaint: null,
}), 'maintenance 2');
must(await c.owner.rpc('update_maintenance_status', { p_request: drainReq, p_status: 'in_progress', p_note: 'Vendor on site' }), 'start');
await expense('Drain cleaning — kitchen', 'Drainage', 3200, 2, vPlumb, 0, 'maintenance', drainReq);
must(await c.owner.rpc('create_maintenance_request', {
  p_building: yvr, p_floor: floors.find((f) => f.floor_number === 2).id, p_room: room('202').id, p_category: mcat('Electrical'),
  p_title: 'Fan not working', p_description: 'Ceiling fan regulator broken.', p_priority: 'medium', p_due_at: null,
  p_assigned_to: null, p_vendor: null, p_complaint: null,
}), 'maintenance 3');
log('complaints and maintenance ready');

// ---------------------------------------------------------------- inventory
const items = [
  ['Rice', 'Grains & Rice', 'kg', 20, 120, 52], ['Toor Dal', 'Pulses & Lentils', 'kg', 5, 18, 135],
  ['Onion', 'Vegetables', 'kg', 5, 25, 32], ['Tomato', 'Vegetables', 'kg', 5, 15, 28],
  ['Cooking Oil', 'Cooking Oil & Ghee', 'litre', 5, 4, 140], ['Salt', 'Spices & Masala', 'kg', 1, 5, 22],
  ['Turmeric Powder', 'Spices & Masala', 'kg', 0.5, 1, 260], ['Sugar', 'Grains & Rice', 'kg', 5, 3, 44],
  ['Milk', 'Dairy Products', 'litre', 10, 30, 56], ['Tea Powder', 'Beverages', 'kg', 0.5, 2, 420],
];
const itemIds = {};
for (const [name, category, unit, reorder] of items) {
  itemIds[name] = must(await c.owner.from('inventory_items').insert({ tenant_id: tenantId, name, category, base_unit: unit, reorder_level: reorder }).select('id').single(), `item ${name}`).id;
}
const move = async (client, item, action, qty, cost = null, v = null) => must(await client.rpc('inventory_move', {
  p_building: yvr, p_item: itemIds[item], p_action: action, p_qty: qty, p_unit_cost: cost, p_vendor: v, p_notes: null, p_idempotency_key: key(),
}), `${action} ${item}`);
for (const [name, , , , qty, cost] of items) await move(c.owner, name, 'purchase', qty, cost, vGrocer);
await move(c.chef, 'Rice', 'issue', 10); await move(c.chef, 'Toor Dal', 'issue', 3); await move(c.chef, 'Onion', 'issue', 5);
await move(c.chef, 'Tomato', 'issue', 4); await move(c.chef, 'Cooking Oil', 'issue', 1); await move(c.chef, 'Salt', 'issue', 0.5);
await move(c.chef, 'Turmeric Powder', 'issue', 0.1);
log('inventory stocked and issued');

// ---------------------------------------------------------------- menus
const week = [
  ['Idli, Sambar, Chutney, Tea', 'Rice, Dal, Mixed Veg, Curd', 'Chapathi, Paneer Curry'],
  ['Poha, Tea', 'Rice, Dal, Mix Veg, Salad', 'Chapathi, Dal Fry'],
  ['Upma, Tea', 'Veg Pulao, Raita', 'Chapathi, Egg Curry'],
  ['Dosa, Chutney', 'Rice, Rajma, Salad', 'Chapathi, Mix Veg'],
  ['Pongal, Tea', 'Lemon Rice, Curd', 'Chapathi, Chole'],
  ['Bread, Jam, Tea', 'Veg Biryani, Raita', 'Chapathi, Dal Tadka'],
  ['Puri, Aloo Curry', 'Rice, Sambar, Cabbage Fry', 'Chapathi, Egg Bhurji'],
];
for (let i = -3; i < 7; i++) {
  const d = new Date(today); d.setDate(d.getDate() + i);
  const [bf, lu, di] = week[(i + 7) % 7];
  for (const [type, items, s, e] of [['breakfast', bf, '07:00', '09:00'], ['lunch', lu, '12:00', '14:00'], ['dinner', di, '19:00', '21:00']]) {
    must(await c.chef.rpc('upsert_meal_menu', { p_building: yvr, p_date: iso(d), p_meal_type: type, p_items: items, p_serving_start: s, p_serving_end: e }), 'menu');
  }
}
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
must(await c.rahul.rpc('set_meal_availability', { p_date: iso(tomorrow), p_meal_type: 'dinner', p_unavailable: true }), 'meal off');
must(await c.amit.rpc('set_meal_availability', { p_date: iso(tomorrow), p_meal_type: 'lunch', p_unavailable: true }), 'meal off 2');

// yesterday's lunch record from the chef, and reviews
const yest = iso(daysAgo(1));
must(await c.chef.rpc('submit_kitchen_report', {
  p_building: yvr, p_date: yest, p_meal_type: 'lunch', p_actual_count: 8, p_summary: 'Lunch served on time',
  p_lines: [
    { item_id: itemIds.Rice, kind: 'consumption', quantity: 4 }, { item_id: itemIds['Toor Dal'], kind: 'consumption', quantity: 1.2 },
    { item_id: itemIds.Onion, kind: 'consumption', quantity: 2 }, { item_id: itemIds.Tomato, kind: 'consumption', quantity: 1.5 },
    { item_id: itemIds['Cooking Oil'], kind: 'consumption', quantity: 0.5 }, { item_id: itemIds.Salt, kind: 'consumption', quantity: 0.2 },
    { item_id: itemIds.Onion, kind: 'return', quantity: 0.5 }, { item_id: itemIds.Tomato, kind: 'wastage', quantity: 0.2, reason: 'Overripe / Spoiled' },
  ],
  p_idempotency_key: key(),
}), 'kitchen report');
const pastMenus = must(await c.rahul.from('meal_menus').select('id,meal_type,meal_date').lte('meal_date', yest).order('meal_date', { ascending: false }).limit(4), 'past menus');
for (const [i, m] of pastMenus.entries()) {
  must(await c.rahul.rpc('submit_meal_review', { p_menu: m.id, p_rating: [5, 4, 3, 4][i], p_comment: ['Very tasty!', 'Good', 'Too much oil in sabzi', null][i] }), 'review');
  must(await c.amit.rpc('submit_meal_review', { p_menu: m.id, p_rating: [4, 4, 2, 5][i], p_comment: [null, 'Not spicy enough', 'Food was cold', 'Excellent'][i] }), 'review 2');
}
log('menus, meal availability, kitchen report, reviews');

// ---------------------------------------------------------------- staff roster, attendance, salary
const staff = [
  ['Suresh Yadav', 'warden', '9876543210', 20000], ['Sita Devi', 'cook', '9123456780', 15000],
  ['Ramesh Kumar', 'cook', '9012345678', 15000], ['Mahesh Singh', 'security', '9988776655', 12000],
  ['Pooja Sharma', 'cleaning', '9090909090', 8000], ['Arjun Rao', 'helper', '8080808080', 6500],
];
const staffIds = [];
for (const [name, role, phone, salary] of staff) {
  staffIds.push(must(await c.owner.rpc('upsert_staff_member', {
    p_id: null, p_building: yvr, p_full_name: name, p_role: role, p_phone: phone, p_joining_date: '2025-01-10',
    p_monthly_salary: salary, p_pay_day: 5, p_status: 'active',
  }), `staff ${name}`));
}
for (let d = 6; d >= 0; d--) {
  must(await c.manager.rpc('mark_staff_attendance', {
    p_building: yvr, p_date: iso(daysAgo(d)),
    p_entries: staffIds.map((id, i) => ({ staff_member_id: id, status: (i + d) % 9 === 0 ? 'absent' : (i + d) % 7 === 0 ? 'late' : 'present' })),
  }), 'attendance');
}
must(await c.manager.rpc('submit_staff_daily_report', { p_staff: staffIds[4], p_date: iso(today), p_summary: 'Cleaned floors 1–2 corridors, washrooms on floor 1.' }), 'daily report');
const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
for (const [i, id] of staffIds.entries()) {
  must(await c.owner.rpc('pay_staff_salary', { p_staff: id, p_month: iso(prevMonth), p_amount: staff[i][3], p_method: 'bank_transfer', p_reference: `SAL${i}` }), 'salary');
}
log('staff roster, attendance, salaries');

// ---------------------------------------------------------------- notices & chat
must(await c.owner.rpc('publish_notice', { p_building: yvr, p_title: 'Water supply maintenance', p_body: 'Water supply will be off from 10 AM to 1 PM on Sunday for tank cleaning.', p_category: 'important', p_expires_at: null }), 'notice');
must(await c.owner.rpc('publish_notice', { p_building: null, p_title: 'Festival celebration on Saturday', p_body: 'Join us in the common hall at 7 PM. Dinner will be special!', p_category: 'event', p_expires_at: null }), 'notice 2');
const channels = must(await c.owner.from('chat_channels').select('id,kind,name,room_id').eq('building_id', yvr), 'channels');
const everyone = channels.find((x) => x.kind === 'building').id;
const room101 = channels.find((x) => x.kind === 'room' && x.room_id === room('101').id).id;
must(await c.owner.rpc('send_chat_message', { p_channel: everyone, p_body: 'Monthly rent is due on the 5th. Late fee of ₹200 applies after the 7th.' }), 'chat');
must(await c.rahul.rpc('send_chat_message', { p_channel: room101, p_body: 'WiFi is not working since morning.' }), 'chat 2');
must(await c.amit.rpc('send_chat_message', { p_channel: room101, p_body: 'Same issue here. Please check.' }), 'chat 3');
must(await c.manager.rpc('send_chat_message', { p_channel: room101, p_body: 'Noted. Router replacement is scheduled for tomorrow.' }), 'chat 4');

// ---------------------------------------------------------------- community (migration 15)
must(await c.rahul.rpc('create_community_post', { p_kind: 'lost_found', p_title: 'Lost: black water bottle', p_body: 'Left it in the dining hall on Friday. Milton bottle with a sticker.', p_price: null }), 'post 1');
must(await c.amit.rpc('create_community_post', { p_kind: 'marketplace', p_title: 'Selling study table lamp', p_body: 'LED lamp, 6 months old, works perfectly.', p_price: 400 }), 'post 2');
const sugg = must(await c.rahul.rpc('create_community_post', { p_kind: 'suggestion', p_title: 'Add a washing machine on Floor 1', p_body: 'The ground floor machine always has a queue in the mornings.', p_price: null }), 'post 3');
must(await c.owner.rpc('respond_community_post', { p_post: sugg, p_response: 'Thanks! We are getting a quote for a second machine.', p_close: false }), 'reply');
const poll = must(await c.owner.rpc('create_poll', { p_building: yvr, p_question: 'Which special dinner should we have on Saturday?', p_options: ['Biryani', 'North Indian thali', 'Chinese'], p_closes_at: null }), 'poll');
const opts = must(await c.amit.from('poll_options').select('id,position').eq('poll_id', poll).order('position'), 'options');
must(await c.amit.rpc('vote_poll', { p_poll: poll, p_option: opts[0].id }), 'vote');
const pass = must(await c.rahul.rpc('request_visitor_pass', { p_name: 'Ravi Sharma', p_phone: '+91 90000 22222', p_date: iso(tomorrow), p_purpose: 'Brother visiting' }), 'visitor pass');
must(await c.owner.rpc('update_visitor_pass', { p_pass: pass, p_action: 'approve', p_note: 'ID at the gate' }), 'approve pass');
must(await c.amit.rpc('request_visitor_pass', { p_name: 'Kiran Patel', p_phone: null, p_date: iso(tomorrow), p_purpose: 'Parent' }), 'visitor pass 2');
const bday = new Date(today); bday.setDate(today.getDate() + 10); bday.setFullYear(2002);
must(await c.owner.from('residents').update({ date_of_birth: iso(bday) }).eq('email', users.rahul[0]).select('id'), 'dob');
must(await c.rahul.rpc('set_share_birthday', { p_share: true }), 'share birthday');
log('community posts, poll, visitor passes, birthday');

console.log('\nSeed complete. Sign in at http://localhost:5173 with any of these (password: ' + PASSWORD + '):');
for (const [k, [email]] of Object.entries(users)) console.log(`  ${k.padEnd(9)} ${email}`);
