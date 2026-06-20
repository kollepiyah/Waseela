// ============================================================================
// WASEELA — Mode DEMO (panel toggle fitur untuk calon pelanggan).
//   AKTIF hanya bila tenant.config.demo === true (build demo). Override fitur
//   disimpan di localStorage; perubahan diterapkan via RELOAD (lihat useFeatures).
//   Tidak memengaruhi build tenant asli (non-demo) sama sekali.
// ============================================================================
import tenantConfig from '@/tenant.config.js'
import { resolveFeatures, ALL_FEATURES, PLANS } from '@/config/plans.js'

const KEY = 'waseela_demo_features'
const PANEL_KEY = 'waseela_demo_panel_open'

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

// Hapus override → kembali ke baseline config demo, lalu reload.
export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  reload()
}

// Panel buka/tutup dipertahankan melewati reload (UX: tetap terbuka setelah toggle).
export function isPanelOpen() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PANEL_KEY) === '1'
}
export function setPanelOpen(open) {
  try {
    localStorage.setItem(PANEL_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function reload() {
  if (typeof location !== 'undefined') location.reload()
}
