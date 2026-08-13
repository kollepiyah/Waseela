// Kotak unggah impor sejak dulu menulis `accept=".xlsx,.csv"`, padahal importFile
// hanya memuat xlsx lewat ExcelJS — setiap CSV berakhir "Parse gagal". Ketahuan saat
// mesin absensi pembeli (Solution X609) ternyata mengekspor CSV dari aplikasi bawaannya.
import { describe, it, expect } from 'vitest'
import { parseDelimitedText } from '@/composables/useExcel'

describe('parseDelimitedText', () => {
  it('CSV biasa → objek per baris, header dari baris pertama', () => {
    const rows = parseDelimitedText('PIN,Nama,Tanggal,Jam\n7,Ust. Ahmad,13/08/2026,06:30')
    expect(rows).toEqual([
      { PIN: '7', Nama: 'Ust. Ahmad', Tanggal: '13/08/2026', Jam: '06:30' }
    ])
  })

  it('pemisah titik-koma & tab ikut dikenali (ekspor mesin & Excel lokal)', () => {
    expect(parseDelimitedText('PIN;Nama\n7;Ust. Ahmad')[0]).toEqual({ PIN: '7', Nama: 'Ust. Ahmad' })
    expect(parseDelimitedText('PIN\tNama\n7\tUst. Ahmad')[0]).toEqual({
      PIN: '7',
      Nama: 'Ust. Ahmad'
    })
  })

  it('nilai berkutip yang memuat pemisah tidak terpecah', () => {
    const rows = parseDelimitedText('PIN,Nama\n7,"Ahmad, S.Pd"')
    expect(rows[0].Nama).toBe('Ahmad, S.Pd')
  })

  it('kutip ganda di dalam kutip = satu tanda kutip', () => {
    expect(parseDelimitedText('A,B\n1,"kata ""kunci"""')[0].B).toBe('kata "kunci"')
  })

  it('baris kop di atas header dilewati — header = baris ber-sel-berbeda terbanyak', () => {
    const teks =
      'LAPORAN ABSENSI,,\nPeriode : Agustus 2026,,\nPIN,Nama,Waktu\n7,Ust. Ahmad,2026-08-13 06:30'
    const rows = parseDelimitedText(teks)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ PIN: '7', Nama: 'Ust. Ahmad', Waktu: '2026-08-13 06:30' })
  })

  it('CRLF, baris kosong, dan kolom tanpa judul tidak merusak hasil', () => {
    const rows = parseDelimitedText('PIN,Nama,\r\n\r\n7,Ust. Ahmad,x\r\n')
    expect(rows[0]).toMatchObject({ PIN: '7', Nama: 'Ust. Ahmad', col3: 'x' })
  })

  it('teks kosong / tanpa kolom → daftar kosong, bukan galat', () => {
    expect(parseDelimitedText('')).toEqual([])
    expect(parseDelimitedText(null)).toEqual([])
    expect(parseDelimitedText('cuma satu kolom\nisi')).toEqual([])
  })
})
