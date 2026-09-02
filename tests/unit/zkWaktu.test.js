// Pembongkaran waktu & catatan absensi mesin ZKTeco/Solution (jalur TCP 4370).
//
// KENAPA DIUJI DARI BERKAS BUILD, bukan dari src: modul sumbernya TypeScript di
// app/electron dan tak ikut pipeline Vite. Yang diuji di sini justru yang BENAR-BENAR
// DIKAPALKAN — app/electron/build/solution-sync.js ikut ter-commit dan itulah yang
// dijalankan Electron. Kalau seseorang mengubah .ts tapi lupa `npm run build`, tes ini
// menguji versi lama; itu disengaja — ia menjaga artefak yang dipakai, bukan niatnya.
//
// KENAPA PENTING: mesinnya ada di tempat pembeli dan tak bisa dijangkau dari sini, jadi
// tak ada satu pun jalur di modul itu yang pernah diuji ke perangkat sungguhan. Aritmetika
// pengemasan waktu inilah bagian yang paling mudah salah DAN paling sunyi kalau salah —
// hasilnya tetap berupa tanggal yang masuk akal, cuma meleset. Ia dipagari di sini.

import { describe, it, expect } from 'vitest'
import { decodeZkTime, decodeRecord } from '../../app/electron/build/solution-sync.js'

/**
 * Kebalikan dari decodeZkTime — dipakai untuk menyusun contoh uji.
 * Perhatikan basisnya: hari berbasis 31 dan bulan berbasis 12, BUKAN jumlah hari
 * sebenarnya per bulan. Itu memang cara perangkat mengemasnya.
 */
function encodeZkTime({ year, month, day, hour, minute, second }) {
  let v = (year - 2000) * 12 + (month - 1)
  v = v * 31 + (day - 1)
  v = v * 24 + hour
  v = v * 60 + minute
  v = v * 60 + second
  return v
}

describe('decodeZkTime — bongkar waktu terkemas mesin', () => {
  it('nilai 0 = slot kosong, bukan 1 Januari 2000', () => {
    // Log mesin yang belum penuh menyisakan slot bernilai 0. Kalau ini diterjemahkan
    // jadi tanggal sungguhan, ribuan "absensi" hantu tahun 2000 akan ikut tertulis.
    expect(decodeZkTime(0)).toBe('')
  })

  it('membongkar balik apa yang dikemas', () => {
    const contoh = [
      { year: 2026, month: 9, day: 1, hour: 7, minute: 12, second: 33 },
      { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 1 },
      { year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 59 },
      { year: 2030, month: 6, day: 15, hour: 13, minute: 5, second: 0 }
    ]
    for (const c of contoh) {
      const teks =
        `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')} ` +
        `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}:${String(c.second).padStart(2, '0')}`
      expect(decodeZkTime(encodeZkTime(c))).toBe(teks)
    }
  })

  it('nilai acuan tetap (kalau ini berubah, aritmetikanya bergeser)', () => {
    // 857113953 dihitung tangan dari rumus pengemasan untuk 1 Sep 2026 07:12:33.
    // Angka mati ini menangkap pergeseran basis (mis. hari jadi berbasis 30) yang
    // uji bolak-balik di atas TIDAK akan menangkap — sebab ia memakai rumus yang sama.
    expect(decodeZkTime(857113953)).toBe('2026-09-01 07:12:33')
  })

  it('jam dinding mesin tidak digeser zona waktu PC', () => {
    // Ini inti "JAM MESIN ADALAH SUMBER KEBENARAN" di kepala modul. Kalau suatu saat
    // ada yang menyisipkan `new Date(...)` lalu memformatnya, tengah malam di mesin
    // akan bergeser sebesar offset zona PC dan absensi pindah hari tanpa ada yang sadar.
    const tengahMalam = encodeZkTime({ year: 2026, month: 3, day: 10, hour: 0, minute: 0, second: 0 })
    expect(decodeZkTime(tengahMalam)).toBe('2026-03-10 00:00:00')
    const sedetikSebelum = encodeZkTime({ year: 2026, month: 3, day: 9, hour: 23, minute: 59, second: 59 })
    expect(decodeZkTime(sedetikSebelum)).toBe('2026-03-09 23:59:59')
  })

  it('tahun di luar akal ditolak, bukan diteruskan', () => {
    expect(decodeZkTime(0xffffffff)).toBe('')
  })
})

describe('decodeRecord — satu catatan absensi 40 byte', () => {
  const NUL = String.fromCharCode(0)

  /** Susun satu catatan seperti yang dikirim mesin. */
  function rekam(pin, waktu) {
    const buf = Buffer.alloc(40)
    buf.writeUInt16LE(7, 0) // nomor urut internal — tak dipakai
    buf.write(String(pin).padEnd(9, NUL), 2, 9, 'ascii')
    buf.writeUInt32LE(encodeZkTime(waktu), 27)
    return buf
  }

  it('mengambil PIN dan waktu', () => {
    const rec = rekam('1042', { year: 2026, month: 9, day: 1, hour: 6, minute: 45, second: 10 })
    expect(decodeRecord(rec)).toEqual({ device_pin: '1042', timestamp: '2026-09-01 06:45:10' })
  })

  it('padding NUL dibuang — PIN tak ikut membawa byte kosong', () => {
    // PIN dipadatkan sampai 9 byte. Kalau paddingnya ikut terbawa, pencocokan ke
    // guru.id_fingerprint GAGAL SELURUHNYA dan setiap scan jadi "PIN tak dikenal".
    const rec = rekam('7', { year: 2026, month: 9, day: 1, hour: 6, minute: 45, second: 10 })
    expect(decodeRecord(rec).device_pin).toBe('7')
    expect(decodeRecord(rec).device_pin.length).toBe(1)
  })

  it('slot kosong dibuang, bukan jadi baris absensi', () => {
    expect(decodeRecord(Buffer.alloc(40))).toBeNull()
  })

  it('PIN kosong dengan waktu sah tetap dibuang', () => {
    // Tanpa PIN tak ada guru yang bisa ditunjuk — barisnya tak berguna dan hanya
    // akan muncul sebagai "PIN tak dikenal" yang membingungkan.
    const rec = rekam('', { year: 2026, month: 9, day: 1, hour: 6, minute: 45, second: 10 })
    expect(decodeRecord(rec)).toBeNull()
  })
})
