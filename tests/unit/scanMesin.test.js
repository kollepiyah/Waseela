// Kyai (13 Agu 2026): "mesin absensi pembeli adalah Solution X609."
//
// X609 (dan merek sejenis) tak pernah mengekspor kolom `shift` — yang keluar adalah
// log mentah: PIN, nama, tanggal, jam, beberapa baris sehari. Importer lama menuntut
// kolom shift, jadi berkas mesin harus dirapikan manual dulu — itulah yang ditutup
// utils/scanMesin.js: shift, jam masuk, dan jam pulang diturunkan APLIKASI, dengan
// aturan yang sama persis dengan sinkron Fingerspot (utils/shiftDerive).
import { describe, it, expect } from 'vitest'
import {
  normalTanggal,
  normalJam,
  bacaBarisScan,
  adaKolomShift,
  rangkumScanMentah
} from '@/utils/scanMesin'
import { SHIFT_LEGACY_KOSONG } from '@/utils/shiftMaster'

// Jam nyata lembaga: pagi 06:00–12:00 (telat 06:45), sore 15:00–17:15 (telat 15:20).
const SETELAN = {
  shiftMaster: [
    {
      id: 'pagi',
      label: 'Pagi',
      untuk: 'guru',
      urutan: 1,
      mulai: '06:00',
      terlambat: '06:45',
      selesai: '12:00'
    },
    {
      id: 'sore',
      label: 'Sore',
      untuk: 'guru',
      urutan: 4,
      mulai: '15:00',
      terlambat: '15:20',
      selesai: '17:15'
    }
  ]
}

const GURU = [
  { id: 'g1', nama: 'Ust. Ahmad', id_fingerprint: '7', shift_ids: ['pagi', 'sore'] },
  { id: 'g2', nama: 'Ust. Basyir', id_fingerprint: '12', shift_ids: ['pagi'] }
]

describe('normalTanggal', () => {
  it('objek Date dibaca sebagai UTC — bukan lokal', () => {
    // ExcelJS menyusun tanggal sel di UTC. Getter lokal di WIB akan menggeser jam
    // 07:12 jadi 14:12, dan tanggal 00:30 UTC jadi hari berikutnya.
    expect(normalTanggal(new Date(Date.UTC(2026, 7, 13, 7, 12)))).toBe('2026-08-13')
    expect(normalTanggal(new Date(Date.UTC(2026, 7, 13, 23, 30)))).toBe('2026-08-13')
  })

  it('serial Excel (angka hari) diterima — banyak ekspor mesin menyimpannya begitu', () => {
    // 46247 = 13 Agu 2026 pada sistem tanggal 1900.
    expect(normalTanggal(46247)).toBe('2026-08-13')
    expect(normalTanggal(46247.5)).toBe('2026-08-13') // ada ekor jam
  })

  it('teks ISO & bentuk Indonesia', () => {
    expect(normalTanggal('2026-08-13')).toBe('2026-08-13')
    expect(normalTanggal('2026/8/3')).toBe('2026-08-03')
    expect(normalTanggal('13-08-2026')).toBe('2026-08-13')
    expect(normalTanggal('13/08/2026')).toBe('2026-08-13')
    expect(normalTanggal('3.8.2026')).toBe('2026-08-03')
  })

  it('kolom gabungan tanggal+jam tetap terbaca tanggalnya', () => {
    expect(normalTanggal('2026-08-13 07:12:33')).toBe('2026-08-13')
    expect(normalTanggal('13/08/2026 07:12')).toBe('2026-08-13')
  })

  it('ambigu DD/MM vs MM/DD: bagian >12 yang menentukan, selebihnya HARI dulu', () => {
    expect(normalTanggal('08/13/2026')).toBe('2026-08-13') // 13 mustahil jadi bulan
    expect(normalTanggal('05/08/2026')).toBe('2026-08-05') // dua-duanya ≤12 → hari dulu
  })

  it('tahun 2 digit dianggap 20xx', () => {
    expect(normalTanggal('13/08/26')).toBe('2026-08-13')
  })

  it('nilai tak masuk akal → kosong', () => {
    for (const v of ['', null, undefined, 'entah', '32/13/2026', 0.35]) {
      expect(normalTanggal(v)).toBe('')
    }
  })
})

