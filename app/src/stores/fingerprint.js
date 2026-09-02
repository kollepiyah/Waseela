// Fingerprint store — config + status + scheduler sinkron mesin absensi
// (Fingerspot, Solution/ZKTeco, Attendance Management).
//
// HANYA berguna di aplikasi Desktop (Electron). Memegang setelan PER-PC (localStorage):
// merek + setelan jalurnya + auto-sync + interval, plus status sync terakhir. Scheduler `setInterval`
// hidup di STORE (singleton, hidup selama app) — bukan di view — supaya auto-sync tetap
// jalan walau user pindah halaman. Engine sinkron tetap di composable useFingerprintSync.
//
// Default auto-sync OFF: hanya PC station (yg di-enable manual) yg menyinkron. init()
// dipanggil 1× dari RibbonLayout supaya auto-sync resume sendiri setelah app restart.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useFingerprintSync } from '@/composables/useFingerprintSync'
import { getAll, deleteOne } from '@/services/db'

const LS_KEY = 'waseela_fp_sync_cfg'
const DEFAULT_INTERVAL = 30 // menit (selaras jembatan Task Scheduler lama)
const MIN_INTERVAL = 5

// Daftar merek yang punya bridge di useFingerprintSync. Dipakai DUA arah: menyaring nilai
// basi dari localStorage, dan menolak nilai asing di setMerek(). Sebelumnya setMerek
// memakai `v === 'solution' ? 'solution' : 'fingerspot'` — pola yang diam-diam melempar
// merek ketiga kembali ke fingerspot, jadi pilihan pembeli tak pernah tersimpan.
const MEREK_SAH = ['fingerspot', 'solution', 'attmdb']

function loadCfg() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) || {}
  } catch (e) {
    /* ignore */
  }
  return {}
}

