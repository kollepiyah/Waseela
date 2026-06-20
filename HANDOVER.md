# 🤝 HANDOVER — Waseela (Template White-Label Portal Pesantren)

> **Untuk Claude / dev sesi berikutnya:** baca dokumen ini dulu. Ini sumber kebenaran
> mandiri untuk proyek **Waseela** (tak bergantung pada memory Ammu). Update bagian
> **Status** tiap ada kemajuan.
>
> Terakhir diperbarui: **20 Jun 2026** (Fase 0-2 scaffold + **Fase A backend port** + **Fase B test/hardcode**).

---

## 🎯 TL;DR

**Waseela** = produk **white-label** (jual aplikasi portal pesantren ke banyak lembaga)
diturunkan dari **Ammu Online** (aplikasi Pondok Mambaul Ulum). Satu kode bersama +
lapisan config per-lembaga. Tiap lembaga ganti nama/logo/fitur tanpa ubah kode.

- **Backend:** Firebase (TETAP) — akun + project BARU per lembaga.
- **Frontend:** Vue 3 (sama persis Ammu).
- **Status:** Fase 0-2 (scaffold/config/flags) + **Fase A (backend Firebase port)** + **Fase B (test+hardcode)** + **Paket (Basic/Pro/Premium) & Demo interaktif** **SELESAI & build hijau (17 test PASS)**. Fase D (go-live lembaga #1) **DITAHAN** (fokus produk+demo dulu). Sisa: native Android (Fase C), seed+deploy demo (jalankan sendiri — lihat `DEMO.md`), lalu Fase D.
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
│       ├── config/plans.js       # Paket Basic/Pro/Premium + resolveFeatures (plan+overrides)
│       ├── composables/useFeatures.js   # feature-flags (isOn, featureForPath) + override demo
│       ├── composables/useDemo.js       # mode demo (panel toggle fitur, reload-based)
│       ├── components/demo/DemoFeaturePanel.vue  # panel demo (muncul bila tenant.demo=true)
│       ├── config/__tests__ + composables/__tests__   # 17 unit-test (vitest)
│       ├── services/firebase.js  # firebaseConfig + FUNCTIONS_BASE (derive projectId) dari tenant.config
│       └── stores/settings.js    # branding default dari tenant.config.branding (+ motto/psbPublicUrl seed)
├── functions/                    # Fase A: Cloud Functions (port Ammu, 19 trigger, project-agnostic)
│   ├── index.js                  #   _BQ_PROJECT=process.env.GCLOUD_PROJECT (auto per-tenant)
│   └── package.json              #   Node 24; deps firebase-admin + bigquery + cheerio
├── firebase.json                 # Fase A: 1 hosting site → app/dist + firestore/storage/functions
├── firestore.rules               # Fase A: RBAC custom-claim (project-agnostic, port Ammu)
├── firestore.indexes.json        # Fase A: kosong (composite index dibuat via link Console saat query)
├── storage.rules                 # Fase A: rules Storage (port Ammu)
├── .firebaserc                   # DIGENERATE build-tenant dari firebaseConfig.projectId (gitignored)
├── tenants/
│   ├── _template/tenant.config.js   # cetakan lembaga baru (salin ini)
│   ├── mambaul-ulum/tenant.config.js # tenant referensi #1 (= Ammu, nilai asli)
│   └── demo/tenant.config.js     # tenant DEMO (demo:true, plan:premium) — showcase jualan
├── scripts/
│   ├── build-tenant.mjs          # set config aktif + patch capacitor + gen .firebaserc + (opsional) build
│   └── seed-demo.mjs             # isi project sandbox demo (admin + data dummy) via Admin SDK
├── DEMO.md                       # runbook setup & deploy demo (tanpa functions, Spark gratis)
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

### Paket (plan) & pemilihan fitur

- **`app/src/config/plans.js`**: preset **Basic / Pro / Premium** (`PLANS`) + `resolveFeatures(cfg)`.
  Tenant cukup set `plan: 'pro'` di config + boleh kustom à la carte via `featureOverrides`.
  Tanpa `plan` → pakai `features` lama (backward-compat). Matriks paket → ubah di file ini.
- **Demo interaktif** (`tenant.config.demo: true`): panel melayang (pojok kanan-bawah) untuk
  nyala/matikan modul → app refresh menampilkan paket berbeda. Lihat **`DEMO.md`** (setup+deploy,
  tanpa functions/Spark gratis) + `scripts/seed-demo.mjs` (data dummy). Panel & override demo
  TIDAK aktif di build tenant asli (gated `IS_DEMO`).

> ⚠️ **Fix white-label penting (P0):** `services/auth.js` & `services/analytics.js` dulu
> meng-hardcode URL Cloud Functions project **Ammu** (`portal-mambaul-ulum`) → login guru/santri
> & analitik SEMUA tenant nyasar ke Ammu. Kini `FUNCTIONS_BASE` di `services/firebase.js`
> derive dari `firebaseConfig.projectId`. Link PSB `ammuonline-psb.web.app` → `settings.psbPublicUrl`.

### Feature-flags (cara kerja)

- `app/src/composables/useFeatures.js`: `isOn(key)` (default ON kecuali `false` eksplisit;
  **parent-inheritance**: pos/tabungan/bisyaroh/hutangPiutang anak `keuangan`, fingerprint
  anak `absensi`) + `featureForPath(path)` (peta path→flag).
- **Gate terpusat (BUKAN tag tiap item):**
  - `composables/useMenus.js` → sembunyikan menu modul yang off.
  - `router/index.js` beforeEach → blok deep-link modul off → redirect /dashboard.
  - `views/DashboardView.vue` → `posts` off ⇒ beranda tampil `DasborPendidikan` (KPI), bukan feed Ammu Channel.
- Flag terwire: posts, keuangan(+sub pos/tabungan/bisyaroh/hutangPiutang), absensi
  (+anak fingerprint, **absensiSekolah**), psb, prestasi, **kenaikan**, **rapor**,
  **kegiatanPesantren**, supervisi, analitik, kritikSaran.
  (kalender tetap di flag runtime lama `fiturKalender`; `fiturTesKenaikan` runtime tetap berlaku
  BERSAMA flag build-time `kenaikan` — keduanya komposit di menu.)
- **rapor** gate `/rapor` (menu Rapor Semester + deep-link). **absensiSekolah** gate mode "Absen
  Sekolah" di `AbsensiSantriView` (komponen — Basic Qiraati hanya Absen Ngaji). Keduanya = fitur
  lembaga sekolah → paket Pro+. **kenaikan** gate `/naik-kelas`+`/kenaikan`+`/tes-kenaikan` (Basic+).
  **kegiatanPesantren** gate `/kegiatan-pesantren` (Premium-only). Backward-compat: config
  `features` lama (Ammu) tanpa key → default ON.

---

## ✅ STATUS PROGRES

| Fase | Isi | Status |
|------|-----|--------|
| **0. Scaffold** | folder + salin source Ammu ke `app/` (tanpa node_modules/native/secret) | ✅ |
| **1. Ekstraksi config** | tenant.config.js (template+mambaul-ulum) + wire firebase.js/settings.js + 7 hardcode branding ke settings + build-tenant.mjs | ✅ **build verified** |
| **2. Feature-flags** | useFeatures + gate menu/router/beranda | ✅ **build verified** |
| **A. Backend Firebase** | port rules/indexes/storage + firebase.json ramping (1 site→app/dist) + functions (19 trigger, digenerickan: `_BQ_PROJECT`=runtime, notif/UA generik) + .firebaserc per-tenant via build-tenant | ✅ **build hijau, deploy = Fase D** |
| **B. Test + hardcode** | Vitest + **10/10 unit-test PASS** (useFeatures) + footer "Portal MU"→generik + motto→tenant.config.branding | ✅ **build + test hijau** |
| **Git** | `git init` (repo sendiri, terpisah Ammu), commit `6861f28`, branch master | ✅ |

> ⚠️ **Koreksi klaim lama:** sebelum Fase B, HANDOVER menyebut "unit-test 7/7 PASS" padahal
> tak ada test framework/file di repo. Fase B memperbaikinya: Vitest terpasang, 10 test nyata
> (`app/src/composables/__tests__/useFeatures.test.js`), `npm run test` hijau.

### ⏳ SISA (belum dikerjakan)
1. **Fase C — Native Android scaffold:** `cd app && npx cap add android && npx cap sync` (appId/appName otomatis dari `capacitor.config.json` yang dipatch build-tenant). Lalu aset per-tenant (icon/splash via `@capacitor/assets`) + keystore + `google-services.json` lembaga → `./gradlew bundleRelease` (AAB).
2. **Fase D — Provisioning & go-live lembaga #1:** isi `tenants/<slug>` (firebaseConfig lengkap), aktifkan Auth/Firestore(asia-southeast2)/Storage + **upgrade Blaze**, `firebase deploy` (rules+indexes+storage+functions), set secret, seed admin+import data, deploy hosting, smoke-test. **Lihat runbook backend di bawah.**
3. **(Skala besar nanti) Naik ke C1 multi-tenant:** tenantId di semua koleksi + rules isolasi (security-critical, wajib rules unit-test) + signup mandiri + billing (Midtrans/Stripe).

### 🚀 RUNBOOK BACKEND (Fase D — deploy ke project lembaga)
```bash
# 0. Prasyarat: Firebase CLI login, project lembaga sudah dibuat + Blaze aktif.
node scripts/build-tenant.mjs <slug> --no-build   # set config aktif + generate .firebaserc
firebase use <projectId>                          # atau biarkan .firebaserc (default) yang menarget

# 1. Deploy rules + indexes + storage (aman, tak butuh Blaze)
firebase deploy --only firestore:rules,firestore:indexes,storage

# 2. Cloud Functions (BUTUH Blaze). Install dep dulu:
cd functions && npm ci && cd ..
firebase deploy --only functions

# 3. Secret per-project (hanya bila fitur dipakai):
firebase functions:secrets:set IFRAMELY_KEY        # link-preview di posts/Ammu Channel
firebase functions:secrets:set BMT_WEBHOOK_SECRET  # hanya bila integrasi BMT
firebase functions:secrets:set BMT_DISBURSE_SECRET

# 4. (Opsional) BigQuery extensions — HANYA bila features.analitik=true (mahal, lambat):
#    pasang 8 extension firestore-bigquery-export + storage-extract-image-text via:
firebase ext:install firebase/firestore-bigquery-export   # ulang per dataset (santri/guru/keuangan/…)

# 5. Build & deploy web
node scripts/build-tenant.mjs <slug>               # build app/dist
firebase deploy --only hosting
```
> **Catatan:** `firestore.indexes.json` kosong — bila ada query composite, Firestore akan
> melempar error berisi link "create index". Klik saat smoke-test, atau export indeks Ammu live.
> `_BQ_PROJECT` otomatis = project tenant (runtime), jadi analitik menarget BigQuery sendiri.

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