describe('normalJam', () => {
  it('objek Date dibaca sebagai UTC', () => {
    expect(normalJam(new Date(Date.UTC(2026, 7, 13, 7, 12)))).toBe('07:12')
  })

  it('pecahan hari (sel jam Excel) → HH:MM', () => {
    expect(normalJam(0.3)).toBe('07:12')
    expect(normalJam(46247.3)).toBe('07:12') // serial berisi tanggal + jam
  })

  it('teks berdetik, berkoma, dan kolom gabungan', () => {
    expect(normalJam('07:12:33')).toBe('07:12')
    expect(normalJam('7.5')).toBe('07:05')
    expect(normalJam('2026-08-13 07:12:33')).toBe('07:12')
    expect(normalJam('6:07')).toBe('06:07')
  })

  it('jam mustahil / kosong → kosong', () => {
    for (const v of ['', null, undefined, '25:00', '07:70', 'pagi']) {
      expect(normalJam(v)).toBe('')
    }
  })
})

describe('bacaBarisScan — nama kolom ekspor mesin berbeda-beda', () => {
  it('kolom terpisah gaya Indonesia', () => {
    expect(bacaBarisScan({ PIN: 7, Nama: 'Ust. Ahmad', Tanggal: '13/08/2026', Jam: '06:30' })).toEqual(
      { pin: '7', nama: 'Ust. Ahmad', tanggal: '2026-08-13', jam: '06:30' }
    )
  })

  it('kolom gaya ZKTeco/Solution (AC-No + Date/Time gabungan)', () => {
    expect(
      bacaBarisScan({ 'AC-No': '12', Name: 'Ust. Basyir', 'Date/Time': '2026-08-13 06:50:11' })
    ).toEqual({ pin: '12', nama: 'Ust. Basyir', tanggal: '2026-08-13', jam: '06:50' })
  })

  it('"No. ID" / "ID Karyawan" ikut dikenali', () => {
    expect(bacaBarisScan({ 'No. ID': '7', Waktu: '2026-08-13 06:30' })?.pin).toBe('7')
    expect(bacaBarisScan({ 'ID Karyawan': '7', Timestamp: '2026-08-13 06:30' })?.pin).toBe('7')
  })

  it('tanpa identitas, atau tanpa tanggal/jam → null (baris ditolak, bukan menebak)', () => {
    expect(bacaBarisScan({ Tanggal: '13/08/2026', Jam: '06:30' })).toBeNull()
    expect(bacaBarisScan({ PIN: '7', Jam: '06:30' })).toBeNull()
    expect(bacaBarisScan({ PIN: '7', Tanggal: '13/08/2026' })).toBeNull()
    expect(bacaBarisScan(null)).toBeNull()
  })
})

describe('adaKolomShift — pemilah jalur lama vs log mentah', () => {
  it('berkas hasil rapian manual (punya kolom shift) dikenali', () => {
    expect(adaKolomShift([{ tanggal: '2026-08-13', jam: '06:30', shift: 'pagi' }])).toBe(true)
  })

  it('log mentah mesin → false', () => {
    expect(adaKolomShift([{ PIN: '7', 'Date/Time': '2026-08-13 06:30' }])).toBe(false)
  })

  it('kolom shift ada tapi seluruhnya kosong → tetap dianggap log mentah', () => {
    expect(adaKolomShift([{ PIN: '7', Tanggal: '2026-08-13', Jam: '06:30', Shift: '' }])).toBe(false)
  })
})

describe('rangkumScanMentah — sehari penuh dari mesin', () => {
  // Log khas X609: scan dobel saat masuk, lalu ceklok pulang tiap shift.
  const rows = [
    { PIN: '7', Nama: 'Ust. Ahmad', 'Date/Time': '2026-08-13 06:30:02' }, // masuk pagi
    { PIN: '7', Nama: 'Ust. Ahmad', 'Date/Time': '2026-08-13 06:30:41' }, // verifikasi dobel
    { PIN: '7', Nama: 'Ust. Ahmad', 'Date/Time': '2026-08-13 11:50:00' }, // pulang pagi
    { PIN: '7', Nama: 'Ust. Ahmad', 'Date/Time': '2026-08-13 15:10:00' }, // masuk sore
    { PIN: '7', Nama: 'Ust. Ahmad', 'Date/Time': '2026-08-13 17:05:00' } // pulang sore
  ]
  const hasil = rangkumScanMentah(rows, GURU, SETELAN)

  it('scan terawal tiap shift jadi jam masuk', () => {
    expect(hasil.masuk).toHaveLength(2)
    const pagi = hasil.masuk.find((r) => r.shift === 'pagi')
    expect(pagi).toMatchObject({
      docId: 'shift_g1_2026-08-13_pagi',
      guru_id: 'g1',
      jam: '06:30',
      status: 'hadir'
    })
    expect(hasil.masuk.find((r) => r.shift === 'sore')).toMatchObject({
      jam: '15:10',
      status: 'hadir'
    })
  })

  it('scan dobel 39 detik setelah masuk TIDAK jadi jam pulang', () => {
    const pagi = hasil.pulang.find((r) => r.shift === 'pagi')
    expect(pagi.jam_pulang).toBe('11:50') // bukan 06:30
  })

  it('pulang tercatat untuk kedua shift, ambil yang terakhir', () => {
    expect(hasil.pulang).toHaveLength(2)
    expect(hasil.pulang.find((r) => r.shift === 'sore').jam_pulang).toBe('17:05')
  })

  it('menghitung baris terbaca & ditolak', () => {
    const campur = rangkumScanMentah([...rows, { PIN: '7' }, {}], GURU, SETELAN)
    expect(campur.total).toBe(7)
    expect(campur.terbaca).toBe(5)
    expect(campur.ditolak).toBe(2)
  })
})

