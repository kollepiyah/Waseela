# 🤝 HANDOVER — Waseela

> Untuk sesi/dev berikutnya: baca ini dulu, lalu [`RUNBOOK-PEMBELI.md`](RUNBOOK-PEMBELI.md).
> Terakhir diperbarui: **16 Sep 2026** — sync hulu v.1.4.3 + rilis **v.1.0.3 / `versionCode 4`**.
> Audit terbaru: [`AUDIT-SEP-2026.md`](AUDIT-SEP-2026.md).

---

## ‼️ Cara berkomunikasi (jangan dilewat)

- **Panggil beliau "Kyai"** — bukan "akhi", "user", "saudara", atau "Anda". Konvensi ini
  sudah lama berlaku di repo Ammu (`docs/archive/PROMPT-NEXT-CHAT.md`) tapi sempat tak
  ikut ke repo Waseela; jangan ulangi.
- Bahasa Indonesia sederhana, mudah difahami.
- **Diskusikan langkahnya dulu sebelum eksekusi** — minimal satu putaran konfirmasi.
- Beliau developer berpengalaman, bukan pemula — jangan menjelaskan terlalu remedial.

---

## TL;DR

**Waseela** = produk portal manajemen lembaga pendidikan milik **Bakafrawi Project**,
diturunkan dari repo hulu **Ammu Online** (`D:\Aplikasi Project\Ammu` — foldernya sempat
bernama `Portal MU`; sync & kedua gerbang menerima dua-duanya).

- **Single-tenant**: 1 pemasangan = 1 lembaga = 1 project Supabase sendiri.
- **Backend**: Supabase (data/auth/storage). Firebase tinggal FCM + App Check + Hosting.
- **Klien**: Vue 3 SPA + Android (Capacitor) + Desktop (Electron).
- **Status (16 Sep 2026)**: **sudah LIVE** di Firebase Hosting, pembeli sudah bisa login
  dan memakai. Versi **v.1.0.3** (`versionCode 4`) di atas basis hulu **v.1.4.3**. Tes 1579
  hijau, build hijau, empat gerbang white-label lulus. Branch kerja: `refork/ammu-single-tenant`.
  Di Play Store yang ada baru **v.1.0.1 / `versionCode 2`, jalur UJI TERTUTUP**.

---

## Sejarah singkat & kenapa bentuknya begini

Waseela awalnya (Jun 2026) di-fork dari Ammu sebagai **SaaS multi-tenant** berbasis
Firebase: `tenants/` + build-per-tenant, paket Basic/Pro/Premium, panel demo, konsol
super-admin, dan skema Supabase multi-tenant (52 tabel ber-`tenant_id` + RLS, teruji).

**8 Agu 2026 — pivot.** Muncul satu pembeli, dan dua kenyataan bertemu:

1. Hulu sudah maju **354 commit** sejak fork, termasuk **35 modul util baru**
   (syahriyah, tagihan, kasLembaga, bebanMengajar, simulasiBisyaroh, shiftDerive, …).
2. Backend sudah bercabang: hulu **Supabase-native**, Waseela masih **Firebase-first**.
   Cherry-pick per fitur = menulis ulang tiap fitur melintasi beda backend.

Keputusan: **re-fork** dari hulu terkini + **collapse ke single-tenant**. Karena hulu
memang single-tenant, arsitektur Waseela jadi identik dengannya — sehingga sync
berikutnya cukup salin + terapkan ulang aturan, bukan proyek re-arsitektur.

Kerja multi-tenant **tidak hilang**: tag **`arsip/multitenant-v1`** (commit `3465131`).
Basis re-fork = hulu commit **`e255c5d`** (8 Agu 2026).

---

## Keputusan kunci

