// Supabase client — WASEELA (multi-tenant). SCAFFOLD (Fase 1): belum dipakai
// view/composable manapun. Firebase TETAP sumber kebenaran sampai cutover
// per-koleksi (Fase 6). App tetap jalan normal walau env Supabase kosong.
//
// Isolasi tenant DITEGAKKAN DI SERVER (RLS + public.current_tenant_id()), BUKAN
// di client — anon key publik aman; RLS yang menjaga & memisah data antar-lembaga.
// Kredensial dari .env.local (per-build tenant): VITE_SUPABASE_URL +
// VITE_SUPABASE_PUBLISHABLE_KEY (key format baru `sb_publishable_...`; alias lama
// VITE_SUPABASE_ANON_KEY tetap didukung utk backward-compat).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
// Slug tenant build ini (di-set build-tenant.mjs). Dikirim sbg header `x-tenant`
// supaya current_tenant_id() bisa resolusi tenant utk request ANON (pra-login:
// branding/PSB/posts publik). User LOGIN tetap pakai profiles.tenant_id (header
// diabaikan) -> tak bisa lompat-tenant. Kosong = mode single/dev.
const tenantSlug = import.meta.env.VITE_SUPABASE_TENANT_SLUG || ''

// Guard: env belum diisi -> export null (JANGAN throw saat boot). Saat adapter
// mulai memakai ini (Fase 4/6), ketiadaan env ketahuan eksplisit.
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // FALSE: true bikin login username/WA/NIS hang (proses URL hash-router
          // saat init). OAuth balik `?code=` ditukar MANUAL di initAuth (Fase 4).
          detectSessionInUrl: false,
          flowType: 'pkce'
        },
        global: tenantSlug ? { headers: { 'x-tenant': tenantSlug } } : {}
      })
    : null

if (!supabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum di-set (.env.local) — client = null (scaffold Fase 1).'
  )
}

/** True bila client Supabase siap dipakai (env terisi). */
export function isSupabaseReady() {
  return supabase !== null
}
