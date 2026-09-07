# 🔍 AUDIT SUSULAN — Waseela, 7 Sep 2026

> Lanjutan [`AUDIT-AGU-2026.md`](AUDIT-AGU-2026.md). Audit itu menyisir keamanan backend
> dari nol; yang ini **audit sesudah sync hulu v.1.4.1** — memeriksa apa yang berubah,
> apa yang membusuk sejak Agustus, dan apa yang dibawa masuk oleh sync.
>
> Yang **tidak** diulang di sini: temuan Agustus yang sudah ditambal (`_enqueue_notif`,
> bucket storage, `allowBackup`, jaring galat global). Statusnya tak berubah.

---

## Keadaan saat audit

| | |
|---|---|
| Branch | `refork/ammu-single-tenant` |
| Versi | v.1.0.2 / `versionCode 3` |
| Basis hulu | **v.1.4.1** (`e530546`), naik dari v.1.3.7 — 22 commit |
| Tes | **1379 hijau / 98 berkas** (sebelum sync: 1089 / 85) |
| Build | `vite build` bersih |
| Gerbang | 4/4 lulus — sumber, hasil build, backend, `cek-kebocoran` |
| `npm audit` root | 0 kerentanan |

---

## Ringkasan temuan

| # | Temuan | Tingkat | Status |
|---|---|---|---|
| 1 | pg_cron masih kosong — kini **dua** fitur mati diam-diam | 🟠 | belum |
| 2 | Empat migrasi belum sampai ke Supabase pembeli | 🟠 | belum |
| 3 | Android tanpa jalur pembaruan otomatis | 🟠 | disengaja (Kyai) |
| 4 | `npm run lint` rusak — gerbang mutu yang tak pernah jalan | 🟡 | belum |
| 5 | 9 kerentanan dependensi di `app/` | 🟡 | sebagian mudah |
| 6 | Gerbang white-label salah tuduh kata sah | 🟡 | ✅ ditambal hari ini |
| 7 | Sisa fitur yang sudah dibuang (TODO BMT, env basi, util yatim) | 🟢 | kosmetik |
| 8 | Versi root `package.json` tertinggal | 🟢 | kosmetik |

---

# A · Operasional — dua sumbat yang sama-sama diam

## 🟠 1. pg_cron masih belum terpasang, sekarang menahan DUA fitur

Audit Agustus temuan #7 mencatat pg_cron belum terpasang sehingga **notifikasi tak pernah
terkirim**. Sumbat itu masih ada, dan sync ini menambah penumpang kedua:
`arsip_prestasi_bulanan` (arsip + kosongkan papan peringkat tiap tanggal 25).

Yang membuatnya berbahaya bukan besarnya, melainkan **bentuk kegagalannya**:

- Migrasinya hanya **membuat fungsinya**, tidak menjadwalkannya — disengaja, jadwal sengaja
  tak ikut migrasi.
- **Tak ada pemicu manual di aplikasi.** Sudah dicek: `arsip_prestasi_bulanan` tidak
  dipanggil dari mana pun di `app/src`.
- Akibatnya papan peringkat tak pernah diarsipkan, **tanpa galat, tanpa spanduk, tanpa
  gejala apa pun**. Yang terlihat cuma "kok angkanya tidak pernah mulai dari nol".

Fitur yang gagal dengan berisik akan diperbaiki. Fitur yang gagal diam-diam akan dipercaya
selama berbulan-bulan.

**Perbaikan:** pasang `pg_cron` + Vault sekali, lalu jadwalkan keduanya. Ini menutup temuan
Agustus #7 sekaligus.

## 🟠 2. Empat migrasi belum sampai ke Supabase pembeli

```
20260812120000_auth_email_internal_ketat.sql
20260831120000_santri_upd_kepala_lembaga.sql
20260813090000_buang_va_bmt.sql
20260902120000_arsip_prestasi_bulanan.sql  →  20260904120000_arsip_prestasi_periode_laporan.sql
```

Yang paling perlu diperhatikan **`buang_va_bmt`**: selama ia belum dijalankan, tabel & RPC
Virtual Account masih **hidup di basis data pembeli** padahal kodenya sudah dicabut sejak
v.1.0.1. Itu permukaan serang yang tak dipakai siapa pun dan tak terlihat dari aplikasi.

Dua migrasi prestasi harus didorong **berurutan** — yang kedua menulis ulang fungsi yang
dibuat pertama.

> **Migrasi BMT hulu sengaja diblokir.** `20260905120000_bmt_alokasi_utuh.sql` menulis ulang
> `apply_bmt_payment` dan menyentuh `keuangan_va_inbox` — keduanya sudah kita DROP. Kalau
> ikut tertarik, `db push` **gagal**. Aturannya sudah dipasang di `ABAIKAN`.

---

# B · Android

## 🟠 3. Tak ada jalur pembaruan otomatis sampai tayang di Play Store