| Topik | Keputusan | Alasan |
|---|---|---|
| Tenancy | **Single-tenant**, 1 project Supabase per lembaga | Isolasi di batas project — tak bisa bocor antar-lembaga; sync hulu jadi murah selamanya |
| Sync hulu | **Re-fork**, bukan cherry-pick | 354 commit + beda backend membuat port per-fitur = tulis ulang |
| Gating paket | **Dibuang** | Pembeli tunggal; `plans.js`/`useFeatures` hanya menambah beban sync |
| Panel demo & konsol super-admin | **Dibuang** | Ikut model SaaS yang ditinggalkan |
| Merek aplikasi | **Tetap Waseela**, hak cipta Bakafrawi Project | Pembeli tak mengganti merek app — hanya mengisi identitas lembaganya di kop |
| Identitas lembaga | **Runtime**, lewat UI Pengaturan | Pembeli mengisi sendiri, tanpa rebuild |
| Repo hulu | **BACA-SAJA, selamanya** | Tak ada tulis/hapus/git di repo `Ammu`; `sync-from-ammu.mjs` satu arah |
| Virtual Account (BMT) | **DIBUANG** v.1.0.1 (kode + tabel + RPC) | Terikat satu BMT milik lembaga hulu; pembeli tak memakai, integrasinya tak pernah hidup |
| Mesin absensi pembeli | **Solution X609**, jalur utama **tarik langsung TCP 4370** | Mesin bicara protokol ZKTeco; Desktop menariknya sendiri — tanpa software vendor, tanpa langkah operator |
| Cadangan saat PC tak sejaringan | **Baca `att2000.mdb`** software Attendance Management (2 Sep 2026) | Pembeli sudah memasang software bawaannya. Menutup celah "mesin ditarik lewat flashdisk" yang dulu hanya bisa lewat impor berkas manual. Menempel pada software vendor, jadi bisa BASI — karena itu cadangan, bukan pengganti |

---

## Peta kode

```
app/src/config/brand.js    # SUMBER TUNGGAL identitas produk + default merek + FIREBASE_CONFIG
app/src/stores/settings.js # DEFAULT_SETTINGS ← BRAND; watch → setKopImage
app/src/utils/kopMuassis.js# kop baris-1 config-driven (settings.kopImageUrl)
scripts/whitelabel-rules.mjs # aturan transformasi hulu → Waseela (SATU sumber)
scripts/whitelabel.mjs       # terapkan + GERBANG audit (sumber, hasil build, target backend)
scripts/cek-kebocoran.mjs    # GERBANG pembanding: panen nilai identitas hulu, cari di repo kita
scripts/apply-brand.mjs      # sebar aset gambar + audit aset
app/electron/src/fingerprint-sync.ts # Fingerspot: baca MySQL Personnel (mysqld sekali-pakai)
app/electron/src/solution-sync.ts    # Solution/ZKTeco: tarik langsung dari mesin, TCP 4370
app/electron/src/att-mdb-sync.ts     # Attendance Management: baca att2000.mdb (Jet 4.0, PowerShell 32-bit)
app/src/utils/shiftDerive.js # aturan shift — SATU sumber untuk KETIGA jalur + impor berkas
scripts/sync-from-ammu.mjs   # tarik fitur baru, satu arah
scripts/.sync-baseline.json  # sidik jari hulu saat sync terakhir
brand-assets/                # logo/ikon/splash sumber
```

---

## Yang HARUS dipahami sebelum menyentuh white-label

**Bentuk kebocoran di kode hulu adalah _fallback_, bukan teks biasa:**

```js
settings.kopLine1 || 'YAYASAN MAMBAUL ULUM'
settings.namaLembaga || 'Pondok Pesantren Mambaul Ulum'
```

Fallback hanya muncul saat baris settings pembeli **masih kosong** — persis hari pertama
pemakaian, dan justru saat itulah kop pertama dicetak. Semuanya sudah diarahkan ke
`BRAND.*`, dan dikunci tes `tests/unit/whiteLabelBrand.test.js`.

