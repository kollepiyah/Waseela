// Settings store — `savedSettings` di legacy
// Halaman 'pengaturan-web' adalah PoC migration pertama
// v.61.0526: SYNC FIX — legacy Pengaturan save ke settings/general, Vue baca dari sini.
// Tetap baca settings/web untuk Vue-only settings (Pengaturan PoC Vue), merge keduanya.
// Subscribe ke 'general' real-time supaya kalibrasi Hijri / kop / logo update otomatis di Vue.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getOne, mergeOne, subscribeDoc } from '@/services/firestore'
import tenantConfig from '@/tenant.config.js'

const SETTINGS_DOC_ID_VUE = 'web' // Firestore: settings/web (Vue Pengaturan PoC)
const SETTINGS_DOC_ID_LEGACY = 'general' // Firestore: settings/general (legacy Pengaturan Web — source of truth)
// WASEELA white-label: default branding dari tenant.config.js (SEED per lembaga).
//   Semua ini bisa di-override admin via UI Pengaturan → tersimpan di Firestore settings/web.
const _b = tenantConfig.branding || {}
const DEFAULT_SETTINGS = {
  namaLembaga: _b.namaLembaga || 'Waseela',
  namaPondokSingkat: _b.namaPondokSingkat || 'Waseela',
  txtAppName: _b.txtAppName || 'Waseela',
  txtHeaderBar: _b.txtHeaderBar || 'Waseela',
  appTitle: _b.appTitle || 'Waseela',
  motto: _b.motto || '', // tagline di halaman login (seed tenant.config.branding.motto)
  kopLine1: _b.kopLine1 || '',
  kopLine2: _b.kopLine2 || '',
  kopLine3: '',
  kopLine4: '',
  logoUrl: '',
  logoKop: '',
  logoQiraati: '',
  alamat: '',
  noTelp: '',
  fiturBeranda: true,
  fiturKalender: true,
  fiturKritikSaran: true,
  fiturNotifikasi: true,
  namaChannel: _b.namaChannel || 'Channel',
  // v.21.10.0526: Ma'had tagihan template + sub-kategori (kyai spec final)
  mahad_tagihan_template: [],  // [{ kategori: 'makan', nominal_default: 0 }]
  mahad_sub_kategori: [],       // ['makan', 'listrik', 'air', dst]
  tarif_fullday_default: 0,     // Fullday extra fix nominal (admin input)
  // v.100 Batch11: integrasi Google Sheet (Apps Script Web App) — kirim laporan rapi mirip PDF
  gsheetUrl: '',
  gsheetToken: ''
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({ ...DEFAULT_SETTINGS })
  const isLoading = ref(false)
  const error = ref(null)
  let unsubscribe = null

  // Getters
  const kopLines = computed(() => [
    settings.value.kopLine1,
    settings.value.kopLine2,
    settings.value.kopLine3,
    settings.value.kopLine4
  ].filter(Boolean))

  // v.61.0526: Track 2 subscription handles (web + general docs)
  let unsubscribeGeneral = null

  // Actions
  // v.47.0526: silent retry on offline error — Firestore akan delivery via subscribe() saat reconnect
  // v.61.0526: Load BOTH settings/general (legacy source of truth) + settings/web (Vue PoC), merge keduanya
  async function load(retryCount = 0) {
    if (isLoading.value) return // dedup parallel calls
    isLoading.value = true
    error.value = null
    try {
      const [legacyData, vueData] = await Promise.all([
        getOne('settings', SETTINGS_DOC_ID_LEGACY).catch(() => null),
        getOne('settings', SETTINGS_DOC_ID_VUE).catch(() => null)
      ])
      // Merge: DEFAULT < vueData < legacyData (legacy menang karena live source of truth)
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...(vueData || {}),
        ...(legacyData || {})
      }
    } catch (e) {
      const isOffline = e?.code === 'unavailable' || /offline/i.test(e?.message || '')
      if (isOffline && retryCount < 2) {
        isLoading.value = false
        setTimeout(() => load(retryCount + 1), 1500)
        return
      }
      error.value = e.message || String(e)
      if (!isOffline) {
        // eslint-disable-next-line no-console
        console.error('[settings/load]', e)
      }
    } finally {
      isLoading.value = false
    }
  }

  function subscribe() {
    // v.61.0526: subscribe ke kedua doc — general (legacy) + web (Vue PoC)
    if (!unsubscribe) {
      unsubscribe = subscribeDoc('settings', SETTINGS_DOC_ID_VUE, (data) => {
        if (data) settings.value = { ...settings.value, ...data, ...(_lastLegacyData || {}) }
      })
    }
    if (!unsubscribeGeneral) {
      unsubscribeGeneral = subscribeDoc('settings', SETTINGS_DOC_ID_LEGACY, (data) => {
        if (data) {
          _lastLegacyData = data
          // Legacy data overrides Vue (legacy = source of truth)
          settings.value = { ...settings.value, ...data }
        }
      })
    }
  }

  let _lastLegacyData = null

  function unsubscribeNow() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (unsubscribeGeneral) {
      unsubscribeGeneral()
      unsubscribeGeneral = null
    }
  }

  async function save(patch) {
    isLoading.value = true
    error.value = null
    try {
      const merged = { ...settings.value, ...patch }
      // v.21.105.0527: save ke KEDUA doc.
      // settings/general (legacy, source of truth) supaya semua consumer
      // termasuk legacy Pengaturan Web v0 ikut update.
      // settings/web (Vue PoC) tetap sbg backup/audit.
      // Sebelumnya hanya save ke /web → legacy /general overwrite di subscribe
      // → kalibrasiHijri, kop, dll tampak "tidak tersimpan" padahal sudah.
      await Promise.all([
        mergeOne('settings', SETTINGS_DOC_ID_LEGACY, merged),
        mergeOne('settings', SETTINGS_DOC_ID_VUE, merged)
      ])
      settings.value = merged
    } catch (e) {
      error.value = e.message || String(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function reset() {
    settings.value = { ...DEFAULT_SETTINGS }
  }

  return {
    settings,
    isLoading,
    error,
    kopLines,
    load,
    subscribe,
    unsubscribeNow,
    save,
    reset
  }
})
