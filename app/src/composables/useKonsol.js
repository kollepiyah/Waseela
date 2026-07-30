// useKonsol — data konsol PLATFORM OWNER (lintas-tenant). Supabase-direct
// (bukan db.js yang tenant-scoped). RLS + platform_owner yang menjaga akses.
import { ref } from 'vue'
import { supabase } from '@/services/supabase'

export function useKonsol() {
  const loading = ref(false)
  const error = ref(null)

  async function _run(fn) {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e) {
      error.value = e?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function _ensure() {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi (.env.local).')
  }

  // ---- Dashboard: agregat lintas-tenant (RPC guard owner, tanpa PII) ----
  const stats = () => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase.rpc('platform_stats')
    if (e) throw e
    return data || []
  })

  // ---- Tenants ----
  const listTenants = () => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase.from('tenants').select('*').order('created_at')
    if (e) throw e
    return data || []
  })
  const createTenant = ({ slug, nama, plan = 'basic', aktif = true }) => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase
      .from('tenants')
      .insert({ slug: String(slug || '').trim().toLowerCase(), nama: String(nama || '').trim(), plan, aktif })
      .select().single()
    if (e) throw e
    return data
  })
  const updateTenant = (id, patch) => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase.from('tenants').update(patch).eq('id', id).select().single()
    if (e) throw e
    return data
  })

  // ---- Langganan / pembelian ----
  const listLangganan = () => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase
      .from('langganan')
      .select('*, tenants(slug,nama)')
      .order('created_at', { ascending: false })
    if (e) throw e
    return data || []
  })
  const createLangganan = (row) => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase.from('langganan').insert(row).select().single()
    if (e) throw e
    return data
  })
  const updateLangganan = (id, patch) => _run(async () => {
    _ensure()
    const { data, error: e } = await supabase.from('langganan').update(patch).eq('id', id).select().single()
    if (e) throw e
    return data
  })

  // ---- Provision admin tenant (Edge Function service-role) ----
  // Pakai fetch langsung (supabase.functions.invoke bermasalah di sebagian lingkungan);
  // endpoint /functions/v1 + JWT owner + apikey.
  const provisionAdmin = (slug, password) => _run(async () => {
    _ensure()
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    const base = supabase.supabaseUrl || import.meta.env.VITE_SUPABASE_URL
    const r = await fetch(base + '/functions/v1/provision-tenant-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabase.supabaseKey,
        Authorization: 'Bearer ' + (token || '')
      },
      body: JSON.stringify({ slug, password: password || undefined })
    })
    const out = await r.json().catch(() => ({}))
    if (!r.ok || out.error) throw new Error(out.error || ('provision gagal (' + r.status + ')'))
    return out
  })

  return {
    loading, error,
    stats,
    listTenants, createTenant, updateTenant,
    listLangganan, createLangganan, updateLangganan,
    provisionAdmin
  }
}
