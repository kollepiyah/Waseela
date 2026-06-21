# 🤝 HANDOVER — Waseela (Template White-Label Portal Pesantren)

> **Untuk Claude / dev sesi berikutnya:** baca dokumen ini dulu. Ini sumber kebenaran
> mandiri untuk proyek **Waseela** (tak bergantung pada memory Ammu). Update bagian
> **Status** tiap ada kemajuan.
>
> Terakhir diperbarui: **22 Jun 2026** — tambah **ROADMAP DB (migrasi Supabase saat ada pembeli)**. (20 Jun: Fase 0-2 scaffold + Fase A backend port + Fase B test/hardcode.)

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

> **Kapan pertimbangkan Postgres/Supabase?** Sekarang (belum ada pembeli) TETAP Firebase —
> termurah di skala kecil & velocity solo-dev. **Saat sudah ada pembeli bayar → migrasi ke
> Supabase** (rencana baku di bawah: **ROADMAP DB**).

---

## 🔮 ROADMAP DB — Migrasi Waseela ke Supabase  ⟵ TASK (saat sudah ada pembeli)

> **Status: BELUM dimulai — Firebase TETAP sampai ada pembeli bayar.** Catatan hasil diskусi
> **22 Jun 2026**; jadi rencana baku saat Waseela pindah dari Firebase → Postgres demi
> **reporting relasional + multi-tenant murah + biaya terprediksi**.
> **Kerjakan SETELAH** migrasi Ammu→Supabase (Ammu = pathfinder; Waseela pakai ulang polanya
> + TAMBAH lapisan multi-tenant). Pola dasar ada di repo Ammu (`D:\Aplikasi Project\Portal MU`).

**Keputusan baku (multi-tenant — BEDA dari Ammu yang single-tenant):**

| Topik | Keputusan |
|------|-----------|
| **DB** | Supabase Postgres, **region Singapore (ap-southeast-1)** |
| **Multi-tenant** | **SATU project + kolom `tenant_id` + RLS** — BUKAN project-per-lembaga. Tambah pembeli = **tambah BARIS tenant**, bukan project. (Ammu: single-tenant, tanpa tenant_id.) |
| **Auth** | Supabase Auth + RLS untuk **peran** (admin/guru/santri/wali) DAN **scoping per-tenant** |
| **Akun/Org** | 1 akun Supabase; Waseela di **organization TERPISAH** dari Ammu (billing/kuota sendiri) |
| **Tier** | Mulai **Free** (dev/pilot) + DIY backup → **naik Pro ($25/bln) di PEMBELI BAYAR PERTAMA** (BUKAN nunggu "banyak tenant"). Upgrade in-place: 1 klik, project sama, tanpa migrasi |
| **Backup** | GitHub Actions + `pg_dump` (**session pooler :5432**) + rclone → Google Drive, retensi 14 hari |
| **Push** | tetap **FCM** (Firebase diciutkan jadi pipa notifikasi) |
| **Performa non-realtime** | `@tanstack/vue-query` (cache) + pagination + index → terasa instan (~100ms) |

- **Definition-of-ready go-Pro:** ada pelanggan bayar + ada data produksi + backup jalan + region Singapore.
- **Kuota aman:** data per-lembaga kecil (~300–400 MB / lembaga / 5 thn) → 1 project Pro (8 GB included)
  muat puluhan tenant; lebih dari itu bayar storage murah. Nambah pembeli **tidak** bikin kehabisan kuota —
  yang naik cuma sedikit compute/storage di SATU project.

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

### 🎨 BRANDING — REBRAND EMERALD (21 Jun)
Waseela dibedakan dari Ammu (teal) → **brand EMERALD hijau**, layout/UX TETAP sama (cuma warna+logo):
- **Logo baru** `waseela.png` (icon وسيلة hijau) → `tenants/demo/logo.png` + `tenants/_template/logo.png`
  (build-tenant sebar ke favicon/splash/PWA/header).
- **Warna teal→emerald, terpusat:** `tailwind.config.js` remap palet `teal` → emerald (1 sumber, semua
  165 class `teal-*` ikut) · `main.css` `:root`+`.dark` brand vars · `ribbon.css` `--accent`/`--rb-hover` ·
  `index.html`+`manifest` `theme_color` → `#065F46`.
- **`tenant.config.themeColor` kini FUNGSIONAL:** `main.js` inject ke CSS `--theme-color` (ribbon `--accent`)
  + sinkron `<meta theme-color>`; `build-tenant.mjs` patch `manifest.theme_color`. Tiap tenant bisa beda
  warna chrome. Semua tenant Waseela themeColor = `#065F46` (emerald). Primary CTA `#047857`.
- **Verifikasi:** `build-tenant demo` build EXIT 0; dev server login page = emerald + logo baru, 0 error console.
  Berlaku SELURUH Waseela (termasuk referensi mambaul-ulum); **Ammu repo Portal MU TAK tersentuh**.

