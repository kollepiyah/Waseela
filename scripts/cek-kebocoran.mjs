#!/usr/bin/env node
// ============================================================================
// cek-kebocoran — cari sisa identitas repo HULU dengan MEMBANDINGKAN, bukan mencari kata.
//
//   node scripts/cek-kebocoran.mjs
//
// ── KENAPA ADA (tiga kebocoran yang lolos gerbang teks) ─────────────────────
// `whitelabel.mjs` mencari kata "ammu"/"mambaul". Tiga kebocoran nyata lolos karena
// bentuknya BUKAN kata:
//   1. ref project Supabase hulu ter-bundel  → `rzwefjilxzsqlokkwiyt`, huruf acak
//   2. latar layar login                     → FOTO pesantren lain, tersandi base64
//   3. VAPID key web push                    → kunci acak milik project hulu
// Ditambah `firebase.json` (CSP) yang luput karena letaknya di ROOT, di luar pindaian.
//
// Pemeriksa ini bekerja terbalik: PANEN nilai identitas dari repo hulu, lalu cari
// nilai-nilai itu di repo kita. Tak perlu menebak bentuknya — kalau hulu punya dan
// kita punya juga, itu kebocoran. Daftarnya ikut berubah sendiri kalau hulu berubah.
//
// Lapis kedua: bandingkan ASET MEREK byte-per-byte. Gambar tak punya kata untuk dicari.
// ============================================================================
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { resolve, dirname, relative, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HULU = process.env.AMMU_REPO || resolve(ROOT, '..', 'Portal MU')

if (!existsSync(HULU)) {
  console.log('\n═══ cek-kebocoran ═══\n')
  console.log(`  · Repo hulu tak ada di ${HULU} — pemeriksaan dilewati.`)
  console.log('    (Set AMMU_REPO bila lokasinya lain. Di CI tanpa repo hulu, ini wajar.)\n')
  process.exit(0)
}

// ── 1. Panen nilai identitas milik hulu ─────────────────────────────────────
const nilaiHulu = new Map() // nilai -> keterangan asal

function panen(berkasRel, pola, keterangan, minLen = 8) {
  const p = resolve(HULU, berkasRel)
  if (!existsSync(p)) return
  const teks = readFileSync(p, 'utf8')
  for (const m of teks.matchAll(pola)) {
    const v = (m[1] || m[0]).trim()
    if (v.length >= minLen && !nilaiHulu.has(v)) nilaiHulu.set(v, keterangan)
  }
}

// Ref project Supabase
panen('supabase/config.toml', /project_id\s*=\s*"([a-z0-9]{20})"/g, 'ref project Supabase hulu')
// Seluruh nilai di dalam firebaseConfig (apiKey, projectId, senderId, appId, dst)
panen(
  'vue-app/src/services/firebase.js',
  /(?:apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId):\s*'([^']+)'/g,
  'nilai firebaseConfig hulu'
)
// VAPID key web push (kunci base64url panjang)
panen('vue-app/src/composables/usePushNotifications.js', /'(B[A-Za-z0-9_-]{40,})'/g, 'VAPID key hulu')
// Alamat, telepon, dan kota lembaga hulu — ketiganya ikut TERCETAK di kop rapor,
// dan tak satu pun memuat kata "ammu"/"mambaul" sehingga gerbang teks buta padanya.
panen('vue-app/src/utils/raporPdf.js', /'(Jl\.[^']{10,})'/g, 'alamat lembaga hulu')
panen('vue-app/src/utils/raporPdf.js', /'(Telp\.[^']{6,})'/g, 'telepon lembaga hulu')
panen('vue-app/src/utils/raporPdf.js', /settings\.kota \|\| '([^']+)'/g, 'kota lembaga hulu', 4)