export const useFingerprintStore = defineStore('fingerprint', () => {
  const cfg = loadCfg()

  // Config (persist)
  // Merek menentukan JALUR, dan jalurnya butuh setelan berbeda:
  //   fingerspot → personnelDir (folder software vendor di PC ini)
  //   solution   → host + port (mesin ditarik langsung lewat jaringan)
  //   attmdb     → mdbPath (att2000.mdb software Attendance Management di PC ini)
  // Disimpan berdampingan, bukan satu field serbaguna: kalau pembeli sempat mencoba
  // ketiganya, setelan yang satu tak menghapus yang lain.
  const merek = ref(MEREK_SAH.includes(cfg.merek) ? cfg.merek : 'fingerspot')
  const personnelDir = ref(String(cfg.personnelDir || '').trim())
  const host = ref(String(cfg.host || '').trim())
  const port = ref(parseInt(cfg.port, 10) || 4370)
  const mdbPath = ref(String(cfg.mdbPath || '').trim())
  const autoSync = ref(!!cfg.autoSync)
  const intervalMin = ref(Math.max(MIN_INTERVAL, parseInt(cfg.intervalMin, 10) || DEFAULT_INTERVAL))

  // Status (lastSyncAt persist; result/error hanya sesi ini)
  const running = ref(false)
  const lastSyncAt = ref(cfg.lastSyncAt || null) // ISO string
  const lastResult = ref(null) // ringkasan sync terakhir { written, skipIzin, takKenal[], luar, ... }
  const lastError = ref(null) // pesan error sync terakhir
  const lastTrigger = ref(null) // 'manual' | 'auto'

  let _timer = null
  let _inited = false

  const fp = useFingerprintSync() // engine sinkron (sync/available)

  // Tersedia hanya di Electron desktop dgn bridge readAttLog.
  function available() {
    return fp.available(merek.value)
  }

  function persist() {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          merek: merek.value,
          personnelDir: personnelDir.value,
          host: host.value,
          port: port.value,
          mdbPath: mdbPath.value,
          autoSync: autoSync.value,
          intervalMin: intervalMin.value,
          lastSyncAt: lastSyncAt.value
        })
      )
    } catch (e) {
      /* ignore */
    }
  }

  // Jalankan satu siklus sinkron. trigger 'manual' (tombol) / 'auto' (scheduler).
  // Anti-tumpang-tindih: skip kalau sedang berjalan. Tak melempar — simpan error ke state.
  async function runNow(trigger = 'manual') {
    if (running.value) return null
    running.value = true
    lastError.value = null
    lastTrigger.value = trigger
    try {
      const res = await fp.sync({
        merek: merek.value,
        personnelDir: personnelDir.value,
        host: host.value,
        port: port.value,
        mdbPath: mdbPath.value,
        commit: true
      })
      lastResult.value = res
      lastSyncAt.value = new Date().toISOString()
      persist()
      return res
    } catch (e) {
      lastResult.value = null
      lastError.value = (e && e.message) || String(e)
      lastSyncAt.value = new Date().toISOString()
      persist()
      return null
    } finally {
      running.value = false
    }
  }

  // Hapus SEMUA absensi hasil sinkron fingerprint (source 'fingerprint') — untuk reset uji coba.
  // TIDAK menyentuh izin/sakit (source 'pengajuan_guru'), impor xlsx ('fingerprint_import'),
  // atau input manual. Hanya super_admin (RLS delete = auth_is_super). Return jumlah dihapus.
  async function hapusHasilScan() {
    if (running.value) return 0
    running.value = true
    try {
      const all = await getAll('absensi_shift_guru')
      const target = (all || []).filter((r) => String(r.source || '') === 'fingerprint')
      let deleted = 0
      for (const r of target) {
        await deleteOne('absensi_shift_guru', r.id, {
          alasan: 'reset riwayat scan fingerprint (uji)'
        })
        deleted++
      }
      lastResult.value = null
      lastError.value = null
      return deleted
    } finally {
      running.value = false
    }
  }

  function stopScheduler() {
    if (_timer) {
      clearInterval(_timer)
      _timer = null
    }
  }

  // (Re)start interval kalau auto-sync aktif & bridge tersedia. Idempoten.
  function startScheduler() {
    stopScheduler()
    if (!autoSync.value || !available()) return
    const ms = Math.max(MIN_INTERVAL, intervalMin.value) * 60 * 1000
    _timer = setInterval(() => {
      runNow('auto')
    }, ms)
  }

  // Setters (persist + sinkronkan scheduler)
  function setMerek(v) {
    merek.value = MEREK_SAH.includes(v) ? v : 'fingerspot'
    persist()
    startScheduler() // jalur berganti → bridge yang dipakai scheduler ikut berganti
  }
  function setHost(v) {
    host.value = String(v || '').trim()
    persist()
  }
  function setPort(v) {
    port.value = parseInt(v, 10) || 4370
    persist()
  }
  function setPersonnelDir(v) {
    personnelDir.value = String(v || '').trim()
    persist()
  }
  function setMdbPath(v) {
    mdbPath.value = String(v || '').trim()
    persist()
  }
  function setAutoSync(v) {
    autoSync.value = !!v
    persist()
    startScheduler() // start bila ON, stop bila OFF
  }
  function setIntervalMin(v) {
    intervalMin.value = Math.max(MIN_INTERVAL, parseInt(v, 10) || DEFAULT_INTERVAL)
    persist()
    if (autoSync.value) startScheduler() // restart dgn interval baru
  }

  // Dipanggil 1× saat shell desktop mount → resume auto-sync pasca-restart.
  // TIDAK menjalankan sync langsung (hindari race dgn login/sesi); tunggu tick pertama.
  function init() {
    if (_inited) return
    _inited = true
    if (autoSync.value && available()) startScheduler()
  }

  return {
    merek,
    personnelDir,
    host,
    port,
    mdbPath,
    autoSync,
    intervalMin,
    running,
    lastSyncAt,
    lastResult,
    lastError,
    lastTrigger,
    available,
    runNow,
    hapusHasilScan,
    startScheduler,
    stopScheduler,
    setMerek,
    setPersonnelDir,
    setMdbPath,
    setHost,
    setPort,
    setAutoSync,
    setIntervalMin,
    init,
    MIN_INTERVAL
  }
})
