// ============================================================================
// Aturan white-label — SUMBER TUNGGAL transformasi kode Ammu → Waseela.
//
// Dipakai oleh `whitelabel.mjs` (terapkan + audit) dan `sync-from-ammu.mjs`
// (terapkan ulang otomatis ke berkas yang baru disalin dari Ammu).
//
// ATURAN MAIN:
//   1. Setiap kali sync membawa literal identitas baru, TAMBAHKAN aturannya di sini —
//      jangan menambal berkasnya langsung, nanti hilang di sync berikutnya.
//   2. Urutan penting: pola paling spesifik lebih dulu.
//   3. Gerbang `grep` di whitelabel.mjs yang membuktikan aturan ini cukup.
// ============================================================================

/** Pola nama berkas yang ikut disapu. */
export const EXT_SRC = /\.(js|vue|css)$/
export const EXT_BACKEND = /\.(ts|sql|toml)$/

/** Impor yang disisipkan saat sebuah berkas mulai memakai BRAND. */
export const BRAND_IMPORT = "import { BRAND } from '@/config/brand'"

// ── app/src ─────────────────────────────────────────────────────────────────
export const RULES_SRC = [
  // Prefix CSS & identifier internal (paling spesifik dulu)
  ['ammu-ribbon-app', 'wsl-ribbon-app'],
  ['ammu-pos-backdrop', 'wsl-pos-backdrop'],
  ['ammu-post', 'wsl-post'],
  ['ammu-jam', 'wsl-jam'],
  ['ammu-icons', 'wsl-icons'],
  ['AmmuOnline', 'Waseela'],
  ['ammu_', 'waseela_'],
  ['portalMu_', 'waseela_'],

  // Auth (DB pembeli bersih → tanpa alias legacy)
  ['@ammu.local', '@waseela.local'],
  ['mu_auth_', 'wsl_auth_'],
  // Nama akun admin bawaan: huruf "mu" pada 'adminmu' = Mambaul Ulum. Kanoniknya
  // 'admin' (lihat migrasi 20260808130000). 'adminmu' tetap DITERIMA sebagai masukan,
  // jadi hanya nilai bawaan/kanonik yang diganti — bukan pengenalan aliasnya.
  ["adminUsername: 'adminmu'", "adminUsername: 'admin'"],
  ["{ username: 'adminmu' }", "{ username: 'admin' }"],

  // Nama event & resource
  ["'ammu:open-printer-settings'", "'waseela:open-printer-settings'"],
  ["'ic_stat_ammu'", "'ic_stat_waseela'"],

  // Fallback identitas → BRAND.* (kopLine1/2 default KOSONG, jadi tak ada nama lembaga asing)
  //
  // ⚠ URUTAN: yang SPESIFIK wajib lebih dulu. Aturan generik `|| 'Ammu Online'` di bawah
  //   akan melahap pola-pola ini kalau ditaruh belakangan (pernah terjadi: header & status
  //   bar jadi BRAND.appName, padahal semestinya txtHeaderBar / namaLembaga).
  [/(txtAppName\s*\|\|\s*)'Ammu Online'/g, '$1BRAND.txtHeaderBar'],
  [/(appTitle\s*\|\|\s*)'Mambaul Ulum'/g, '$1BRAND.namaLembaga'],
  [/(appVersion\s*\|\|\s*)'v\.\d+\.\d+\.\d+'/g, '$1BRAND.version'],
  [/(kopLine1\s*\|\|\s*)'YAYASAN MAMBAUL ULUM'/g, '$1BRAND.kopLine1'],
  [/(kopLine1\s*\|\|\s*)'PONDOK PESANTREN MAMBAUL ULUM'/g, '$1BRAND.kopLine1'],
  [/(kopLine2\s*\|\|\s*)'PONDOK PESANTREN MAMBAUL ULUM'/g, '$1BRAND.kopLine2'],
  [/(kopLine2\s*\|\|\s*)'Pondok Pesantren Mambaul Ulum'/g, '$1BRAND.kopLine2'],
  [/(namaLembaga\s*\|\|\s*)'Pondok Pesantren Mambaul Ulum'/g, '$1BRAND.namaLembaga'],
  [/(namaPondokSingkat\s*\|\|\s*)'Mambaul Ulum'/g, '$1BRAND.namaPondokSingkat'],
  [/(\|\|\s*)'MAMBAUL ULUM'/g, '$1BRAND.kopLine2'],
  [/(\|\|\s*)'Ammu Online'/g, '$1BRAND.appName'],
  [/(\|\|\s*)'Mambaul Ulum'/g, '$1BRAND.appName'],
  [/(\|\|\s*)'Ammu Channel'/g, '$1BRAND.namaChannel'],
  ["'Al Manshur Channel'", 'BRAND.namaChannel'],

  // URL layanan milik lembaga lain
  ["'https://github.com/kollepiyah/ammu/releases/latest'", "BRAND.releaseRepo + '/releases/latest'"],
  ["'https://github.com/kollepiyah/ammu/releases'", "BRAND.releaseRepo + '/releases'"],
  ["'https://ammuonline.web.app/app-version.json'", '`${BRAND.hostingUrl}/app-version.json`'],
  ["'https://ammuonline-psb.web.app'", 'BRAND.psbUrl'],

  // Label & komentar spesifik (harus SEBELUM aturan generik di bawah)
  ['name: \'Notifikasi Ammu\',', 'name: `Notifikasi ${BRAND.appName}`,'],
  ["txtHeaderBar: 'Ammu Online',", 'txtHeaderBar: BRAND.txtHeaderBar,'],
  ['© 2026 Mambaul Ulum', '© {{ new Date().getFullYear() }} {{ BRAND.copyrightName }}'],
  ['sudah include nya (hindari "TPQ TPQ MAMBAUL ULUM")', 'sudah include-nya (hindari "TPQ TPQ <NAMA>")'],
  ['<!-- Modal: Create / Edit Post (style: legacy ammu) -->', '<!-- Modal: Create / Edit Post -->'],
  ['alt="Logo Mambaul Ulum"', 'alt="Logo lembaga"'],
  ['* Ammu berbasis teks,', '* Antarmuka berbasis teks,'],
  ['design_handoff_waseela_desktop/app/ammu.css.', 'design_handoff_waseela_desktop/app/ribbon.css.'],
  ['<!-- Dekorasi: logo app (Mambaul Ulum) di kanan,', '<!-- Dekorasi: logo app di kanan,'],
  ['+ leaf logo + "Ammu Online" branding -->', '+ leaf logo + branding app -->'],
  ['sebelum "mulai tagih" AMMU = bukan tunggakan', 'sebelum "mulai tagih" = bukan tunggakan'],
  ['(https://localhost -> ammuonline.web.app), dan', '(https://localhost -> hosting produksi), dan'],
  ['// Sumber Excel (READ-ONLY) di "D:/Aplikasi Project/Ammu Data/":', '// Sumber Excel (READ-ONLY) dari folder ekspor data lama:'],
  ['dari Excel "Ammu Data/" -> Supabase', 'dari Excel ekspor lama -> Supabase'],
  ['folder <b>Ammu Data</b>', 'folder ekspor data lama'],
  ['// namaLembaga dari settings.kopLine2 atau default "MAMBAUL ULUM"', '// namaLembaga dari settings.kopLine2; kosong = lembaga belum mengisi kop (white-label)'],
  ['form "Slip Ammu"', 'form "Slip"'],
  ['AMMU simpan PIN fingerprint', 'Aplikasi menyimpan PIN fingerprint'],
  ["id='admin' (ammuadmin)", "id='admin'"],
  ['laporan keuangan Ammu tetap satu wajah', 'laporan keuangan tetap satu wajah'],
  ['Pengaturan Postingan / Ammu Channel', 'Pengaturan Postingan / Kanal Informasi'],
  ['v.21.84.0527: Ammu Channel —', 'v.21.84.0527: Kanal informasi —'],
  ['silhouette putih Ammu', 'silhouette putih logo app'],
  ['(auto-download) → Ammu.', '(auto-download) → aplikasi.'],

  // Istilah dalam teks & komentar
  ['Mulai Tagih di AMMU', 'Mulai Tagih di Aplikasi'],
  ['Ammu Desktop', 'aplikasi Desktop'],
  ['tagihan di AMMU', 'tagihan di aplikasi'],
  ['memakai AMMU', 'memakai aplikasi'],
  ['setelan AMMU', 'setelan aplikasi'],
  ['MILIK AMMU', 'MILIK APLIKASI'],
  ['shift AMMU', 'shift aplikasi'],
  ['Ammu Channel', 'kanal informasi'],
  ['Ammu Online', 'Waseela'],
  ['Portal MU', 'Waseela']
]

