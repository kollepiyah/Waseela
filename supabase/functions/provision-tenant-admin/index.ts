// provision-tenant-admin — Edge Function (service-role). Konsol platform_owner
// membuat AKUN ADMIN AWAL untuk sebuah tenant: admin@<slug>.waseela.local.
// Trigger handle_new_user otomatis membuat profil super_admin + tenant (dari slug).
//
// Guard: hanya pemanggil ber-role_sistem 'platform_owner' yang boleh.
// Prasyarat: tenant dgn <slug> SUDAH dibuat (else profil admin tak dapat tenant).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-tenant, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // 1) verifikasi pemanggil = platform_owner
    const caller = createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    })
    const { data: u } = await caller.auth.getUser()
    const uid = u?.user?.id
    if (!uid) return json({ error: 'unauthenticated' }, 401)
    const { data: prof } = await admin.from('profiles').select('role_sistem').eq('id', uid).maybeSingle()
    if (prof?.role_sistem !== 'platform_owner') return json({ error: 'forbidden — bukan platform_owner' }, 403)

    // 2) input
    const body = await req.json().catch(() => ({}))
    const slug = String(body?.slug || '').trim().toLowerCase()
    if (!slug) return json({ error: 'slug wajib' }, 400)
    const password = String(body?.password || 'admin1234')
    const email = `admin@${slug}.waseela.local`

    // 3) pastikan tenant ada
    const { data: t } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!t) return json({ error: `tenant "${slug}" belum ada — buat tenant dulu` }, 400)

    // 4) buat user (sandi dipad seperti client; email auto-confirm)
    const { error: cErr } = await admin.auth.admin.createUser({
      email,
      password: 'wsl_auth_' + password,
      email_confirm: true
    })
    if (cErr) {
      if (/already|registered|exists/i.test(cErr.message || '')) {
        return json({ error: `admin untuk "${slug}" sudah ada` }, 409)
      }
      return json({ error: cErr.message }, 500)
    }
    // profil super_admin + tenant dibuat oleh trigger handle_new_user.
    return json({ ok: true, email, username: 'admin', password })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
