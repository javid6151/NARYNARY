import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createClient } from '@supabase/supabase-js';

function authApiPlugin() {
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  return {
    name: 'zipnary-auth-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/auth/')) return next();

        if (!supabaseAdmin) {
          const env = loadEnv('', process.cwd(), '');
          const url = env.VITE_SUPABASE_URL;
          const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
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

        const json = (data: any, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        try {
          if (req.method === 'POST' && req.url === '/api/auth/resolve-identifier') {
            const { identifier } = await readBody();
            if (!identifier) return json({ error: 'Identifier is required' }, 400);

            const clean = String(identifier).trim();
            if (clean.includes('@')) {
              return json({ email: clean.toLowerCase() });
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
              (x.email && x.email.toLowerCase().startsWith(phone10))
            );
            if (u?.email) {
              return json({ email: u.email.toLowerCase(), role: 'user' });
            }

            return json({ error: `No registered account found with mobile number ${clean}` }, 404);
          }

          if (req.method === 'POST' && req.url === '/api/auth/set-resident-password') {
            const { residentId, phone, email, fullName, password } = await readBody();
            if (!password || password.length < 6) {
              return json({ error: 'Password must be at least 6 characters' }, 400);
            }
            if (!phone && !email) {
              return json({ error: 'Phone or email is required' }, 400);
            }

            const cleanPhone = (phone || '').replace(/\D/g, '');
            const phone10 = cleanPhone.slice(-10);
            const userEmail = email?.trim()
              ? email.trim().toLowerCase()
              : `${phone10 || 'resident'}@resident.zipnary.internal`;

            // Check if user already exists
            const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            let user = users?.users?.find((u: any) =>
              u.email?.toLowerCase() === userEmail.toLowerCase() ||
              (cleanPhone && u.phone && u.phone.replace(/\D/g, '').endsWith(phone10)) ||
              (cleanPhone && u.email?.toLowerCase().startsWith(phone10))
            );

            if (user) {
              const { data: updated, error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password,
                user_metadata: { full_name: fullName || user.user_metadata?.full_name || 'Resident', phone: cleanPhone },
              });
              if (uErr) return json({ error: uErr.message }, 400);
              user = updated.user;
            } else {
              const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
                email: userEmail,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName || 'Resident', phone: cleanPhone },
              });
              if (cErr) return json({ error: cErr.message }, 400);
              user = created.user;
            }

            if (residentId && user?.id) {
              await supabaseAdmin.from('residents').update({ email: userEmail, user_id: user.id }).eq('id', residentId);
            }

            return json({ ok: true, email: userEmail, userId: user?.id });
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
              const origin = req.headers.origin || 'http://localhost:1000';
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
