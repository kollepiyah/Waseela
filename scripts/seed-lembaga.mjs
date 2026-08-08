#!/usr/bin/env node
// ============================================================================
// seed-lembaga — isi baris `master/lembaga` dengan struktur lembaga & kelas awal.
//
//   node scripts/seed-lembaga.mjs --print   (lihat JSON-nya, tanpa menyentuh DB)
//   node scripts/seed-lembaga.mjs           (tulis ke DB bila baris belum ada)
//   node scripts/seed-lembaga.mjs --force   (timpa baris yang sudah ada)
//
// Butuh env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (jangan ditaruh di repo).
//
// ── INI CUMA BIBIT, BUKAN SUMBER ────────────────────────────────────────────
// Sesudah di-seed, daftar lembaga & kelas sepenuhnya milik DB dan bisa diubah
// pembeli lewat UI Master Data › Lembaga — TANPA menyentuh kode.
//   baca  : useLembaga  → subscribeDoc('master','lembaga') → doc.list
//   tulis : useLembagaForm → mergeOne('master','lembaga', { list })
// Skrip ini tak pernah dipanggil saat aplikasi berjalan.
//
// Sumber angkanya = DEFAULT_LEMBAGA_SEED di app/src/composables/useLembaga.js,
// dibaca langsung dari berkas itu supaya tak ada salinan kedua yang bisa melenceng.
// (Berkas itu mengimpor Vue/pinia, jadi tak bisa di-`import` dari Node biasa.)
// `tests/unit/seedLembaga.test.js` menjaga hasil pembacaan ini tetap sama persis
// dengan konstanta aslinya.
// ============================================================================
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SUMBER = resolve(ROOT, 'app/src/composables/useLembaga.js')

/** Ambil literal array DEFAULT_LEMBAGA_SEED dari berkas sumber (pencocokan kurung). */
export function bacaSeedLembaga(berkas = SUMBER) {
  const teks = readFileSync(berkas, 'utf8')
  const tanda = 'export const DEFAULT_LEMBAGA_SEED = ['
  const mulai = teks.indexOf(tanda)
  if (mulai === -1) throw new Error('DEFAULT_LEMBAGA_SEED tak ketemu di ' + berkas)
  let i = mulai + tanda.length - 1
  let dalam = 0
  let akhir = -1
  let kutip = null
  for (; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) {
      if (c === '\\') i++
      else if (c === kutip) kutip = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') kutip = c
    else if (c === '[') dalam++
    else if (c === ']') {
      dalam--
      if (dalam === 0) {
        akhir = i
        break
      }
    }
  }
  if (akhir === -1) throw new Error('Kurung penutup DEFAULT_LEMBAGA_SEED tak ketemu')
  // Literal murni data (tanpa pemanggilan fungsi) — sudah diperiksa saat ditulis
  // dan dijaga tes. Function() dipakai karena JSON.parse tak menerima kutip tunggal.
  return Function('return ' + teks.slice(mulai + tanda.length - 1, akhir + 1))()
}

// Bagian CLI di bawah HANYA jalan saat berkas ini dieksekusi langsung. Tanpa gerbang
// ini, `tests/unit/seedLembaga.test.js` yang meng-import `bacaSeedLembaga` ikut
// menjalankan seluruh skrip (dan keluar karena env kosong).
const dijalankanLangsung =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (!dijalankanLangsung) {
  // diimpor sebagai modul — cukup ekspor fungsinya
} else {
const seed = bacaSeedLembaga()
const nilai = { list: seed }

if (process.argv.includes('--print')) {
  console.log(JSON.stringify(nilai, null, 2))
  process.exit(0)
}

const URL_SB = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SB || !KEY) {
  console.error('[seed] ✗ Set dulu SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.')
  console.error('        PowerShell:  $env:SUPABASE_URL="https://<ref>.supabase.co"')
  console.error('                     $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"')
  process.exit(1)
}

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json'
}

const cek = await fetch(`${URL_SB}/rest/v1/master?key=eq.lembaga&select=key`, { headers: H })
const sudahAda = (await cek.json()).length > 0

if (sudahAda && !process.argv.includes('--force')) {
  console.log('[seed] · Baris master/lembaga SUDAH ADA — tidak disentuh.')
  console.log('        Pakai --force kalau memang mau menimpanya.')
  console.log('        ⚠ Menimpa akan MENGHAPUS lembaga/kelas yang sudah diubah pembeli.')
  process.exit(0)
}

const res = await fetch(`${URL_SB}/rest/v1/master`, {
  method: 'POST',
  headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ key: 'lembaga', value: nilai })
})
if (!res.ok) {
  console.error('[seed] ✗ Gagal:', res.status, await res.text())
  process.exit(1)
}
console.log(`[seed] ✓ master/lembaga ter-seed — ${seed.length} lembaga, ` +
  `${seed.reduce((n, l) => n + (l.kelas?.length || 0), 0)} kelas.`)
console.log('       Selanjutnya pembeli bisa mengubahnya dari Master Data › Lembaga.')
}
