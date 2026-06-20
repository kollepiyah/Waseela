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
  hostingSite: 'waseela', // project waseela-id punya 2 site → demo ke 'waseela' (waseela.web.app)

  // === Paket baseline (premium = semua modul nyala; pelanggan toggle turun via panel) ===
  plan: 'premium',
  featureOverrides: {}, // kosong — semua dikontrol panel demo saat runtime

  // === Firebase project SANDBOX (waseela-id) ===
  firebaseConfig: {
    apiKey: 'AIzaSyDEd5UKDcsy0QC1B1x_75L1VaTgasTzGTE',
    authDomain: 'waseela-id.firebaseapp.com',
    projectId: 'waseela-id',
    storageBucket: 'waseela-id.firebasestorage.app',
    messagingSenderId: '31586326439',
    appId: '1:31586326439:web:c8f394228777130242c882',
    measurementId: 'G-0P9771H5GE'
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
