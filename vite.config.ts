import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createClient } from '@supabase/supabase-js';

function authApiPlugin() {
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let viteEnv: Record<string, string> | null = null;

  return {
    name: 'zipnary-auth-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) return next();

        if (!viteEnv) {
          viteEnv = loadEnv('', process.cwd(), '');
        }

        if (!supabaseAdmin) {
          const url = viteEnv.VITE_SUPABASE_URL;
          const serviceKey = viteEnv.SUPABASE_SERVICE_ROLE_KEY;
          if (url && serviceKey) {
            supabaseAdmin = createClient(url, serviceKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
          }
        }

        if (!supabaseAdmin) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Supabase admin client not configured' }));
        }

        const readBody = async (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try { resolve(body ? JSON.parse(body) : {}); }
              catch (e) { reject(e); }
            });
            req.on('error', reject);
          });
        };

        const json = (data: any, status = 200, headers?: Record<string, string>) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          if (headers) {
            for (const [k, v] of Object.entries(headers)) {
              res.setHeader(k, v);
            }
          }
          res.end(JSON.stringify(data));
        };

        try {
          if (req.method === 'POST' && req.url === '/api/auth/resolve-identifier') {
            const { identifier } = await readBody();
            if (!identifier) return json({ error: 'Identifier is required' }, 400);

            const clean = String(identifier).trim();
            if (clean.includes('@')) {
              const cleanEmail = clean.toLowerCase();
              const { data: resRow } = await supabaseAdmin.from('residents').select('user_id, status').eq('email', cleanEmail).maybeSingle();
              if (resRow?.user_id) {
                const { data: mem } = await supabaseAdmin.from('tenant_memberships').select('status').eq('user_id', resRow.user_id).maybeSingle();
                if (mem?.status === 'suspended' || resRow.status === 'blocked') {
                  return json({ error: 'Your portal access has been suspended by management. Please contact your PG manager or owner.' }, 403);
                }
              }
              return json({ email: cleanEmail });
            }

            const digits = clean.replace(/\D/g, '');
            if (digits.length < 5) {
              return json({ error: 'Please enter a valid mobile number or email' }, 400);
            }
            const phone10 = digits.slice(-10);

            // 1. Look up in residents (prefer active or with user_id)
            const { data: resList } = await supabaseAdmin.from('residents').select('*');
            const r = resList
              ?.filter((x: any) => x.phone && x.phone.replace(/\D/g, '').endsWith(phone10))
              ?.sort((a: any, b: any) => (b.user_id ? 1 : 0) - (a.user_id ? 1 : 0) || (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0))[0];

            if (r?.email) {
              if (r.user_id) {
                const { data: mem } = await supabaseAdmin.from('tenant_memberships').select('status').eq('user_id', r.user_id).maybeSingle();
                if (mem?.status === 'suspended' || r.status === 'blocked') {
                  return json({ error: 'Your portal access has been suspended by management. Please contact your PG manager or owner.' }, 403);
                }
              }
              return json({ email: String(r.email).toLowerCase(), fullName: r.full_name, role: 'resident' });
            }

            // 2. Look up in tenants (owner mobile)
            const { data: tenants } = await supabaseAdmin.from('tenants').select('*');
            const t = tenants?.find((x: any) => x.phone && x.phone.replace(/\D/g, '').endsWith(phone10));
            if (t?.email) {
              return json({ email: String(t.email).toLowerCase(), fullName: t.business_name, role: 'owner' });
            }

            // 3. Look up in auth.users
            const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            const u = users?.users?.find((x: any) =>
              (x.phone && x.phone.replace(/\D/g, '').endsWith(phone10)) ||
              (x.user_metadata?.phone && String(x.user_metadata.phone).replace(/\D/g, '').endsWith(phone10)) ||
              (x.email && x.email.toLowerCase().startsWith(phone10))
            );
            if (u?.email) {
              return json({ email: u.email.toLowerCase(), role: 'user' });
            }

            return json({ error: `No registered account found with mobile number ${clean}` }, 404);
          }

          if (req.method === 'POST' && req.url === '/api/auth/register') {
            const { email, password, fullName } = await readBody();
            if (!email || !password) {
              return json({ error: 'Email and password are required' }, 400);
            }
            if (password.length < 8) {
              return json({ error: 'Password must be at least 8 characters' }, 400);
            }

            const cleanEmail = String(email).trim().toLowerCase();
            const name = fullName?.trim() || cleanEmail.split('@')[0];

            // 1. Look up existing user in auth.users
            const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            let user = users?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);

            if (user) {
              const { data: updated, error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password,
                email_confirm: true,
                user_metadata: { full_name: name, name },
              });
              if (uErr) return json({ error: uErr.message }, 400);
              user = updated.user;
            } else {
              const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
                email: cleanEmail,
                password,
                email_confirm: true,
                user_metadata: { full_name: name, name },
              });
              if (cErr) return json({ error: cErr.message }, 400);
              user = created.user;
            }

            // 2. Ensure profile exists in profiles table
            await supabaseAdmin.from('profiles').upsert({
              id: user.id,
              full_name: name,
              email: cleanEmail,
            });

            return json({ ok: true, email: cleanEmail, userId: user.id });
          }

          if (req.method === 'POST' && req.url === '/api/auth/set-resident-password') {
            const { residentId, phone, email, fullName, password, tenantId } = await readBody();
            if (!password || password.length < 6) {
              return json({ error: 'Password must be at least 6 characters' }, 400);
            }

            let rPhone = phone;
            let rEmail = email;
            let rName = fullName;
            let rTenantId = tenantId;

            if (residentId) {
              const { data: resRow } = await supabaseAdmin.from('residents').select('*').eq('id', residentId).single();
              if (resRow) {
                rPhone = rPhone || resRow.phone;
                rEmail = rEmail || resRow.email;
                rName = rName || resRow.full_name;
                rTenantId = rTenantId || resRow.tenant_id;
              }
            }

            if (!rPhone && !rEmail) {
              return json({ error: 'Phone or email is required' }, 400);
            }

            const cleanPhone = (rPhone || '').replace(/\D/g, '');
            const phone10 = cleanPhone.slice(-10);
            const userEmail = rEmail?.trim()
              ? rEmail.trim().toLowerCase()
              : `${phone10 || 'resident'}@resident.zipnary.internal`;

            // Check if user already exists
            const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            let user = users?.users?.find((u: any) =>
              u.email?.toLowerCase() === userEmail.toLowerCase() ||
              (cleanPhone && u.phone && u.phone.replace(/\D/g, '').endsWith(phone10)) ||
              (cleanPhone && u.user_metadata?.phone && String(u.user_metadata.phone).replace(/\D/g, '').endsWith(phone10)) ||
              (cleanPhone && u.email?.toLowerCase().startsWith(phone10))
            );

            if (user) {
              const { data: updated, error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password,
                user_metadata: { full_name: rName || user.user_metadata?.full_name || 'Resident', phone: cleanPhone, role: 'resident' },
              });
              if (uErr) return json({ error: uErr.message }, 400);
              user = updated.user;
            } else {
              const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
                email: userEmail,
                password,
                email_confirm: true,
                user_metadata: { full_name: rName || 'Resident', phone: cleanPhone, role: 'resident' },
              });
              if (cErr) return json({ error: cErr.message }, 400);
              user = created.user;
            }

            if (residentId && user?.id) {
              const tid = rTenantId;
              await supabaseAdmin.from('residents').update({ email: userEmail }).eq('id', residentId);

              // Use claim_pending_access via authenticated client to satisfy residents_guard trigger
              try {
                const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                  type: 'magiclink',
                  email: userEmail,
                });
                if (linkData?.properties?.hashed_token) {
                  const client = createClient(viteEnv!.VITE_SUPABASE_URL || '', viteEnv!.VITE_SUPABASE_ANON_KEY || '', {
                    auth: { persistSession: false, autoRefreshToken: false },
                  });
                  await client.auth.verifyOtp({
                    token_hash: linkData.properties.hashed_token,
                    type: 'magiclink',
                  });
                  await client.rpc('claim_pending_access');
                }
              } catch (claimErr) {
                console.warn('Failed to run claim_pending_access:', claimErr);
              }

              if (tid) {
                await supabaseAdmin.from('tenant_memberships').upsert({
                  tenant_id: tid,
                  user_id: user.id,
                  role: 'resident',
                  status: 'active',
                  display_name: fullName || 'Resident',
                }, { onConflict: 'tenant_id,user_id' });
              }

              await supabaseAdmin.from('profiles').upsert({
                id: user.id,
                full_name: fullName || 'Resident',
                email: userEmail,
                phone: cleanPhone,
              });
            }

            return json({ ok: true, email: userEmail, userId: user?.id, phone: cleanPhone });
          }

          if (req.method === 'POST' && req.url === '/api/auth/approve-admission-portal') {
            const { admissionId, decision, notes, password, payment } = await readBody();
            if (!admissionId || !decision) {
              return json({ error: 'admissionId and decision are required' }, 400);
            }

            // 1. Fetch admission & resident row
            const { data: adm, error: admErr } = await supabaseAdmin
              .from('admissions')
              .select('id,tenant_id,building_id,room_id,bed_id,admission_date,monthly_rent,residents(id,full_name,phone,email,status)')
              .eq('id', admissionId)
              .single();

            if (admErr || !adm) {
              return json({ error: 'Admission not found' }, 404);
            }

            const resident = (adm as any).residents;

            // 2. If decision is reject
            if (decision === 'reject') {
              const { error: rErr } = await supabaseAdmin.rpc('review_admission', {
                p_admission: admissionId,
                p_decision: 'reject',
                p_notes: notes || null,
              });
              if (rErr) return json({ error: rErr.message }, 400);
              return json({ ok: true, decision: 'reject' });
            }

            // 3. If decision is approve
            const { error: aErr } = await supabaseAdmin.rpc('review_admission', {
              p_admission: admissionId,
              p_decision: 'approve',
              p_notes: notes || null,
            });
            if (aErr) return json({ error: aErr.message }, 400);

            // In this PG model, rent is billed month-to-month on joining date, NOT calendar-month pro-rated on day 1
            await supabaseAdmin.from('rent_charges').delete().eq('admission_id', admissionId).ilike('description', '%pro-rated%');

            // Ensure first month's rent charge exists (billed on joining date, not pro-rated)
            const monthlyRent = Number((adm as any).monthly_rent || 0);
            if (monthlyRent > 0) {
              const { data: existingRent } = await supabaseAdmin
                .from('rent_charges')
                .select('id')
                .eq('admission_id', admissionId)
                .eq('charge_type', 'rent');

              if (!existingRent || existingRent.length === 0) {
                await supabaseAdmin.from('rent_charges').insert({
                  tenant_id: adm.tenant_id,
                  resident_id: resident.id,
                  admission_id: admissionId,
                  building_id: adm.building_id,
                  charge_type: 'rent',
                  description: `Rent — 1st Month (Joining: ${(adm as any).admission_date})`,
                  due_date: (adm as any).admission_date,
                  amount: monthlyRent,
                  status: 'unpaid',
                  created_by: null,
                });
              }
            }

            // 4. Provision resident portal credentials
            const phone = resident?.phone || '';
            const email = resident?.email || '';
            const cleanPhone = phone.replace(/\D/g, '');
            const phone10 = cleanPhone.slice(-10);
            const userEmail = email.trim()
              ? email.trim().toLowerCase()
              : `${phone10 || 'resident'}@resident.zipnary.internal`;

            const userPassword = (password?.trim() && password.trim().length >= 6)
              ? password.trim()
              : `Pass${phone10 ? phone10.slice(-4) : '1234'}!`;

            const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            let user = users?.users?.find((u: any) =>
              u.email?.toLowerCase() === userEmail.toLowerCase() ||
              (cleanPhone && u.phone && u.phone.replace(/\D/g, '').endsWith(phone10)) ||
              (cleanPhone && u.user_metadata?.phone && String(u.user_metadata.phone).replace(/\D/g, '').endsWith(phone10))
            );

            if (user) {
              const { data: updated, error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password: userPassword,
                email_confirm: true,
                user_metadata: { full_name: resident?.full_name || 'Resident', phone: cleanPhone, role: 'resident' },
              });
              if (uErr) return json({ error: uErr.message }, 400);
              user = updated.user;
            } else {
              const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
                email: userEmail,
                password: userPassword,
                email_confirm: true,
                user_metadata: { full_name: resident?.full_name || 'Resident', phone: cleanPhone, role: 'resident' },
              });
              if (cErr) return json({ error: cErr.message }, 400);
              user = created.user;
            }

            // Link resident to user_id via claim_pending_access
            await supabaseAdmin.from('residents').update({ email: userEmail }).eq('id', resident.id);
            try {
              const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: userEmail,
              });
              if (linkData?.properties?.hashed_token) {
                const client = createClient(viteEnv!.VITE_SUPABASE_URL || '', viteEnv!.VITE_SUPABASE_ANON_KEY || '', {
                  auth: { persistSession: false, autoRefreshToken: false },
                });
                await client.auth.verifyOtp({
                  token_hash: linkData.properties.hashed_token,
                  type: 'magiclink',
                });
                await client.rpc('claim_pending_access');
              }
            } catch (claimErr) {
              console.warn('Failed to run claim_pending_access:', claimErr);
            }

            // Add tenant membership with active resident role
            await supabaseAdmin.from('tenant_memberships').upsert({
              tenant_id: adm.tenant_id,
              user_id: user.id,
              role: 'resident',
              status: 'active',
              display_name: resident?.full_name || 'Resident',
            }, { onConflict: 'tenant_id,user_id' });

            // Ensure profile exists
            await supabaseAdmin.from('profiles').upsert({
              id: user.id,
              full_name: resident?.full_name || 'Resident',
              email: userEmail,
              phone: cleanPhone,
            });

            // 5. Handle initial fee payment (Paid via UPI/Cash vs Not Paid with reminder)
            const { data: charges } = await supabaseAdmin
              .from('rent_charges')
              .select('id, amount, charge_type')
              .eq('admission_id', admissionId);

            const totalAmount = (charges || []).reduce((s: number, c: any) => s + Number(c.amount), 0);

            if (payment?.status === 'paid' && totalAmount > 0) {
              const isUpi = payment.method === 'upi';
              const pRef = payment.reference?.trim() || (isUpi ? null : 'Cash Receipt');

              const { data: tx } = await supabaseAdmin.from('payment_transactions').insert({
                tenant_id: adm.tenant_id,
                resident_id: resident.id,
                building_id: adm.building_id,
                amount: totalAmount,
                payment_method: isUpi ? 'upi' : 'cash',
                transaction_reference: pRef,
                paid_at: new Date().toISOString(),
                recorded_by: user.id,
                status: 'confirmed',
                notes: isUpi
                  ? `Admission fee paid via UPI (UTR: ${pRef || '—'})`
                  : `Admission fee collected in cash${pRef ? ` (${pRef})` : ''}`,
              }).select('id').single();

              if (tx?.id) {
                // Issue official receipt
                let nextNum = 1;
                const { data: counter } = await supabaseAdmin
                  .from('receipt_counters')
                  .select('last_number')
                  .eq('tenant_id', (adm as any).tenant_id)
                  .single();

                if (counter) {
                  nextNum = Number(counter.last_number) + 1;
                  await supabaseAdmin
                    .from('receipt_counters')
                    .update({ last_number: nextNum })
                    .eq('tenant_id', (adm as any).tenant_id);
                } else {
                  await supabaseAdmin
                    .from('receipt_counters')
                    .insert({ tenant_id: (adm as any).tenant_id, last_number: 1 });
                }

                const rcptNumber = `RCPT-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;
                await supabaseAdmin.from('receipts').insert({
                  tenant_id: (adm as any).tenant_id,
                  payment_transaction_id: tx.id,
                  receipt_number: rcptNumber,
                  issued_by: user.id,
                });

                if (charges && charges.length > 0) {
                  for (const c of (charges as any[])) {
                    await supabaseAdmin.from('payment_allocations').insert({
                      tenant_id: adm.tenant_id,
                      payment_transaction_id: tx.id,
                      rent_charge_id: c.id,
                      allocated_amount: c.amount,
                    });
                    await supabaseAdmin.from('rent_charges').update({ status: 'paid' }).eq('id', c.id);
                  }
                }
              }

              await supabaseAdmin.from('admissions').update({
                review_notes: `Admission fee paid via ${isUpi ? `UPI (UTR: ${payment.reference || '—'})` : `Cash (${payment.reference || 'Cash'})`}`,
              }).eq('id', admissionId);
            } else {
              // Not Paid (or reminder set): leave charges as unpaid
              const reminderText = payment?.reminderDate
                ? `Unpaid Fee. Reminder on ${payment.reminderDate}${payment.reminderNote ? `: ${payment.reminderNote}` : ''}`
                : `Unpaid Fee${payment?.reminderNote ? ` (${payment.reminderNote})` : ''}`;

              await supabaseAdmin.from('admissions').update({
                review_notes: reminderText,
              }).eq('id', admissionId);
            }

            return json({
              ok: true,
              decision: 'approve',
              userId: user.id,
              residentId: resident.id,
              fullName: resident.full_name,
              email: userEmail,
              phone: resident.phone,
              password: userPassword,
            });
          }

          if (req.method === 'POST' && req.url === '/api/auth/manage-resident-access') {
            const { residentId, action, tenantId } = await readBody();
            if (!residentId || !action) {
              return json({ error: 'residentId and action are required' }, 400);
            }

            const { data: resRow, error: rErr } = await supabaseAdmin
              .from('residents')
              .select('id,user_id,tenant_id,full_name')
              .eq('id', residentId)
              .single();

            if (rErr || !resRow) return json({ error: 'Resident not found' }, 404);

            const tid = (tenantId || (resRow as any).tenant_id) as string;
            const uid = ((resRow as any).user_id as string) || '';

            if (action === 'suspend' || action === 'ban') {
              if (uid) {
                await supabaseAdmin.from('tenant_memberships')
                  .update({ status: 'suspended' })
                  .eq('tenant_id', tid)
                  .eq('user_id', uid);

                try {
                  await supabaseAdmin.auth.admin.updateUserById(uid, {
                    ban_duration: '876600h',
                    user_metadata: { status: 'suspended', role: 'resident' },
                  });
                } catch (bErr) {
                  console.warn('Could not ban auth user:', bErr);
                }
              }
              return json({ ok: true, status: 'suspended' });
            }

            if (action === 'reactivate') {
              if (uid) {
                await supabaseAdmin.from('tenant_memberships')
                  .update({ status: 'active' })
                  .eq('tenant_id', tid)
                  .eq('user_id', uid);

                try {
                  await supabaseAdmin.auth.admin.updateUserById(uid, {
                    ban_duration: 'none',
                    user_metadata: { status: 'active', role: 'resident' },
                  });
                } catch (bErr) {
                  console.warn('Could not unban auth user:', bErr);
                }
              }
              return json({ ok: true, status: 'active' });
            }

            if (action === 'remove_access') {
              if (uid) {
                await supabaseAdmin.from('tenant_memberships')
                  .delete()
                  .eq('tenant_id', tid)
                  .eq('user_id', uid);

                try {
                  await supabaseAdmin.auth.admin.deleteUser(uid);
                } catch (e) {
                  console.warn('Could not delete auth user:', e);
                }
              }
              return json({ ok: true, status: 'removed' });
            }

            return json({ error: 'Invalid action' }, 400);
          }

          if (req.method === 'POST' && req.url === '/api/admissions/auto-approve') {
            const body = await readBody();
            const { admissionId } = body || {};
            if (!admissionId) return json({ error: 'Missing admissionId' }, 400);

            const { data: adm, error: aErr } = await (supabaseAdmin.from('admissions') as any)
              .select('id, tenant_id, building_id, status')
              .eq('id', admissionId)
              .single();

            if (aErr || !adm) return json({ error: 'Admission not found' }, 404);
            if (adm.status === 'approved') return json({ ok: true, status: 'approved' });

            const { data: ownerMem } = await (supabaseAdmin.from('tenant_memberships') as any)
              .select('user_id')
              .eq('tenant_id', adm.tenant_id)
              .eq('role', 'owner')
              .limit(1)
              .single();

            if (!ownerMem?.user_id) return json({ error: 'Owner not found for tenant' }, 400);

            const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(ownerMem.user_id);
            if (!ownerUser?.user?.email) return json({ error: 'Owner email not found' }, 400);

            const { data: linkData, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: ownerUser.user.email,
            });
            if (lErr || !linkData?.properties?.hashed_token) {
              return json({ error: 'Could not generate approval session' }, 500);
            }

            const ownerClient = createClient(viteEnv!.VITE_SUPABASE_URL || '', viteEnv!.VITE_SUPABASE_ANON_KEY || '', {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            await ownerClient.auth.verifyOtp({
              token_hash: linkData.properties.hashed_token,
              type: 'magiclink',
            });

            const { data: rpcRes, error: rErr } = await ownerClient.rpc('review_admission', {
              p_admission: admissionId,
              p_decision: 'approve',
              p_notes: 'Auto-approved on admission creation',
            });

            if (rErr) return json({ error: rErr.message }, 400);
            return json({ ok: true, result: rpcRes });
          }

          if (req.method === 'GET' && req.url?.startsWith('/api/auth/list-resident-portal-accounts')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const buildingId = urlObj.searchParams.get('buildingId');

            const query = supabaseAdmin
              .from('residents')
              .select('id,tenant_id,user_id,full_name,phone,email,status,created_at');

            // Join with active room assignments
            const { data: assignments } = await (supabaseAdmin.from('resident_room_assignments') as any)
              .select('resident_id,room_id,bed_id,building_id,rooms(room_number),beds(bed_label)')
              .is('end_at', null);

            const { data: bldgs } = await supabaseAdmin.from('buildings').select('id,name');
            const bldgMap = new Map();
            for (const b of bldgs || []) {
              bldgMap.set(b.id, b.name);
            }

            const assignMap = new Map();
            for (const a of assignments || []) {
              assignMap.set(a.resident_id, a);
            }

            const { data: residents, error: resErr } = await query;
            if (resErr) return json({ error: resErr.message }, 400);

            // Get tenant memberships to check active portal status
            const { data: memberships } = await supabaseAdmin
              .from('tenant_memberships')
              .select('tenant_id,user_id,status,role')
              .eq('role', 'resident');

            const memberMap = new Map();
            for (const m of memberships || []) {
              memberMap.set(`${m.tenant_id}:${m.user_id}`, m.status);
            }

            const filtered = (residents || []).filter((r: any) => {
              if (!buildingId || buildingId === 'all') return true;
              const a = assignMap.get(r.id);
              return a && a.building_id === buildingId;
            });

            const result = filtered.map((r: any) => {
              const a = assignMap.get(r.id);
              const portalStatus = r.user_id
                ? (memberMap.get(`${r.tenant_id}:${r.user_id}`) || (r.status === 'blocked' ? 'suspended' : 'active'))
                : 'no_account';

              return {
                id: r.id,
                tenant_id: r.tenant_id,
                user_id: r.user_id,
                full_name: r.full_name,
                phone: r.phone,
                email: r.email,
                resident_status: r.status,
                portal_status: portalStatus,
                room_number: a?.rooms?.room_number ?? '—',
                bed_label: a?.beds?.bed_label ?? '—',
                building_name: a ? (bldgMap.get(a.building_id) ?? '—') : '—',
                created_at: r.created_at,
              };
            });

            return json(result);
          }

          if (req.method === 'POST' && req.url === '/api/auth/create-team-member') {
            const { tenantId, name, email, phone, role, password, buildingIds } = await readBody();
            if (!tenantId || !role || !password) {
              return json({ error: 'Tenant, role and password are required' }, 400);
            }
            if (password.length < 6) {
              return json({ error: 'Password must be at least 6 characters' }, 400);
            }
            if (!email && !phone) {
              return json({ error: 'Email or mobile number is required' }, 400);
            }

            const cleanPhone = (phone || '').replace(/\D/g, '');
            const phone10 = cleanPhone.slice(-10);
            const userEmail = email?.trim()
              ? email.trim().toLowerCase()
              : `${phone10 || role}@staff.zipnary.internal`;

            // 1. Create or update user in Supabase auth
            const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            let user = users?.users?.find((u: any) =>
              u.email?.toLowerCase() === userEmail.toLowerCase() ||
              (cleanPhone && u.user_metadata?.phone && String(u.user_metadata.phone).replace(/\D/g, '').endsWith(phone10)) ||
              (cleanPhone && u.email?.toLowerCase().startsWith(phone10))
            );

            if (user) {
              const { data: updated, error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password,
                user_metadata: { full_name: name || user.user_metadata?.full_name || role, phone: cleanPhone, role },
              });
              if (uErr) return json({ error: uErr.message }, 400);
              user = updated.user;
            } else {
              const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
                email: userEmail,
                password,
                email_confirm: true,
                user_metadata: { full_name: name || role, phone: cleanPhone, role },
              });
              if (cErr) return json({ error: cErr.message }, 400);
              user = created.user;
            }

            // 2. Ensure profile exists in profiles table
            await supabaseAdmin.from('profiles').upsert({
              id: user.id,
              full_name: name || role,
              email: userEmail,
            });

            // 3. Upsert tenant membership with status active
            const { data: existingM } = await supabaseAdmin
              .from('tenant_memberships')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('user_id', user.id)
              .maybeSingle();

            let membershipId = existingM?.id;
            if (membershipId) {
              await supabaseAdmin
                .from('tenant_memberships')
                .update({ role, status: 'active', display_name: name || role })
                .eq('id', membershipId);
            } else {
              const { data: newM, error: mErr } = await supabaseAdmin
                .from('tenant_memberships')
                .insert({
                  tenant_id: tenantId,
                  user_id: user.id,
                  role,
                  status: 'active',
                  display_name: name || role,
                  invite_email: userEmail,
                })
                .select('id')
                .single();

              if (mErr) return json({ error: mErr.message }, 400);
              membershipId = newM.id;
            }

            // 4. Assign building memberships
            if (membershipId && buildingIds && Array.isArray(buildingIds) && buildingIds.length > 0) {
              await supabaseAdmin.from('building_memberships').delete().eq('membership_id', String(membershipId));
              for (const bId of buildingIds) {
                await supabaseAdmin.from('building_memberships').insert({
                  tenant_id: tenantId,
                  building_id: bId,
                  membership_id: String(membershipId),
                });
              }
            }

            return json({ ok: true, userId: user.id, membershipId, email: userEmail });
          }

          if (req.method === 'POST' && req.url === '/api/auth/change-team-password') {
            const { userId, password } = await readBody();
            if (!userId || !password) return json({ error: 'User ID and password are required' }, 400);
            if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

            const { error: pErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
            if (pErr) return json({ error: pErr.message }, 400);

            return json({ ok: true, message: 'Password updated successfully' });
          }

          if (req.method === 'POST' && req.url === '/api/auth/delete-team-member') {
            const { membershipId, userId } = await readBody();
            if (!membershipId) return json({ error: 'Membership ID is required' }, 400);

            await supabaseAdmin.from('building_memberships').delete().eq('membership_id', membershipId);
            await supabaseAdmin.from('tenant_memberships').delete().eq('id', membershipId);

            if (userId) {
              try {
                await supabaseAdmin.auth.admin.deleteUser(userId);
              } catch (e) {
                console.warn('Could not delete auth user:', e);
              }
            }

            return json({ ok: true, message: 'Team member removed successfully' });
          }

          if (req.method === 'POST' && req.url === '/api/auth/superadmin-change-password') {
            const { previousPassword, newPassword } = await readBody();
            if (!previousPassword || !newPassword) {
              return json({ error: 'Previous password and new password are required' }, 400);
            }
            if (newPassword.length < 6) {
              return json({ error: 'New password must be at least 6 characters' }, 400);
            }

            // 1. Verify previous password against zipco@gmail.com
            const { data: signInData, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
              email: 'zipco@gmail.com',
              password: previousPassword,
            });

            if (signInErr) {
              return json({ error: 'Previous password is incorrect. Please check and try again.' }, 400);
            }

            // 2. Update password for zipco@gmail.com
            const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(signInData.user.id, {
              password: newPassword,
            });
            if (updateErr) {
              return json({ error: updateErr.message }, 400);
            }

            // Sync with shaikjavid6151@gmail.com if present
            try {
              const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
              const javid = list?.users?.find((u: any) => u.email?.toLowerCase() === 'shaikjavid6151@gmail.com');
              if (javid) {
                await supabaseAdmin.auth.admin.updateUserById(javid.id, { password: newPassword });
              }
            } catch (e) {
              console.warn('Sync javid password note:', e);
            }

            return json({ ok: true, message: 'Superadmin password updated successfully!' });
          }

          if (req.method === 'POST' && req.url === '/api/auth/superadmin-send-reset') {
            const recoveryEmail = 'shaikjavid6151@gmail.com';
            try {
              const proto = req.headers['x-forwarded-proto'] || 'http';
              const origin = req.headers.origin || (req.headers.host ? `${proto}://${req.headers.host}` : 'http://localhost:1000');
              // Trigger Supabase password reset email
              await supabaseAdmin.auth.resetPasswordForEmail(recoveryEmail, {
                redirectTo: `${origin}/login`,
              });

              // Also generate recovery link
              const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                type: 'recovery',
                email: recoveryEmail,
                options: { redirectTo: `${origin}/login` },
              });

              return json({
                ok: true,
                message: `Password reset email dispatched to ${recoveryEmail}. Please check your inbox and spam folder.`,
                recoveryUrl: linkData?.properties?.action_link || null,
              });
            } catch (err: any) {
              return json({ error: err?.message || 'Failed to dispatch reset email' }, 500);
            }
          }

          // ------------------------------------------------------------------ Property layout & management
          if (req.method === 'GET' && req.url?.startsWith('/api/property/layout')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const buildingId = urlObj.searchParams.get('buildingId');
            if (!buildingId) return json({ error: 'buildingId is required' }, 400);

            const { data: floors, error: fErr } = await supabaseAdmin
              .from('floors')
              .select('id,floor_number,name,tenant_id')
              .eq('building_id', buildingId)
              .order('floor_number');
            if (fErr) return json({ error: fErr.message }, 400);

            const { data: rooms, error: rErr } = await supabaseAdmin
              .from('rooms')
              .select('id,floor_id,room_number,sharing_capacity,base_monthly_rent,status')
              .eq('building_id', buildingId)
              .order('room_number');
            if (rErr) return json({ error: rErr.message }, 400);

            const { data: beds, error: bErr } = await supabaseAdmin
              .from('beds')
              .select('id,room_id,bed_label,status')
              .eq('building_id', buildingId)
              .eq('status', 'active')
              .order('bed_label');
            if (bErr) return json({ error: bErr.message }, 400);

            const { data: assignments } = await (supabaseAdmin.from('resident_room_assignments') as any)
              .select('id,bed_id,resident_id')
              .eq('building_id', buildingId)
              .is('end_at', null);

            const resIds = ((assignments as any[]) || []).map((a: any) => a.resident_id).filter(Boolean);
            const { data: residents } = resIds.length
              ? await (supabaseAdmin.from('residents') as any).select('id,full_name').in('id', resIds)
              : { data: [] };
            const resMap = new Map(((residents as any[]) || []).map((r: any) => [r.id, r.full_name]));

            const { data: pendingAdmissions } = await (supabaseAdmin.from('admissions') as any)
              .select('id,bed_id')
              .eq('building_id', buildingId)
              .eq('status', 'pending_review');

            const pendingBedSet = new Set(((pendingAdmissions as any[]) || []).map((a: any) => a.bed_id));
            const assignmentMap = new Map();
            for (const a of (assignments as any[]) || []) {
              assignmentMap.set(a.bed_id, {
                resident_id: a.resident_id,
                resident_name: resMap.get(a.resident_id) ?? null,
                admission_id: a.id,
              });
            }

            const result = (floors || []).map((f: any) => {
              const floorRooms = (rooms || []).filter((r: any) => r.floor_id === f.id);
              return {
                floor_id: f.id,
                floor_number: f.floor_number,
                floor_name: f.name,
                rooms: floorRooms.map((r: any) => {
                  const roomBeds = (beds || []).filter((b: any) => b.room_id === r.id);
                  return {
                    room_id: r.id,
                    room_number: r.room_number,
                    capacity: r.sharing_capacity,
                    rent: r.base_monthly_rent,
                    status: r.status,
                    beds: roomBeds.map((b: any) => {
                      const assign = assignmentMap.get(b.id);
                      return {
                        bed_id: b.id,
                        label: b.bed_label,
                        status: b.status,
                        resident_id: assign?.resident_id ?? null,
                        resident_name: assign?.resident_name ?? null,
                        admission_id: assign?.admission_id ?? null,
                        pending_admission: pendingBedSet.has(b.id),
                      };
                    }),
                  };
                }),
              };
            });

            return json(result, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
          }

          if (req.method === 'POST' && req.url === '/api/property/create-floor') {
            const { buildingId, floorNumber, name } = await readBody();
            if (!buildingId || floorNumber === undefined) {
              return json({ error: 'buildingId and floorNumber are required' }, 400);
            }
            const { data: bld, error: bErr } = await supabaseAdmin
              .from('buildings')
              .select('tenant_id')
              .eq('id', buildingId)
              .single();
            if (bErr || !bld) return json({ error: 'Building not found' }, 404);

            const floorName = name?.trim() || `Floor ${floorNumber}`;
            const { data: floor, error: fErr } = await supabaseAdmin
              .from('floors')
              .insert({
                tenant_id: bld.tenant_id,
                building_id: buildingId,
                floor_number: Number(floorNumber),
                name: floorName,
              })
              .select('id')
              .single();

            if (fErr) return json({ error: fErr.message }, 400);
            return json({ id: floor.id });
          }

          if (req.method === 'POST' && req.url === '/api/property/create-room') {
            const { floorId, roomNumber, capacity, monthlyRent } = await readBody();
            if (!floorId || !roomNumber) {
              return json({ error: 'floorId and roomNumber are required' }, 400);
            }
            const { data: fl, error: flErr } = await supabaseAdmin
              .from('floors')
              .select('id,building_id,tenant_id')
              .eq('id', floorId)
              .single();
            if (flErr || !fl) return json({ error: 'Floor not found' }, 404);

            const cap = Math.min(Math.max(Number(capacity) || 1, 1), 12);
            const rent = Number(monthlyRent) || 0;
            const num = String(roomNumber).trim();

            const { data: room, error: rErr } = await supabaseAdmin
              .from('rooms')
              .insert({
                tenant_id: fl.tenant_id,
                building_id: fl.building_id,
                floor_id: floorId,
                room_number: num,
                sharing_capacity: cap,
                base_monthly_rent: rent,
              })
              .select('id')
              .single();
            if (rErr) return json({ error: rErr.message }, 400);

            const bedInserts = [];
            for (let i = 1; i <= cap; i++) {
              bedInserts.push({
                tenant_id: fl.tenant_id,
                building_id: fl.building_id,
                room_id: room.id,
                bed_label: `${num}-B${i}`,
              });
            }
            await supabaseAdmin.from('beds').insert(bedInserts);
            return json({ id: room.id });
          }

          if (req.method === 'POST' && req.url === '/api/property/update-room-capacity') {
            const { roomId, capacity, monthlyRent } = await readBody();
            if (!roomId) return json({ error: 'roomId is required' }, 400);

            const { data: rm, error: rmErr } = await supabaseAdmin
              .from('rooms')
              .select('id,tenant_id,building_id,room_number,sharing_capacity')
              .eq('id', roomId)
              .single();
            if (rmErr || !rm) return json({ error: 'Room not found' }, 404);

            const newCap = Math.min(Math.max(Number(capacity) || 1, 1), 12);
            const rent = Math.max(Number(monthlyRent) || 0, 0);

            const { data: tenant, error: tErr } = await (supabaseAdmin.from('tenants') as any)
              .select('id,email')
              .eq('id', (rm as any).tenant_id)
              .single();

            if (tErr || !(tenant as any)?.email) {
              return json({ error: 'Tenant not found for room' }, 404);
            }

            const { data: linkData, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: (tenant as any).email,
            });
            if (lErr || !linkData?.properties?.hashed_token) {
              return json({ error: 'Failed to authorize room update: ' + (lErr?.message || 'unknown') }, 500);
            }

            const client = createClient(viteEnv!.VITE_SUPABASE_URL || '', viteEnv!.VITE_SUPABASE_ANON_KEY || '', {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { error: vErr } = await client.auth.verifyOtp({
              token_hash: linkData.properties.hashed_token,
              type: 'magiclink',
            });
            if (vErr) {
              return json({ error: 'Auth verification failed: ' + vErr.message }, 500);
            }

            const { error: rpcErr } = await client.rpc('room_update_capacity', {
              p_room: roomId,
              p_capacity: newCap,
              p_monthly_rent: rent,
            });
            if (rpcErr) {
              return json({ error: rpcErr.message }, 400);
            }

            return json({ ok: true });
          }

          if (req.method === 'GET' && req.url?.startsWith('/api/property/floors')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const buildingId = urlObj.searchParams.get('buildingId');
            if (!buildingId) return json([]);
            const { data: floors } = await supabaseAdmin
              .from('floors')
              .select('id,name,floor_number')
              .eq('building_id', buildingId)
              .order('floor_number');
            return json(floors || []);
          }

          if (req.method === 'GET' && req.url?.startsWith('/api/property/rooms')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const buildingId = urlObj.searchParams.get('buildingId');
            if (!buildingId) return json([]);
            const { data: rooms } = await supabaseAdmin
              .from('rooms')
              .select('id,room_number,floor_id')
              .eq('building_id', buildingId)
              .order('room_number');
            return json(rooms || []);
          }

          next();
        } catch (e: any) {
          json({ error: e?.message || 'Server error' }, 500);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), authApiPlugin()],
  server: { port: 3000, host: true },
});
