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

// Baseline = sidik jari saat sync terakhir. DUA nilai per berkas:
//   hulu — sidik jari isi MENTAH berkas hulu. Untuk berkas MILIK_WASEELA: tanpa ini
//          mereka dilaporkan "berubah" selamanya (versi kita memang beda permanen dari
//          hulu), sehingga perubahan hulu yang sungguhan ikut tenggelam.
//   kita — sidik jari isi yang DITULIS SYNC. Inilah pengaman utamanya: kalau berkas di
//          working tree tak lagi cocok dengannya, berarti ada yang mengeditnya lokal
//          sesudah sync terakhir → JANGAN ditimpa, laporkan.
//
// KENAPA `kita` ADA (1 Sep 2026). Sebelumnya satu-satunya pengaman adalah daftar tangan
// MILIK_WASEELA. Daftar itu hanya memuat divergensi yang tercatat saat re-fork 8 Agu;
// tiga minggu kerja lokal sesudahnya tak pernah didaftarkan, dan sync menimpanya diam-diam
// — termasuk MEMBATALKAN pengerasan gagal-tertutup pada dua edge function yang dipanggil
// publik (`if (!CRON_SECRET) return false` kembali jadi `return true`), dan perbaikan POS
// 15 Agu. Tes tetap hijau: yang diuji util murninya, bukan perangkaiannya. Gerbang teks
// pun diam: yang hilang bukan kata "ammu".
//
// Pelajarannya: pengaman yang bergantung pada INGATAN pasti gagal. `kita` menutup celah
// itu untuk SEMUA berkas — MILIK_WASEELA kini tinggal dokumentasi ALASAN, bukan pagar.
const BASELINE_PATH = resolve(ROOT, 'scripts', '.sync-baseline.json')
const baselineMentah = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}
// Bentuk lama: { path: "<sha hulu>" }. Bentuk baru: { path: { hulu, kita } }.
const baseline = {}
for (const [k, v] of Object.entries(baselineMentah)) {
  baseline[k] = typeof v === 'string' ? { hulu: v } : v
}
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
  // Latar layar login. Versi hulu adalah FOTO bangunan & santri pesantren lain,
  // tersandi base64 sehingga lolos SEMUA audit teks — ketahuannya cuma lewat
  // cek-kebocoran (pembanding byte). Waseela memakai gradasi merek; gradasi tak
  // pernah bisa jadi "tempat milik orang lain". Sekelas muassis.png: JANGAN ditarik.
  /assets[\\/]loginBg\.js$/,
  /\.broken\.bak$/,
  /utils[\\/]kopMuassis\.js$/, // versi Waseela config-driven
  /services[\\/]firebase\.js$/, // config Firebase Waseela
  /config[\\/]brand\.js$/,
  /functions[\\/]bmt-webhook[\\/]/, // integrasi BMT tak dipakai
  /utils[\\/]bmtVa\.js$/, // fitur Virtual Account DIBUANG v.1.0.1 (Kyai, 13 Agu 2026)
  /tests[\\/]unit[\\/]escapeHtml\.test\.js$/, // menguji helper legacy pra-Vue
  /tests[\\/]unit[\\/]extractFirstLink\.test\.js$/
,
  // Fitur TES SEKOLAH tak dipakai pembeli (Kyai, 1 Sep 2026). Berkas intinya tak pernah
  // ada di Waseela; kalau ikut tertarik ia menyeret tabel `tes_sekolah` + migrasinya, dan
  // halaman yang menunjuk tabel yang tak ada di Supabase pembeli. Empat berkas yang
  // MEMANGGILNYA ada di MILIK_WASEELA (berkasnya sendiri tetap dipakai), bukan di sini.
  /components[\\/]TesModeSwitch\.vue$/,
  /composables[\\/]useTesSekolah\.js$/,
  /utils[\\/]tesSekolah\.js$/,
  /views[\\/]MateriTesKelolaView\.vue$/,
  /views[\\/]TesSekolahView\.vue$/,
  /tests[\\/]unit[\\/]tesSekolah\.test\.js$/,
  /migrations[\\/]20260812130000_tes_sekolah\.sql$/
]