describe('rangkumScanMentah — status, pencocokan, dan diagnosa', () => {
  it('datang lewat batas → terlambat', () => {
    const h = rangkumScanMentah(
      [{ PIN: '12', Tanggal: '13/08/2026', Jam: '07:10' }],
      GURU,
      SETELAN
    )
    expect(h.masuk[0]).toMatchObject({ guru_id: 'g2', shift: 'pagi', status: 'terlambat' })
  })

  it('PIN tak dikenal dilaporkan, tidak ditulis diam-diam', () => {
    const h = rangkumScanMentah(
      [{ PIN: '99', Nama: 'Entah Siapa', Tanggal: '13/08/2026', Jam: '06:30' }],
      GURU,
      SETELAN
    )
    expect(h.masuk).toHaveLength(0)
    expect(h.takKenal).toEqual(['99'])
  })

  it('tanpa PIN, cocok lewat NAMA (huruf besar-kecil diabaikan)', () => {
    const h = rangkumScanMentah(
      [{ Nama: 'ust. ahmad', Tanggal: '13/08/2026', Jam: '06:30' }],
      GURU,
      SETELAN
    )
    expect(h.masuk[0].guru_id).toBe('g1')
  })

  it('guru dikenal tapi jamnya di luar semua window → tanpaWindow, bukan hilang diam-diam', () => {
    const h = rangkumScanMentah(
      [
        { PIN: '12', Tanggal: '13/08/2026', Jam: '13:30' },
        { PIN: '12', Tanggal: '13/08/2026', Jam: '14:00' }
      ],
      GURU,
      SETELAN
    )
    expect(h.masuk).toHaveLength(0)
    expect(h.pulang).toHaveLength(0) // tak ada baris masuk → tak ada tempat menempel
    expect(h.tanpaWindow).toEqual([
      {
        nama: 'Ust. Basyir',
        tanggal: '2026-08-13',
        jam: ['13:30', '14:00'],
        sebab: 'jam di luar window shift'
      }
    ])
  })

  it('guru tanpa shift dibedakan sebabnya — itu salah konfigurasi, bukan jam mesin', () => {
    // shift_ids kosong TIDAK berarti tanpa shift (turun ke aturan data lama). "Tanpa
    // shift" yang sesungguhnya = penanda SHIFT_LEGACY_KOSONG — lihat shiftMaster.js.
    const guruTanpaShift = [
      { id: 'g9', nama: 'Ust. Cholil', id_fingerprint: '20', shift: SHIFT_LEGACY_KOSONG }
    ]
    const h = rangkumScanMentah(
      [{ PIN: '20', Tanggal: '13/08/2026', Jam: '06:30' }],
      guruTanpaShift,
      SETELAN
    )
    expect(h.tanpaWindow[0].sebab).toBe('guru belum punya shift')
  })

  it('hari yang sudah punya baris masuk TIDAK ikut dilaporkan tanpaWindow', () => {
    // Scan pulang memang jatuh di luar window masuk — itu normal, bukan masalah.
    const h = rangkumScanMentah(
      [
        { PIN: '12', Tanggal: '13/08/2026', Jam: '06:30' },
        { PIN: '12', Tanggal: '13/08/2026', Jam: '12:30' }
      ],
      GURU,
      SETELAN
    )
    expect(h.tanpaWindow).toHaveLength(0)
    expect(h.pulang[0].jam_pulang).toBe('12:30')
  })

  it('daftar kosong / bukan array → hasil kosong, tanpa lempar galat', () => {
    const h = rangkumScanMentah(null, GURU, SETELAN)
    expect(h).toMatchObject({ total: 0, terbaca: 0, masuk: [], pulang: [] })
  })
})