**Titik paling berisiko: `muassis.png`** — kaligrafi lembaga hulu yang dulu ter-hardcode
di 9 berkas. Sekarang config-driven (`settings.kopImageUrl`, kosong = fallback teks).
Ini **gambar**, jadi grep tak akan pernah menangkapnya. `sync-from-ammu.mjs`
sengaja tak pernah menarik `kopMuassis.js` maupun `muassis.png`.

**Aturan main:** kalau sync membawa literal identitas baru, tambahkan aturannya di
`scripts/whitelabel-rules.mjs` — **jangan menambal berkasnya langsung**, tambalan itu
hilang di sync berikutnya. Gerbang akan menolak sampai aturannya ada.

**Gerbang bisa DIAM karena foldernya dinamai ulang (16 Sep 2026).** Repo hulu berganti nama
`Portal MU` → `Ammu`, dan `cek-kebocoran.mjs` memang dirancang keluar dengan `exit 0` bila repo
hulu tak ada (supaya CI tanpa repo hulu tak merah). Dua hal bertemu: sync BERHENTI dengan galat
(kelihatan), tapi gerbang pembanding cuma mencetak satu baris "dilewati" lalu menyatakan sukses —
gerbang yang paling mahal justru yang paling sunyi saat mati. Ketiga skrip kini mencoba **dua nama**
folder. Kalau kelak ia dinamai ulang lagi, tambahkan namanya di `NAMA_HULU`.

**Gerbang juga bisa salah tuduh (7 Sep 2026).** `POLA_JEJAK` mencari `ammu` di mana saja,
dan hulu memperkenalkan `jamMulaiShift` — huruf "j-**ammu**-lai". Sync v.1.4.1 tertahan oleh
8 baris yang sama sekali bukan identitas. Penawarnya lookbehind `(?<![a-z])ammu`: merek hulu
tak pernah didahului huruf (selalu awal kata, sesudah `.`, `@`, atau `_` — `app.ammu.id`,
`@ammu.local`, `ic_stat_ammu` semuanya tetap tertangkap). Kalau kelak menambah pola, uji
DUA arah: jangan cuma memastikan yang jahat tertangkap, pastikan juga yang sah lolos —
gerbang yang salah tuduh akan ditumpulkan orang yang sedang buru-buru, dan sesudah itu ia
tak menjaga apa pun.

### Tiga cara kebocoran lolos (ketiganya sudah kejadian)

**1. Bentuknya bukan kata.** Gerbang teks mencari "ammu"/"mambaul". Yang lolos:
ref project Supabase (`rzwefjilxzsqlokkwiyt`), VAPID key, foto latar login yang tersandi
base64, dan — 9 Agu 2026 — **kota, alamat jalan, dan nomor telepon** lembaga hulu di
rantai kop rapor. Penawarnya `cek-kebocoran.mjs`: ia **memanen** nilai-nilai itu dari repo
hulu lalu mencarinya di repo kita, jadi tak perlu menebak bentuknya. Kalau menemukan
literal identitas jenis baru, **tambahkan `panen()`-nya**, bukan cuma menambal berkasnya.

**2. Letaknya di luar cakupan pindaian.** Ini yang paling sering terulang:

| Luput | Akibat | Sekarang |
|---|---|---|
| `firebase.json` (root) | CSP memblokir seluruh Supabase | ikut `BERKAS_ROOT` |
| `app/electron/src` | kotak "Tentang" menyebut yayasan lain | ikut `AREA` |
| `app/android/.../main` | teks yang dilihat pembeli | ikut `AREA` |

**Kalau menambah folder/berkas yang membawa teks atau gambar user-facing, daftarkan
sekalian ke `AREA`/`BERKAS_ROOT`.** Gerbang yang tak memindai = gerbang yang bohong.