// Domain hosting + repo rilis milik hulu
for (const f of [
  'vue-app/src/utils/unduhan.js',
  'vue-app/public/app-version.json',
  'vue-app/index.html',
  'vue-app/src/composables/useAndroidUpdate.js'
]) {
  panen(f, /https:\/\/([a-z0-9-]+\.(?:web\.app|firebaseapp\.com))/g, 'domain hosting hulu')
  panen(f, /github\.com\/([A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)/g, 'repo rilis hulu')
}

// ── 2. Pindai repo kita — TERMASUK berkas konfigurasi di ROOT ───────────────
// `scripts/` SENGAJA tak dipindai: berkas aturan white-label memang HARUS memuat
// nilai-nilai hulu — itulah yang dicari-dan-diganti. Memindainya = positif palsu abadi.
const AREA_TEKS = [
  'app/src', 'app/public', 'app/dist', 'supabase', 'tests',
  'app/android/app/src/main', 'app/electron/src', 'app/electron/build'
]
const BERKAS_ROOT = [
  'firebase.json', '.firebaserc', 'package.json', 'app/package.json',
  'app/index.html', 'app/vite.config.js', 'app/capacitor.config.json',
  'app/tailwind.config.js', 'app/android/app/build.gradle', 'app/electron/package.json',
  // PLAYSTORE-LISTING.md ikut dipindai karena isinya DITAKDIRKAN TERBIT: teksnya
  // ditempel apa adanya ke halaman Play Store. Kebocoran di sana bukan sekadar ada di
  // repo — ia tayang ke publik.
  //
  // ⚠️ Dokumen root LAIN sengaja TIDAK didaftarkan. HANDOVER.md (17 kemunculan),
  // README.md (3), dan AUDIT-AGU-2026.md (1) memang HARUS menyebut nilai hulu — itu
  // dokumen rekayasa yang justru menjelaskan cara kebocoran terjadi dan cara sync
  // bekerja. Memindainya = positif palsu abadi, dan gerbang yang selalu merah akan
  // diabaikan orang. Alasan yang sama dengan `scripts/` di komentar atas.
  //
  // Aturan pembeda: berkas yang ISINYA DISALIN KELUAR (listing, halaman publik,
  // teks yang dilihat pembeli) WAJIB dipindai. Berkas yang hanya dibaca pengembang
  // di dalam repo, tidak.
  'PLAYSTORE-LISTING.md'
]
const EXT_TEKS = /\.(js|mjs|cjs|ts|vue|css|json|html|md|sql|toml|xml|txt|webmanifest|gradle|properties|java)$/
const LEWATI = /[\\/](node_modules|\.git|fonts)[\\/]/

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (LEWATI.test(p)) continue
    if (statSync(p).isDirectory()) walk(p, ext, out)
    else if (ext.test(p)) out.push(p)
  }
  return out
}

const berkasTeks = [
  ...AREA_TEKS.flatMap((d) => walk(resolve(ROOT, d), EXT_TEKS)),
  ...BERKAS_ROOT.map((f) => resolve(ROOT, f)).filter(existsSync)
]

const bocor = []
for (const p of berkasTeks) {
  const teks = readFileSync(p, 'utf8')
  for (const [nilai, asal] of nilaiHulu) {
    if (teks.includes(nilai)) {
      bocor.push({ berkas: relative(ROOT, p).split('\\').join('/'), nilai, asal })
    }
  }
}

