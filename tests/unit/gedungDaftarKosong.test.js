import { describe, it, expect } from 'vitest'
import { gedungList, DEFAULT_GEDUNG } from '../../app/src/utils/gedung.js'

// ============================================================================
// Laporan Kyai (9 Agu 2026): daftar gedung masih berisi nama milik lembaga di repo
// asal, dan setiap kali dihapus selalu muncul kembali.
//
// Akarnya `arr.length ? arr : DEFAULT` — begitu gedung TERAKHIR dihapus, daftarnya
// kosong, syarat gagal, dan nilai bawaan muncul lagi seolah penghapusan tak jadi.
// Jadi mustahil punya nol gedung, dan nama gedung lembaga lain selalu kembali.
//
// Aturan sekarang: HANYA `undefined` yang berarti "belum diisi". Array kosong adalah
// keputusan admin dan wajib dihormati. Pola yang sama sudah lebih dulu dipakai
// master JABATAN (JabatanKelolaView) sesudah keluhan yang serupa.
// ============================================================================

describe('gedungList — daftar kosong wajib dihormati', () => {
  it('daftar kosong TETAP kosong (tidak memunculkan bawaan)', () => {
    expect(gedungList({ gedung_list: [] })).toEqual([])
  })

  it('menghapus gedung terakhir benar-benar menyisakan nol', () => {
    let daftar = ['Gedung Putra', 'Gedung Putri']
    daftar = daftar.filter((g) => g !== 'Gedung Putri')
    expect(gedungList({ gedung_list: daftar })).toEqual(['Gedung Putra'])
    daftar = daftar.filter((g) => g !== 'Gedung Putra')
    expect(gedungList({ gedung_list: daftar })).toEqual([])
  })

  it('belum pernah diisi (undefined) → pakai bawaan', () => {
    expect(gedungList({})).toEqual(DEFAULT_GEDUNG)
    expect(gedungList(null)).toEqual(DEFAULT_GEDUNG)
  })

  it('daftar isian admin dipakai apa adanya, entri kosong disaring', () => {
    expect(gedungList({ gedung_list: ['Gedung Putra', '', 'Gedung Putri'] })).toEqual([
      'Gedung Putra',
      'Gedung Putri'
    ])
  })

  // Nama gedung itu milik LEMBAGA, bukan milik aplikasi. Repo asal mengisinya dengan
  // nama gedungnya sendiri, sehingga di pemasangan baru daftar itu tampil seolah milik
  // pembeli — persis yang dilaporkan Kyai.
  it('tak ada nama gedung bawaan milik lembaga mana pun', () => {
    expect(DEFAULT_GEDUNG).toEqual([])
  })
})
