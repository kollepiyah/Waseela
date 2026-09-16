#!/usr/bin/env node
/**
 * APK Rebuild Pipeline — Waseela (UNTUK TESTER / sideload)
 *
 * Sama dengan build-aab.cjs, tapi menghasilkan APK (assembleRelease), bukan AAB.
 * APK bisa langsung dikirim & di-install di HP tester (tanpa Play Store).
 *
 * Steps:
 *   1. npm run build --prefix app   (build Vue → app/dist/)
 *   2. Force-delete android assets/public (hindari cache cap sync basi)
 *   3. npx cap sync android             (dist → android assets/public)
 *   4. cd android && gradlew assembleRelease  (generate signed APK)
 *
 * Output:
 *   app/android/app/build/outputs/apk/release/app-release.apk
 *   dist-release/Waseela.apk   <- salinan siap unggah (nama WAJIB persis begini)
 *
 * KENAPA DISALIN & DIGANTI NAMA (Kyai, 13 Agu 2026):
 *   Tombol "Android" di halaman login menunjuk
 *   <releaseRepo>/releases/latest/download/<BRAND.artifactBase>.apk — jadi berkas di
 *   GitHub Release HARUS bernama `Waseela.apk`. Mengunggah `app-release.apk` apa adanya
 *   membuat tautannya 404 tanpa ada yang menjerit. Namanya diambil dari BRAND, bukan
 *   diketik ulang, supaya sekali ganti merek tak ada yang tertinggal.
 *
 * Pre-requisites: sama dgn build:aab (JDK, Android SDK, keystore release).
 * Catatan: APK ini ber-signature SAMA dengan AAB (signingConfigs.release) — yaitu kunci
 * UPLOAD kita, bukan kunci Play App Signing. Selama aplikasi belum terbit di Play, APK
 * inilah yang dipakai pembeli. Sesudah terbit di Play, APK untuk `apkUrl` harus diambil
 * dari Play Console (App bundle explorer), kalau tidak pemasangan dari Play tak bisa
 * menerima pembaruannya.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const VUE_APP = path.join(ROOT, 'app')
const ANDROID_DIR = path.join(VUE_APP, 'android')
const APK_PATH = path.join(
  ANDROID_DIR,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk'
)

function log(msg) {
  console.log(`[build-apk] ${msg}`)
}

function run(cmd, opts = {}) {
  log(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

try {
  log('Step 1: Build Vue app → app/dist/')
  run('npm run build --prefix app', { cwd: ROOT })

  const ANDROID_ASSETS = path.join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'public')
  if (fs.existsSync(ANDROID_ASSETS)) {
    log('Step 1b: Force-delete Android assets/public/ (avoid cap sync stale cache)')
    fs.rmSync(ANDROID_ASSETS, { recursive: true, force: true })
  }

  log('Step 1c: Sync Capacitor — app/dist → app/android/app/src/main/assets/public/')
  run('npx cap sync android', { cwd: VUE_APP })

  log('Step 2: Run gradle assembleRelease (generate signed APK)')
  // Path penuh — lihat catatan yang sama di build-aab.cjs.
  const gradlew = path.join(ANDROID_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
  run(`"${gradlew}" assembleRelease`, { cwd: ANDROID_DIR })

  if (fs.existsSync(APK_PATH)) {
    const size = (fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(2)
    log(`✓ APK rebuilt: ${APK_PATH}`)
    log(`  Size: ${size} MB`)

    // Salin dgn nama yang DICARI halaman login. artifactBase & versi dibaca dari sumbernya
    // masing-masing supaya tak ada nama/angka yang diketik ulang di dua tempat.
    const brand = fs.readFileSync(path.join(VUE_APP, 'src', 'config', 'brand.js'), 'utf8')
    const namaArtefak = (brand.match(/artifactBase:\s*'([^']+)'/) || [])[1] || 'Waseela'
    const versi = require(path.join(VUE_APP, 'package.json')).version
    const OUT_DIR = path.join(ROOT, 'dist-release')
    const OUT_APK = path.join(OUT_DIR, `${namaArtefak}.apk`)
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.copyFileSync(APK_PATH, OUT_APK)
    log(`✓ Siap unggah: ${OUT_APK}`)
    log('')
    log('Langkah berikutnya (manual):')
    log(`  1. Rilis Desktop dulu: npm run electron:release  → membuat rilis GitHub v${versi}`)
    log(`  2. Unggah ${namaArtefak}.apk ke rilis v${versi} ITU JUGA (jangan rilis terpisah —`)
    log('     halaman login memakai /releases/latest/download/, jadi APK & installer harus')
    log('     berada di rilis yang sama, yaitu yang terbaru).')
    log('  3. Cek tombol Android & Desktop di halaman login sesudahnya.')
    log('')
    log(`  (Untuk tester: kirim ${namaArtefak}.apk lewat WA/Drive; di HP aktifkan`)
    log('   "Install unknown apps" untuk aplikasi pengirimnya.)')
  } else {
    throw new Error(`APK output missing: ${APK_PATH}`)
  }
} catch (err) {
  console.error('[build-apk] FAILED:', err.message)
  console.error('')
  console.error('Common issues:')
  console.error('  - JAVA_HOME not set → install JDK 17+ dan set env var')
  console.error('  - ANDROID_HOME not set → install Android SDK')
  console.error('  - Keystore missing → cek app/android/app/build.gradle signingConfig')
  process.exit(1)
}
