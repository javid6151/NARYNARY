import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').trim();
  }
}

const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing URL or serviceKey');
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  const email = 'zipco@gmail.com';
  const password = 'zipcozipco';

  // 1. Check if user already exists
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('listUsers error:', listErr);
    return;
  }

  let user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    console.log('Found existing user:', user.id, user.email);
    // Update password to zipcozipco
    const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'ZIPCO Super Admin' }
    });
    if (updateErr) {
      console.error('updateUser error:', updateErr);
      return;
    }
    console.log('Password updated successfully for', email);
  } else {
    console.log('Creating user', email);
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'ZIPCO Super Admin' }
    });
    if (createErr) {
      console.error('createUser error:', createErr);
      return;
    }
    user = created.user;
    console.log('Created user:', user.id);
  }

  // 2. Ensure user is in platform_admins with active status
  const { data: upsertAdmin, error: adminErr } = await supabaseAdmin
    .from('platform_admins')
    .upsert({ user_id: user.id, status: 'active' }, { onConflict: 'user_id' });

  if (adminErr) {
    console.error('platform_admins upsert error:', adminErr);
  } else {
    console.log('platform_admins successfully provisioned for', user.id);
  }

  // 3. Ensure profile exists
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: user.id, full_name: 'ZIPCO Super Admin', email: email }, { onConflict: 'id' });
  if (profileErr) {
    console.log('profile error:', profileErr);
  } else {
    console.log('profile ready for', email);
  }

  // Verify sign-in with anon client
  const anonClient = createClient(url, env.VITE_SUPABASE_ANON_KEY);
  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password
  });
  if (signInErr) {
    console.error('Verification sign-in failed:', signInErr);
  } else {
    console.log('VERIFICATION SUCCESSFUL: Can sign in with zipco@gmail.com / zipcozipco! User ID:', signInData.user.id);
  }
}

main();
