// Bootstrap Vue 3 SPA
// v.20.0526: Import Tailwind CSS entry — auto-bundle ke dist/assets/index-*.css
import './assets/main.css'
// v.98: token + style shell Ribbon desktop (Electron). Semua selector di-scope .wsl-ribbon-app -> aman utk web/HP.
import './assets/ribbon.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUiStore } from './stores/ui'
// v.21.24.0526: STATIC import auth store — fix race condition dengan router guard.
import { useAuthStore } from './stores/auth'
import { BRAND } from './config/brand'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// ── AUDIT AGU 2026 (#17): jaring galat GLOBAL ────────────────────────────────
// Sebelum ini tak ada `app.config.errorHandler` sama sekali. Akibatnya DUA hal:
//
//   1. Sentry BUTA terhadap galat komponen. Sentry (dimuat dari CDN di bawah)
//      memasang sendiri penangkap `window.onerror` + `unhandledrejection` — jadi
//      galat JS biasa memang sudah terlapor. TAPI Vue MENELAN galat render /
//      lifecycle / watcher / handler-event dan menyalurkannya ke errorHandler
//      yang tak ada, sehingga galat itu tak pernah menyentuh window.onerror.
//      Justru kelas galat inilah yang paling sering mematikan layar.
//   2. Pengguna tak diberi tahu apa pun. Layar kosong atau beku, tanpa sepatah
//      kata. Bagi staf lembaga yang bukan orang teknis hasilnya "aplikasinya
//      rusak" — tanpa jalan keluar, dan tanpa bahan diagnosis.
//
// Sengaja TIDAK memakai @sentry/vue: SDK-nya dimuat dari CDN (menghemat ~250 KB
// di tiap muat, lihat komentar di index.html), jadi integrasi resminya tak
// tersedia sebagai modul. Tiga baris di bawah menggantikannya.
const _GALAT_JEDA_MS = 8000
let _galatTerakhir = 0

function _laporGalat(sumber, err, info) {
  // 1) Konsol — SELALU, dan paling dulu. Ini satu-satunya jejak yang tetap ada
  //    saat Sentry gagal dimuat (CDN diblokir, luring, atau `defer` belum usai).
  console.error(`[galat:${sumber}]`, err, info || '')

  // 2) Sentry — inilah yang menutup kebutaan terhadap galat komponen Vue.
  try {
    window.Sentry?.captureException?.(err, { tags: { sumber }, extra: { info } })
  } catch {
    /* pelapor galat tak boleh ikut melempar galat */
  }

  // 3) Pengguna. Di-jeda: galat render bisa berulang tiap frame, dan toast
  //    beruntun justru menutupi layar yang sedang coba dibaca pengguna.
  try {
    const now = Date.now()
    if (now - _galatTerakhir < _GALAT_JEDA_MS) return
    _galatTerakhir = now
    useUiStore(pinia).toast.error(
      'Terjadi galat tak terduga. Coba ulangi langkah tadi — bila tetap, tutup lalu buka lagi aplikasinya.',
      6000
    )
  } catch {
    /* store belum siap (galat sangat dini) — konsol & Sentry sudah menampung */
  }
}

app.config.errorHandler = (err, _instance, info) => _laporGalat('vue', err, info)

// Sentry sudah MELAPORKAN unhandledrejection sendiri; yang ditambahkan di sini
// semata sisi PENGGUNA, supaya promise yang ditolak tak lagi berakhir sebagai
// layar diam. Penolakan yang memang wajar disaring — batal-navigasi dan fetch
// yang di-abort terjadi normal saat pengguna berpindah halaman dengan cepat,
// dan memberi toast untuk itu hanya akan melatih pengguna mengabaikan toast.
const _GALAT_WAJAR = /AbortError|Navigation (cancelled|aborted)|ResizeObserver|Load failed/i
window.addEventListener('unhandledrejection', (ev) => {
  const r = ev?.reason
  if (_GALAT_WAJAR.test(String(r?.name || r?.message || r || ''))) return
  _laporGalat('promise', r)
})

// F4 (migrasi Supabase): SWR cache utk view yang sudah cutover ke db.js (F6).
// Additif — tak memengaruhi store/firestore yang masih jalan.
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from './services/queryClient'
app.use(VueQueryPlugin, { queryClient })

// v.71.0526: register v-haptic directive globally untuk tombol native feel
import { vHaptic } from './composables/useHaptic'
app.directive('haptic', vHaptic)

// Init dark mode dari storage SEBELUM mount supaya tidak flash
const ui = useUiStore(pinia)
ui.initDarkFromStorage()

// v.21.24.0526: Init auth SEBELUM mount supaya authReady promise tersedia di router guard
const auth = useAuthStore(pinia)
auth.initAuth()

// v.21.24c.0526: STATIC import settings — fix race dengan view init.
import { useSettingsStore } from './stores/settings'
import { APP_VERSION_RAW } from '@/utils/appVersion'
const settingsStore = useSettingsStore(pinia)
settingsStore
  .load()
  .then(() => settingsStore.subscribe())
  .catch(() => {})

