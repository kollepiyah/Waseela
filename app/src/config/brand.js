// ============================================================================
// BRAND — SUMBER TUNGGAL identitas bawaan aplikasi.
//
// Dua lapis yang sengaja dipisah:
//
//   1. IDENTITAS PRODUK (tetap, tak berubah antar pembeli)
//      Nama app, judul header, hak cipta. Ini merek Waseela milik Bakafrawi Project.
//
//   2. IDENTITAS LEMBAGA PEMBELI (kosong saat dikirim)
//      kopLine*, kopImageUrl, namaLembaga, namaChannel. SENGAJA kosong/generik supaya
//      tak ada identitas lembaga lain yang bocor ke cetakan. Pembeli mengisinya sendiri
//      lewat UI Pengaturan (tersimpan di DB, menimpa nilai di sini tanpa rebuild).
//
// ATURAN: JANGAN menulis literal identitas (nama lembaga/app) langsung di komponen atau
// util. Semua fallback harus menunjuk ke sini — supaya mengganti merek = mengedit SATU
// berkas, dan audit `grep` bisa dipercaya.
// ============================================================================
export const BRAND = {
  // ── Identitas produk (tetap) ──────────────────────────────────────────────
  appName: 'Waseela',
  appTitle: 'Waseela',
  txtHeaderBar: 'Waseela',
  copyrightName: 'BAKAFRAWI PROJECT', // tahun dirender dinamis di komponen
  version: 'v.1.0.0', // versi rilis Waseela (selaras app/package.json & android versionName)
  sentryRelease: 'waseela',

  // ── Identitas lembaga pembeli (diisi lewat UI Pengaturan) ─────────────────
  // Dipakai sebagai fallback saat settings belum terisi. Kosong = renderer melewati
  // baris itu, jadi tak ada nama lembaga asing yang tercetak.
  namaLembaga: 'Waseela',
  namaPondokSingkat: 'Waseela',
  kopLine1: '',
  kopLine2: '',
  kopImageUrl: '', // gambar baris-1 kop surat; kosong = pakai teks kopLine1
  motto: '',
  namaChannel: 'Channel',

  // ── Alamat layanan (diisi saat provisioning pembeli) ──────────────────────
  hostingUrl: 'https://waseela.web.app', // sumber app-version.json utk pembaruan Android
  psbUrl: '', // situs PSB/PPDB publik; kosong = tautan disembunyikan

  // ── Kanal rilis (APK & installer desktop) ─────────────────────────────────
  // artifactBase TERIKAT pada app/electron/package.json (build.nsis.artifactName dan
  // argumen --config.nsis.artifactName di skrip win7). Kalau salah satu diubah,
  // tests/unit/unduhanRilis.test.js GAGAL — itu memang tujuannya.
  releaseRepo: 'https://github.com/kollepiyah/waseela',
  artifactBase: 'Waseela'
}

// ── Firebase: HANYA pipa notifikasi (FCM) + App Check ────────────────────────
// Data, auth, dan storage semuanya Supabase — Firebase tidak menyentuh data lembaga.
// Ganti blok ini dengan project Firebase milik pembeli saat provisioning (Fase 3),
// lalu regenerate `public/firebase-messaging-sw.js` agar cocok.
// Kunci VAPID (Web Push certificate) — TERIKAT pada project Firebase di bawah.
// Ambil di: Firebase Console → Project settings → Cloud Messaging →
//           Web Push certificates → Key pair.
//
// WAJIB dari project yang SAMA dengan FIREBASE_CONFIG. Kunci milik project lain
// ditolak dengan `401 token-subscribe-failed`, dan pesannya menyesatkan — berbunyi
// "missing required authentication credential", seolah masalah izin, padahal
// kuncinya sekadar bukan milik project ini.
//
// Kosong = notifikasi web push DIMATIKAN dengan tenang (tanpa galat merah di konsol).
// Fungsi lain aplikasi tak terpengaruh sama sekali.
export const VAPID_KEY = ''

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDEd5UKDcsy0QC1B1x_75L1VaTgasTzGTE',
  authDomain: 'waseela-id.firebaseapp.com',
  projectId: 'waseela-id',
  storageBucket: 'waseela-id.firebasestorage.app',
  messagingSenderId: '31586326439',
  appId: '1:31586326439:web:c8f394228777130242c882',
  measurementId: 'G-0P9771H5GE'
}

export default BRAND
