import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function clearTable(tableName, pkColumn = 'id') {
  try {
    const { count: beforeCount } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (!beforeCount || beforeCount === 0) {
      console.log(`✓ ${tableName}: already empty (0 rows)`);
      return;
    }

    const { error } = await supabase.from(tableName).delete().neq(pkColumn, '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`✗ Error clearing ${tableName}:`, error.message);
    } else {
      console.log(`✓ ${tableName}: cleared ${beforeCount} rows`);
    }
  } catch (err) {
    console.error(`✗ Exception clearing ${tableName}:`, err.message);
  }
}

async function main() {
  console.log('========================================================');
  console.log('CLEARING DATABASE AT:', url);
  console.log('========================================================\n');

  // Deletion order respecting foreign key constraints
  const tables = [
    // 1. Community & Chat
    { name: 'visitor_passes', pk: 'id' },
    { name: 'poll_votes', pk: 'poll_id' },
    { name: 'poll_options', pk: 'id' },
    { name: 'polls', pk: 'id' },
    { name: 'community_posts', pk: 'id' },
    { name: 'chat_channel_reads', pk: 'user_id' },
    { name: 'chat_messages', pk: 'id' },
    { name: 'chat_channels', pk: 'id' },
    { name: 'notice_reads', pk: 'id' },
    { name: 'notices', pk: 'id' },
    { name: 'notifications', pk: 'id' },

    // 2. Staff
    { name: 'staff_daily_reports', pk: 'id' },
    { name: 'staff_attendance', pk: 'id' },
    { name: 'staff_members', pk: 'id' },

    // 3. Kitchen & Inventory
    { name: 'kitchen_daily_reports', pk: 'id' },
    { name: 'meal_reviews', pk: 'id' },
    { name: 'meal_availability', pk: 'id' },
    { name: 'meal_menus', pk: 'id' },
    { name: 'meal_settings', pk: 'tenant_id' },
    { name: 'inventory_transactions', pk: 'id' },
    { name: 'inventory_locations', pk: 'id' },
    { name: 'inventory_items', pk: 'id' },

    // 4. Maintenance & Complaints
    { name: 'maintenance_attachments', pk: 'id' },
    { name: 'maintenance_activity', pk: 'id' },
    { name: 'maintenance_requests', pk: 'id' },
    { name: 'complaints', pk: 'id' },

    // 5. Expenses & Vendors
    { name: 'expense_attachments', pk: 'id' },
    { name: 'expense_payments', pk: 'id' },
    { name: 'expenses', pk: 'id' },
    { name: 'vendors', pk: 'id' },

    // 6. Billing, Payments & Admissions
    { name: 'receipts', pk: 'id' },
    { name: 'receipt_counters', pk: 'tenant_id' },
    { name: 'payment_allocations', pk: 'id' },
    { name: 'payment_transactions', pk: 'id' },
    { name: 'rent_charges', pk: 'id' },
    { name: 'resident_documents', pk: 'id' },
    { name: 'resident_room_assignments', pk: 'id' },
    { name: 'checkouts', pk: 'id' },
    { name: 'admissions', pk: 'id' },
    { name: 'residents', pk: 'id' },

    // 7. Property Layout
    { name: 'beds', pk: 'id' },
    { name: 'rooms', pk: 'id' },
    { name: 'floors', pk: 'id' },
    { name: 'building_memberships', pk: 'id' },
    { name: 'buildings', pk: 'id' },

    // 8. Subscriptions & Tenants
    { name: 'subscriptions', pk: 'id' },
    { name: 'tenant_memberships', pk: 'id' },
    { name: 'tenant_onboarding_requests', pk: 'id' },
    { name: 'tenants', pk: 'id' },

    // 9. System metadata
    { name: 'audit_logs', pk: 'id' },
    { name: 'idempotency_keys', pk: 'tenant_id' },
    { name: 'profiles', pk: 'id' },
  ];

  for (const t of tables) {
    await clearTable(t.name, t.pk);
  }

  console.log('\n--------------------------------------------------------');
  console.log('CLEARING AUTH USERS (PRESERVING SUPER ADMIN zipco@gmail.com)');
  console.log('--------------------------------------------------------\n');

  const { data: userList, error: uErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) {
    console.error('Failed to list auth users:', uErr.message);
  } else {
    for (const u of userList.users || []) {
      if (u.email?.toLowerCase() === 'zipco@gmail.com') {
        console.log(`★ Preserving Super Admin: ${u.email} (${u.id})`);
        continue;
      }
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`✗ Error deleting user ${u.email}:`, delErr.message);
      } else {
        console.log(`✓ Deleted user: ${u.email || u.phone || u.id}`);
      }
    }
  }

  // Ensure zipco@gmail.com is in platform_admins
  const zipcoUser = userList?.users?.find(u => u.email?.toLowerCase() === 'zipco@gmail.com');
  if (zipcoUser) {
    await supabase.from('platform_admins').upsert({
      user_id: zipcoUser.id,
      status: 'active',
    });
    console.log(`✓ Confirmed ${zipcoUser.email} is active in platform_admins`);
  }

  console.log('\n========================================================');
  console.log('DATABASE DATA HAS BEEN COMPLETELY CLEARED AND RESET.');
  console.log('========================================================');
}

main().catch(console.error);