Keputusan Kyai 7 Sep 2026, mengikuti hulu. Dicatat di sini bukan sebagai keberatan,
melainkan supaya konsekuensinya tak terlupakan:

- Hulu boleh mematikan cek in-app karena **mereka sudah rilis di Play** — Play punya
  pemberitahuannya sendiri. Waseela **belum**.
- Jadi sejak sekarang, perbaikan yang mendesak sampai ke HP pembeli hanya kalau seseorang
  **memberi tahu mereka** untuk mengunduh ulang APK.
- `apkUrl` di `app-version.json` dikosongkan — itu remnya untuk APK yang **sudah**
  terpasang, yang masih membawa cek-otomatis di dalam dirinya.

**Kalau kelak Play tayang:** tak ada yang perlu dihidupkan. **Kalau Play batal:**
`useAndroidUpdate.js` masih utuh & teruji — cukup panggil `cekOtomatis()` lagi dan isi
ulang `apkUrl`.

---

# C · Mutu & rantai pasok

## 🟡 4. `npm run lint` rusak — gerbang yang mengaku ada tapi tak pernah jalan

`app/package.json` punya `"lint": "eslint src/"`, tetapi:

- tak ada `eslint.config.*` maupun `.eslintrc.*` di `app/` maupun akar;
- `eslint` **tidak terpasang** di `app/node_modules`.

Menjalankannya bukan menemukan nol masalah — ia **gagal sebelum memeriksa apa pun**. Catatan
commit hulu rutin menyebut "eslint 0 error"; di Waseela klaim itu tak pernah bisa benar.

Ini kelas yang sama dengan pelajaran di HANDOVER: *gerbang yang tak memindai = gerbang yang
bohong*. Bedanya yang ini bahkan tak berpura-pura memindai — ia hanya ada di daftar skrip.

**Perbaikan:** pasang eslint + config (salin dari hulu, sesuaikan path `app/src`), atau
**buang skripnya** supaya tak ada yang mengira ia menjaga sesuatu. Yang paling buruk adalah
membiarkannya seperti sekarang.

## 🟡 5. Sembilan kerentanan dependensi di `app/`

| Paket | Tingkat | Lewat | Perbaikan |
|---|---|---|---|
| `brace-expansion` | tinggi (DoS) | archiver, fstream, zip-stream | `npm audit fix` — aman |
| `nanoid` | tinggi | langsung | `npm audit fix` — aman |
| `postcss` | tinggi (path traversal `.map`) | langsung | `npm audit fix` — aman |
| `protobufjs` | sedang (DoS) | Firebase | `npm audit fix` — aman |
| `dompurify` | sedang (XSS) | `jspdf` → `jspdf-autotable` | butuh jspdf 4.x — **mayor** |
| `uuid` | sedang | `exceljs` | "perbaikannya" **menurunkan** exceljs 4→3.4 |

Penilaian jujur:

- **Empat yang pertama**: jalankan `npm audit fix`. Tak ada perubahan yang memutus apa pun,
  dan ketiganya hidup di jalur build/tooling, bukan di bundel yang dijalankan pembeli.
- **`dompurify`/`jspdf`**: risikonya nyata tapi **jauh** — ia hanya menggigit kalau HTML
  yang tak dipercaya masuk ke perender jspdf. PDF Waseela dirakit dari datanya sendiri
  (`pdfBuilder`, `strukBuilder`). Naik ke jspdf 4.x adalah perubahan mayor pada bagian
  aplikasi yang paling banyak dipakai (rapor, struk, semua ekspor) — **jangan** dikerjakan
  bersamaan dengan rilis. Jadwalkan sendiri, dengan uji cetak menyeluruh.
- **`exceljs`/`uuid`**: `npm audit fix --force` akan **menurunkan** exceljs 4.4 → 3.4.
  Menukar kerentanan sedang dengan kemunduran dua versi mayor bukan perbaikan. **Abaikan**,
  tunggu exceljs memperbarui `uuid`-nya.

## 🟡 6. Gerbang white-label salah menuduh kata yang sah ✅ DITAMBAL HARI INI

`POLA_JEJAK` mencari `ammu` di mana saja. Hulu memperkenalkan `jamMulaiShift` — dan di
dalam "j‑**ammu**‑lai" pola itu cocok. Sync v.1.4.1 **tertahan** oleh 8 baris yang sama
sekali bukan identitas.

Ditambal dengan lookbehind `(?<![a-z])ammu`: merek hulu tak pernah didahului huruf — ia
selalu di awal kata atau sesudah `.`, `@`, `_`. Diuji dua arah: `app.ammu.id`,
`@ammu.local`, `ammu_provisioned`, `ic_stat_ammu`, `AMMU Desktop`, `portalMu_settings`
semuanya **tetap** tertangkap; `jamMulaiShift` tidak lagi.

