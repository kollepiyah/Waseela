// ============================================================================
// WASEELA — Tenant config TEMPLATE (cetakan lembaga baru)
// ============================================================================
// CARA PAKAI:
//   1. Salin folder ini → `tenants/<slug-lembaga>/`  (mis. tenants/al-falah/)
//   2. Isi nilai di bawah (firebaseConfig dari project Firebase BARU lembaga itu).
//   3. Taruh logo: tenants/<slug>/logo.png (+ icon/splash bila build Android).
//   4. Build: `node scripts/build-tenant.js <slug>`
//
// PEMBAGIAN:
//   - BUILD-TIME (wajib di sini): firebaseConfig, appId, appName, theme.
//   - RUNTIME (branding = SEED): admin bisa override via UI Pengaturan.
// ============================================================================
export default {
  slug: '', // WAJIB: pengenal unik, huruf kecil + strip (mis. 'al-falah')

  // === Identitas app (native/build) ===
  appId: '', // mis. 'id.waseela.alfalah' — package Android UNIK per lembaga
  appName: '', // mis. 'Portal Al-Falah'
  themeColor: '#065F46', // warna brand (default Waseela emerald)

  // === Firebase project BARU lembaga ini (Console → Project settings → Web app) ===
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  },

  // === Branding SEED (admin bisa ubah nanti via UI Pengaturan) ===
  branding: {
    namaLembaga: '', // mis. 'Pondok Pesantren Al-Falah'
    namaPondokSingkat: '', // mis. 'Al-Falah'
    txtAppName: '', // mis. 'Portal Al-Falah'
    txtHeaderBar: '',
    appTitle: '',
    motto: '', // mis. 'Generasi Qurani Pewaris Negeri' — tagline halaman login
    kopLine1: '', // baris kop cetak rapor/PDF
    kopLine2: '',
    namaChannel: '', // mis. 'Al-Falah Channel'
    copyrightName: ''
  },

  // === Feature flags (sesuaikan kebutuhan lembaga) ===
  features: {
    keuangan: true,
    tabungan: true,
    pos: true,
    bisyaroh: true,
    hutangPiutang: true,
    absensi: true,
    fingerprint: false,
    psb: true,
    prestasi: true,
    posts: false, // default Waseela: TANPA postingan → beranda tampil KPI dasbor (set true bila mau Ammu Channel)
    kalender: true,
    kritikSaran: true,
    supervisi: true,
    analitik: true
  }
}
