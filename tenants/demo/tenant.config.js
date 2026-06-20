// ============================================================================
// WASEELA — Tenant config: DEMO (showcase untuk calon pelanggan)
// ============================================================================
// Build: `node scripts/build-tenant.mjs demo`
//   → app menampilkan PANEL DEMO (pojok kanan-bawah) untuk nyala/matikan modul.
//
// PENTING:
//   - `demo: true`  → mengaktifkan panel toggle fitur (lihat useDemo / DemoFeaturePanel).
//   - `plan: 'premium'` → baseline SEMUA modul nyala, jadi calon pelanggan bisa
//     mematikannya satu-satu untuk lihat tampilan paket Basic/Pro.
//   - Pakai project Firebase SANDBOX (bukan produksi lembaga). Isi firebaseConfig di bawah.
//   - Demo TIDAK butuh Cloud Functions (cukup Spark gratis) — fitur server (notif massal,
//     analitik live) tak aktif; demo fokus PAMER TAMPILAN + data dummy.
// ============================================================================
export default {
  slug: 'demo',
  demo: true, // ⟵ aktifkan panel demo

  // === Identitas app ===
  appId: 'id.waseela.demo',
  appName: 'Waseela Demo',
  themeColor: '#0F766E',

  // === Paket baseline (premium = semua modul nyala; pelanggan toggle turun via panel) ===
  plan: 'premium',
  featureOverrides: {}, // kosong — semua dikontrol panel demo saat runtime

  // === Firebase project SANDBOX (Console → Project settings → Web app) — ISI INI ===
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  },

  // === Branding demo (SEED; bisa diubah admin via UI Pengaturan) ===
  branding: {
    namaLembaga: 'Pondok Pesantren Demo Waseela',
    namaPondokSingkat: 'Demo Waseela',
    txtAppName: 'Waseela Demo',
    txtHeaderBar: 'Waseela Demo',
    appTitle: 'Waseela — Demo Portal Pesantren',
    motto: 'Coba semua fitur, pilih yang Anda butuhkan',
    kopLine1: 'PONDOK PESANTREN DEMO',
    kopLine2: 'PORTAL WASEELA',
    namaChannel: 'Demo Channel',
    copyrightName: 'Waseela'
  }
}