// ── 3. Aset merek: bandingkan BYTE dengan padanannya di hulu ────────────────
// Gambar tak punya kata untuk dicari. Latar login pun sempat lolos karena berupa
// foto yang tersandi base64 di dalam berkas .js.
//
// Kembar = MENCURIGAKAN hanya untuk aset MEREK. Kode identik itu wajar (memang
// hasil fork) — karena itu cakupannya dibatasi ke berkas yang membawa rupa.
// XML sengaja DILUAR cakupan: drawable XML itu definisi bentuk & warna (kode), bukan
// rupa. Warna merek di dalamnya sudah dijaga pemetaan warna + gerbang teks.
const PETA_ASET = [
  ['vue-app/src/assets', 'app/src/assets', /\.(png|jpg|jpeg|webp|svg|ico|js)$/],
  ['vue-app/public', 'app/public', /\.(png|jpg|jpeg|webp|svg|ico|webmanifest)$/],
  ['vue-app/electron/assets', 'app/electron/assets', /\.(png|ico)$/],
  ['vue-app/android/app/src/main/res', 'app/android/app/src/main/res', /\.png$/]
]
// Pengecualian yang SUDAH DIPERIKSA satu per satu — bukan ambang yang menebak.
// (Ambang ukuran/warna pernah dipertimbangkan lalu ditolak: ikon monokrom lembaga
//  hulu juga cuma 2 warna, jadi aturan begitu justru akan melewatkannya.)
//
//   bakafrawi…, splash_branding  → merek PENGEMBANG; isinya "Powered by Bakafrawi
//                                  Project", memang sengaja sama di kedua repo.
//   widget_hijri_pattern         → ubin 32x32 dua warna berisi garis belah ketupat.
//                                  Geometri dekoratif; diperiksa 9 Agu 2026, nol identitas.
const ASET_SAH = /bakafrawi|splash_branding|widget_hijri_pattern/i

/** Dimensi PNG dari header — tanpa dependensi gambar. null bila bukan PNG. */
function dimensiPng(p) {
  try {
    const b = readFileSync(p).subarray(0, 24)
    if (b.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') return null
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  } catch {
    return null
  }
}

const kembar = []
for (const [dariRel, keRel, ext] of PETA_ASET) {
  const dariDir = resolve(HULU, dariRel)
  const keDir = resolve(ROOT, keRel)
  for (const p of walk(keDir, ext)) {
    const rel = relative(keDir, p)
    if (ASET_SAH.test(rel)) continue
    // Gambar mungil tak mungkin memuat lambang. Capacitor memasang placeholder 8x8
    // transparan sebagai `splash.png`; kembar di situ tak berarti apa-apa.
    const d = dimensiPng(p)
    if (d && (d.w < 24 || d.h < 24)) continue
    const asal = join(dariDir, rel)
    if (!existsSync(asal)) continue
    if (statSync(asal).size !== statSync(p).size) continue
    if (readFileSync(asal).equals(readFileSync(p))) {
      kembar.push(relative(ROOT, p).split('\\').join('/'))
    }
  }
}

// ── Laporan ─────────────────────────────────────────────────────────────────
console.log('\n═══ cek-kebocoran ═══')
console.log(`  Hulu (baca-saja): ${HULU}`)
console.log(`  Nilai identitas hulu yang dicari: ${nilaiHulu.size}\n`)

if (bocor.length) {
  console.log(`  ✗ NILAI IDENTITAS HULU DITEMUKAN DI REPO KITA (${bocor.length}):\n`)
  for (const b of bocor) {
    const potong = b.nilai.length > 28 ? b.nilai.slice(0, 28) + '…' : b.nilai
    console.log(`    ${b.berkas}`)
    console.log(`      ${potong}   (${b.asal})`)
  }
  console.log('')
}
if (kembar.length) {
  console.log(`  ✗ ASET MEREK MASIH KEMBAR DENGAN HULU (${kembar.length}):\n`)
  kembar.forEach((k) => console.log('    ' + k))
  console.log('\n    Aset ini membawa RUPA lembaga lain (logo/foto/ikon). Ganti lewat')
  console.log('    brand-assets/ + `node scripts/apply-brand.mjs`.\n')
}

if (bocor.length || kembar.length) {
  console.log('  JANGAN RILIS sebelum bersih.\n')
  process.exit(1)
}
console.log('  ✓ Nol nilai identitas hulu di kode, konfigurasi, maupun hasil build.')
console.log('  ✓ Nol aset merek yang masih kembar dengan hulu.\n')
