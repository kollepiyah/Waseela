#!/usr/bin/env node
// ============================================================================
// whitelabel — terapkan aturan white-label + JALANKAN GERBANG AUDIT.
//
//   node scripts/whitelabel.mjs          (terapkan aturan lalu audit)
//   node scripts/whitelabel.mjs --audit  (audit saja — dipakai di CI / sebelum rilis)
//
// Gerbang ini menangkap jejak identitas berupa TEKS. Jejak berupa GAMBAR
// (logo, splash, ikon) di luar jangkauannya — itu tugas `apply-brand.mjs`.
// Jalankan KEDUANYA sebelum mengirim ke pembeli.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import {
  EXT_SRC, EXT_BACKEND, RULES_SRC, RULES_BACKEND, POLA_JEJAK, terapkan, pastikanImportBrand
} from './whitelabel-rules.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT_ONLY = process.argv.includes('--audit')

const AREA = [
  { dir: 'app/src', ext: EXT_SRC, rules: RULES_SRC, brand: true },
  { dir: 'supabase/migrations', ext: EXT_BACKEND, rules: RULES_BACKEND, brand: false },
  { dir: 'supabase/functions', ext: EXT_BACKEND, rules: RULES_BACKEND, brand: false },
  { dir: 'tests', ext: /\.js$/, rules: RULES_BACKEND, brand: false }
]

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out
  for (const n of readdirSync(dir)) {
    const p = resolve(dir, n)
    if (statSync(p).isDirectory()) walk(p, ext, out)
    else if (ext.test(p)) out.push(p)
  }
  return out
}

const diubah = []
const perluTangan = []

if (!AUDIT_ONLY) {
  for (const a of AREA) {
    for (const p of walk(resolve(ROOT, a.dir), a.ext)) {
      const before = readFileSync(p, 'utf8')
      let after = terapkan(before, a.rules)
      if (after === before) continue
      if (a.brand) {
        const withImport = pastikanImportBrand(after, p.endsWith('.vue'))
        if (withImport === null) {
          perluTangan.push(relative(ROOT, p))
          continue
        }
        after = withImport
      }
      writeFileSync(p, after)
      diubah.push(relative(ROOT, p))
    }
  }
}

// ── GERBANG AUDIT ───────────────────────────────────────────────────────────
const sisa = []
for (const a of AREA) {
  for (const p of walk(resolve(ROOT, a.dir), a.ext)) {
    const teks = readFileSync(p, 'utf8')
    teks.split('\n').forEach((baris, i) => {
      if (POLA_JEJAK.test(baris)) sisa.push(`${relative(ROOT, p)}:${i + 1}: ${baris.trim().slice(0, 100)}`)
    })
  }
}

// Pindai HASIL BUILD kalau ada. Ini bukti terkuat: yang benar-benar dikirim ke
// pembeli adalah dist/, bukan src/. Menangkap juga jejak yang masuk lewat aset
// atau dependensi yang di-inline saat bundling.
const distDir = resolve(ROOT, 'app/dist')
const sisaDist = []
if (existsSync(distDir)) {
  for (const p of walk(distDir, /\.(js|css|html|json|webmanifest|txt|xml)$/)) {
    const teks = readFileSync(p, 'utf8')
    if (POLA_JEJAK.test(teks)) sisaDist.push(relative(ROOT, p))
  }
}

console.log('\n═══ whitelabel' + (AUDIT_ONLY ? ' (audit saja)' : '') + ' ═══\n')
if (diubah.length) {
  console.log(`  Diubah (${diubah.length}):`)
  diubah.forEach((f) => console.log('    ' + f))
  console.log('')
}
if (perluTangan.length) {
  console.log('  ⚠ PERLU TANGAN (tak ada blok import untuk menyisipkan BRAND):')
  perluTangan.forEach((f) => console.log('    ' + f))
  console.log('')
}
if (sisa.length || sisaDist.length) {
  if (sisa.length) {
    console.log(`  ✗ GERBANG SUMBER GAGAL — ${sisa.length} jejak identitas tersisa:\n`)
    sisa.slice(0, 40).forEach((l) => console.log('    ' + l))
    if (sisa.length > 40) console.log(`    … dan ${sisa.length - 40} lagi`)
  }
  if (sisaDist.length) {
    console.log(`\n  ✗ GERBANG HASIL BUILD GAGAL — jejak ikut ter-bundel (${sisaDist.length}):\n`)
    sisaDist.forEach((l) => console.log('    ' + l))
  }
  console.log('\n  Tambahkan aturannya di scripts/whitelabel-rules.mjs — JANGAN tambal berkasnya')
  console.log('  langsung, tambalan itu akan hilang di sync berikutnya.\n')
  process.exit(1)
}
console.log('  ✓ Gerbang SUMBER lulus — nol jejak di app/src, supabase/, tests/.')
console.log(
  existsSync(distDir)
    ? '  ✓ Gerbang HASIL BUILD lulus — nol jejak di app/dist.'
    : '  · app/dist belum ada — jalankan `npm run build` lalu ulangi untuk memeriksa hasil build.'
)
console.log('\n  Ingat: gambar (logo/splash/ikon) tak tercakup grep → jalankan juga:')
console.log('    node scripts/apply-brand.mjs\n')
