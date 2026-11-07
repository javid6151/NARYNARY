import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import dns from 'node:dns/promises';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function checkDns(hostname) {
  try {
    const res = await dns.lookup(hostname);
    return !!res.address;
  } catch {
    return false;
  }
}

async function main() {
  console.log('========================================================');
  console.log('ZIPNARY AUTH & DATABASE RESET PIPELINE');
  console.log('Target URL:', url);
  console.log('========================================================\n');

  const hostname = new URL(url).hostname;
  const dnsOk = await checkDns(hostname);
  if (!dnsOk) {
    console.error(`❌ CRITICAL: Cannot resolve DNS for ${hostname}`);
    console.error('The Supabase project is currently PAUSED or has not been restored.');
    console.error(`Please visit https://supabase.com/dashboard/project/jrfvcfoktgrixftjupzk and click "Restore project".`);
    console.error('Once restored, re-run: node scripts/reset-auth-clean.mjs\n');
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Wipe all operational and customer records
  const tables = [
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
    { name: 'staff_daily_reports', pk: 'id' },
    { name: 'staff_attendance', pk: 'id' },
    { name: 'staff_members', pk: 'id' },
    { name: 'kitchen_daily_reports', pk: 'id' },
    { name: 'meal_reviews', pk: 'id' },
    { name: 'meal_availability', pk: 'id' },
    { name: 'meal_menus', pk: 'id' },
    { name: 'meal_settings', pk: 'tenant_id' },
    { name: 'inventory_transactions', pk: 'id' },
    { name: 'inventory_locations', pk: 'id' },
    { name: 'inventory_items', pk: 'id' },
    { name: 'maintenance_attachments', pk: 'id' },
    { name: 'maintenance_activity', pk: 'id' },
    { name: 'maintenance_requests', pk: 'id' },
    { name: 'complaints', pk: 'id' },
    { name: 'expense_attachments', pk: 'id' },
    { name: 'expense_payments', pk: 'id' },
    { name: 'expenses', pk: 'id' },
    { name: 'vendors', pk: 'id' },
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
    { name: 'beds', pk: 'id' },
    { name: 'rooms', pk: 'id' },
    { name: 'floors', pk: 'id' },
    { name: 'building_memberships', pk: 'id' },
    { name: 'buildings', pk: 'id' },
    { name: 'subscriptions', pk: 'id' },
    { name: 'tenant_memberships', pk: 'id' },
    { name: 'tenant_onboarding_requests', pk: 'id' },
    { name: 'tenants', pk: 'id' },
    { name: 'audit_logs', pk: 'id' },
    { name: 'idempotency_keys', pk: 'tenant_id' },
  ];

  console.log('1. Clearing existing operational tables...');
  for (const t of tables) {
    try {
      await supabaseAdmin.from(t.name).delete().neq(t.pk, '00000000-0000-0000-0000-000000000000');
      console.log(`   ✓ Cleared table: ${t.name}`);
    } catch (err) {
      console.warn(`   Notice on ${t.name}:`, err.message);
    }
  }

  // 2. Delete all auth users except zipco@gmail.com
  console.log('\n2. Resetting auth accounts (keeping Super Admin only)...');
  const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('   ✗ Failed to list users:', listErr.message);
  } else {
    for (const u of userList.users || []) {
      if (u.email?.toLowerCase() === 'zipco@gmail.com') {
        console.log(`   ★ Retaining Super Admin: ${u.email} (${u.id})`);
        continue;
      }
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`   ✗ Error deleting ${u.email || u.id}:`, delErr.message);
      } else {
        console.log(`   ✓ Deleted auth user: ${u.email || u.phone || u.id}`);
      }
    }
  }

  // 3. Ensure zipco@gmail.com is created / updated with zipcozipco
  console.log('\n3. Provisioning Super Admin credentials (zipco@gmail.com / zipcozipco)...');
  const superEmail = 'zipco@gmail.com';
  const superPassword = 'zipcozipco';

  let superUser = (userList?.users || []).find(u => u.email?.toLowerCase() === superEmail);
  if (superUser) {
    const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(superUser.id, {
      password: superPassword,
      email_confirm: true,
      user_metadata: { full_name: 'ZIPCO Super Admin' }
    });
    if (upErr) console.error('   ✗ Update password error:', upErr.message);
    else console.log('   ✓ Super Admin password reset to default: zipcozipco');
  } else {
    const { data: created, error: crErr } = await supabaseAdmin.auth.admin.createUser({
      email: superEmail,
      password: superPassword,
      email_confirm: true,
      user_metadata: { full_name: 'ZIPCO Super Admin' }
    });
    if (crErr) {
      console.error('   ✗ Create Super Admin error:', crErr.message);
      process.exit(1);
    }
    superUser = created.user;
    console.log('   ✓ Created fresh Super Admin user:', superUser.id);
  }

  // 4. Ensure platform_admins and profiles records
  await supabaseAdmin.from('platform_admins').upsert({ user_id: superUser.id, status: 'active' }, { onConflict: 'user_id' });
  await supabaseAdmin.from('profiles').upsert({ id: superUser.id, full_name: 'ZIPCO Super Admin', email: superEmail }, { onConflict: 'id' });
  console.log('   ✓ Super Admin active in platform_admins and profiles');

  // 4b. Ensure a default active subscription plan exists for onboarding approvals
  const { data: existingPlans } = await supabaseAdmin.from('subscription_plans').select('id, is_default, is_active');
  const hasDefault = existingPlans?.some((p) => p.is_default && p.is_active);
  if (!hasDefault) {
    if (existingPlans && existingPlans.length > 0) {
      await supabaseAdmin.from('subscription_plans').update({ is_default: true }).eq('id', existingPlans[0].id);
      console.log('   ✓ Set existing plan as default subscription plan');
    } else {
      await supabaseAdmin.from('subscription_plans').insert({
        name: 'Standard',
        monthly_price: 4999,
        included_residents: 120,
        max_managers: 3,
        max_chefs: 3,
        trial_days: 90,
        is_default: true,
        is_active: true,
      });
      console.log('   ✓ Seeded default Standard subscription plan');
    }
  }

  // 5. Verify sign-in
  const anonClient = createClient(url, anonKey);
  const { data: signInRes, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: superEmail,
    password: superPassword,
  });

  if (signInErr) {
    console.error('   ✗ Verification failed:', signInErr.message);
  } else {
    console.log('\n========================================================');
    console.log('RESET COMPLETE AND VERIFIED!');
    console.log('Super Admin Email:    zipco@gmail.com');
    console.log('Super Admin Password: zipcozipco');
    console.log('Portal Link:          http://localhost:1000/platformadmin');
    console.log('All other accounts have been deleted. Logins are completely fresh.');
    console.log('========================================================\n');
  }
}

main().catch(console.error);

