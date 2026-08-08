import { describe, it, expect } from 'vitest'
import { kelasRank } from '../../app/src/utils/santriSort.js'

// ============================================================================
// Jenjang Pra PTPT dinamai jumlah juz (keputusan Kyai, 8 Agu 2026):
//   Level ½ Juz · Level 1 Juz · Level 1½ Juz · Level 2 Juz · Level 3 Juz
//
// Pembacaan LAMA (angka pertama sesudah kata "Level") rusak untuk nama ini:
//   - '½' bukan digit  → 'Level ½ Juz' tak dapat peringkat, terlempar ke buntut;
//   - 'Level 1½ Juz'   → terbaca 1, BERTABRAKAN dengan 'Level 1 Juz'.
// Tes ini mengunci perbaikannya sekaligus memastikan PPPH & PTPT tak ikut berubah.
// ============================================================================

describe('kelasRank — jenjang Pra PTPT bernama juz', () => {
  const JENJANG = ['Level ½ Juz', 'Level 1 Juz', 'Level 1½ Juz', 'Level 2 Juz', 'Level 3 Juz']

  it('urutannya menaik dan tak ada yang bertabrakan', () => {
    const rank = JENJANG.map(kelasRank)
    expect(rank).toEqual([5, 10, 15, 20, 30])
    expect(new Set(rank).size).toBe(JENJANG.length) // tak ada peringkat kembar
    expect([...rank].sort((a, b) => a - b)).toEqual(rank) // sudah menaik
  })

  it('urut benar walau daftarnya teracak', () => {
    const acak = ['Level 3 Juz', 'Level ½ Juz', 'Level 2 Juz', 'Level 1½ Juz', 'Level 1 Juz']
    expect(acak.slice().sort((a, b) => kelasRank(a) - kelasRank(b))).toEqual(JENJANG)
  })

  it("menerima penulisan '1/2' dan huruf besar-kecil apa pun", () => {
    expect(kelasRank('level 1/2 juz')).toBe(5)
    expect(kelasRank('LEVEL 1 1/2 JUZ')).toBe(15)
    expect(kelasRank('Level ½ juz')).toBe(5)
  })

  // PPPH memakai 'Level N' polos — jangan sampai ikut berubah maknanya.
  it('PPPH Level 1..4 tetap urut benar', () => {
    const ppph = ['Level 1', 'Level 2', 'Level 3', 'Level 4']
    const rank = ppph.map(kelasRank)
    expect(rank).toEqual([10, 20, 30, 40])
    expect([...rank].sort((a, b) => a - b)).toEqual(rank)
  })

  // PTPT pakai 'Kelas N' — jalur berbeda, harus tak tersentuh.
  it('PTPT Kelas 1..6 tetap urut benar', () => {
    const ptpt = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6']
    const rank = ptpt.map(kelasRank)
    expect([...rank].sort((a, b) => a - b)).toEqual(rank)
    expect(new Set(rank).size).toBe(ptpt.length)
  })

  // TPQ: Jilid → KPI → Persiapan Khotaman. Level tak boleh mencuri jalur ini.
  it('TPQ tetap Jilid < KPI < Persiapan Khotaman', () => {
    expect(kelasRank('Jilid 1A')).toBeLessThan(kelasRank('Jilid 5B'))
    expect(kelasRank('Jilid 5B')).toBeLessThan(kelasRank('KPI'))
    expect(kelasRank('KPI')).toBeLessThan(kelasRank('Persiapan Khotaman'))
  })
})
