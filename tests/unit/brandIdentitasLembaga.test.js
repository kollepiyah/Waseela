import { describe, it, expect } from 'vitest'
import { BRAND } from '../../app/src/config/brand.js'

// ============================================================================
// Laporan Kyai (9 Agu 2026): tanda tangan di rapor tercetak "PJ PTPT Waseela".
//
// Waseela itu nama APLIKASI, bukan nama lembaga. Ia muncul di rapor karena
// `namaPondokSingkat` tak punya isian di Pengaturan, sehingga terkunci di nilai
// bawaan merek — lalu selalu ditempelkan ke belakang jabatan penanda tangan.
//
// Dua hal yang dikunci tes ini:
//   1. namaPondokSingkat bawaan KOSONG — beda perlakuan dari namaLembaga, yang boleh
//      memakai nama produk karena hanya jadi cadangan TAMPILAN (sidebar, judul login).
//   2. Nilai yang DICETAK tak boleh mengandung nama produk.
// ============================================================================

describe('BRAND — identitas lembaga vs identitas produk', () => {
  it('nama singkat lembaga dikirim KOSONG (dicetak di rapor)', () => {
    expect(BRAND.namaPondokSingkat).toBe('')
  })

  it('nama lembaga boleh memakai nama produk (hanya cadangan tampilan)', () => {
    expect(BRAND.namaLembaga).toBe(BRAND.appName)
  })

  // Bidang yang IKUT TERCETAK di kop/rapor tak boleh membawa nama produk maupun
  // nama lembaga mana pun.
  it('bidang cetak lain juga kosong', () => {
    for (const k of ['kopLine1', 'kopLine2', 'kopImageUrl', 'motto']) {
      expect(BRAND[k], `BRAND.${k}`).toBe('')
    }
  })
})
