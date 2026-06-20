# 🤝 HANDOVER — Waseela (Template White-Label Portal Pesantren)

> **Untuk Claude / dev sesi berikutnya:** baca dokumen ini dulu. Ini sumber kebenaran
> mandiri untuk proyek **Waseela** (tak bergantung pada memory Ammu). Update bagian
> **Status** tiap ada kemajuan.
>
> Terakhir diperbarui: **20 Jun 2026** (sesi awal scaffold Fase 0-2).

---

## 🎯 TL;DR

**Waseela** = produk **white-label** (jual aplikasi portal pesantren ke banyak lembaga)
diturunkan dari **Ammu Online** (aplikasi Pondok Mambaul Ulum). Satu kode bersama +
lapisan config per-lembaga. Tiap lembaga ganti nama/logo/fitur tanpa ubah kode.

- **Backend:** Firebase (TETAP) — akun + project BARU per lembaga.
- **Frontend:** Vue 3 (sama persis Ammu).
- **Status:** Fase 0 (scaffold) + Fase 1 (ekstraksi config) + Fase 2 (feature-flags) **SELESAI & build verified**. Sudah `git init`.
- **Folder ini TERPISAH dari Ammu** (`D:\Aplikasi Project\Portal MU`). Jangan campur.

---

## 🧭 KEPUTUSAN KUNCI (sudah final)

| Topik | Keputusan | Alasan |
|------|-----------|--------|
| **Backend** | **Firebase**, akun+project baru per lembaga | Solo dev (velocity), offline kuat, reuse RBAC+rules+BigQuery, biaya termurah di skala kecil (no floor bulanan) |
| **Pendekatan** | **B (template build-per-tenant)** sekarang → **C1 (multi-tenant)** saat skala besar | B = on-ramp untuk 1-5 lembaga; config-nya dipakai ulang di C1. JANGAN copy-paste fork (jebakan maintenance) |
| **Sifat perbedaan antar-lembaga** | **Murni config/flags** (nyala-mati modul, branding, skema nilai) — BUKAN koding custom | Kalau custom per-lembaga = jadi software-house, bukan produk |
| **Target lembaga pertama** | **Mirip Mambaul Ulum** (pesantren Qiraati/Diniyah) | Skema akademik (rapor/kenaikan) PAKAI ULANG, nol kode baru |
| **Skala awal** | 1-2 lembaga | Pemicu naik ke C1: tagihan Firestore membengkak (read) ATAU mentok query relasional |

> **Kapan pertimbangkan Postgres/Supabase?** Hanya bila skala besar + butuh SQL relasional
> berat + ada tim. Sekarang TIDAK — Firebase termurah di skala kecil & velocity solo-dev.

---

## 🏗️ ARSITEKTUR & STRUKTUR

```
Waseela/
├── app/                          # SATU kode (dari vue-app Ammu). JANGAN edit utk branding.
│   └── src/
│       ├── tenant.config.js      # ACTIVE config — DIGENERATE (gitignored), jangan edit langsung
│       ├── composables/useFeatures.js   # feature-flags (isOn, featureForPath)
│       ├── services/firebase.js  # baca firebaseConfig dari tenant.config
│       └── stores/settings.js    # branding default dari tenant.config.branding
├── tenants/
│   ├── _template/tenant.config.js   # cetakan lembaga baru (salin ini)
│   └── mambaul-ulum/tenant.config.js # tenant referensi #1 (= Ammu, nilai asli)
├── scripts/build-tenant.mjs      # set config aktif + patch capacitor + (opsional) build
├── README.md                     # ringkas cara pakai
└── HANDOVER.md                   # dokumen ini
```

### Pembagian config (PENTING)

| Tipe | Di mana | Contoh | Bisa diubah admin? |
|------|---------|--------|--------------------|
| **Build-time** | `tenants/<slug>/tenant.config.js` | `firebaseConfig`, `appId`, `appName`, `themeColor` | ❌ harus rebuild |
| **Runtime (branding)** | seed di `tenant.config.branding` → diisi admin | nama lembaga, kop, logo, kontak, channel | ✅ via UI Pengaturan (Firestore `settings/web`) |
| **Feature-flags** | `tenant.config.features` | `keuangan`, `psb`, `posts`, `fingerprint`, dst | ❌ build-time |

> Branding di app sebagian besar **sudah data-driven** (baca `settings` store). Hardcode
> "Mambaul Ulum"/"Ammu" mayoritas cuma **fallback**. Skema akademik (rapor/kenaikan/jenjang)
> = data-driven via UI MasterData/FieldSchema — lembaga mirip Mambaul Ulum tak perlu kode baru.

### Feature-flags (cara kerja)

- `app/src/composables/useFeatures.js`: `isOn(key)` (default ON kecuali `false` eksplisit;
  **parent-inheritance**: pos/tabungan/bisyaroh/hutangPiutang anak `keuangan`, fingerprint
  anak `absensi`) + `featureForPath(path)` (peta path→flag).