**3. Letaknya di RIWAYAT, bukan di kode sekarang.** Keempat gerbang kita — `whitelabel
--audit`, `cek-kebocoran`, `apply-brand`, dan pindaian `app/dist` — semuanya hanya melihat
**working tree**. Riwayat git tak pernah dilihat siapa pun. Padahal era multi-tenant
(sebelum re-fork 8 Agu 2026) sempat membawa berkas konfigurasi per-lembaga yang memuat
identitas lembaga hulu; berkasnya sudah lama tak ada di HEAD, tapi commit-nya tetap ada —
dan repo ini **publik**. Ketahuan 13 Agu 2026 lewat *secret scanning* GitHub, bukan lewat
gerbang kita.

Yang perlu dipahami penerus:

- **"Bersih di `git status`" ≠ "bersih di repo."** Untuk identitas yang pernah ada lalu
  dihapus, satu-satunya pembersih adalah menulis ulang riwayat (mahal: semua SHA berubah,
  termasuk tag arsip) **atau** menjadikan repo privat.
- Menulis ulang riwayat sering **tak menyelesaikan apa pun**: nilai yang sama biasanya
  sudah publik di repo lain milik pemilik yang sama. Periksa dulu sebarannya sebelum
  menempuh jalan mahal itu.
- Untuk kunci yang **memang dirancang publik** (Firebase Web API key ikut di tiap bundel
  web & APK), obatnya bukan menyembunyikan, melainkan **membatasi**: HTTP referrer untuk
  kunci Web, paket + SHA-1 untuk kunci Android, plus App Check. Menghapusnya dari kode
  malah membuatnya tampak rahasia padahal tidak.
- Pelajaran untuk white-label: **jangan pernah menaruh konfigurasi milik lembaga lain di
  repo produk, sekalipun "sementara"** — sekali ter-commit, ia permanen.

### Cara keempat: sync MENIMPA kerja lokal (1 Sep 2026)

Tiga cara di atas semuanya soal identitas hulu yang **masuk**. Yang keempat kebalikannya:
kerja Waseela yang **keluar**, tertimpa `sync-from-ammu` tanpa suara.

Sampai 1 Sep 2026 satu-satunya pengaman adalah daftar tangan `MILIK_WASEELA`. Daftar itu
hanya memuat divergensi yang tercatat saat re-fork 8 Agu; tiga minggu kerja lokal sesudahnya
tak pernah didaftarkan. Sync 1 Sep menimpa **32 dari 62** berkas yang ia sentuh:

| Yang hilang | Akibat |
|---|---|
| `dispatch-push` + `auto-generate-tagihan` | pengerasan **gagal-tertutup** direvert jadi `if (!CRON_SECRET) return true`. Keduanya deploy `--no-verify-jwt` = terbuka untuk internet |
| `ModalPOS.vue` (118 baris) | perbaikan POS 15 Agu batal; `posBarisTagihan.js` jadi util yatim |
| `main.css`, `App.vue`, `ribbon.css`, `receiptHtml.js` | palet merek emerald direvert ke teal hulu |
| 13 berkas | istilah "pondok" yang sudah dibuang kembali muncul |
| `loginBg.js` | foto bangunan & santri pesantren lain kembali (base64 — lolos semua gerbang teks) |
| `gedung.js` | nama gedung lembaga hulu kembali + bug "gedung terakhir tak bisa dihapus" |

**Kenapa tak ketahuan:** tes tetap **hijau** — yang diuji util murninya, bukan perangkaian di
layar. Gerbang teks pun diam — yang hilang bukan kata "ammu". Hanya `cek-kebocoran` yang
menangkap dua di antaranya; sisanya ketahuan lewat pembandingan berkas-per-berkas.

**Penawarnya sudah dipasang.** `.sync-baseline.json` kini menyimpan DUA sidik jari per berkas:

```json
"app/src/App.vue": { "hulu": "71af0ecc…", "kita": "3ab06e3a…" }
```

