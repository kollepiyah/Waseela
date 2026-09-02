// Pemilihan JALUR sinkron mesin: merek → bridge Electron → bentuk argumen.
//
// KENAPA DIUJI: sejak 2 Sep 2026 ada TIGA sumber scan (Fingerspot, Solution/ZKTeco lewat
// TCP, Attendance Management lewat att2000.mdb) yang semuanya mengembalikan bentuk sama.
// Kesebangunan itu justru yang membuat salah-sambung SUNYI: memanggil bridge yang benar
// dengan argumen milik merek lain tidak melempar galat — main process cuma menerima objek
// kosong, memakai lokasi bawaan, lalu mengembalikan 0 baris. Layar melapor "0 scan" dan
// tak ada satu pun petunjuk bahwa yang salah adalah perkabelannya.
//
// Karena itu yang dipagari di sini bukan hasil sinkronnya, melainkan DUA hal sempit:
// bridge mana yang dipanggil, dan argumen apa yang dibawanya.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Sinkron menulis ke Supabase lewat services/db. Di sini tak ada yang perlu ditulis —
// daftar guru kosong membuat semua scan berhenti sebagai "PIN tak dikenal", dan itu cukup:
// yang diuji adalah pengambilan scan, bukan penulisannya.
vi.mock('@/services/db', () => ({
  getAll: vi.fn(async () => []),
  getOne: vi.fn(async () => null),
  setOne: vi.fn(async () => undefined),
  mergeOne: vi.fn(async () => undefined)
}))

import { useFingerprintSync } from '@/composables/useFingerprintSync'

function pasangBridge({ fingerspot = true, solution = true, attmdb = true } = {}) {
  const balas = vi.fn(async () => ({ ok: true, rows: [] }))
  const api = {}
  if (fingerspot) api.readAttLog = vi.fn(balas)
  if (solution) api.readZkAttLog = vi.fn(balas)
  if (attmdb) api.readAttMdbLog = vi.fn(balas)
  globalThis.window.electronAPI = api
  return api
}

describe('jalur sinkron mesin — merek menentukan bridge & argumen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    delete globalThis.window.electronAPI
  })

  it('attmdb → readAttMdbLog, membawa mdbPath', async () => {
    const api = pasangBridge()
    const { sync } = useFingerprintSync()
    await sync({ merek: 'attmdb', mdbPath: 'D:\\Absensi\\att2000.mdb' })

    expect(api.readAttMdbLog).toHaveBeenCalledWith({ mdbPath: 'D:\\Absensi\\att2000.mdb' })
    // Bridge lain tak boleh ikut terpanggil — inilah bentuk salah-sambung yang sunyi itu.
    expect(api.readAttLog).not.toHaveBeenCalled()
    expect(api.readZkAttLog).not.toHaveBeenCalled()
  })

  it('attmdb tanpa path → objek kosong, biar main process memakai lokasi bawaan', async () => {
    const api = pasangBridge()
    const { sync } = useFingerprintSync()
    await sync({ merek: 'attmdb' })
    expect(api.readAttMdbLog).toHaveBeenCalledWith({})
  })

  it('solution → readZkAttLog, membawa host & port', async () => {
    const api = pasangBridge()
    const { sync } = useFingerprintSync()
    await sync({ merek: 'solution', host: '192.168.1.201', port: 4370 })
    expect(api.readZkAttLog).toHaveBeenCalledWith({ host: '192.168.1.201', port: 4370 })
    expect(api.readAttMdbLog).not.toHaveBeenCalled()
  })

  it('fingerspot → readAttLog, membawa personnelDir', async () => {
    const api = pasangBridge()
    const { sync } = useFingerprintSync()
    await sync({ merek: 'fingerspot', personnelDir: 'C:\\FP' })
    expect(api.readAttLog).toHaveBeenCalledWith({ personnelDir: 'C:\\FP' })
    expect(api.readAttMdbLog).not.toHaveBeenCalled()
  })

  it('merek asing jatuh ke fingerspot, bukan meledak', async () => {
    const api = pasangBridge()
    const { sync } = useFingerprintSync()
    await sync({ merek: 'entah-apa' })
    expect(api.readAttLog).toHaveBeenCalled()
  })

  describe('available() — Desktop versi lama belum punya bridge merek baru', () => {
    it('false kalau bridge-nya tak ada, bukan galat gelap saat sinkron', () => {
      // Pembeli bisa saja memilih merek baru di PC yang aplikasinya belum diperbarui.
      // Di sana available() harus jujur bilang tidak, supaya layar menampilkan pesan
      // "hanya tersedia di Desktop" — bukan gagal dengan 'fn is not a function'.
      pasangBridge({ attmdb: false })
      const { available } = useFingerprintSync()
      expect(available('attmdb')).toBe(false)
      expect(available('fingerspot')).toBe(true)
      expect(available('solution')).toBe(true)
    })

    it('false di web/HP — tak ada electronAPI sama sekali', () => {
      const { available } = useFingerprintSync()
      expect(available('attmdb')).toBe(false)
      expect(available('fingerspot')).toBe(false)
    })
  })

  it('sinkron menolak jalan kalau bridge-nya tak ada', async () => {
    pasangBridge({ attmdb: false })
    const { sync } = useFingerprintSync()
    await expect(sync({ merek: 'attmdb' })).rejects.toThrow(/Desktop/)
  })
})