// ── supabase (edge functions + migrations) + tests ──────────────────────────
export const RULES_BACKEND = [
  // Tata letak: hulu menaruh app Vue di `vue-app/`, Waseela di `app/`.
  // Tanpa ini, tiap sync mengembalikan impor tes ke folder yang tak ada.
  ["'../../vue-app/", "'../../app/"],
  ['vue-app/src/', 'app/src/'],
  ['vue-app/electron/', 'app/electron/'],
  ["path.join(dir, 'vue-app', 'src')", "path.join(dir, 'app', 'src')"],
  ["path.join(AKAR, 'vue-app', 'src'", "path.join(AKAR, 'app', 'src'"],
  ['(yang memuat vue-app/src)', '(yang memuat app/src)'],

  // Kepala berkas (spesifik dulu — aturan generik 'Ammu Online'→'Waseela' di bawah
  // hanya menyapu separuhnya dan menyisakan nama pesantrennya).
  ['Ammu Online (SINGLE-TENANT, Pondok Mambaul Ulum)', 'Waseela (SINGLE-TENANT, satu lembaga per project)'],
  ['# Supabase config — Waseela (SINGLE-TENANT, satu lembaga per project).', '# Supabase config — Waseela (SINGLE-TENANT, satu lembaga per project).'],

  ['ammu_provisioned', 'waseela_provisioned'], // penanda app_metadata — gerbang trigger
  ['@ammu.local', '@waseela.local'],
  ['mu_auth_', 'wsl_auth_'],
  ["row.judul || 'Mambaul Ulum'", "row.judul || 'Waseela'"],
  ['MambaulUlumBot/1.0; +https://almanshur.id', 'WaseelaBot/1.0'],
  ['Gerbang "Mulai Tagih di AMMU"', 'Gerbang "Mulai Tagih di Aplikasi"'],
  ['mulai memakai AMMU', 'mulai memakai aplikasi'],
  ['settings AMMU', 'settings aplikasi'],
  ['MILIK AMMU', 'MILIK APLIKASI'],
  ['shift AMMU', 'shift aplikasi'],
  ['AMMU Desktop', 'aplikasi Desktop'],
  ['Ammu Desktop', 'aplikasi Desktop'],
  ['Ammu Online', 'Waseela']
]