- `hulu` — isi mentah berkas hulu saat sync terakhir (dipakai seperti dulu).
- `kita` — **isi yang ditulis sync itu**. Kalau berkas di working tree tak lagi cocok
  dengannya, berarti ada yang mengeditnya lokal → sync **menolak menimpa** dan melaporkannya
  di blok `⛔ TAK DITIMPA`, lengkap dengan penanda apakah hulu juga berubah (perlu gabung
  tiga-arah) atau tidak (tak ada yang perlu ditarik).

Konsekuensinya: **`MILIK_WASEELA` bukan lagi pagar, melainkan dokumentasi ALASAN.** Berkas
yang kamu edit lokal otomatis terlindungi walau lupa didaftarkan. Yang tetap perlu masuk
daftar hanyalah berkas yang divergensinya permanen dan alasannya layak dicatat.

> Pelajaran umumnya: **pengaman yang bergantung pada ingatan pasti gagal.** Kalau sebuah
> gerbang menuntut seseorang mendaftarkan sesuatu lebih dulu, ia akan bocor pada hari
> orang itu lupa — dan hari itu pasti datang.

### Palet merek & istilah kini jadi ATURAN, bukan kerja tangan

Dua kategori yang dulu ditambal tangan saat re-fork sekarang ada di `whitelabel-rules.mjs`,
jadi berlaku otomatis tiap sync:

- **`PALET`** — 9 pasang warna teal hulu → emerald Waseela (huruf besar & kecil sama-sama
  didaftarkan; kelas Tailwind arbitrary dan atribut SVG memakai huruf besar).
- **Istilah "pondok"** — 15 aturan per-frasa. Sengaja BUKAN sapuan buta `" pondok"` → `""`:
  itu akan merusak kalimat ("nomor pondok" jadi "nomor", bukan "nomor induk lembaga").

Aturan ini sekalian membetulkan sisa "pondok" yang terlewat pass manual re-fork — antara lain
"Hubungi admin pondok" di `ProfilView`, yang selama ini dilihat pengguna.

### Istilah: "pondok" DIBUANG dari teks user-facing

Lembaga pembeli **bukan pondok** (keputusan Kyai, 9 Agu 2026). Mis. "Alamat Pondok" →
"Alamat". Nama variabel/kolom DB (`namaPondokSingkat`, dll) sengaja **tak** ikut diubah —
biayanya besar, manfaatnya nol, dan tak terlihat pembeli. "pesantren"/"santri" **belum**
diputuskan: `santri` menyentuh nama tabel DB, jadi jangan disapu tanpa arahan Kyai.

---

## Perubahan identifier (DB pembeli bersih → aman)

| Lama (hulu) | Baru | Dipakai di |
|---|---|---|
| `@ammu.local` | `@waseela.local` | authSupabase + 3 migrasi + 2 edge fn |
| `mu_auth_` | `wsl_auth_` | padding sandi: klien + 2 edge fn + tes |
| `ammu_provisioned` | `waseela_provisioned` | `app_metadata` — **gerbang trigger**, wajib serempak |
| `ammu-*` (CSS) | `wsl-*` | ribbon.css dkk |
| `ammu_*` / `portalMu_*` | `waseela_*` | kunci localStorage, SharedPreferences |
| `app.ammu.id` | `app.waseela.id` | applicationId, namespace, paket Java |
| `ic_stat_ammu` | `ic_stat_waseela` | drawable + manifest + capacitor config |
| `app.ammu.id://auth-callback` | `app.waseela.id://auth-callback` | deep link balik login Google (manifest + Redirect URLs Supabase) |

---

## Sisa pekerjaan

Web sudah live. Yang tersisa (per 16 Sep 2026):