// MILIK WASEELA — berkas yang sudah berdivergensi STRUKTURAL dari hulu (bukan sekadar
// ganti kata): kop config-driven, branding runtime, PSB per-lembaga, dsb. Sync TIDAK
// menimpanya. Kalau hulu mengubahnya, skrip melaporkan supaya kamu menggabung sendiri.
//
// Menyusut seiring waktu: kalau sebuah berkas ternyata bisa diurus aturan, buang dari sini.
const MILIK_WASEELA = [
  'app/src/services/supabase.js', // terima ANON_KEY *atau* PUBLISHABLE_KEY
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
  // Fitur Virtual Account (BMT) DIBUANG v.1.0.1 — bukan sekadar ganti kata: satu langkah
  // alur bayar, satu seksi pengaturan, dan satu koleksi ikut hilang. Kalau berkas-berkas
  // ini ditarik ulang dari hulu, VA-nya HIDUP LAGI diam-diam (tabelnya sudah di-DROP,
  // jadi wali akan melihat galat, bukan sekadar fitur tak terpakai).
  'app/src/views/PembayaranView.vue', // langkah VA + keranjang niat-bayar
  'app/src/views/TabunganView.vue', // badge sumber 'bmt_va'
  'app/src/utils/metodeBayar.js', // sumber transfer: VA dibuang, nilai lama tetap dikenali
  'app/src/services/db.js', // koleksi keuangan_va_intent dibuang dari COLS + realtime
  // Impor absensi kini menerima LOG MENTAH mesin (Solution X609 dkk) lewat utils/scanMesin.
  'app/src/views/AbsensiGuruView.vue',
  'app/src/composables/useExcel.js', // hulu tanpa blok import + parser CSV/TSV Waseela
  'app/src/composables/useLocalNotif.js',
  'app/src/composables/useFingerprintSync.js',
  // Sinkron mesin punya TIGA sumber di Waseela (2 Sep 2026), hulu hanya punya satu:
  //   fingerspot → baca folder Personnel (sama dengan hulu)
  //   solution   → tarik LANGSUNG dari mesin lewat TCP 4370 (app/electron/src/solution-sync.ts)
  //   attmdb     → baca att2000.mdb Attendance Management (app/electron/src/att-mdb-sync.ts)
  // Store menyimpan merek + setelan tiap jalur; composable memilih bridge-nya lewat tabel
  // JALUR. Ditarik ulang dari hulu = dua jalur non-Fingerspot hilang diam-diam dan pembeli
  // kembali ke impor berkas manual.
  // Berkas .ts-nya sendiri aman tanpa didaftarkan di sini — sync memang tak menyentuh
  // electron/ (lihat kepala berkas), yang rapuh justru sisi app/src ini.
  'app/src/stores/fingerprint.js',
  'app/src/composables/useMenus.js',
  'app/src/composables/useRibbonNav.js',
  'app/src/utils/kenaikan.js',
  'app/src/utils/raporPdf.js',
  'app/src/utils/unduhan.js', // nama artefak rilis

  // Dua regresi NYATA yang lolos ke working tree saat sync 1 Sep 2026 — keduanya
  // perbaikan lokal yang dibuat SESUDAH sync terakhir, jadi belum pernah dilindungi:
  //
  //  * gedung.js — hulu mengisi DEFAULT_GEDUNG dengan nama gedung LEMBAGANYA SENDIRI,
  //    dan memakai `arr.length ? arr : DEFAULT` sehingga gedung terakhir mustahil
  //    dihapus (begitu kosong, bawaan muncul lagi). Waseela mengosongkan daftarnya dan
  //    menghormati array kosong. Ini divergensi PERILAKU, tak bisa diungkapkan aturan
  //    teks. Kebocorannya lolos gerbang POLA_JEJAK karena bentuknya bukan kata "ammu" —
  //    yang menangkapnya justru tes penjaga tests/unit/gedungDaftarKosong.test.js.
  //
  //  * metodeBayar.test.js — versi hulu menguji sumber VA (`va_bmt`) yang SUDAH DIBUANG
  //
  //  * santriIdentitas.test.js — fixture alamatnya di hulu memakai ALAMAT ASLI lembaga
  //    hulu (dusun/desa/kecamatan/kabupaten). Waseela sudah menetralkannya sekali;
  //    sync 1 Sep 2026 mengembalikannya dan cek-kebocoran menandainya lagi.
  'tests/unit/santriIdentitas.test.js',

  // ── Divergensi yang ditemukan saat audit sync 1 Sep 2026 ──────────────────────
  // Semuanya sempat DITIMPA sync hari itu. Yang menangkap bukan tes dan bukan gerbang
  // teks, melainkan pembandingan berkas-per-berkas terhadap hulu. Sejak `kita` ada di
  // baseline, kejadian serupa mustahil terulang diam-diam — daftar ini menyimpan
  // ALASANNYA, supaya penerus tahu kenapa berkas-berkas ini memang beda.
  //
  //  * Dua edge function: Waseela mengeraskan `cronAuthorized` jadi GAGAL-TERTUTUP
  //    (audit A4, 11 Agu 2026) — tanpa CRON_SECRET fungsi MENOLAK semua. Hulu masih
  //    `if (!CRON_SECRET) return true`. Keduanya di-deploy --no-verify-jwt alias bisa
  //    dipanggil siapa pun dari internet, jadi menariknya ulang = membuka endpoint yang
  //    MENERBITKAN TAGIHAN dan MENGURAS notif_queue. JANGAN PERNAH ditimpa hulu.
  'supabase/functions/dispatch-push/index.ts',
  'supabase/functions/auto-generate-tagihan/index.ts',
  //
  //  * ModalPOS + TagihanView: perbaikan Kyai 15 Agu 2026 — tagihan terbit bisa
  //    dibetulkan, dan tagihan jenis manual tak lagi hilang dari POS. Perangkaiannya
  //    memanggil utils/posBarisTagihan.js (milik Waseela). Ditimpa = util itu jadi
  //    YATIM sementara tesnya tetap hijau — tes menguji util murninya, bukan layarnya.
  'app/src/components/pos/ModalPOS.vue',
  'app/src/views/TagihanView.vue',
  //
  //  * authSupabase: audit A2 (11 Agu 2026) membuang lazy-create akun saat pendaftaran
  //    mandiri dimatikan — akun hanya lahir lewat provision-akun (service-role).
  'app/src/services/authSupabase.js',
  //
  //  * Sisa Virtual Account (dibuang v.1.0.1). Komentar & fixture yang menyebut VA/BMT.
  //    Sengaja TIDAK dijadikan aturan teks: tambalannya lintas-baris dan rapuh, sedang
  //    isinya cuma komentar — aturan rapuh lebih mahal daripada dua baris di daftar ini.
  'app/src/utils/nisGenerator.js',
  'app/src/utils/tagihan.js',
  'tests/unit/dbUpdateOne.test.js',
  //    di v.1.0.1. Versi Waseela mengujinya dari sisi lain: nilai lama tetap dibaca
  //    Transfer, bukan Tunai. Pasangan wajib dari metodeBayar.js yang sudah di sini.
  'app/src/utils/gedung.js',
  'tests/unit/metodeBayar.test.js',

  // Jenjang Pra PTPT dinamai jumlah juz (keputusan Kyai, 8 Agu 2026) — hulu masih
  // memakai 'Level 1'..'Level 5' di kelas penempatan. Dua berkas ini sepasang:
  // nama jenjangnya di useLembaga, aturan urutannya (½=5, 1½=15) di santriSort.
  'app/src/composables/useLembaga.js',
  'app/src/utils/santriSort.js',

  // Secret webhook mesin absensi dibaca dari settings/mesin (bisa diatur pembeli dari
  // app), env HIVIEW_PUSH_SECRET tinggal cadangan. Hulu masih env-only.
  'supabase/functions/hiview-absen/index.ts',

  // VAPID key pindah ke config/brand.js (terikat project Firebase). Di hulu masih
  // ter-hardcode milik project mereka — kalau tertarik lagi, web push balik 401.
  'app/src/composables/usePushNotifications.js',

  // Tes yang diarahkan ulang ke penerus di app/src (hulu menunjuk helper legacy pra-Vue
  // `src/helpers.js` yang tak ikut ke Waseela) atau yang ekspektasinya khas Waseela.
  'tests/unit/_toAuthPassword.test.js',
  'tests/unit/buildAuthEmail.test.js',
  'tests/unit/formatTanggal.test.js',
  'tests/unit/toTitleCase.test.js',
  'tests/unit/hitungUsiaPadaTanggal.test.js',
  'tests/unit/unduhanRilis.test.js', // nama artefak rilis Waseela
  'tests/unit/putusanPembaruan.test.js',

  // Perangkai TES SEKOLAH (Kyai, 1 Sep 2026 — fitur tak ditarik). Diperiksa satu per satu:
  // sejak baseline 8 Agu 2026 keempatnya HANYA berubah oleh commit tes-sekolah, jadi tak
  // ada perbaikan lain yang hilang. Kalau ditarik apa adanya, mereka meng-import berkas
  // yang sengaja tak ada → build Vite GAGAL, bukan sekadar fitur yang mati diam-diam.
  'app/src/router/index.js', // +2 route ke TesSekolahView & MateriTesKelolaView
  'app/src/views/TesKenaikanView.vue', // saklar Qiraati/Sekolah (TesModeSwitch)
  'app/src/views/MasterDataView.vue', // kartu master Materi Tes
  'app/src/views/CapaianPrestasiView.vue' // blok "Catatan Tes Sekolah" di akun santri
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
const divergensiLokal = []

for (const [dariRel, keRel, ext, rules, brand] of PETA) {
  const dariDir = resolve(HULU, dariRel)
  const keDir = resolve(ROOT, keRel)
  for (const src of walk(dariDir, ext)) {
    const rel = relative(dariDir, src)
    if (ABAIKAN.some((re) => re.test(rel) || re.test(src))) continue
    const dst = resolve(keDir, rel)
    const relRepo = relative(ROOT, dst).split('\\').join('/')

    const mentah = lf(readFileSync(src, "utf8"))
    const huluSha = sha(mentah)
    const lama = baseline[relRepo] || null
    baselineBaru[relRepo] = { hulu: huluSha }

    // Berkas milik Waseela: JANGAN sentuh. Laporkan hanya bila HULU-nya yang berubah
    // sejak sync terakhir (bandingkan sidik jari hulu, bukan isi berkas kita).
    if (MILIK_WASEELA.includes(relRepo)) {
      if (lama && lama.hulu && lama.hulu !== huluSha) milikBerubah.push(relRepo)
      else if (!lama) belumBerbaseline.push(relRepo)
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

    if (!existsSync(dst)) {
      baru.push(relRepo)
      if (!DRY) {
        mkdirSync(dirname(dst), { recursive: true })
        writeFileSync(dst, isi)
        baselineBaru[relRepo].kita = sha(isi)
      }
      continue
    }

    const kini = lf(readFileSync(dst, "utf8"))
    if (kini === isi) {
      // sudah seusia hulu — catat sidik jarinya supaya edit lokal BERIKUTNYA terdeteksi
      baselineBaru[relRepo].kita = sha(isi)
      continue
    }

    // Beda. Apakah isinya persis yang ditulis sync terakhir (belum tersentuh)? → aman ditimpa.
    if (lama && lama.kita && sha(kini) === lama.kita) {
      beda.push(relRepo)
      if (!DRY) {
        writeFileSync(dst, isi)
        baselineBaru[relRepo].kita = sha(isi)
      }
      continue
    }

    // Sampai sini: isinya beda DAN bukan hasil tulisan sync terakhir → ada kerja lokal di
    // dalamnya. GAGAL-AMAN: jangan pernah menimpa. Baseline lama dipertahankan apa adanya
    // supaya penanda "hulu juga berubah" tetap benar sampai berkasnya benar-benar digabung.
    divergensiLokal.push({
      f: relRepo,
      huluBerubah: !!(lama && lama.hulu && lama.hulu !== huluSha)
    })
    if (lama) baselineBaru[relRepo] = { ...lama }
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
if (divergensiLokal.length) {
  console.log(`  ⛔ TAK DITIMPA — ada kerja lokal di dalamnya (${divergensiLokal.length}):`)
  for (const d of divergensiLokal) {
    const ket = d.huluBerubah
      ? '   (hulu juga berubah → gabung tiga-arah)'
      : '   (hulu tak berubah → tak ada yang perlu ditarik)'
    console.log('    ! ' + d.f + ket)
  }
  console.log('    Isinya beda dari hasil sync terakhir, jadi seseorang mengeditnya di sini.')
  console.log('    Menimpanya = membatalkan kerja itu diam-diam, dan tes belum tentu merah.')
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
if (!baru.length && !beda.length && !milikBerubah.length && !divergensiLokal.length) {
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
