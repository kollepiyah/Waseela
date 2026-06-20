// ============================================================================
// useFeatures — feature-flags tenant (BUILD-TIME, dari tenant.config.js).
//   Modul on/off per lembaga (white-label). Lihat tenants/<slug>/tenant.config.js.
// ============================================================================
import tenantConfig from '@/tenant.config.js'

const FEATURES = { ...(tenantConfig.features || {}) }

// Sub-flag mewarisi parent: bila parent OFF, anak ikut OFF (walau flag anak true).
const PARENT = {
  pos: 'keuangan',
  tabungan: 'keuangan',
  bisyaroh: 'keuangan',
  hutangPiutang: 'keuangan',
  fingerprint: 'absensi'
}

// Flag default ON kecuali di-set `false` eksplisit — aman untuk modul yang belum
// dicantumkan di config (perilaku lama dipertahankan).
export function isOn(key) {
  if (!key) return true
  if (FEATURES[key] === false) return false
  const parent = PARENT[key]
  if (parent && FEATURES[parent] === false) return false
  return true
}

export function useFeatures() {
  return FEATURES
}

// Peta path → flag. Dipakai gate menu (useMenus) + router guard tanpa menandai
// tiap item/route satu per satu. Sub-path (mis. /psb/123) ikut segmen pertama.
const PATH_FEATURE = {
  '/laporan': 'analitik',
  '/supervisi': 'supervisi',
  '/psb': 'psb',
  '/absensi-guru': 'absensi',
  '/absensi-santri': 'absensi',
  '/rekap-prestasi': 'prestasi',
  '/capaian-prestasi': 'prestasi',
  '/posts': 'posts',
  '/keuangan': 'keuangan',
  '/keuangan-desktop': 'keuangan',
  '/tagihan': 'keuangan',
  '/pembayaran': 'keuangan',
  '/pembayaran-pending': 'keuangan',
  '/riwayat-santri': 'keuangan',
  '/buku-induk': 'keuangan',
  '/laporan-keuangan': 'keuangan',
  '/keu-pengaturan': 'keuangan',
  '/pos-santri': 'pos',
  '/pos-riwayat': 'pos',
  '/bisyaroh': 'bisyaroh',
  '/tabungan': 'tabungan',
  '/uang-saku': 'tabungan',
  '/hutang-piutang': 'hutangPiutang',
  '/kritik-saran': 'kritikSaran'
}

export function featureForPath(path) {
  if (!path) return null
  if (PATH_FEATURE[path]) return PATH_FEATURE[path]
  const seg = String(path).split('/').filter(Boolean)[0]
  return seg ? PATH_FEATURE['/' + seg] || null : null
}