**Rilis v.1.0.3 / vc4 — urutannya MENGIKAT (dikerjakan Kyai)**
0. **`npx supabase db push`** — TUJUH berkas migrasi belum sampai ke Supabase pembeli:
   `20260812120000_auth_email_internal_ketat.sql`, `20260813090000_buang_va_bmt.sql`,
   `20260831120000_santri_upd_kepala_lembaga.sql`, dua migrasi prestasi
   (`20260902120000_arsip_prestasi_bulanan.sql` → disempurnakan
   `20260904120000_arsip_prestasi_periode_laporan.sql`), plus dua bawaan sync v.1.4.3:
   `20260912120000_izin_guru_staff_write.sql` dan `20260912130000_supervisi_respon_target.sql`.
   Dorong SEKALIGUS — yang terakhir memakai `auth_heads_lembaga()` yang lahir di migrasi
   31 Agu, dan urutan cap waktunya memang sudah benar. Tanpa langkah ini aplikasi TIDAK
   rusak, tapi dua perbaikan yang sudah diiklankan di Bantuan v.1.0.3 (izin bagi pegawai
   kantor & tanggapan supervisi) tetap ditolak basis data.
1. **`npx supabase functions deploy auto-generate-tagihan`** — cron tagihan bulanan kini
   mengakui pembayaran di muka lewat `prabayar.ts`. Tanpa deploy, fungsi lama tetap jalan
   dan santri yang membayar di muka ditagih ulang tiap awal bulan.
2. **`npm run deploy`** — build + gerbang + Firebase Hosting.
3. **`npm run build:aab`** → **uji AAB-nya di HP sungguhan** (login, notifikasi, widget Jam
   Hijri & Kalender, ekspor PDF, kasir POS) → unggah ke Play Console.
4. Desktop & APK, bila pembeli memakainya: `npm run electron:release` lalu `npm run build:apk`,
   keduanya ke rilis GitHub `v1.0.3` yang SAMA — rinciannya di RUNBOOK §5.

**Play Store — keadaan 16 Sep 2026**
- Yang ada di sana baru **v.1.0.1 / `versionCode 2`, jalur UJI TERTUTUP**. Unggahan berikutnya
  `versionCode 4`.
- `versionCode 3` sengaja DILEWATI: ia sudah sampai ke pengguna sebagai APK GitHub v.1.0.2,
  jadi memakainya ulang untuk isi yang berbeda membuat nomor versi berbohong.
- **`minSdkVersion` naik 23 → 24** (16 Sep 2026): "Perlindungan Otomatis" Play menolak AAB
  ber-minSdk 23 di pintu unggah — bukan saat peninjauan. Konsekuensinya Android 6.0 tak lagi
  terlayani. Kalau kelak perlu turun lagi, matikan dulu Perlindungan Otomatis di Play Console
  → Integritas aplikasi; keduanya tak bisa hidup bersamaan.
- Tautan "Pasang Android" di Login & Bantuan **sengaja masih ke APK GitHub**: selama uji
  tertutup, tautan Play memulangkan halaman kosong bagi yang bukan penguji. Begitu produksi
  terbit, `URL_PLAYSTORE` sudah siap di `app/src/utils/unduhan.js` — atau lebih cepat lagi,
  isi `settings.downloadAndroid` di Pengaturan Web (menang atas kode, tanpa rilis ulang).
- APK GitHub ditandatangani kunci UPLOAD kita. Kalau Play App Signing memakai kunci milik
  Google, HP yang sudah memasang APK itu **tak bisa** diperbarui dari Play — harus copot lalu
  pasang sekali. Datanya di server, jadi yang hilang cuma sesi login.

**Sumbat lama yang masih berdiri**
A. **Jadwalkan `arsip-prestasi-bulanan` di pg_cron** — migrasinya hanya membuat fungsinya,
   TIDAK menjadwalkannya, dan tak ada tombol pemicu di aplikasi. Tanpa langkah ini papan
   peringkat tak pernah diarsipkan tiap tanggal 25 dan tak ada gejala apa pun. Ini sumbat
   yang sama dengan temuan pg_cron di audit Agustus — sekarang dua fitur bergantung padanya.
