// ============================================================================
// WASEELA — Tenant config: Pondok Pesantren Mambaul Ulum (tenant referensi #1)
// ============================================================================
// File ini = SUMBER KEBENARAN build-time untuk SATU lembaga.
// Build: `node scripts/build-tenant.js mambaul-ulum`
//   → menyalin file ini ke `app/src/tenant.config.js` lalu build app.
//
// CATATAN pembagian config:
//   - BUILD-TIME (di sini): firebaseConfig, appId, appName, theme — TAK bisa runtime.
//   - RUNTIME (branding di bawah = SEED default): admin bisa override lewat UI
//     Pengaturan → tersimpan di Firestore settings/web. Jadi nilai di sini hanya
//     dipakai bila settings kosong / build awal.
// ============================================================================
export default {
  slug: 'mambaul-ulum',

  // === Identitas app (native/build — TAK bisa diubah runtime) ===
  appId: 'app.ammu.id', // package Android / bundle id
  appName: 'Ammu Online', // nama launcher + judul window
  themeColor: '#065F46', // warna brand (status bar, splash) — Waseela emerald

  // === Firebase (TIAP lembaga = PROJECT FIREBASE TERPISAH) ===
  firebaseConfig: {
    apiKey: 'AIzaSyBdZexExhs-vCnAOXRK6DSj4uUUTMGWlEE',
    authDomain: 'portal-mambaul-ulum.firebaseapp.com',
    projectId: 'portal-mambaul-ulum',
    storageBucket: 'portal-mambaul-ulum.firebasestorage.app',
    messagingSenderId: '289365012301',
    appId: '1:289365012301:web:c5b2655559043783221104',
    measurementId: 'G-59LNXJ9MVH'
  },

  // === Branding SEED (default; admin override via UI Pengaturan → settings/web) ===
  branding: {
    namaLembaga: 'Pondok Pesantren Mambaul Ulum',
    namaPondokSingkat: 'Mambaul Ulum',
    txtAppName: 'Ammu Online',
    txtHeaderBar: 'Ammu Online',
    appTitle: 'Ammu Online — Pondok Pesantren Mambaul Ulum',
    motto: 'Generasi Qurani Pewaris Negeri', // tagline halaman login
    kopLine1: 'PONDOK PESANTREN MAMBAUL ULUM',
    kopLine2: 'PORTAL PRESTASI QIRAATI',
    namaChannel: 'Al Manshur Channel',
    copyrightName: 'Mambaul Ulum'
  },

  // === Feature flags (nyala/mati modul per lembaga = tier harga) ===
  features: {
    keuangan: true, // tagihan, pembayaran, buku induk
    tabungan: true, // tabungan + uang saku santri
    pos: true, // POS kasir santri
    bisyaroh: true, // gaji/bisyaroh guru
    hutangPiutang: true,
    absensi: true, // absensi santri + guru
    fingerprint: false, // integrasi mesin fingerprint (Premium)
    psb: true, // pendaftaran santri baru
    prestasi: true, // rekap + capaian prestasi
    posts: true, // Ammu Channel
    kalender: true, // kalender pendidikan
    kritikSaran: true,
    supervisi: true, // catatan Direktur/Supervisor
    analitik: true // Laporan BigQuery (Premium)
  }
}