- **Gate terpusat (BUKAN tag tiap item):**
  - `composables/useMenus.js` → sembunyikan menu modul yang off.
  - `router/index.js` beforeEach → blok deep-link modul off → redirect /dashboard.
  - `views/DashboardView.vue` → `posts` off ⇒ beranda tampil `DasborPendidikan` (KPI), bukan feed Ammu Channel.
- Flag terwire: posts, keuangan(+sub), absensi, psb, prestasi, supervisi, analitik, kritikSaran.
  (kalender & tesKenaikan sengaja tetap di flag runtime lama `fiturKalender`/`fiturTesKenaikan`.)

---

## ✅ STATUS PROGRES

| Fase | Isi | Status |
|------|-----|--------|
| **0. Scaffold** | folder + salin source Ammu ke `app/` (tanpa node_modules/native/secret) | ✅ |
| **1. Ekstraksi config** | tenant.config.js (template+mambaul-ulum) + wire firebase.js/settings.js + 7 hardcode branding ke settings + build-tenant.mjs | ✅ **build verified** |
| **2. Feature-flags** | useFeatures + gate menu/router/beranda | ✅ **build + unit-test 7/7 PASS** |
| **Git** | `git init` (repo sendiri, terpisah Ammu), commit `6861f28`, branch master, 235 file bersih | ✅ |

### ⏳ SISA (belum dikerjakan)
1. **Native Android scaffold:** `npx cap add android` + `npx cap sync` (appId otomatis dari `capacitor.config.json` yang dipatch build-tenant). Lalu rakit AAB per lembaga (butuh keystore + project Firebase + `google-services.json` lembaga itu).
2. **Aset per-tenant:** logo/icon/splash (script sudah salin `tenants/<slug>/logo.png` bila ada).
3. **Hardcode kecil sisa:** tagline `motto` (LoginView) + footer "Portal MU" belum digenerickan.
4. **(Skala besar nanti) Naik ke C1 multi-tenant:** tenantId di semua koleksi + rules isolasi (security-critical, wajib rules unit-test) + signup mandiri + billing (Midtrans/Stripe).

---

## 🛠️ CARA KERJA

```bash
# Pengembangan (pakai tenant aktif terakhir; default mambaul-ulum)
cd app && npm install && npm run dev

# Ganti tenant aktif TANPA build
node scripts/build-tenant.mjs <slug> --no-build

# Build produksi untuk 1 lembaga
node scripts/build-tenant.mjs <slug>     # hasil di app/dist
```

> `app/src/tenant.config.js` GENERATED & gitignored. Fresh clone: jalankan
> `node scripts/build-tenant.mjs mambaul-ulum --no-build` dulu agar `npm run dev` jalan.

### Tambah lembaga baru
1. `cp -r tenants/_template tenants/<slug>`
2. Buat **project Firebase BARU** untuk lembaga itu → isi `firebaseConfig`.
3. Isi `appId`, `appName`, `branding`, atur `features` (nyala/mati modul).
4. (opsional) taruh `tenants/<slug>/logo.png`.
5. `node scripts/build-tenant.mjs <slug>` → deploy `app/dist` ke hosting lembaga.

---

## 💰 PRICING (kerangka awal — belum final, validasi ke 1-2 lembaga pertama)

- **Prinsip:** jual NILAI (ganti Excel/manual, transparansi wali, hemat waktu). Biaya
  terbesar = WAKTU support solo-dev. Tahunan > bulanan. HINDARI "beli putus".
- **Model:** Hybrid = setup sekali (impor data+training+branding) + langganan tahunan
  bertingkat (tier = feature-flags).
- **Tier (ILUSTRASI IDR):** Basic 1,5-3jt/th · Pro 3-6jt/th · Premium 6-12jt/th. Atau
  per-santri Rp 10-25rb/santri/th (adil + auto-ikut biaya Firebase).
- **1-2 lembaga pertama** = founding customer (diskon tukar testimoni, TAPI tetap berbayar).
- **Pertanyaan terbuka:** segmen target (kecil ≤150 vs 300+), preferensi model (flat/per-santri/gabungan).

---

## ⚠️ CATATAN PENTING

1. **JANGAN sentuh Ammu** (`D:\Aplikasi Project\Portal MU`) saat kerja Waseela — folder terpisah, repo terpisah. Ammu produksi hidup & tak boleh terpengaruh.
2. **Tiap lembaga = project Firebase TERPISAH** (isolasi data otomatis di fase B). Jangan campur data antar-lembaga.
3. **Rules unit-test wajib** saat nanti naik ke C1 (isolasi tenant = satu-satunya batas; salah = data bocor antar-lembaga).
4. **Desain hemat-read** (paginasi/counter/cache + laporan berat ke BigQuery) — biar biaya Firestore terkendali di skala.
5. Konteks lengkap Ammu (deploy, keamanan, versi) ada di **memory proyek Portal MU**
   (`MEMORY.md` + `project_whitelabel_template.md`), auto-load bila sesi dibuka dari folder Ammu.

---

## 🔗 RUJUKAN
- `README.md` — ringkas struktur & cara pakai.
- Memory Ammu: `project_whitelabel_template.md` (status detail), `project_play_version_ledger.md`, `project_security_findings.md`.
- Repo Ammu: `D:\Aplikasi Project\Portal MU` (sumber kode asal).