B. **Daftarkan `app.waseela.id://auth-callback`** di Supabase → Auth → URL Configuration →
   Redirect URLs. Tanpa itu login Google di Android tetap mentok di halaman galat browser:
   Supabase mengabaikan deep link-nya dan memulangkan ke Site URL. Intent-filter di
   `AndroidManifest.xml` sudah dipasang, tapi ia tak berarti apa-apa sendirian.
C. **Migrasi BMT hulu sengaja DIBLOKIR.** `20260905120000_bmt_alokasi_utuh.sql` menulis ulang
   RPC `apply_bmt_payment` + tabel `keuangan_va_inbox` yang sudah kita DROP; kalau tertarik,
   `db push` gagal. Aturannya sudah di `ABAIKAN` (`scripts/sync-from-ammu.mjs`).

> Tes Sekolah SENGAJA tak ditarik (keputusan Kyai). Berkas intinya di `ABAIKAN`,
> perangkainya di `MILIK_WASEELA` — lihat `scripts/sync-from-ammu.mjs`. Kalau kelak
> dipakai: buang dari kedua daftar, tarik ulang, lalu push migrasi `..._tes_sekolah.sql`.

**Wajib sebelum dianggap selesai**
1. **Uji cetak kop kosong** — satu-satunya gerbang yang tak bisa diotomatiskan: cetak
   **struk POS + rapor + rekap prestasi SEBELUM kop diisi**. Tak boleh muncul identitas
   lembaga mana pun. Semua kebocoran fallback ketahuannya lewat jalur ini.
2. **Data awal pembeli**: seed lembaga/kelas, akun `admin`, impor data lama lewat menu
   **Impor Supabase** (jangan tulis skrip migrasi baru — importer-nya sudah ada).

**Notifikasi pembaruan Android — DIMATIKAN (Kyai, 7 Sep 2026)**
Mengikuti hulu yang sudah rilis lewat Play Store. Yang dilakukan di Waseela:
`App.vue` tak lagi memanggil `cekOtomatis()`, tombol "Cek Pembaruan" di `BantuanView`
dibuang, dan `app/public/app-version.json` → `apkUrl` **dikosongkan**. Yang terakhir itu
remnya untuk APK yang SUDAH terpasang: bundel di dalamnya masih membawa cek-otomatis dan
tetap menembak berkas itu tiap dibuka — tanpa `apkUrl`, putusannya `belum-siap` dan ia diam.
Mengisinya lagi = notifikasi hidup kembali di semua HP tersebut.

> Konsekuensi yang disengaja: sampai Waseela tayang di jalur PRODUKSI Play Store, pembeli
> **tak punya jalur pembaruan Android otomatis** (uji tertutup hanya menjangkau penguji). Tautan PASANG tetap hidup (layar login & Bantuan →
> `utils/unduhan.js` → GitHub Releases); yang mati hanya pemberitahuannya.
> `useAndroidUpdate.js` sengaja tak dihapus — menghidupkannya kembali cukup memanggil
> `cekOtomatis()` lagi dan mengisi ulang `apkUrl`.

**Menunggu keputusan Kyai**
3. Istilah **"pesantren"** (mudah) dan **"santri"** (dalam — menyentuh nama tabel DB).
3b. ~~Absensi otomatis dari X609~~ — **SELESAI 1 Sep 2026**, tapi lewat jalur TARIK, bukan
   ADMS. `app/electron/src/solution-sync.ts` bicara protokol ZKTeco di port 4370 dan
   menarik log sendiri. ADMS ditinggalkan karena mesin ZKTeco menembak `/iclock/...` lewat
   HTTP polos — tak cocok dengan Edge Function, dan menambalnya berarti membuka penampung
   HTTP di jaringan pembeli. **BELUM diuji ke mesin sungguhan** (mesinnya di tempat
   pembeli): uji pertamanya `node build/solution-sync.js <ip>` — lihat RUNBOOK §4b.
