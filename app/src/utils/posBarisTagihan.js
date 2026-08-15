// posBarisTagihan.js — penggolongan "tagihan ini digambar di mana pada layar POS".
//
// Kyai 15 Agu 2026. Layar POS punya empat tempat untuk memperlihatkan tagihan:
//   1. sel matriks Bulanan        — untuk jenis berfrekuensi `bulanan`
//   2. baris Nonbulanan           — untuk jenis berfrekuensi `tahunan`
//   3. baris matriks "di luar daftar" — tagihan yang jenisnya TAK terdaftar lagi, periodenya
//                                    berupa satu bulan T.A. berjalan
//   4. baris orphan di Nonbulanan — sisanya, supaya tak ada tagihan yang hilang dari layar
//   (di luar itu: Tunggakan Tahun Lalu, untuk periode sebelum T.A. berjalan)
//
// Jenis berfrekuensi `manual` TIDAK punya tempat sendiri — ia hanya muncul sebagai cip
// "Item lain" yang membuat item BARU. Maka tagihan jenis manual yang sudah terbit wajib
// jatuh ke nomor 4. Dulu tidak: penjagaannya bertanya "jenisnya terdaftar?" sebagai
// pengganti "sudah tergambar di tempat lain?" — dan untuk jenis manual dua pertanyaan itu
// berbeda jawabannya. Akibatnya tagihan KBM SD Agustus 2026 Rp 800.000 tak muncul di POS
// sama sekali: kasir hanya melihat cip "+ KBM SD", dan membayarnya lewat cip itu tidak
// melunasi tagihannya — tagihan tetap menggantung sebagai tunggakan sementara wali merasa
// sudah membayar.
//
// Fungsi ini sengaja MURNI (tanpa Vue, tanpa DOM): logika yang pernah salah di dalam SFC
// tak bisa diuji, dan yang tak bisa diuji akan salah lagi.

/**
 * Apakah tagihan ini perlu digambar sebagai baris "orphan" di daftar Nonbulanan?
 *
 * @param {object}      a
 * @param {string}      a.status            status tagihan ('belum' | 'partial' | 'lunas' | ...)
 * @param {string}      a.periodeKode       'YYYY-MM'; '' bila periodenya bukan satu bulan
 * @param {string}      a.jenisKey          kunci jenis tagihan (huruf kecil, sudah dirapikan)
 * @param {string}      a.startKode         'YYYY-07' — awal T.A. berjalan
 * @param {Set<string>} a.bulanTA           12 kode bulan T.A. berjalan
 * @param {Set<string>} a.jenisSudahTampil  jenis bulanan + tahunan (punya sel/baris sendiri)
 * @param {Set<string>} a.jenisTerdaftar    seluruh jenis terdaftar (bulanan + tahunan + manual)
 * @returns {boolean}
 */
export function perluBarisOrphanNonbulanan({
  status,
  periodeKode,
  jenisKey,
  startKode,
  bulanTA,
  jenisSudahTampil,
  jenisTerdaftar
}) {
  const st = String(status || 'belum').toLowerCase()
  // Yang sudah lunas tak perlu ditawarkan lagi ke keranjang.
  if (st !== 'belum' && st !== 'partial') return false
  const pk = String(periodeKode || '')
  // Periode sebelum T.A. berjalan = urusan "Tunggakan Tahun Lalu", bukan di sini.
  if (pk && pk < String(startKode || '')) return false
  const jk = String(jenisKey || '')
  // Sudah punya sel matriks (bulanan) atau baris tahunan sendiri → jangan digambar dua kali.
  if (jenisSudahTampil?.has(jk)) return false
  // Jenisnya TAK terdaftar DAN periodenya satu bulan T.A. berjalan → sudah jadi baris matriks
  //   "di luar daftar". Syarat "tak terdaftar" WAJIB ikut: baris itu HANYA dibuat untuk jenis
  //   yang tak terdaftar, jadi tanpa syarat itu tagihan jenis manual dibuang ke baris yang
  //   tak pernah ada — persis cacat yang fungsi ini lahir untuk mencegahnya.
  if (!jenisTerdaftar?.has(jk) && pk && bulanTA?.has(pk)) return false
  return true
}
