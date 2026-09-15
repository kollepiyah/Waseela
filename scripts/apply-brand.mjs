#!/usr/bin/env node
// ============================================================================
// apply-brand — pasang identitas merek WASEELA ke seluruh aset build.
//
//   node scripts/apply-brand.mjs          (pasang + audit)
//   node scripts/apply-brand.mjs --audit  (audit saja, tanpa menulis)
//
// KENAPA ADA: identitas produk tersebar di tempat yang tak tersentuh `config/brand.js`
// — ikon PWA, splash, ikon native, ikon notifikasi. Semuanya BERUPA GAMBAR, jadi audit
// `grep` tak akan pernah menangkapnya. Skrip ini yang menjaga bagian itu.
//
// SUMBER ASET: folder `brand-assets/` di akar repo (lihat brand-assets/README.md).
// Yang belum tersedia dilaporkan sebagai ✗ — TIDAK didiamkan.
// ============================================================================
import { existsSync, copyFileSync, readFileSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = resolve(ROOT, 'app')
const SRC = resolve(ROOT, 'brand-assets')
const AUDIT_ONLY = process.argv.includes('--audit')

const ok = []
const warn = []

/** Dimensi PNG dari header (tanpa dependensi gambar). */
function dimensiPng(p) {
  try {
    const b = readFileSync(p).subarray(0, 24)
    if (b.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') return null
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  } catch {
    return null
  }
}

function salin(dariRel, keRelList, label, syarat) {
  const dari = resolve(SRC, dariRel)
  if (!existsSync(dari)) {
    warn.push(`✗ ${label}\n    butuh: brand-assets/${dariRel}${syarat ? `  (${syarat})` : ''}`)
    return
  }
  const d = dimensiPng(dari)
  for (const rel of keRelList) {
    const ke = resolve(APP, rel)
    if (!AUDIT_ONLY) copyFileSync(dari, ke)
  }
  ok.push(`✓ ${label}${d ? ` — ${d.w}x${d.h}` : ''} → ${keRelList.length} berkas`)
}

// ── 1. Ikon web & PWA ───────────────────────────────────────────────────────
// Catatan: satu berkas dipakai untuk semua ukuran (peramban menskalakan). Ini
// perilaku yang sama dengan build Waseela sebelumnya — sengaja dipertahankan.
salin('logo.png', ['public/logo.png', 'public/pwa-192.png', 'public/pwa-512.png', 'public/apple-touch-icon.png'],
  'Logo web + ikon PWA')

// ── 2. Ikon & splash native (sumber capacitor-assets) ───────────────────────
salin('icon.png', ['resources/icon.png', 'resources/icon-dark.png', 'electron/assets/appIcon.png'],
  'Ikon aplikasi native + Electron', 'PERSEGI, 1024x1024')
salin('splash.png', ['resources/splash.png', 'resources/splash-dark.png', 'electron/assets/splash-light.png', 'electron/assets/splash-dark.png'],
  'Splash screen', 'PERSEGI, 2732x2732')

// ── 3. Ikon kecil notifikasi Android (silhouette putih transparan) ──────────
salin('ic_stat.png', [
  'android/app/src/main/res/drawable-mdpi/ic_stat_waseela.png',
  'android/app/src/main/res/drawable-hdpi/ic_stat_waseela.png',
  'android/app/src/main/res/drawable-xhdpi/ic_stat_waseela.png',
  'android/app/src/main/res/drawable-xxhdpi/ic_stat_waseela.png',
  'android/app/src/main/res/drawable-xxxhdpi/ic_stat_waseela.png'
], 'Ikon notifikasi status bar', 'silhouette PUTIH latar transparan, 96x96')

// ── 3b. Aset Android yang TAK disentuh capacitor-assets ─────────────────────
// `npx @capacitor/assets generate` meregenerasi splash.png + ikon launcher, TAPI
// TIDAK menyentuh dua berkas ini — keduanya milik splash animasi Android 12+ dan
// lapisan ikon bertema Android 13+. Akibatnya keduanya sempat lolos: `splash_icon`
// ternyata masih kaligrafi lembaga hulu, dan MUNCUL TIAP KALI aplikasi dibuka.
//
// Dibuat di sini (bukan tangan) supaya ikut terbarui tiap ganti logo.
const HIJAU = { r: 0x06, g: 0x5f, b: 0x46 } // #065F46 — warna logo Waseela
const HITAM = { r: 0, g: 0, b: 0 }

/** Siluet satu warna dari logo, dipasang di tengah kanvas persegi transparan. */
async function siluetPersegi(sisi, warna, isiPersen) {
  const sharp = (await import('sharp')).default
  const src = resolve(SRC, 'logo.png')
  const lebar = Math.round(sisi * isiPersen)
  const alpha = await sharp(src).ensureAlpha().resize({ width: lebar }).extractChannel('alpha').toBuffer()
  const { width, height } = await sharp(alpha).metadata()
  const mark = await sharp({ create: { width, height, channels: 3, background: warna } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
  return sharp({
    create: { width: sisi, height: sisi, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
}

const RES = 'android/app/src/main/res'
const DENSITAS = [
  ['mdpi', 288, 108],
  ['hdpi', 432, 162],
  ['xhdpi', 576, 216],
  ['xxhdpi', 864, 324],
  ['xxxhdpi', 1152, 432]
]
if (existsSync(resolve(SRC, 'logo.png')) && !AUDIT_ONLY) {
  const { writeFileSync } = await import('fs')
  for (const [d, sSplash, sMono] of DENSITAS) {
    // splash_icon: tampil di tengah splash Android 12+ (latar dari warna splashBg).
    const p1 = resolve(APP, `${RES}/drawable-${d}/splash_icon.png`)
    if (existsSync(dirname(p1))) writeFileSync(p1, await siluetPersegi(sSplash, HIJAU, 0.55))
    // ic_launcher_monochrome: lapisan ikon bertema — Android membuang warnanya dan
    // hanya memakai alpha, jadi WAJIB siluet satu warna.
    const p2 = resolve(APP, `${RES}/mipmap-${d}/ic_launcher_monochrome.png`)
    if (existsSync(dirname(p2))) writeFileSync(p2, await siluetPersegi(sMono, HITAM, 0.62))
  }
  ok.push(`✓ splash_icon + ic_launcher_monochrome — ${DENSITAS.length} densitas × 2`)

  // Bingkai animasi splash Android (drawable/splash_icon_anim.xml merangkainya).
  // Ini pun luput dari capacitor-assets — dan isinya ternyata 14 bingkai kaligrafi
  // lembaga hulu yang berputar tiap aplikasi dibuka.
  // Geraknya meniru splash web di index.html: skala 0,72 → 1 (keyframe splashLogoIn).
  const sharp = (await import('sharp')).default
  const { readdirSync: bacaDir } = await import('fs')
  const dirAnim = resolve(APP, `${RES}/drawable-nodpi`)
  if (existsSync(dirAnim)) {
    const frame = bacaDir(dirAnim).filter((f) => /^splash_anim_\d+\.png$/.test(f)).sort()
    const SISI = 768
    for (let i = 0; i < frame.length; i++) {
      const t = frame.length > 1 ? i / (frame.length - 1) : 1
      const skala = 0.72 + 0.28 * (1 - Math.pow(1 - t, 3)) // ease-out, seperti di web
      const lebar = Math.max(8, Math.round(SISI * 0.62 * skala))
      const mark = await sharp(resolve(SRC, 'logo.png')).resize({ width: lebar }).png().toBuffer()
      const buf = await sharp({
        create: { width: SISI, height: SISI, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      })
        .composite([{ input: mark, gravity: 'center' }])
        .png()
        .toBuffer()
      writeFileSync(resolve(dirAnim, frame[i]), buf)
    }
    if (frame.length) ok.push(`✓ bingkai animasi splash — ${frame.length} bingkai`)
  }
}

// ── 4. Audit: aset yang masih identik dengan repo asal ──────────────────────
// Kalau repo Ammu ada di mesin ini, bandingkan byte-per-byte. Ini jaring terakhir
// untuk gambar — satu-satunya cara menangkap logo lembaga lain yang ikut tersalin.
// Folder hulu sempat berganti nama (Portal MU → Ammu, 16 Sep 2026) — dicoba keduanya.
const AMMU =
  ['Ammu', 'Portal MU'].map((n) => resolve(ROOT, '..', n, 'vue-app')).find((p) => existsSync(p)) ||
  resolve(ROOT, '..', 'Ammu', 'vue-app')
const CEK_TIRU = [
  ['public/logo.png', 'public/logo.png'],
  ['public/pwa-192.png', 'public/pwa-192.png'],
  ['public/pwa-512.png', 'public/pwa-512.png'],
  ['public/apple-touch-icon.png', 'public/apple-touch-icon.png'],
  ['resources/icon.png', 'resources/icon.png'],
  ['resources/splash.png', 'resources/splash.png'],
  ['electron/assets/appIcon.png', 'electron/assets/appIcon.png'],
  ['android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png']
]
const tiru = []
if (existsSync(AMMU)) {
  for (const [a, b] of CEK_TIRU) {
    const pa = resolve(APP, a)
    const pb = resolve(AMMU, b)
    if (!existsSync(pa) || !existsSync(pb)) continue
    if (statSync(pa).size !== statSync(pb).size) continue
    if (readFileSync(pa).equals(readFileSync(pb))) tiru.push(a)
  }
}

// ── Laporan ─────────────────────────────────────────────────────────────────
console.log('\n═══ apply-brand' + (AUDIT_ONLY ? ' (audit saja)' : '') + ' ═══\n')
ok.forEach((l) => console.log('  ' + l))
if (warn.length) {
  console.log('\n  BELUM ADA SUMBERNYA:')
  warn.forEach((l) => console.log('  ' + l))
}
if (tiru.length) {
  console.log('\n  ⚠ MASIH IDENTIK DENGAN REPO ASAL (logo lembaga lain akan tampil):')
  tiru.forEach((l) => console.log('    • app/' + l))
}
if (!warn.length && !tiru.length) {
  console.log('\n  Semua aset merek terpasang.')
} else {
  console.log('\n  Lengkapi brand-assets/ lalu jalankan ulang. Sesudah resources/ terisi:')
  console.log('    cd app && npx capacitor-assets generate --android')
  console.log('  (regenerasi ikon launcher + splash Android dari resources/)')
}
console.log('')
process.exit(tiru.length ? 1 : 0)
