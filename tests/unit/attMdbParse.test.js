// Pengurai keluaran pembaca att2000.mdb (jalur Attendance Management / ZKTeco).
//
// KENAPA DIUJI DARI BERKAS BUILD, bukan dari src: sama alasannya dengan zkWaktu.test.js —
// modul sumbernya TypeScript di app/electron dan tak ikut pipeline Vite. Yang diuji di
// sini adalah app/electron/build/att-mdb-sync.js, artefak yang BENAR-BENAR dikapalkan.
//
// KENAPA PENTING: pembacaannya menumpang PowerShell 32-bit + Jet 4.0, dan diukur 2 Sep 2026
// DUA cara cepat yang menggoda (Recordset.GetString dan Format() di dalam SQL) memformat
// tanggal lewat locale Windows. Di Windows berbahasa Indonesia keduanya menghasilkan
// '06.32.11' — pemisah jam jadi titik. Bentuk itu tetap "tanggal yang masuk akal", lolos
// tanpa galat, lalu GAGAL diurai splitTs() di useFingerprintSync — hasilnya seluruh scan
// hilang diam-diam dan layar melapor "0 scan" tanpa sebab yang kelihatan.
//
// Jadi tes ini bukan sekadar menguji parser: ia memagari SATU keputusan rancangan — bahwa
// hanya 'YYYY-MM-DD HH:MM:SS' yang diterima, dan apa pun yang berbau locale ditolak
// DI SINI, bukan jauh di hilir.

import { describe, it, expect } from 'vitest'
import { parseBarisAttMdb } from '../../app/electron/build/att-mdb-sync.js'

const TAB = '\t'
const baris = (pin, waktu) => pin + TAB + waktu

describe('parseBarisAttMdb — keluaran pembaca → baris scan', () => {
  it('membaca PIN dan waktu apa adanya', () => {
    const out = [baris('1042', '2026-09-01 06:45:10'), baris('7', '2026-09-01 12:05:40')].join('\n')
    expect(parseBarisAttMdb(out)).toEqual([
      { device_pin: '1042', timestamp: '2026-09-01 06:45:10' },
      { device_pin: '7', timestamp: '2026-09-01 12:05:40' }
    ])
  })

  it('akhir baris CRLF ikut ditangani', () => {
    // PowerShell menulis CRLF. Kalau '\r' ikut terbawa ke timestamp, pencocokan pola
    // gagal dan SELURUH keluaran terbuang — gejalanya "0 scan", bukan galat.
    const out = baris('1042', '2026-09-01 06:45:10') + '\r\n' + baris('1043', '2026-09-01 06:46:02') + '\r\n'
    expect(parseBarisAttMdb(out)).toHaveLength(2)
    expect(parseBarisAttMdb(out)[0].timestamp).toBe('2026-09-01 06:45:10')
  })

  it('PIN tetap teks — nol di depan tidak hilang', () => {
    // BADGENUMBER di mesin bisa '007'. Kalau ia sempat jadi angka, pencocokan ke
    // guru.id_fingerprint ('007') gagal dan gurunya masuk sebagai "PIN tak dikenal".
    const hasil = parseBarisAttMdb(baris('007', '2026-09-01 06:45:10'))
    expect(hasil[0].device_pin).toBe('007')
  })

  describe('penjaga locale — bentuk waktu yang bukan ISO harus DITOLAK', () => {
    // Ketiganya keluaran nyata yang terekam saat pembandingan cara baca, bukan karangan.
    it('pemisah jam titik (Recordset.GetString & Format() di Windows id-ID)', () => {
      expect(parseBarisAttMdb(baris('1042', '2026-01-01 06.32.11'))).toEqual([])
    })

    it('tanggal gaya lokal dd/MM/yyyy', () => {
      expect(parseBarisAttMdb(baris('1042', '01/01/2026 06.32.11'))).toEqual([])
    })

    it('jam 12-jam berimbuhan AM/PM', () => {
      expect(parseBarisAttMdb(baris('1042', '2026-01-01 06:32:11 AM'))).toEqual([])
    })
  })

  describe('baris cacat dibuang, bukan diteruskan setengah jadi', () => {
    it('baris tanpa tab', () => {
      expect(parseBarisAttMdb('1042 2026-09-01 06:45:10')).toEqual([])
    })

    it('PIN kosong walau waktunya sah', () => {
      // Tanpa PIN tak ada guru yang bisa ditunjuk — sikap yang sama dengan
      // decodeRecord() di solution-sync.ts.
      expect(parseBarisAttMdb(baris('', '2026-09-01 06:45:10'))).toEqual([])
      expect(parseBarisAttMdb(baris('   ', '2026-09-01 06:45:10'))).toEqual([])
    })

    it('waktu kosong', () => {
      expect(parseBarisAttMdb(baris('1042', ''))).toEqual([])
    })

    it('satu baris rusak tak menjatuhkan baris lain', () => {
      // Ini alasan baris cacat dibuang alih-alih melempar: satu catatan aneh di database
      // pembeli tak boleh membatalkan sinkron setahun.
      const out = [
        baris('1042', '2026-09-01 06:45:10'),
        'sampah tanpa tab',
        baris('1043', '2026-09-01 06:46:02')
      ].join('\n')
      expect(parseBarisAttMdb(out).map((r) => r.device_pin)).toEqual(['1042', '1043'])
    })
  })

  it('masukan kosong / tak berbentuk → daftar kosong, bukan galat', () => {
    expect(parseBarisAttMdb('')).toEqual([])
    expect(parseBarisAttMdb(null)).toEqual([])
    expect(parseBarisAttMdb(undefined)).toEqual([])
    expect(parseBarisAttMdb('\r\n\r\n')).toEqual([])
  })
})
