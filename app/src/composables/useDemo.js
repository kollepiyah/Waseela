// ============================================================================
// WASEELA — Mode DEMO (panel toggle fitur untuk calon pelanggan).
//   AKTIF hanya bila tenant.config.demo === true (build demo). Override fitur
//   disimpan di localStorage; perubahan diterapkan via RELOAD (lihat useFeatures).
//   Tidak memengaruhi build tenant asli (non-demo) sama sekali.
// ============================================================================
import tenantConfig from '@/tenant.config.js'
import { resolveFeatures, ALL_FEATURES, PLANS } from '@/config/plans.js'

const KEY = 'waseela_demo_features'
const WELCOME_KEY = 'waseela_demo_welcome' // sessionStorage: status gate sambutan pra-login

export const IS_DEMO = tenantConfig.demo === true

function readRaw() {
  if (typeof localStorage === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function writeRaw(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj))
  } catch {
    /* ignore (private mode dll) */
  }
}

// Status EFEKTIF tiap modul saat ini = baseline config (plan/features) + override demo.
export function currentFeatures() {
  return { ...resolveFeatures(tenantConfig), ...readRaw() }
}

// Set satu modul lalu reload supaya app mencerminkan perubahan.
export function setFeature(key, val) {
  const o = readRaw()
  o[key] = !!val
  writeRaw(o)
  reload()
}

// Terapkan preset paket (basic/pro/premium): set SEMUA modul sesuai preset, lalu reload.
export function applyPreset(plan) {
  const on = new Set(PLANS[plan] || [])
  const o = {}
  for (const k of ALL_FEATURES) o[k] = on.has(k)
  writeRaw(o)
  reload()
}

// Hapus override -> kembali ke baseline config demo, lalu reload.
export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  reload()
}

// Gate sambutan pra-login (auto-muncul tiap kunjungan). Pakai sessionStorage
// supaya tiap pengunjung baru lihat lagi, TAPI tetap stabil melewati reload akibat
// toggle/preset dalam satu sesi. Nilai: null=fresh (belum dilihat) -> buka,
// '1'=sedang terbuka (pertahankan saat reload), '0'=sudah ditutup pengunjung.
export function welcomeState() {
  if (typeof sessionStorage === 'undefined') return '0'
  try {
    return sessionStorage.getItem(WELCOME_KEY)
  } catch {
    return '0'
  }
}
export function setWelcomeOpen(open) {
  try {
    sessionStorage.setItem(WELCOME_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function reload() {
  if (typeof location !== 'undefined') location.reload()
}
