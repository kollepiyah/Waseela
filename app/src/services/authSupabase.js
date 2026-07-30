// authSupabase.js — WASEELA Fase 3 (migrasi Supabase): jalur auth PARALEL ke auth.js
// (Firebase), DORMANT sampai cutover (Fase 6). Belum diimpor view/store mana pun.
//
// Alur: login username/WA/NIS + source -> resolve_login RPC (auth_key kanonik, tenant
// dari header x-tenant, tanpa PII) -> email `<auth_key>@<slug>.waseela.local` -> signIn;
// belum ada -> signUp (lazy-create, sandi default '1234'). Peran + tenant dipetakan
// server (trigger handle_new_user). Client lalu baca profiles + guru/santri -> sesiAktif.
//
// MULTI-TENANT: email di-NAMESPACE per-tenant (<slug>.waseela.local) supaya username/NIS
// yang sama antar-lembaga tak bentrok di auth.users.email (unik global). slug = build tenant.
import { supabase } from './supabase'
import { getOne, mergeOne } from './db'

function _ensure() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi (.env.local).')
}

// Slug tenant build ini (sama dg header x-tenant di supabase.js). Domain email dinamai
// per-tenant. Dev tanpa env -> 'demo'.
const TENANT_SLUG = import.meta.env.VITE_SUPABASE_TENANT_SLUG || 'demo'
export const AUTH_EMAIL_DOMAIN = '@' + TENANT_SLUG + '.waseela.local'

/** Padding sandi -> >= 6 char (mirror Firebase). User tak tahu prefix. */
export function toAuthPassword(pass) {
  return 'wsl_auth_' + String(pass || '')
}

// Platform owner (vendor Bakafrawi) — akun LINTAS-tenant, email TETAP (bukan
// namespaced per-tenant). Login pakai key ini di form username biasa.
export const PLATFORM_OWNER_EMAIL = 'owner@waseela.local'
const PLATFORM_OWNER_KEYS = ['owner', 'superowner', 'platform', 'bakafrawi']

