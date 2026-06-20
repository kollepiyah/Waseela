// ============================================================================
// WASEELA — Paket (plan) & resolusi feature-flags.
//   Model B (build-per-tenant): tiap lembaga pilih `plan` di tenant.config.js
//   + boleh kustom à la carte lewat `featureOverrides`.
//   Sumber kebenaran daftar modul yang bisa di-flag = ALL_FEATURES di bawah.
// ============================================================================

// Semua modul yang bisa dinyala/matikan (urutan = tampilan panel demo).
// Anak keuangan (pos/tabungan/bisyaroh/hutangPiutang) diletakkan setelah parent.
export const ALL_FEATURES = [
  'absensi',
  'fingerprint',
  'absensiSekolah',
  'prestasi',
  'kenaikan',
  'rapor',
  'kalender',
  'kegiatanPesantren',
  'kritikSaran',
  'psb',
  'posts',
  'keuangan',
  'pos',
  'tabungan',
  'bisyaroh',
  'hutangPiutang',
  'supervisi',
  'analitik'
]

// Label Indonesia untuk panel demo / UI pemilihan paket.
export const FEATURE_LABELS = {
  absensi: 'Absensi santri & guru (ngaji/Qiraati)',
  fingerprint: 'Integrasi Fingerprint',
  absensiSekolah: 'Absensi sekolah (SD/SMP/SMA)',
  prestasi: 'Prestasi & capaian',
  kenaikan: 'Kenaikan & Tes Kenaikan',
  rapor: 'Rapor Semester (lembaga sekolah)',
  kalender: 'Kalender pendidikan',
  kegiatanPesantren: 'Kegiatan Pesantren',
  kritikSaran: 'Kritik & saran',
  psb: 'PSB (Pendaftaran santri baru)',
  posts: 'Channel / Postingan',
  keuangan: 'Keuangan (tagihan & pembayaran)',
  pos: 'POS kasir santri',
  tabungan: 'Tabungan & uang saku',
  bisyaroh: 'Bisyaroh / gaji guru',
  hutangPiutang: 'Hutang–piutang',
  supervisi: 'Supervisi (Direktur)',
  analitik: 'Analitik / laporan BigQuery'
}

// Bundel saran (BERTINGKAT: basic ⊂ pro ⊂ premium). value = daftar modul ON (sisanya OFF).
// Boleh ditimpa per-lembaga via `featureOverrides` (à la carte). Ubah isi paket di sini.
//
//  BASIC   = lembaga QIRAATI/Diniyah (absen NGAJI + kenaikan/tes-kenaikan + prestasi + pengumuman).
//            TANPA Rapor Semester & TANPA absensi sekolah (fitur lembaga sekolah → Pro).
//  PRO     = Basic + RAPOR + ABSENSI SEKOLAH (lembaga sekolah) + KEUANGAN penuh.
//  PREMIUM = Pro + lanjutan (Kegiatan Pesantren, supervisi, analitik BigQuery, fingerprint)
const _BASIC = ['absensi', 'prestasi', 'kenaikan', 'kalender', 'kritikSaran', 'psb', 'posts']
const _SEKOLAH = ['rapor', 'absensiSekolah'] // fitur lembaga sekolah formal
const _KEUANGAN = ['keuangan', 'pos', 'tabungan', 'bisyaroh', 'hutangPiutang']
export const PLANS = {
  basic: [..._BASIC], // Qiraati saja — tanpa rapor & absensi sekolah
  pro: [..._BASIC, ..._SEKOLAH, ..._KEUANGAN],
  premium: [...ALL_FEATURES] // = pro + kegiatanPesantren, fingerprint, supervisi, analitik
}

// Urutan + metadata tampilan paket (untuk panel/landing/penawaran).
export const PLAN_ORDER = ['basic', 'pro', 'premium']
export const PLAN_LABELS = { basic: 'Basic', pro: 'Pro', premium: 'Premium' }
// Tagline + harga ILUSTRASI (IDR/tahun) — validasi ke 1-2 lembaga pertama (lihat HANDOVER PRICING).
export const PLAN_META = {
  basic: { tagline: 'Operasional dasar pesantren', harga: '1,5–3 jt/th' },
  pro: { tagline: 'Basic + manajemen keuangan penuh', harga: '3–6 jt/th' },
  premium: { tagline: 'Semua fitur + supervisi & analitik', harga: '6–12 jt/th' }
}

// Resolusi config tenant → objek features { key: bool } final.
//   - Tanpa `plan`  → pakai `features` apa adanya (BACKWARD-COMPAT, perilaku lama).
//   - Dengan `plan` → baseline preset PLANS[plan], lalu ditimpa `featureOverrides` (kustom).
// Catatan: parent-inheritance (mis. keuangan off → pos off) tetap ditangani useFeatures.isOn.
export function resolveFeatures(cfg = {}) {
  const { plan, features, featureOverrides } = cfg
  if (!plan) return { ...(features || {}) }

  const on = new Set(PLANS[plan] || [])
  const out = {}
  for (const key of ALL_FEATURES) out[key] = on.has(key)
  return { ...out, ...(featureOverrides || {}) }
}
