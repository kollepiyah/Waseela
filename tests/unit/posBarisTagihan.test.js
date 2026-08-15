// Kyai (15 Agu 2026): pembeli melaporkan sel Agustus di POS tak mau berubah. Saat
// menelusuri itu ketahuan cacat KEDUA yang lebih diam: tagihan **KBM SD Agustus 2026
// Rp 800.000** tidak muncul di layar POS sama sekali — bukan salah angka, melainkan tak
// ada barisnya.
//
// Akarnya satu penjagaan yang bertanya "jenisnya terdaftar?" sebagai pengganti "sudah
// tergambar di tempat lain?". Untuk jenis berfrekuensi `bulanan` dan `tahunan` kedua
// pertanyaan itu sejawaban, jadi cacatnya tak pernah kelihatan. Untuk jenis `manual`
// tidak: ia terdaftar (maka dibuang dari daftar orphan) tetapi tak pernah punya baris
// sendiri — jenis manual hanya muncul sebagai cip "Item lain" yang membuat item BARU.
//
// Akibat uangnya: kasir tak melihat tagihannya, lalu menagih lewat cip. Pembayaran masuk
// sebagai item lepas, tagihan Rp 800.000 tetap berstatus 'belum', dan wali yang merasa
// sudah membayar tetap tercatat menunggak.
import { describe, it, expect } from 'vitest'
import { perluBarisOrphanNonbulanan } from '@/utils/posBarisTagihan'

// T.A. 2026/2027 — Juli 2026 s.d. Juni 2027
const START = '2026-07'
const BULAN_TA = new Set([
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
  '2026-12',
  '2027-01',
  '2027-02',
  '2027-03',
  '2027-04',
  '2027-05',
  '2027-06'
])
// Sesuai setelan pembeli: syahriyah = bulanan; kbm sd / khidmat / infrastruktur = manual.
const SUDAH_TAMPIL = new Set(['syahriyah', 'daftar ulang'])
const TERDAFTAR = new Set(['syahriyah', 'daftar ulang', 'kbm sd', 'khidmat', 'infrastruktur'])

function tanya(over = {}) {
  return perluBarisOrphanNonbulanan({
    status: 'belum',
    periodeKode: '2026-08',
    jenisKey: 'kbm sd',
    startKode: START,
    bulanTA: BULAN_TA,
    jenisSudahTampil: SUDAH_TAMPIL,
    jenisTerdaftar: TERDAFTAR,
    ...over
  })
}

describe('perluBarisOrphanNonbulanan — jenis MANUAL (cacat yang diperbaiki)', () => {
  it('tagihan jenis manual di bulan T.A. berjalan HARUS tampil (kasus KBM SD Agustus 2026)', () => {
    // Inilah regresinya. Sebelum perbaikan: false — tagihan Rp 800.000 hilang dari layar.
    expect(tanya()).toBe(true)
  })

  it('tagihan jenis manual tanpa periode bulan (mis. "TA 2026/2027") juga tampil', () => {
    expect(tanya({ periodeKode: '' })).toBe(true)
  })

  it('tagihan jenis manual yang baru dicicil (partial) tetap tampil', () => {
    expect(tanya({ status: 'partial' })).toBe(true)
  })

  it('status kosong dianggap "belum" — tagihan lama tanpa kolom status tak boleh hilang', () => {
    expect(tanya({ status: '' })).toBe(true)
    expect(tanya({ status: undefined })).toBe(true)
  })
})

describe('perluBarisOrphanNonbulanan — yang memang sudah tergambar di tempat lain', () => {
  it('jenis BULANAN tidak diulang di sini (sudah jadi sel matriks)', () => {
    // Kalau ini true, tagihan syahriyah tampil dua kali dan bisa masuk keranjang dua kali.
    expect(tanya({ jenisKey: 'syahriyah', periodeKode: '2026-08' })).toBe(false)
  })

  it('jenis TAHUNAN tidak diulang di sini (sudah jadi baris Nonbulanan sendiri)', () => {
    expect(tanya({ jenisKey: 'daftar ulang', periodeKode: '' })).toBe(false)
  })

  it('jenis TAK terdaftar + periode satu bulan T.A. = sudah jadi baris "di luar daftar"', () => {
    // Jenis yang labelnya diganti / whitelist-nya berubah / menempel ke jenis lain.
    expect(tanya({ jenisKey: 'syahriyah qiraati pagi', periodeKode: '2026-08' })).toBe(false)
  })

  it('jenis TAK terdaftar TANPA periode bulan tetap tampil di sini (tak ada baris matriksnya)', () => {
    expect(tanya({ jenisKey: 'seragam lama', periodeKode: '' })).toBe(true)
  })
})

describe('perluBarisOrphanNonbulanan — batas periode & status', () => {
  it('periode sebelum T.A. berjalan bukan urusan di sini (itu Tunggakan Tahun Lalu)', () => {
    expect(tanya({ periodeKode: '2026-06' })).toBe(false)
    expect(tanya({ periodeKode: '2025-11' })).toBe(false)
  })

  it('bulan pertama T.A. (Juli) termasuk, bukan tunggakan lama', () => {
    expect(tanya({ periodeKode: '2026-07' })).toBe(true)
  })

  it('yang sudah lunas / lebih tak perlu ditawarkan lagi ke keranjang', () => {
    expect(tanya({ status: 'lunas' })).toBe(false)
    expect(tanya({ status: 'Lunas' })).toBe(false)
    expect(tanya({ status: 'lebih' })).toBe(false)
  })
})