function sanitizeAuthLocalPart(input) {
  return String(input || '').toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

/** Bangun email Auth internal (namespaced tenant) dari auth_key kanonik. */
export function buildAuthEmail(authKey) {
  const clean = sanitizeAuthLocalPart(authKey)
  return clean ? clean + AUTH_EMAIL_DOMAIN : null
}

/** Resolusi login pra-auth via RPC. `source`: 'guru' | 'santri' | null.
 *  Return { source, auth_key, active } | null. Tenant di-resolve server dari header x-tenant. */
export async function resolveLogin(input, source = null) {
  _ensure()
  const { data, error } = await supabase.rpc('resolve_login', {
    p_input: String(input || '').trim(),
    p_source: source || null
  })
  if (error) throw error
  return data || null
}

function _isInvalidCred(error) {
  const c = error?.code || ''
  const m = String(error?.message || '').toLowerCase()
  return c === 'invalid_credentials' || m.includes('invalid login credentials')
}

/**
 * loginUnified — resolve -> signIn -> (lazy) signUp. Return { source, user, session }.
 * Lempar error kode 'auth/not-found' | 'auth/inactive' | 'auth/wrong-password'.
 */
export async function loginUnified(input, password, source = null) {
  _ensure()

  // Platform owner: bypass resolve_login (tak terikat tenant). Email tetap, signIn saja
  // (akun di-provision, TIDAK lazy-signup — cegah pembuatan owner sembarangan).
  if (PLATFORM_OWNER_KEYS.includes(String(input || '').trim().toLowerCase())) {
    const si = await supabase.auth.signInWithPassword({
      email: PLATFORM_OWNER_EMAIL, password: toAuthPassword(password)
    })
    if (si.error) {
      const e = new Error(_isInvalidCred(si.error)
        ? 'Sandi owner salah.' : 'Akun owner belum tersedia. Hubungi administrator sistem.')
      e.code = _isInvalidCred(si.error) ? 'auth/wrong-password' : 'auth/not-found'
      throw e
    }
    return { source: 'owner', user: si.data.user, session: si.data.session }
  }

  const info = await resolveLogin(input, source)
  if (!info) {
    const e = new Error(
      source === 'santri'
        ? 'Santri/wali tidak ditemukan. Coba No. Induk atau WA wali.'
        : source === 'guru'
          ? 'Guru/pegawai tidak ditemukan. Coba username atau WA.'
          : 'Username tidak ditemukan.'
    )
    e.code = 'auth/not-found'
    throw e
  }
  if (info.active === false) {
    const e = new Error('Akun tidak aktif. Hubungi administrator.')
    e.code = 'auth/inactive'
    throw e
  }
  const email = buildAuthEmail(info.auth_key)
  const pass = toAuthPassword(password)

  let { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
  if (error) {
    if (!_isInvalidCred(error)) throw error
    const up = await supabase.auth.signUp({ email, password: pass })
    if (up.error) {
      if (/already|registered|exists/i.test(up.error.message || '')) {
        const e = new Error('Kata sandi salah')
        e.code = 'auth/wrong-password'
        throw e
      }
      throw up.error
    }
    if (up.data?.session) {
      data = up.data
    } else {
      const re = await supabase.auth.signInWithPassword({ email, password: pass })
      if (re.error) throw re.error
      data = re.data
    }
  }
  return { source: info.source, user: data.user, session: data.session }
}

const _ADMIN_AKSES = {
  kelola_guru: true,
  akses_keuangan: true,
  kelola_santri: true,
  kelola_lembaga: true,
  kelola_kelas: true
}

/**
 * buildSesi — sesudah auth, baca profiles + guru/santri -> sesiAktif (bentuk
 * IDENTIK stores/auth.js). Return null bila tak terdaftar.
 */
export async function buildSesi() {
  _ensure()
  const { data: ures } = await supabase.auth.getUser()
  const user = ures?.user
  if (!user) return null
  const uid = user.id
  const email = user.email || ''

  const { data: prof, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
  if (error) throw error
  if (!prof) return null

  // Platform owner (vendor) — sesi lintas-tenant utk konsol; role UI 'admin' (akses penuh),
  // role_sistem 'platform_owner' dipakai router utk gate /konsol.
  if (prof.role_sistem === 'platform_owner') {
    return {
      id: 'owner',
      role: 'admin',
      role_sistem: 'platform_owner',
      nama: 'Platform Owner',
      guru: 'Platform Owner',
      jk: 'L',
      jabatan: 'Platform Owner',
      lembaga: 'Semua Tenant',
      akses: { ..._ADMIN_AKSES },
      auth_method: 'supabase',
      supabase_uid: uid,
      supabase_email: email
    }
  }

  // Admin built-in (super_admin tanpa guru_id/santri_id).
  if (!prof.guru_id && !prof.santri_id && prof.role_sistem === 'super_admin') {
    return {
      id: 'admin',
      role: 'admin',
      role_sistem: 'super_admin',
      nama: 'Administrator',
      guru: 'Admin Utama',
      jk: 'L',
      jabatan: 'Administrator',
      lembaga: 'Semua Data',
      akses: { ..._ADMIN_AKSES },
      auth_method: 'supabase',
      supabase_uid: uid,
      supabase_email: email
    }
  }

  if (prof.guru_id) {
    const g = await getOne('guru', prof.guru_id)
    if (!g) return null
    if (g.status === 'Tidak Aktif') {
      await signOut()
      const e = new Error('Akun guru tidak aktif')
      e.code = 'auth/inactive'
      throw e
    }
    const rs = prof.role_sistem || 'guru'
    const isPengurus = ['admin', 'admin_keuangan', 'super_admin'].includes(rs)
    const linkedEmail = await _syncGoogleEmail('guru', g.id, g.linked_email)
    return {
      id: g.id,
      role: isPengurus ? 'admin' : 'guru',
      role_sistem: rs,
      nama: g.nama,
      guru: g.nama,
      lembaga: isPengurus ? 'Semua Data' : g.lembaga || '',
      jk: g.jk || '',
      jabatan: g.jabatan || '',
      jabatan_tambahan: g.jabatan_tambahan || '',
      gedung: g.gedung || '',
      username: g.username || '',
      wa: g.wa || '',
      foto: g.foto || '',
      linked_email: linkedEmail || g.linked_email || '',
      akses: g.akses || {},
      auth_method: 'supabase',
      supabase_uid: uid,
      supabase_email: email
    }
  }

  if (prof.santri_id) {
    const s = await getOne('santri', prof.santri_id)
    if (!s) return null
    if (s.aktif === false) {
      await signOut()
      const e = new Error('Akun santri tidak aktif')
      e.code = 'auth/inactive'
      throw e
    }
    const linkedEmailS = await _syncGoogleEmail('santri', s.id, s.linked_email)
    return {
      id: s.id,
      role: 'santri',
      role_sistem: 'santri',
      nama: s.nama,
      nis: s.nis || '',
      username: s.username || '',
      wa: s.wa || '',
      foto: s.foto || '',
      lembaga: s.lembaga || '',
      kelas: s.kelas || '',
      wali: s.wali || '',
      is_mukim: s.is_mukim === true,
      linked_email: linkedEmailS || s.linked_email || '',
      auth_method: 'supabase',
      supabase_uid: uid,
      supabase_email: email
    }
  }

  return null
}

/** Logout Supabase. */
export async function signOut() {
  _ensure()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Subscribe perubahan auth state. Return unsubscribe function. */
export function onAuthChange(callback) {
  _ensure()
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null))
  return () => {
    try { data.subscription.unsubscribe() } catch { /* noop */ }
  }
}

/** Sesi saat ini (async). */
export async function currentSession() {
  _ensure()
  const { data } = await supabase.auth.getSession()
  return data?.session || null
}

/**
 * resetUserPassword — admin (super_admin) reset sandi guru/santri ke '1234' via
 * Edge Function reset-user-password (service-role; guard super_admin). Fase 5.
 */
export async function resetUserPassword(collection, docId) {
  _ensure()
  const { data, error } = await supabase.functions.invoke('reset-user-password', {
    body: { collection, docId: String(docId) }
  })
  if (error) {
    let msg = error.message || 'reset-gagal'
    try {
      const j = await error.context?.json?.()
      if (j?.error) msg = j.error
    } catch { /* noop */ }
    throw new Error(msg)
  }
  if (!data?.ok) throw new Error(data?.error || 'reset-gagal')
  return data
}

// --- Google OAuth via Supabase (provider Google diaktifkan di Supabase Auth). ---
function _googleRedirect() {
  try { return window.location.origin + window.location.pathname } catch { return undefined }
}

async function _syncGoogleEmail(coll, id, current) {
  try {
    const { data } = await supabase.auth.getUserIdentities()
    const gi = (data?.identities || []).find((i) => i.provider === 'google')
    const em = gi?.identity_data?.email || (gi ? 'google' : '')
    if (em && em !== current) await mergeOne(coll, String(id), { linked_email: em })
    return em
  } catch {
    return current || ''
  }
}

/** Tukar kode OAuth (PKCE) jadi sesi — dipanggil initAuth saat balik dari Google. */
export async function exchangeOAuthCode(code) {
  _ensure()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
}

export async function loginWithGoogle() {
  _ensure()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: _googleRedirect() }
  })
  if (error) throw error
}

export async function linkGoogleAccount() {
  _ensure()
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: _googleRedirect() }
  })
  if (error) throw error
  return {}
}

export async function unlinkGoogleAccount(coll, id) {
  _ensure()
  const { data, error } = await supabase.auth.getUserIdentities()
  if (error) throw error
  const g = (data?.identities || []).find((i) => i.provider === 'google')
  if (!g) throw new Error('Tidak ada akun Google tertaut.')
  const { error: e2 } = await supabase.auth.unlinkIdentity(g)
  if (e2) throw e2
  try {
    if (coll && id) await mergeOne(coll, String(id), { linked_email: null, google_email: null })
  } catch { /* ignore */ }
  return {}
}
