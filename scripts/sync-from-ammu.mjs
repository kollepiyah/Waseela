#!/usr/bin/env node
// ============================================================================
// sync-from-ammu — tarik fitur baru dari repo asal, SATU ARAH.
//
//   node scripts/sync-from-ammu.mjs --dry    (lihat apa yang akan berubah)
//   node scripts/sync-from-ammu.mjs          (salin + white-label + gerbang + tes)
//
// ── SATU ARAH, TITIK ────────────────────────────────────────────────────────
// Repo asal HANYA DIBACA. Skrip ini tak pernah menulis, menghapus, atau menjalankan
// perintah git di sana. Jangan pernah menambahkan jalur tulis-balik.
//
// ── KENAPA SEKARANG MURAH ───────────────────────────────────────────────────
// Sesudah re-fork, arsitektur Waseela IDENTIK dengan hulu (Supabase, single-tenant,
// tata letak berkas sama). Jadi sync = salin berkas berubah + terapkan ulang aturan
// white-label. Bukan lagi proyek re-arsitektur.
//
// Yang DISYNC : app/src, tests, supabase/migrations, supabase/functions
// Yang TIDAK  : public/, index.html, android/, electron/, konfigurasi build —
//               cangkang yang sudah di-brand sekali dan jarang berubah di hulu.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, relative, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { EXT_SRC, EXT_BACKEND, RULES_SRC, RULES_BACKEND, terapkan, pastikanImportBrand } from './whitelabel-rules.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HULU = process.env.AMMU_REPO || resolve(ROOT, '..', 'Portal MU')
const DRY = process.argv.includes('--dry')
const lf = (s) => s.split('\r\n').join('\n') // repo ini LF (lihat .gitattributes)
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

// Baseline = sidik jari berkas HULU saat sync terakhir. Dipakai KHUSUS untuk berkas
// MILIK_WASEELA: tanpa ini mereka dilaporkan "berubah" selamanya (versi kita memang
// beda permanen dari hulu), sehingga perubahan hulu yang sungguhan ikut tenggelam.
const BASELINE_PATH = resolve(ROOT, 'scripts', '.sync-baseline.json')
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}
const baselineBaru = {}

if (!existsSync(HULU)) {
  console.error(`[sync] ✗ Repo asal tak ketemu: ${HULU}`)
  console.error('        Set AMMU_REPO=<path> bila lokasinya lain.')
  process.exit(1)
}

// [dari (relatif HULU), ke (relatif ROOT), ekstensi, aturan, sisip import BRAND?]
const PETA = [
  ['vue-app/src', 'app/src', EXT_SRC, RULES_SRC, true],
  ['tests', 'tests', /\.js$/, RULES_BACKEND, false],
  ['supabase/migrations', 'supabase/migrations', EXT_BACKEND, RULES_BACKEND, false],
  ['supabase/functions', 'supabase/functions', EXT_BACKEND, RULES_BACKEND, false]
]

// TAK PERNAH ditarik: identitas lembaga lain, kode yang sudah diganti, fitur tak dipakai.
const ABAIKAN = [
  /assets[\\/]muassis\.png$/,
  /\.broken\.bak$/,
  /utils[\\/]kopMuassis\.js$/, // versi Waseela config-driven
  /services[\\/]firebase\.js$/, // config Firebase Waseela
  /config[\\/]brand\.js$/,
  /functions[\\/]bmt-webhook[\\/]/, // integrasi BMT tak dipakai
  /tests[\\/]unit[\\/]escapeHtml\.test\.js$/, // menguji helper legacy pra-Vue
  /tests[\\/]unit[\\/]extractFirstLink\.test\.js$/
]

// MILIK WASEELA — berkas yang sudah berdivergensi STRUKTURAL dari hulu (bukan sekadar
// ganti kata): kop config-driven, branding runtime, PSB per-lembaga, dsb. Sync TIDAK
// menimpanya. Kalau hulu mengubahnya, skrip melaporkan supaya kamu menggabung sendiri.
//
// Menyusut seiring waktu: kalau sebuah berkas ternyata bisa diurus aturan, buang dari sini.
const MILIK_WASEELA = [
  'app/src/stores/settings.js', // DEFAULT_SETTINGS + watch setKopImage
  'app/src/main.js', // release Sentry
  'app/src/views/LoginView.vue', // judul & motto dari settings
  'app/src/views/RaporView.vue', // kop: gambar → fallback teks
  'app/src/views/PpdbFormView.vue', // URL PSB per-lembaga
  'app/src/views/PpdbAdminView.vue',
  'app/src/views/BantuanView.vue',
  'app/src/views/DashboardView.vue',
  'app/src/views/PengaturanView.vue',
  'app/src/views/PengaturanKeuanganView.vue',
  'app/src/views/MesinAbsensiView.vue',
  'app/src/views/profil/ProfilAdmin.vue',
  'app/src/components/posts/PostCard.vue', // nama lembaga dari settings
  'app/src/components/layout/AppSidebar.vue', // hak cipta + versi
  'app/src/components/ribbon/RibbonBackstage.vue',
  'app/src/components/ribbon/RibbonStatusBar.vue',
  'app/src/composables/useExcel.js', // hulu tanpa blok import
  'app/src/composables/useLocalNotif.js',
  'app/src/composables/useFingerprintSync.js',
  'app/src/composables/useMenus.js',
  'app/src/composables/useRibbonNav.js',
  'app/src/utils/kenaikan.js',
  'app/src/utils/raporPdf.js',
  'app/src/utils/unduhan.js', // nama artefak rilis

  // Tes yang diarahkan ulang ke penerus di app/src (hulu menunjuk helper legacy pra-Vue
  // `src/helpers.js` yang tak ikut ke Waseela) atau yang ekspektasinya khas Waseela.
  'tests/unit/_toAuthPassword.test.js',
  'tests/unit/buildAuthEmail.test.js',
  'tests/unit/formatTanggal.test.js',
  'tests/unit/toTitleCase.test.js',
  'tests/unit/hitungUsiaPadaTanggal.test.js',
  'tests/unit/unduhanRilis.test.js', // nama artefak rilis Waseela
  'tests/unit/putusanPembaruan.test.js'
]

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, ext, out)
    else if (ext.test(p)) out.push(p)
  }
  return out
}