/** Regex gerbang audit — apa pun yang cocok = white-label belum tuntas. */
export const POLA_JEJAK = /ammu|mambaul|manba'ul|al\s*manshur|almanshur|portal[-\s]?mu\b|portalMu/i

/** Terapkan satu set aturan ke sebuah string. */
export function terapkan(teks, rules) {
  let out = teks
  for (const [cari, ganti] of rules) {
    out = cari instanceof RegExp ? out.replace(cari, ganti) : out.split(cari).join(ganti)
  }
  return out
}

/** Sisipkan import BRAND setelah baris import terakhir bila berkas mulai memakainya. */
export function pastikanImportBrand(teks, isVue) {
  if (!/\bBRAND\./.test(teks)) return teks
  if (/from ['"]@\/config\/brand['"]/.test(teks)) return teks
  const lines = teks.split('\n')
  let last = -1
  let inScript = !isVue
  for (let i = 0; i < lines.length; i++) {
    if (isVue && /^\s*<script/.test(lines[i])) inScript = true
    if (inScript && /^\s*import .*from ['"].*['"]/.test(lines[i])) last = i
  }
  if (last === -1) return null // tak ada blok import → perlu tangan
  lines.splice(last + 1, 0, BRAND_IMPORT)
  return lines.join('\n')
}