### 🚀 DEMO DEPLOYED (21 Jun) → https://waseela.web.app
- `firebase deploy --only hosting` (akun hallo@bakafrawi.com, project waseela-id, site `waseela`) + `firebase deploy --only firestore:rules` (sukses). **Storage waseela-id BELUM di-setup** (langkah Console; demo tak butuh upload foto).
- **Seed data dummy** via `node scripts/seed-demo.mjs --project waseela-id` (mode ADC, bukan service-account key). Login: **admin / demo1234** (claim super_admin). Verified: login end-to-end OK, 0 error console, theme emerald aktif.
- **✅ White-label TEKS (SELESAI — 21 Jun, sesi lanjutan):** audit + generickan ke `settings`/"Waseela" tuntas. Kategori A (teks terlihat-user: BantuanView, LoginView pesan WA, AppSidebar, judul notif/Excel/download, PengaturanView default header + "Tes Koneksi" + judul section, ProfilAdmin) + Kategori B (fallback kop/letterhead PDF/struk/rapor di ~14 file → `''`/`'Waseela'`, jadi tenant baru tak pernah cetak "MAMBAUL ULUM"). Sisa "Ammu/Mambaul" HANYA di komentar kode + ID fungsional (CSS `.ammu-*`, `@ammu.local`, channel id `ammu_default`) yang SENGAJA tak diubah. Build vite EXIT 0, 21/21 unit-test PASS.
- **✅ Demo: GATE pilihan demo pra-login (21 Jun, direvisi):** `DemoFeaturePanel.vue` kini SATU permukaan = **gate** terpusat yang muncul tiap pengunjung membuka situs di `/login` (sebelum form login) — pitch + preset paket + toggle modul. **FAB 🎛️ + panel sudut DIHAPUS** (permintaan: jangan langsung ke login, pilih demo dulu). Picu via `watch(isLoginRoute)` (bukan onMounted) karena komponen di-mount di luar `<router-view>`. sessionStorage `waseela_demo_welcome`: '1'=terbuka (pertahankan saat reload toggle), '0'=ditutup ("Masuk ke aplikasi →") jadi form login bisa dipakai; sesi baru tampil lagi. Gated `IS_DEMO`. **Demo = WEB SAJA (tanpa build Android).**
- **✅ Login polish (21 Jun):** tagline (motto) → "Portal Digital Pendidikan" (demo config + seed-demo), nomor versi dihapus, background → warna solid `var(--theme-color)` (emerald) bila admin tak set gambar. **Catatan deploy:** motto live di Firestore demo (`settings/web`+`general`) masih lama — re-seed / `firebase deploy` untuk perbarui situs live.
- **🧹 Repo hygiene (21 Jun):** tambah `.gitattributes` (`eol=lf`) + normalisasi ~20 file yang ke-flip CRLF → diff bersih (48 file, +409/-97). **Catatan:** ada sisa `.git/index.lock` (tak bisa dihapus dari sandbox) — hapus manual sebelum commit: `del .git\index.lock`.

### 🧼 DEEP-CLEAN AMMU + LOGO + GATE WAJIB (21 Jun, sesi lanjutan)
- **Gate demo WAJIB pilih:** tombol ✕ + dismiss klik-backdrop DIHAPUS dari `DemoFeaturePanel.vue` → satu-satunya jalan lanjut = "Masuk ke aplikasi →".
- **Logo Waseela (`waseela.png` → semua ikon):** background square DIHAPUS (transparan) + kaligrafi di-recolor **hijau emerald `#065F46`** (ekstraksi luminance via Pillow). **Splash bg** `#F2FEF9`→**`#ECFDF5`** (terang, kedua mode — logo hijau selalu terlihat). **Logo Bakafrawi** (`bakafrawi-logo.png` + `bakafrawi-footer.png`) hue-shift **teal→emerald**. Push `iconColor` teal `#0F766E`→`#065F46`.
- **Bersih-tuntas Ammu di `app/src`:** CSS class `ammu-*`→`wsl-*` (194×, 8 file) · event `ammu:open-printer-settings`→`waseela:` · key `ammu_default_printer`/`ammu_ribbon_density`→`waseela_*` · channel `ammu_default`→`waseela_default` · native `ic_stat_ammu`→`ic_stat_waseela` (+ `capacitor.config.json`) · komentar "Ammu Online/Ammu Channel/Mambaul" digenerickan · hapus file mati `RaporView.vue.broken.bak`.
- **Service worker push (`firebase-messaging-sw.js`):** dulu **hardcode config Ammu** (`portal-mambaul-ulum`) → kini **DIGENERATE per-tenant** oleh `build-tenant.mjs` (step 4c) dari `firebaseConfig`. Judul fallback dari branding/appName.
- **Domain Auth `@ammu.local`→`@waseela.local`** (aktif) di app+functions+seed; `@ammu.local` jadi **legacy compat** (`authEmailCandidates` coba aktif lalu legacy) → login akun `@ammu.local` lama **tetap jalan tanpa re-seed**. Re-seed (`node scripts/seed-demo.mjs --project waseela-id`) hanya untuk kerapian (akun baru jadi `@waseela.local`).
- **Tenant `mambaul-ulum/` DIHAPUS** dari repo Waseela (config Ammu asli aman di repo Portal MU). Default tenant = `demo`. Docs (README/DEMO/HANDOVER) disesuaikan.
- **Verifikasi:** build EXIT 0, 21/21 test PASS, dev server 0 error console; gate + logo hijau + bakafrawi emerald tervalidasi di browser. **Belum commit/deploy.**

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
# Pengembangan (pakai tenant aktif terakhir; default demo)
cd app && npm install && npm run dev

# Ganti tenant aktif TANPA build
node scripts/build-tenant.mjs <slug> --no-build

# Build produksi untuk 1 lembaga
node scripts/build-tenant.mjs <slug>     # hasil di app/dist
```

> `app/src/tenant.config.js` GENERATED & gitignored. Fresh clone: jalankan
> `node scripts/build-tenant.mjs demo --no-build` dulu agar `npm run dev` jalan.

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
