#!/usr/bin/env node
// ============================================================================
// make-icons — bikin aset PERSEGI dari logo Waseela yang berformat lanskap.
//
//   node scripts/make-icons.mjs
//
// Logo sumber (`brand-assets/logo.png`) adalah wordmark lanskap. Ikon aplikasi &
// splash HARUS persegi — kalau logo lanskap dipakai langsung, sistem memotong atau
// menggepengkannya. Skrip ini menyusunnya di kanvas persegi dengan ruang tepi yang
// aman terhadap masking bulat/rounded milik Android & iOS.
//
// Hasilnya MOCKUP kerja: bentuknya benar dan siap dipakai, tapi kalau nanti ada
// desain ikon khusus dari desainer, cukup timpa berkas di brand-assets/.
// ============================================================================
import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'brand-assets', 'logo.png')

if (!existsSync(SRC)) {
  console.error('[icons] ✗ brand-assets/logo.png tak ada.')
  process.exit(1)
}

const HIJAU = { r: 0x06, g: 0x5f, b: 0x46, alpha: 1 } // #065F46 — emerald, warna logo Waseela (terukur)
const MINT = { r: 0xec, g: 0xfd, b: 0xf5, alpha: 1 } // #ECFDF5 — emerald-50, latar splash

/**
 * Buang tepi transparan berdasarkan kanal alpha.
 * `sharp.trim()` menilai dari warna piksel pojok, jadi gagal pada PNG berlatar
 * transparan penuh — di sini kotak isi dihitung sendiri dari alpha.
 */
async function rapikanTepi(buf) {
  const img = sharp(buf).ensureAlpha()
  const { width, height } = await img.metadata()
  const a = await img.extractChannel('alpha').raw().toBuffer()
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (a[y * width + x] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return buf // seluruhnya transparan — kembalikan apa adanya
  return sharp(buf).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer()
}

/** Ubah logo jadi siluet satu warna: ambil kanal alpha-nya, pakai sebagai masker. */
async function siluet(warna, lebar) {
  const alpha = await sharp(SRC).ensureAlpha().resize({ width: lebar }).extractChannel('alpha').toBuffer()
  const { width, height } = await sharp(alpha).metadata()
  return sharp({ create: { width, height, channels: 3, background: warna } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
}

async function tulis(nama, buf) {
  const p = resolve(ROOT, 'brand-assets', nama)
  writeFileSync(p, buf)
  const m = await sharp(buf).metadata()
  console.log(`  ✓ ${nama.padEnd(12)} ${m.width}x${m.height}  ${(buf.length / 1024).toFixed(0)} KB`)
}

console.log('\n═══ make-icons ═══\n')

// ── 1. Ikon aplikasi 1024×1024 — latar emerald + mark PUTIH ─────────────────
// Kenapa mark putih di latar emerald, bukan sebaliknya: ikon tampil di atas wallpaper
// apa pun. Latar solid menjaga kontras di layar terang maupun gelap, dan tak lenyap
// saat sistem menerapkan masking bulat.
//
// KENDALA: zona aman ikon adaptif Android = LINGKARAN berdiameter ~66% sisi. Wordmark
// "وسيلة" berbanding 1.79:1 — kalau dibesarkan sampai terbaca, ujung kiri-kanannya
// keluar lingkaran dan terpotong. Karena itu dibuat DUA varian; pilih salah satu.
{
  // Varian A — wordmark utuh, dikecilkan supaya muat di lingkaran aman.
  const MARK_W = Math.round(1024 * 0.58)
  const mark = await siluet({ r: 255, g: 255, b: 255 }, MARK_W)
  const buf = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: HIJAU } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
  await tulis('icon-wordmark.png', buf)
}
{
  // Varian B — monogram: huruf "و" saja (glyph paling kanan; Arab dibaca kanan→kiri).
  // Bentuknya mendekati persegi sehingga bisa dibesarkan tanpa terpotong — terbaca
  // jelas di ukuran kecil (launcher 48dp), yang justru ukuran paling sering dilihat.
  const meta = await sharp(SRC).metadata()
  const left = Math.round(meta.width * 0.82) // batas kiri glyph "و" pada logo ini
  const potong = await rapikanTepi(
    await sharp(SRC).extract({ left, top: 0, width: meta.width - left, height: meta.height }).png().toBuffer()
  )
  const alpha = await sharp(potong).ensureAlpha().resize({ height: Math.round(1024 * 0.5) }).extractChannel('alpha').toBuffer()
  const { width, height } = await sharp(alpha).metadata()
  const mark = await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
  const buf = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: HIJAU } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
  await tulis('icon-monogram.png', buf)
}

// ── 2. splash.png 2732×2732 — latar emerald-50 + logo asli ──────────────────
// Ukuran 2732 = sisi terpanjang perangkat terbesar; Capacitor memusatkan lalu memotong,
// jadi mark dibuat kecil (22%) supaya tak pernah terpotong di rasio mana pun.
{
  const MARK_W = Math.round(2732 * 0.22)
  const mark = await sharp(SRC).resize({ width: MARK_W }).png().toBuffer()
  const buf = await sharp({ create: { width: 2732, height: 2732, channels: 4, background: MINT } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
  await tulis('splash.png', buf)
}

// ── 3. ic_stat.png 96×96 — siluet PUTIH, latar TRANSPARAN ───────────────────
// Android membuang semua warna pada ikon status bar dan hanya memakai alpha-nya.
// Kalau dikirim berwarna, hasilnya kotak putih penuh — karena itu wajib siluet.
{
  const MARK_W = Math.round(96 * 0.82)
  const mark = await siluet({ r: 255, g: 255, b: 255 }, MARK_W)
  const buf = await sharp({
    create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
  await tulis('ic_stat.png', buf)
}

console.log('\n  Berikutnya:')
console.log('    node scripts/apply-brand.mjs')
console.log('    cd app && npx capacitor-assets generate --android\n')