// v.91.0626: deteksi Capacitor native — untuk ANTI-DOBEL splash.
const IS_NATIVE = (() => {
  try {
    const C = window.Capacitor
    if (!C) return false
    return typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : !!C.isNative
  } catch {
    return false
  }
})()

// v.20.4.0526: Defensive mount + splash auto-hide (web/PWA)
function hideSplash() {
  const splash = document.getElementById('splash-screen')
  if (splash && !splash.classList.contains('fade-out')) {
    splash.classList.add('fade-out')
    setTimeout(() => {
      document.body.classList.add('app-running')
    }, 600)
  } else if (!document.body.classList.contains('app-running')) {
    document.body.classList.add('app-running')
  }
}

// v.91.0626: picu animasi "muncul" logo (class .reveal di #splash-screen). Idempotent.
function revealSplash() {
  const s = document.getElementById('splash-screen')
  if (s) s.classList.add('reveal')
}

try {
  app.mount('#app')
} catch (mountErr) {
  console.error('[main.js] Vue app.mount FAIL:', mountErr)
}

if (IS_NATIVE) {
  // v.91.0626 IN-APP ANIM (final): splash native = jembatan LATAR mint singkat. Tutup overlay
  // Capacitor ASAP -> web splash terlihat -> MAINKAN animasi logo (reveal, ~2s ala Netflix) +
  // footer (gambar HTML, anti-gepeng). Tak dobel: splash sistem tak menampilkan logo.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
        .catch(() => {})
        .then(() => {
          revealSplash()
          setTimeout(hideSplash, 2400)
        })
    })
  )
  // FALLBACK: kalau plugin tak tersedia/gagal -> tetap reveal + fade-out
  setTimeout(revealSplash, 900)
  setTimeout(() => {
    if (!document.body.classList.contains('app-running')) hideSplash()
  }, 6000)
} else {
  // v.91.0626: Web/PWA — logo di-reveal (animasi Netflix ~2 detik), lalu fade-out.
  requestAnimationFrame(revealSplash)
  const SPLASH_MIN_MS = 2400
  const splashStart = performance.now()
  requestAnimationFrame(() => {
    const elapsed = performance.now() - splashStart
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed)
    setTimeout(hideSplash, remaining)
  })
  // FALLBACK: kalau ada apa-apa yg block, force-hide splash max 6 detik
  setTimeout(() => {
    if (!document.body.classList.contains('app-running')) {
      console.warn('[main.js] Splash fallback hide @ 6s — Vue mount mungkin stuck')
      hideSplash()
    }
  }, 6000)
}

// v.100h: Init Sentry — DSN dari build-time env (VITE_SENTRY_DSN) ATAU default project,
//   dengan Firestore settings/general.sentryDsn sbg OVERRIDE opsional (backward-compat).
//   AKAR FIX (#5 audit): dulu DSN HANYA dari Firestore; field itu KOSONG utk app Vue ->
//   Sentry tak pernah init -> hanya site legacy (DSN hardcoded + masih hidup) yg muncul di
//   dashboard. DSN browser BUKAN rahasia (selalu terekspos di bundle klien) — sama project
//   dgn legacy, dibedakan via release/environment.
const DEFAULT_SENTRY_DSN =
  'https://1bd853a93f9f5d495dcf3e0db5cfe635@o4511390323834880.ingest.us.sentry.io/4511398644088832'
async function initSentry() {
  try {
    // 1) Resolusi DSN dulu (env > default) supaya tak gugur saat field Firestore kosong.
    let dsn = (import.meta.env.VITE_SENTRY_DSN || '').trim() || DEFAULT_SENTRY_DSN
    // 2) Tunggu SDK CDN (window.Sentry) siap — maks 5 dtk (toleran koneksi lambat).
    const t0 = Date.now()
    while (!window.Sentry && Date.now() - t0 < 5000) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (!window.Sentry) return
    // v.110: override DSN dari Firestore DIBUANG (migrasi Supabase). Dulu import('firebase/
    //   firestore') di sini menyeret SELURUH SDK Firestore ke vendor-firebase (~+300KB) PADAHAL
    //   db tak lagi di-ekspor firebase.js -> blok selalu gagal (di-catch). DSN cukup env/default.
    if (!dsn) return
    window.Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      // v.1.0.3: versi dari __APP_VERSION__ (package.json), bukan diketik ulang — tag rilis
      //   Sentry yang salah mengelompokkan galat produksi ke versi yang keliru.
      release: `${BRAND.sentryRelease}@${APP_VERSION_RAW || BRAND.version.replace(/^v\./, '')}`,
      environment: window.location.hostname.includes('localhost') ? 'dev' : 'prod'
    })

    console.log('[main.js] Sentry initialized')
  } catch (e) {
    console.warn('[main.js] Sentry init skipped:', e.message)
  }
}
initSentry()