3c. **Jalur ketiga ditambahkan 2 Sep 2026** — `app/electron/src/att-mdb-sync.ts` membaca
   `att2000.mdb` milik software **Attendance Management** yang sudah dipasang pembeli.
   Dipakai HANYA kalau PC tak sejaringan dengan mesin; kelemahannya sama dengan Fingerspot
   (menempel pada software vendor, bisa basi tanpa ada yang tahu). Berbeda dari jalur TCP,
   jalur ini **sudah diuji end-to-end** di PC ini: 18.000 baris terbaca 1,2 detik dari
   salinan `att2000.mdb` yang diisi data uji.
   membocorkannya, tapi URL yang tertebak = berkas terbuka. Perlu diputuskan mau
   diprivatkan (butuh signed URL di sisi baca) atau dibiarkan.
5. ~~Status repo: publik atau privat?~~ — **DIPUTUSKAN PUBLIK, 2 Sep 2026 (Kyai).**
   Konsekuensinya sengaja dicatat: tautan unduh di halaman login dan auto-update
   `electron-updater` sama-sama menarik dari GitHub Releases `kollepiyah/waseela`, jadi
   keduanya tetap jalan apa adanya — **tak ada perubahan kode yang diperlukan**. Kalau
   suatu hari repo jadi diprivatkan, DUA hal patah bersamaan dan gejalanya 404 di sisi
   pembeli: arahkan `settings.downloadDesktop`/`downloadAndroid` ke Firebase Hosting dan
   pindahkan `publish` electron-builder ke provider `generic`.
   Yang MASIH berlaku dan tak terhapus oleh keputusan ini: riwayat git era multi-tenant
   membawa identitas lembaga hulu (lihat "cara kebocoran ke-3" di atas) — dengan repo
   publik, itu terbaca siapa saja. Dan **batasi kunci API Firebase** di Google Cloud Console
   (HTTP referrer untuk Web, paket + SHA-1 untuk Android) — kini bukan lagi pelengkap,
   melainkan perlindungan utama.

**Butuh akun/aset — detail di RUNBOOK-PEMBELI.md**
5. **Android**: `google-services.json` untuk paket `app.waseela.id`, **keystore BARU**
   (simpan baik-baik; hilang = tak bisa update selamanya), lalu setel `app-version.json`.
6. **Desktop**: `app/electron/node_modules` SUDAH terpasang (tsc 5.9.3, diperiksa
   2 Sep 2026) — `npm run electron:make` bisa langsung. Berkas `build/*.js` ikut ter-commit
   dan itulah yang dijalankan Electron: sesudah mengubah `src/*.ts`, **jalankan `npm run
   build` di `app/electron`** atau perubahannya tak pernah terkapalkan.
7. **FCM + pg_cron/Vault**: secret notifikasi & penjadwalan tagihan otomatis.
8. **Aset persegi** dari desainer, kalau ikon/splash bikinan skrip dirasa kurang.

---

## Jebakan yang sudah pernah memakan waktu

- **Supabase → Exposed schemas** memuat schema hantu → PostgREST `PGRST002` permanen.
  Restart tak menyembuhkan; ini konfigurasi.
- **Supabase → Auth Hooks** menyisakan `custom_access_token_hook` yatim → login 500.
- **Variabel lingkungan OS basi** menang atas `.env.local` → app menunjuk project lama.
- **Akhir baris**: repo ini LF (`.gitattributes`). Hulu campur CRLF/LF; `sync-from-ammu.mjs`
  menormalkan agar beda akhir-baris tak pernah tampil sebagai "berubah".
- **`google-services.json`** sengaja tak ada di repo. Build Android gagal tanpa itu —
  disengaja, lebih baik daripada terkirim memakai project lembaga lain.