Pelajarannya layak dicatat: **gerbang yang salah tuduh sama berbahayanya dengan gerbang
yang bocor** — bukan karena ia melewatkan sesuatu, melainkan karena orang yang sedang
buru-buru akan menumpulkannya, dan sesudah itu ia tak menjaga apa pun.

---

# D · Sisa & kosmetik

## 🟢 7. Peninggalan fitur yang sudah dibuang

- **`BisyarohView.vue:1764`** — `TODO(Model B): saat API disbursement BMT siap…`. Virtual
  Account sudah dibuang seluruhnya di v.1.0.1; TODO ini menunjuk masa depan yang sudah
  dibatalkan. Buang barisnya.
- **`.claude/launch.json`** membawa `VITE_AUTH_BACKEND=firebase` dan
  `VITE_DATA_BACKEND=firebase`. **Tak ada satu baris pun di `app/src` yang membacanya** —
  sisa era Firebase-first sebelum re-fork. Menyesatkan penerus yang membacanya sebagai
  "oh, backend-nya Firebase".
- **`app/src/utils/raporSchema.js`** yatim — tak ada yang mengimpornya. Yatim juga di hulu,
  jadi ini warisan, bukan regresi Waseela. Biarkan sampai hulu membuangnya.
- **`app/src/utils/cocokBayarTagihan.js`** (baru) masih memuat `'bmt_va'` di
  `SUMBER_BAYAR_SANTRI` dan jalur `alokasi[]`. Cabang mati — baris VA tak bisa ada di basis
  data pembeli. Dibiarkan apa adanya supaya sync berikutnya tetap murah; sepadan dengan
  cara `metodeBayar.js` tetap mengenali nilai lama.

## 🟢 8. Versi root `package.json` tertinggal

`BRAND.version`, `app/package.json`, `build.gradle`, dan `app-version.json` semuanya
**v.1.0.2 / vc3** — selaras ✔. Hanya akar (`waseela-ops`) yang masih `1.0.1`. Kosmetik:
paket ini tak pernah diterbitkan. Selaraskan saja saat bump berikutnya.

## 🟢 Placeholder menyebut nama lembaga pembeli

`PengaturanView.vue` memakai `mis. Yayasan Pendidikan Al-Qur'an Daarul Mujawwidin` sebagai
*placeholder*. Bukan fallback — tak pernah tersimpan, tak pernah tercetak. Tapi ia menaruh
nama satu pembeli di dalam repo produk yang **publik**. Kalau kelak ada pembeli kedua,
netralkan jadi contoh generik.

---

# E · Yang diperiksa dan **sehat**

Bagian ini sengaja ditulis: audit yang hanya memuat keluhan membuat orang mengira tak ada
yang beres.

- **Pengerasan gagal-tertutup utuh.** `dispatch-push` & `auto-generate-tagihan` masih
  `if (!CRON_SECRET) return false`. Keduanya di-deploy `--no-verify-jwt`, jadi inilah satu-
  satunya yang berdiri antara internet dan fungsi yang MENERBITKAN TAGIHAN. Sync v.1.4.1
  **tidak** membatalkannya — pengaman `kita` di `.sync-baseline.json` bekerja persis seperti
  yang dirancang sesudah kejadian 1 Sep.
- **`service-account.json` tak pernah ter-commit** dan terdaftar dua kali di `.gitignore`.
  Riwayat git juga bersih untuk berkas ini.
- **`.gitignore` menutup** `dist-release/`, `app/dist`, `.env.local`, `app/android/app/build`.
- **CSP** di `firebase.json` mengizinkan `https://*.supabase.co` + `wss://` — tak ada
  pengulangan bug "CSP memblokir seluruh Supabase".
- **Kop kosong aman secara konstruksi.** Rantai kop baru (`buildKopLembaga` → Rekap
  Prestasi) jatuh ke `BRAND.kopLine1/2` yang **kosong**, bukan ke nama lembaga mana pun.
  Dikunci `tests/unit/kopLembaga.test.js`.
- **Identitas pembeli murni runtime.** Nama lembaga di layar login datang dari settings
  Supabase, bukan dari kode.
- **Aplikasi hidup tanpa galat konsol** pada muat pertama; rute terlindungi benar-benar
  memulangkan ke login.

---

# F · Uji yang belum bisa diotomatiskan

Satu-satunya gerbang yang masih menuntut tangan manusia, dan **tetap berlaku**:

> **Cetak struk POS + rapor + Rekap Prestasi SEBELUM kop diisi.** Tak boleh muncul identitas
> lembaga mana pun.

Sync ini menambah **jalur cetak baru** (ekspor kop per-lembaga di Rekap Prestasi), jadi
daftar yang harus dicetak bertambah satu. Analisis kode bilang aman; analisis kode juga
bilang aman sebelum `muassis.png` ketahuan — dan itu **gambar**, yang tak pernah bisa
ditangkap grep.