const baru = []
const beda = []
const milikBerubah = []
const belumBerbaseline = []
const perluTangan = []

for (const [dariRel, keRel, ext, rules, brand] of PETA) {
  const dariDir = resolve(HULU, dariRel)
  const keDir = resolve(ROOT, keRel)
  for (const src of walk(dariDir, ext)) {
    const rel = relative(dariDir, src)
    if (ABAIKAN.some((re) => re.test(rel) || re.test(src))) continue
    const dst = resolve(keDir, rel)
    const relRepo = relative(ROOT, dst).split('\\').join('/')

    const mentah = lf(readFileSync(src, 'utf8'))
    baselineBaru[relRepo] = sha(mentah)

    // Berkas milik Waseela: JANGAN sentuh. Laporkan hanya bila HULU-nya yang berubah
    // sejak sync terakhir (bandingkan sidik jari hulu, bukan isi berkas kita).
    if (MILIK_WASEELA.includes(relRepo)) {
      if (baseline[relRepo] && baseline[relRepo] !== baselineBaru[relRepo]) milikBerubah.push(relRepo)
      else if (!baseline[relRepo]) belumBerbaseline.push(relRepo)
      continue
    }

    // White-label DULU, baru bandingkan — supaya berkas yang cuma beda karena
    // white-label tidak terus dilaporkan "berubah" tiap sync.
    let isi = terapkan(mentah, rules)
    if (brand) {
      const withImport = pastikanImportBrand(isi, dst.endsWith('.vue'))
      if (withImport === null) {
        // Memakai BRAND tapi hulu tak punya blok import → JANGAN tulis (berkas rusak).
        perluTangan.push(relRepo)
        continue
      }
      isi = withImport
    }

    const ada = existsSync(dst)
    if (ada && lf(readFileSync(dst, 'utf8')) === isi) continue
    ;(ada ? beda : baru).push(relRepo)
    if (!DRY) {
      mkdirSync(dirname(dst), { recursive: true })
      writeFileSync(dst, isi)
    }
  }
}

console.log('\n═══ sync-from-ammu' + (DRY ? ' (dry run)' : '') + ' ═══')
console.log(`  Hulu (baca-saja): ${HULU}\n`)
if (baru.length) {
  console.log(`  BARU (${baru.length}):`)
  baru.forEach((f) => console.log('    + ' + f))
  console.log('')
}
if (beda.length) {
  console.log(`  DIPERBARUI (${beda.length}):`)
  beda.forEach((f) => console.log('    ~ ' + f))
  console.log('')
}
if (milikBerubah.length) {
  console.log(`  ⚠ HULU BERUBAH pada berkas MILIK WASEELA (${milikBerubah.length}) — gabung manual:`)
  milikBerubah.forEach((f) => console.log('    ! ' + f))
  console.log('    Bandingkan sendiri, mis.:')
  console.log(`      diff "${HULU}/vue-app/src/stores/settings.js" app/src/stores/settings.js\n`)
}
if (perluTangan.length) {
  console.log(`  ⚠ PERLU TANGAN — memakai BRAND tapi hulu tak punya blok import (${perluTangan.length}):`)
  perluTangan.forEach((f) => console.log('    ' + f))
  console.log('')
}
if (belumBerbaseline.length) {
  console.log(`  (baseline hulu dicatat untuk ${belumBerbaseline.length} berkas milik Waseela —`)
  console.log('   mulai sync berikutnya hanya perubahan hulu yang sungguhan yang dilaporkan)\n')
}
if (!baru.length && !beda.length && !milikBerubah.length) {
  console.log('  Sudah seusia hulu — tak ada yang perlu ditarik.\n')
}
if (DRY) {
  console.log('  (dry run — tak ada berkas / baseline yang ditulis)\n')
  process.exit(0)
}

// Catat sidik jari hulu SEKARANG, termasuk saat tak ada yang ditarik — supaya
// laporan "hulu berubah" berikutnya benar-benar berarti.
writeFileSync(BASELINE_PATH, JSON.stringify(baselineBaru, null, 2) + '\n')

if (!baru.length && !beda.length) process.exit(0)

console.log('─── gerbang white-label ───')
try {
  execSync('node scripts/whitelabel.mjs --audit', { cwd: ROOT, stdio: 'inherit' })
} catch {
  console.error('\n  ✗ Gerbang GAGAL. Tambahkan aturannya di scripts/whitelabel-rules.mjs,')
  console.error('    lalu jalankan `node scripts/whitelabel.mjs`. JANGAN tambal berkasnya langsung.\n')
  process.exit(1)
}

console.log('─── tes ───')
try {
  execSync('npm test', { cwd: ROOT, stdio: 'inherit' })
} catch {
  console.error('\n  ✗ Tes GAGAL sesudah sync — periksa sebelum commit.\n')
  process.exit(1)
}

console.log('\n  ✓ Sync selesai: gerbang lulus, tes hijau.')
console.log('  Berikutnya: `npm run build`, lalu uji di peramban sebelum rilis.\n')
