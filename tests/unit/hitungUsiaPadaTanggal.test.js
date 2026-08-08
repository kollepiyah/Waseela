import { describe, it, expect } from 'vitest'
import { usiaPada as hitungUsiaPadaTanggal } from '../../app/src/utils/usia.js'

describe('hitungUsiaPadaTanggal', () => {
  it('hitung dasar (full years)', () => {
    expect(hitungUsiaPadaTanggal('2010-01-01', '2025-01-01')).toBe('15th 0bln')
  })

  it('hitung partial year (months)', () => {
    expect(hitungUsiaPadaTanggal('2010-06-15', '2025-09-15')).toBe('15th 3bln')
  })

  it('same date returns 0th 0bln', () => {
    expect(hitungUsiaPadaTanggal('2020-05-10', '2020-05-10')).toBe('0th 0bln')
  })

  it('one day before birthday — month not yet reached', () => {
    expect(hitungUsiaPadaTanggal('2010-06-15', '2025-06-14')).toBe('14th 11bln')
  })

  // KONTRAK BERBEDA dari helper legacy (pra-Vue) yang mengembalikan '-':
  //   utils/usia.js sengaja mengembalikan '' untuk input kosong/tak valid supaya
  //   pemanggil memakai `v-if` / sel tabel kosong, bukan mencetak tanda hubung.
  it('tanggal lahir di masa depan → string kosong', () => {
    expect(hitungUsiaPadaTanggal('2030-01-01', '2025-01-01')).toBe('')
  })

  it('input tak valid → string kosong', () => {
    expect(hitungUsiaPadaTanggal(null, '2025-01-01')).toBe('')
    expect(hitungUsiaPadaTanggal('2010-01-01', null)).toBe('')
    expect(hitungUsiaPadaTanggal('not-a-date', '2025-01-01')).toBe('')
    expect(hitungUsiaPadaTanggal('2010-01-01', 'invalid')).toBe('')
  })

  it('menerima format lama DD/MM/YYYY', () => {
    expect(hitungUsiaPadaTanggal('15/06/2010', '15/09/2025')).toBe('15th 3bln')
  })

  it('leap year edge — Feb 29 birth → non-leap acuan', () => {
    // 2000 is leap, 2025 is not. Feb 29 → Feb 28 treated as same month, day-comparison
    const result = hitungUsiaPadaTanggal('2000-02-29', '2025-02-28')
    expect(result).toMatch(/^(24th 11bln|25th 0bln)$/)
  })

  // Objek Date TIDAK didukung (sengaja): parser bekerja per-komponen atas STRING
  // 'YYYY-MM-DD' / 'DD/MM/YYYY' supaya bebas geser timezone. Semua pemanggil di app
  // mengirim string dari DB, jadi kontrak ini yang dijaga.
  it('objek Date tidak didukung → string kosong', () => {
    expect(hitungUsiaPadaTanggal(new Date('2010-01-01'), new Date('2020-01-01'))).toBe('')
  })
})
