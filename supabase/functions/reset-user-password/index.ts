// reset-user-password — admin (WAJIB super_admin) reset sandi guru/santri ke '1234'
// (= 'wsl_auth_1234' setelah padding client). Multi-tenant: target di-resolve DALAM
// tenant pemanggil via RPC admin_target_auth_uid (guard super_admin + tenant-scoped).
//
// Self-contained (cors inline) supaya bisa deploy via MCP maupun `supabase functions deploy`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const RESET_PASSWORD = 'wsl_auth_1234' // = toAuthPassword('1234') di client

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!/^Bearer\s+.+/i.test(authHeader)) return json({ ok: false, error: 'no-token' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader, 'x-tenant': req.headers.get('x-tenant') || '' } }
    })
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const body = await req.json().catch(() => ({}))
    const collection = String(body.collection || '')
    const docId = String(body.docId || '')
    if (!['guru', 'santri'].includes(collection) || !docId) return json({ ok: false, error: 'bad-input' }, 400)

    const { data: targetUid, error: rpcErr } = await asCaller.rpc('admin_target_auth_uid', {
      p_collection: collection, p_doc_id: docId
    })
    if (rpcErr) {
      const msg = String(rpcErr.message || '')
      if (/forbidden/i.test(msg)) return json({ ok: false, error: 'forbidden' }, 403)
      if (/not-found/i.test(msg)) return json({ ok: false, error: 'not-found' }, 404)
      return json({ ok: false, error: msg }, 400)
    }

    let didReset = false
    if (targetUid) {
      const { error: updErr } = await admin.auth.admin.updateUserById(String(targetUid), { password: RESET_PASSWORD })
      if (updErr) console.warn('[reset-user-password] updateUserById:', updErr.message)
      else didReset = true
    }
    return json({ ok: true, didReset })
  } catch (e) {
    console.error('[reset-user-password]', e)
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
