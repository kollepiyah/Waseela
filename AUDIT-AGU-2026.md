# 🔍 AUDIT MENYELURUH — Waseela

> Tanggal: **11 Agu 2026** · Branch `refork/ammu-single-tenant` · Project live `vfbmaywcjurykxfetbia`
> Status app: **LIVE**, dipakai pembeli (coba-coba). Data masih sangat sedikit.
> Cakupan: A keamanan backend · B auth & peran · C keuangan · D tiga target rilis · E ketahanan · F white-label & performa

---

## Keadaan saat audit

| Ukuran | Nilai |
|---|---|
| Tes | **890 hijau / 71 berkas** |
| Tabel | 55 — **RLS aktif di semua 55** (202 policy) |
| Isi data | **41 tabel masih kosong**; terbanyak 5 baris (2 santri, 2 guru) |
| Akun auth | **1** (`admin@waseela.local`, 8 Agu) — belum ada penyusup |
| Gerbang white-label | **4/4 lulus** |

**Ini waktu terbaik untuk membenahi struktur.** Lubang di bawah nyata dan terbuka, tapi
belum satu pun dilewati orang, dan data santri sungguhan belum masuk. Menambal sekarang
berarti nol migrasi data dan nol pemberitahuan kebocoran.

---

## Ringkasan temuan

| # | Temuan | Berat | Keadaan |
|---|---|---|---|
| 1 | `_enqueue_notif` — anon kirim push/phishing ke semua pengguna | 🔴 Kritis | ✅ **Sudah ditambal 11 Agu** |
| 2 | Pengambilalihan akun santri/guru sebelum dipakai | 🔴 Kritis | ✅ **Sudah ditutup 11 Agu** |
| 3 | Bucket `photo` & `psb` — siapa pun yang login boleh **hapus** semua berkas | 🔴 Kritis | ✅ **Sudah ditambal 11 Agu** |
| 4 | Bucket publik terbaca tanpa login (foto santri, bukti transfer) | 🟠 Tinggi | Terbuka |
| 5 | `CRON_SECRET` gagal-terbuka di 2 edge function publik | 🟠 Tinggi | ✅ **Sudah ditambal 11 Agu** |
| 6 | 10 policy "asal login" — **turun berat** sesudah #2 ditutup | 🟡 Sedang | Terbuka |
| 7 | pg_cron belum terpasang — push & tagihan otomatis **tak jalan** | 🟠 Tinggi | ✅ **Sudah jalan 11 Agu** (push tunggu perangkat) |
| 8 | SSRF: redirect tak divalidasi ulang di `get-link-preview` | 🟡 Sedang | Terbuka |
| 9 | `cleanup_audit_log` — anon hapus jejak audit | 🟡 Sedang | ✅ **Sudah ditambal** |
| 10 | Bucket tanpa batas ukuran/jenis berkas | 🟡 Sedang | Terbuka |
| 11 | Perlindungan sandi bocor (HaveIBeenPwned) mati | 🟡 Sedang | Terbuka |
| 12 | ~~Android: izin storage lawas tanpa `maxSdkVersion`~~ | — | ❌ **KELIRU** — sudah ada, salah baca |
| 18 | Android `allowBackup="true"` — sesi & PII santri tersalin ke Google Drive | 🟠 Tinggi | ✅ **Sudah ditambal 11 Agu** |
| 13 | PWA tanpa service worker — nol kemampuan luring | 🟡 Sedang | Sebelum rilis |
| 14 | Electron: installer tak bertanda tangan | 🟡 Sedang | Terdokumentasi |
| 15 | 5 fungsi `search_path` bebas | 🟢 Rendah | Kebersihan |
| 16 | Electron `node_modules` belum dipasang | 🟢 Rendah | Sebelum rilis |
| 17 | **Tak ada penangan galat global** — galat komponen Vue tak sampai ke Sentry | 🟠 Tinggi | ✅ **Sudah ditambal 11 Agu** |

---

# A · Keamanan backend

## 🔴 1. `_enqueue_notif` — phishing ke seluruh pengguna ✅ SUDAH DITAMBAL

Rantai lengkapnya:

```
anon (kunci publik, tanpa login)
  └→ POST /rest/v1/rpc/_enqueue_notif  { judul, pesan, target, LINK bebas }
      └→ insert notif_queue (status 'pending')
          └→ dispatch-push (pg_cron/menit, service-role) memungut
              └→ FCM terkirim ke santri · wali santri · guru
```

**Akar masalah — dan ini berlaku untuk setiap fungsi baru:** Postgres memberi `EXECUTE`
kepada `PUBLIC` **secara bawaan**. Tiap fungsi `security definer` yang tak pernah dicabut
otomatis terbuka lewat PostgREST. Advisor menandai 67 fungsi berpola ini; yang selamat
hanya yang kebetulan punya gerbang di dalam badannya (`analytics_query` memanggil
`auth_can_manage()` lebih dulu — itu polanya yang benar).

Bidang `link` yang paling berbahaya: tautan phishing yang tiba **lewat aplikasi lembaga
sendiri**, jadi tampak sah di mata wali santri.

**Tambalan:** [`20260811120000_rpc_internal_cabut_publik.sql`](supabase/migrations/20260811120000_rpc_internal_cabut_publik.sql)
— 13 fungsi internal dicabut dari `public`/`anon`/`authenticated`. Advisor turun **74 → 51**.
Terverifikasi: ACL tinggal `postgres | service_role`, seluruh trigger tetap hidup,
`resolve_login` tak tersentuh.

---

## 🔴 2. Pengambilalihan akun santri & guru sebelum akun itu dipakai

**Ini temuan terberat yang masih terbuka.**

Keadaan yang bertemu:

1. **Pendaftaran mandiri terbuka.** `/auth/v1/settings` → `disable_signup: false`,
   `mailer_autoconfirm: true`. Siapa pun bisa mendaftar dengan kunci anon yang memang
   publik, tanpa verifikasi email. Domain `@waseela.local` palsu pun diterima.
2. **`resolve_login` adalah orakel enumerasi.** Wajib anon (dipakai layar login sebelum
   sesi ada), tapi ia menjawab "akun ini ada / tidak" untuk **tebakan NIS, username, atau
   nomor WA apa pun**. NIS umumnya berurutan → mudah disapu.
3. **Akun lahir malas (lazy-create).** Baris `auth.users` baru terbentuk saat orangnya
   login pertama kali. Hari ini **baru 1 akun ada** — artinya akun seluruh santri dan guru
   masih kosong dan bisa diklaim lebih dulu.
4. **Gerbang K1-a tidak menutup santri & guru biasa.** `handle_new_user()` menolak
   pendaftaran mandiri hanya untuk `admin`, `super_admin`, `admin_keuangan`. Sumber
   `santri` dan guru ber-`role_sistem` biasa **lolos** dan langsung tertaut ke
   `santri_id` / `guru_id` sungguhan.

Rantainya:

```
resolve_login('12345')            → { source:'santri', auth_key:'12345', active:true }   ← NIS sah
POST /auth/v1/signup  12345@waseela.local + SANDI PENYUSUP
handle_new_user()                 → K1-a hanya menolak admin → santri LOLOS
                                  → profiles { role:'santri', santri_id:<santri asli> }
penyusup kini memegang akun santri itu — nilai, tagihan, tabungan, data walinya
```

Untuk guru biasa hasilnya lebih luas lagi: akses akademik satu lembaga.

**Catatan penting:** komentar di `handle_new_user` menyebut "buildSesi mengembalikan null
sehingga sesi app tak terbentuk". Itu benar **untuk aplikasinya**, tapi tidak menolong —
JWT-nya tetap sah dan penyusup bisa memukul PostgREST langsung tanpa lewat app.

**Usulan tambalan (urut dari yang paling menutup):**

1. **Matikan pendaftaran mandiri** — Supabase → Authentication → Sign Ups → `disable_signup`.
   Ini satu saklar dan menutup rantainya di langkah paling awal. Konsekuensinya:
   `loginUnified` yang mem-`signUp` saat akun belum ada akan berhenti bekerja, jadi
   **semua akun harus dibuat lewat `provision-akun`**. Perlu dipastikan alur pembuatan
   akun massal pembeli sudah lewat jalur itu.
2. Kalau (1) belum bisa: **perluas gerbang K1-a** agar `_provisi_diizinkan` diwajibkan
   untuk **semua** sumber, bukan hanya admin — yakni tolak setiap pendaftaran mandiri yang
   `m.source is not null` tanpa izin provisi.
3. Beri **jeda + batas laju** pada `resolve_login` agar penyapuan NIS mahal (tak menutup,
   hanya memperlambat).

---

## 🔴 3. Bucket `photo` & `psb` — siapa pun yang login boleh menghapus semuanya

Policy `storage.objects`:

| Bucket | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `branding` | `auth_can_manage()` ✅ | `auth_can_manage()` ✅ | `auth_can_manage()` ✅ |
| `photo` | **hanya cek `bucket_id`** ❌ | **hanya cek `bucket_id`** ❌ | **hanya cek `bucket_id`** ❌ |
| `psb` | **hanya cek `bucket_id`** ❌ | **hanya cek `bucket_id`** ❌ | **hanya cek `bucket_id`** ❌ |

`branding` sudah digerbangi benar — jadi polanya sudah ada di repo, `photo` dan `psb`
hanya belum menyusul.

Digabung temuan #2 (pendaftaran terbuka), artinya **orang luar bisa menghapus seluruh
foto santri dan seluruh bukti transfer**, atau menimpanya dengan berkas lain. Tak ada
versi cadangan di Storage secara bawaan.

**Usulan:** samakan dengan pola `branding` — tulis/hapus butuh `auth_can_manage()`;
untuk `photo`, kalau santri perlu mengunggah fotonya sendiri, batasi pada prefiks
miliknya (`name like auth_santri_id() || '/%'`), bukan seluruh bucket.

---

## 🟠 4. Ketiga bucket publik terbaca tanpa login

`branding` · `photo` · `psb` semuanya `public = true`. Berarti tak perlu login sama
sekali — cukup tahu (atau menebak) URL-nya:

- `photo` — foto santri & guru. Kalau namanya mengikuti NIS, URL-nya bisa ditebak.
- `psb` — bukti transfer pendaftaran; berpasangan dengan `psb_pendaftaran` yang berisi
  NIK, HP, alamat.

Sudah tercatat di HANDOVER sebagai menunggu keputusan Kyai. Sekarang ada bahan
memutuskannya: **memprivatkan butuh signed URL di sisi baca** (perubahan di komponen
penampil gambar), sedangkan membiarkannya berarti menerima bahwa berkas yang URL-nya
bocor sekali akan terbuka selamanya.

Untuk `branding` (logo lembaga) publik itu wajar. Untuk `photo` dan `psb` tidak.

---

## 🟠 5. `CRON_SECRET` gagal-terbuka di dua fungsi publik

`dispatch-push` dan `auto-generate-tagihan` keduanya `verify_jwt = false` (memang, karena
dipanggil pg_cron). Penjaganya:

```js
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
function ok(req) {
  if (!CRON_SECRET) return true   // ← bila secret belum diset, SIAPA PUN boleh
  ...
}
```

Kalau `CRON_SECRET` belum dipasang di project, keduanya **terbuka untuk umum**:

- `dispatch-push` — orang luar bisa menguras antrean kapan saja (biaya FCM, waktu kirim kacau).
- `auto-generate-tagihan` — orang luar bisa **memicu penerbitan tagihan**. Id tagihan
  deterministik sehingga tak menerbitkan duplikat (lihat C), tapi tetap bisa menerbitkan
  tagihan periode berjalan lebih awal dari yang dikehendaki.

**Belum bisa saya pastikan dari sini** — nilai secret Edge Function tak terbaca lewat SQL,
dan mengujinya dengan memanggil endpoint-nya justru akan menerbitkan tagihan sungguhan di
DB pembeli, jadi sengaja tidak saya lakukan.

**Yang perlu Kyai cek:** Supabase → Edge Functions → Secrets → apakah `CRON_SECRET` ada.
Kalau belum: pasang, lalu sertakan di URL pemanggil pg_cron. Dan ubah polanya jadi
**gagal-tertutup** (`if (!CRON_SECRET) return false`) supaya lupa memasang secret berarti
fungsi mati, bukan fungsi terbuka.

---

## 🟠 6. Sepuluh policy "asal sudah login" = efektif publik

Dari 202 policy: **10 ber-`qual = true`** dan **10 ber-`auth.uid() IS NOT NULL`**.
Selama pendaftaran mandiri terbuka, kelompok kedua **sama saja dengan kelompok pertama**.

Yang terbuka lewat "asal login":

| Tabel | Isi |
|---|---|
| `absensi_santri_sekolah` | absensi sekolah per santri |
| `absensi_kegiatan` | absensi kegiatan |
| `supervisi_catatan` | catatan supervisi |
| `keuangan_va_intent` | niat bayar virtual account |
| `scheduled_jobs`, `user_notif_state`, `post_reactions` | — |

Yang terbuka penuh tanpa login: `beranda_post`, `posts`, `post_reactions`, `kegiatan`,
`kegiatan_master`, `kegiatan_pesantren`, `lembaga`, `master`, `profil_pesantren`,
`link_preview_cache`.

Beberapa di antaranya memang niatnya publik (profil lembaga, kegiatan). Tapi
`beranda_post` perlu ditimbang — kalau isinya pengumuman internal, itu bocor ke umum.

Audit Agustus (`20260803120000`) sudah menutup tujuh tabel serupa; sepuluh ini
sisanya. **Menutup #2 (pendaftaran mandiri) langsung menaikkan nilai kelompok kedua**
dari "publik" jadi "pengguna sah lembaga" — itu sebabnya #2 didahulukan.

---

## 🟠 7. pg_cron belum terpasang — notifikasi tak pernah terkirim

`cron.job` tidak ada di database. Akibat yang terukur:

- **`notif_queue`: 5 baris macet `pending`** sejak 9 Agu, tak satu pun terkirim.
- `auto-generate-tagihan` tak pernah jalan → tagihan bulanan otomatis tidak terbit.

Ini **fungsional, bukan keamanan** — dan sudah tercatat di HANDOVER sebagai sisa pekerjaan
nomor 7. Tapi dampaknya sekarang nyata: pembeli mengira notifikasi jalan, padahal tak ada
satu pun sampai ke HP. Perlu `create extension pg_cron` + Vault untuk menyimpan secret,
lalu jadwalkan kedua fungsi.

---

## 🟡 8. SSRF: redirect tidak divalidasi ulang

`get-link-preview` (`verify_jwt = false`, publik) punya penjaga SSRF yang **cukup baik**:
menolak `localhost`, `metadata.google.internal`, loopback/link-local/ULA IPv6, dan rentang
IPv4 privat (`0/8`, `127/8`, `10/8`, `172.16–31`, `192.168`, `169.254`, `224+`).

Celahnya: pemeriksaan hanya di **host awal**, lalu:

```js
const r = await fetch(targetUrl, { redirect: 'follow', ... })
```

Situs jahat `https://evil.com/x` yang membalas `302 → http://169.254.169.254/...`
melewati penjaga. Nama host yang resolusi DNS-nya menunjuk IP privat (DNS rebinding)
juga tak tertangkap, karena yang diperiksa hanya IP literal.

**Usulan:** `redirect: 'manual'`, lalu telusuri sendiri tiap lompatan dan jalankan
`isBlockedHost()` di setiap URL tujuan (batasi mis. 3 lompatan).

---

## 🟡 9–11. Sisanya di sumbu A

- **`cleanup_audit_log`** — anon bisa menghapus `audit_log` > 90 hari. ✅ sudah ditambal.
- **Bucket tanpa batas** — ketiganya `file_size_limit: null`, `allowed_mime_types: null`.
  Siapa pun yang bisa mengunggah boleh mengunggah berkas sebesar dan sejenis apa pun →
  penyalahgunaan kuota storage, dan bucket publik jadi tempat menitipkan berkas asing.
  Usulan: batasi ukuran (mis. 5 MB) dan MIME (`image/*`, `application/pdf`).
- **Perlindungan sandi bocor mati** — Supabase Auth bisa menolak sandi yang sudah bocor
  (HaveIBeenPwned). Sekarang nonaktif. Satu saklar di dashboard.
- **`akun_provisi_izin` RLS tanpa policy** — ini **disengaja dan benar** (tolak semua;
  hanya service-role yang menyentuhnya). Advisor menandainya sebagai INFO, bukan masalah.

---

# B · Auth & peran

Selain #2 di atas:

- **Gerbang K1-a bekerja untuk peran pengurus.** Pendaftaran mandiri sebagai
  `admin`/`super_admin`/`admin_keuangan` ditolak dengan `42501`. Rancangannya benar —
  hanya cakupannya kurang luas.
- **`auth_can_*` / `auth_is_*` ditandai advisor tapi bukan lubang.** Isinya cuma fakta
  tentang **pemanggil sendiri**; anon memanggilnya dapat `false`/`null` — nol data bocor.
  Sengaja **tidak** dicabut karena RLS bergantung padanya; mencabutnya berisiko mematikan
  RLS di seluruh app live demi keuntungan keamanan nol.
- **`resolve_login` wajib tetap anon.** Sifat orakelnya melekat pada rancangan login
  (pengguna mengetik NIS, bukan email). Yang bisa dilakukan hanya membatasi laju.
- **`admin_target_auth_uid` / `admin_akun_belum_ada`** — bergerbang `auth_is_super()` /
  `auth_can_manage()` di dalam badannya. Aman.
- **`save_push_token`** — dapat dipanggil `authenticated`. Perlu ditinjau apakah ia
  memverifikasi bahwa `p_coll`/`p_id` benar milik pemanggil; kalau tidak, pengguna sah
  bisa menempelkan token push-nya ke identitas orang lain. **Belum sempat saya baca —
  masuk daftar tindak lanjut.**

---

# C · Integritas keuangan — **sehat**

Bagian ini justru yang paling rapi di seluruh repo.

**Saldo berbasis ledger.** `kasLembaga.js`, `bukuIndukLaporan.js`: saldo selalu dihitung
`Σmasuk − Σkeluar` dari baris mutasi, **bukan** kolom saldo tersimpan yang di-update.
Rancangan ini kebal dari balapan *lost-update* — dua kasir menyetor bersamaan tidak bisa
saling menimpa. Ini keputusan yang benar dan layak dipertahankan.

**Idempotensi tagihan ditangani sengaja.** [`tagihanId.js`](app/src/utils/tagihanId.js):
id dibentuk deterministik `tagihan_<santriId>_<jenisId>_<periode>`, sehingga tombol
Generate manual dan cron bulanan tak bisa menerbitkan tagihan kedua untuk santri dan bulan
yang sama. Berkasnya bahkan memperingatkan bahwa `auto-generate-tagihan/index.ts`
menyusun pola yang sama secara inline dan keduanya harus berubah bersamaan — dikunci
`tests/unit/tagihanId.test.js`.

**Pembulatan menjaga total.** [`syahriyah.js:345`](app/src/utils/syahriyah.js:345)
`pecahProporsional()` memakai pola sisa-berjalan: entri ke-1..n dibulatkan proporsional
dan dijepit `Math.min(sisa, …)`, lalu **entri pertama menerima sisa**. Hasilnya jumlah
baris Buku Induk selalu tepat sama dengan uang yang diterima sampai rupiah terakhir.
Komentarnya menyebut alasannya dengan tepat: pembulatan naif akan membuat kas melenceng
beberapa rupiah tiap transaksi, "dan ini uang riil sejak 1 Agu 2026".

Semua nominal disimpan sebagai **rupiah bulat** (`Math.round`), tak ada pecahan sen —
jadi tak ada galat floating point yang menumpuk.

**Tes pendukung:** `posDana` (11), `tagihan` (14), `metodeBayar` (8), `bisyarohPerTepat` (4),
`tagihanId` (6) — semuanya hijau.

**Satu-satunya catatan:** #5 di atas — kalau `CRON_SECRET` belum dipasang, orang luar bisa
memicu `auto-generate-tagihan`. Id deterministik mencegah duplikat, jadi kerusakannya
terbatas pada *waktu terbit*, bukan *jumlah tagihan*.

---

# D · Kesiapan tiga target rilis

## Web / PWA

| Hal | Keadaan |
|---|---|
| `manifest.webmanifest` | ✅ lengkap — nama, ikon 192/512 + maskable, `standalone`, warna tema |
| Ikon & splash | ✅ 16 berkas terpasang, audit `apply-brand` lulus |
| `privacy.html` | ✅ ada (dibutuhkan Play Store) |
| **Service worker** | ❌ **tidak ada** — hanya `firebase-messaging-sw.js` untuk FCM |
| Ukuran bundle | 6,0 MB total; `vendor-excel` 918 KB + `vendor-pdf` 766 KB **sudah terpisah** (lazy) |

**Temuan #13:** tak ada service worker aplikasi (`vite-plugin-pwa` tidak dipakai). App
bisa dipasang, tapi **nol kemampuan luring** — tanpa jaringan layarnya kosong. Untuk
lembaga pendidikan dengan koneksi tak menentu, ini terasa. Minimal: cache app-shell +
aset statis.

Pemecahan chunk sudah baik — excel dan pdf tidak ikut terunduh di muat pertama.

## Android

| Hal | Keadaan |
|---|---|
| `targetSdkVersion` | ✅ **36** (Android 16) — memenuhi tenggat Play **31 Agu 2026** |
| `minSdkVersion` | 23 |
| Perubahan perilaku Android 16 | ✅ sudah ditelaah & didokumentasikan di `variables.gradle` |
| `applicationId` | ✅ `app.waseela.id` |
| `versionCode` | 1 (wajar untuk rilis perdana) |
| `google-services.json` | ❌ sengaja tak ada — build gagal tanpa itu (disengaja) |
| Keystore | ❌ belum dibuat |

**❌ Temuan #12 DICABUT — itu kekeliruan saya, bukan cacat manifest.**

Saya melaporkan izin storage "tanpa `maxSdkVersion`". Salah: keduanya sudah punya sejak
v.85 —

```xml
<uses-permission android:name="...WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
<uses-permission android:name="...READ_EXTERNAL_STORAGE"  android:maxSdkVersion="32" />
```

Perintah pindai saya hanya mengekstrak atribut `android:name`, sehingga `maxSdkVersion`
tak pernah ikut terlihat. Pelajarannya: **jangan menyimpulkan cacat dari grep yang
memotong atribut** — baca berkasnya.

**Manifest ini justru teladan**, dan layak dipertahankan apa adanya. Setiap izin
terdokumentasi alasannya, dan tiga kelas izin sudah sengaja DIBUANG dengan rujukan
kebijakan Play yang tepat:

| Dibuang | Alasan tertulis di manifest |
|---|---|
| `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` | Izin TERBATAS Play — hanya untuk app yang intinya alarm/timer/kalender. Widget Jam Hijri bukan alasan sah; `setExact()` sudah dibungkus try/catch → jatuh ke `set()` inexact |
| `READ_MEDIA_IMAGES` / `_VIDEO` | Kebijakan "Penggunaan izin foto & video tidak valid" — app hanya pakai `<input type="file">` = photo picker sistem, tak butuh izin |
| `CAMERA` + `uses-feature` | Izin MENGANGGUR — `@capacitor/camera` tak terpasang, nol pemakaian kamera di `src/` |

Izin yang tersisa (`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `VIBRATE`,
`RECEIVE_BOOT_COMPLETED`) wajar dan sepadan dengan fiturnya.

## 🟠 18. `allowBackup="true"` — sesi & PII santri tersalin ke Google Drive ✅ DITAMBAL

Manifest memakai `android:allowBackup="true"` **tanpa** `fullBackupContent` maupun
`dataExtractionRules`. Android Auto Backup karena itu menyalin seluruh data aplikasi ke
Google Drive pengguna — termasuk `localStorage` WebView yang menyimpan **sesi login**
(`waseela_sesiAktif`) dan cache data lembaga (nama, NIK, NIS, nomor wali, foto santri).

**Dilarang, bukan disaring.** Waseela klien tipis di atas Supabase: semua data sungguhan
ada di server, yang tersimpan di perangkat cuma sesi + cache yang lahir kembali sendiri
begitu pengguna login. Backup lokal menambah **nol manfaat** saat ganti HP, sambil membawa
PII santri dan sesi keluar. Ganti HP cukup login ulang — dan itu justru lebih aman.

Ditambal dengan `allowBackup="false"` **plus**
[`res/xml/data_extraction_rules.xml`](app/android/app/src/main/res/xml/data_extraction_rules.xml):
flag itu menutup backup awan di semua versi, sedangkan berkas aturan menutup jalur kedua
yang tak tersentuh flag — **transfer langsung antar-perangkat di Android 12+**, yang hanya
patuh pada `dataExtractionRules`. Menyetel salah satunya saja meninggalkan separuh terbuka.

**Masih dibutuhkan sebelum kirim ke Play:** `google-services.json` untuk `app.waseela.id`,
keystore **baru** (hilang = tak bisa memperbarui selamanya), pengisian **Data Safety**
(app mengumpulkan nama, foto, NIK, nomor HP, data keuangan — semua wajib dideklarasikan),
dan tautan kebijakan privasi.

## Electron

| Hal | Keadaan |
|---|---|
| `nodeIntegration` | ✅ `false` di semua jendela |
| `contextIsolation` | ✅ `true` |
| `webSecurity` | ✅ `true` |
| `setWindowOpenHandler` | ✅ ada — tautan luar diserahkan ke `shell.openExternal` |
| `node_modules` | ❌ **belum dipasang** — `tsc` tak ada, build belum bisa jalan |
| Tanda tangan installer | ❌ tidak ada sertifikat |

Dasar keamanannya **benar semua** — ini seringnya justru yang salah di aplikasi Electron.

**Temuan #14 — installer tak bertanda tangan.** Sudah didokumentasikan panjang di
`app/electron/package.json`: `publisherName` sengaja dilepas karena `NsisUpdater`
memverifikasi Authenticode installer yang baru diunduh; installer tak bersertifikat →
`NotSigned` → pembaruan **ditolak**. Di PC yang PowerShell-nya bermasalah verifikasi
dilewati dan update justru jalan — itulah sebab keluhan Kyai 5 Agu bahwa "auto-update
tidak bisa di beberapa PC" terasa acak.

Selama belum ada sertifikat code-signing: pengguna akan melihat peringatan SmartScreen
tiap memasang, dan auto-update tetap tak bisa diandalkan. Ini **keputusan bisnis**
(sertifikat OV/EV berbayar tahunan), bukan bug.

---

# E · Ketahanan runtime — **sehat, satu lubang**

Ditelusuri 11 Agu 2026. Hasilnya jauh lebih baik dari dugaan awal.

## Yang sudah benar

**Langganan realtime bersih 100%.** Dari 103 pemakaian `subscribeColl`/`subscribeDoc` di
`views/` + `components/`, **setiap** berkas yang benar-benar berlangganan punya
`onUnmounted`. Satu-satunya yang tampak menyimpang (`MasterDataView.vue`) ternyata positif
palsu — namanya hanya muncul di komentar sejarah; langganannya sudah diganti pengambilan
sekali-jalan. Tak ada kebocoran listener.

**Kegagalan sampai ke mata pengguna.** 436 pemakaian `toast.error`/`warning` di 69 view.
View yang tak memakai toast pun bukan berarti diam: `ImporSupabaseView` misalnya menampilkan
galat lewat state merah di template ([baris 121](app/src/views/ImporSupabaseView.vue:121)),
bukan toast. Menghitung toast saja akan menyesatkan.

**Sesi kedaluwarsa ditangani matang.** [`stores/auth.js`](app/src/stores/auth.js) membedakan
tiga keadaan yang mudah tertukar: belum login, **sesi zombie** (localStorage terisi tapi
token Supabase sudah mati), dan logout sengaja — lengkap dengan `_recoverZombieSession()`.
`TOKEN_REFRESHED` di-dedupe per-uid supaya refresh berkala tak memicu refetch koleksi
berulang. Ini menutup gejala "data kosong sampai hard refresh" di Android/Electron.

**Luring terdeteksi dengan benar.** `AppHeader.vue` memakai `@capacitor/network` di native
— sebab `navigator.onLine` tak andal di WebView — dengan fallback ke event window, dan
listener-nya **dilepas** saat unmount. Statusnya tampil di tiga tempat.

**`catch` kosong yang ada, wajar.** Yang di `auth.js` membungkus `localStorage` dan atribusi
audit — keduanya memang boleh gagal (mode privat, kuota penuh) tanpa mematahkan login.

## ✅ 17. Jaring galat global — sudah ditambal

**Koreksi atas dugaan awal:** saya sempat mencatat "tak ada pendengar `unhandledrejection`".
Itu **tidak tepat** — Sentry sudah terpasang ([`main.js`](app/src/main.js) + CDN di
`index.html`) dan memasang sendiri penangkap `window.onerror` serta `unhandledrejection`,
jadi galat JS biasa memang sudah terlapor selama ini.

Yang benar-benar hilang lebih spesifik dan lebih tajam: **galat komponen Vue tak pernah
sampai ke Sentry.** Vue menelan galat render / lifecycle / watcher / handler-event dan
menyalurkannya ke `app.config.errorHandler` — yang tidak ada — sehingga tak pernah
menyentuh `window.onerror`. Justru kelas galat inilah yang paling sering mematikan layar.
Ditambah: pengguna tak diberi tahu apa pun, layar kosong tanpa sepatah kata.

**Tambalan:** tiga lapis di `main.js`, urut sengaja — konsol dulu (satu-satunya jejak yang
tetap ada bila CDN Sentry diblokir / luring / `defer` belum usai), lalu Sentry, lalu toast
pengguna. Toast dijeda 8 detik sebab galat render bisa berulang tiap frame. Penolakan
promise yang wajar (`AbortError`, batal-navigasi, `ResizeObserver`) disaring — itu terjadi
normal saat pengguna berpindah halaman cepat, dan memberi toast untuknya hanya melatih
pengguna mengabaikan toast.

Tak memakai `@sentry/vue` karena SDK-nya dimuat dari CDN (hemat ~250 KB tiap muat), jadi
integrasi resminya tak tersedia sebagai modul.

**Terverifikasi di dev server, bukan sekadar build hijau:**

| Uji | Hasil |
|---|---|
| `Promise.reject(new Error(…))` | Toast tampil + `[galat:promise]` di konsol + objek bertanda `__sentry_captured__: true` |
| `Promise.reject(DOMException 'AbortError')` | Tak ada `[galat:promise]`, tak ada toast — tersaring benar |

## 🟡 Luring: terindikasi, belum tertahankan

Statusnya ditampilkan, tapi aplikasinya tak bisa hidup tanpa jaringan — tak ada service
worker (temuan #13), jadi tanpa koneksi layarnya kosong sejak awal. Tak ada pula antrean
tulis: simpanan yang dicoba saat jaringan putus gagal per-view, tak ditahan untuk dikirim
ulang. Untuk lembaga dengan koneksi tak menentu, keduanya berpasangan — service worker
tanpa antrean tulis hanya menyelesaikan separuh.

---

# F · White-label & performa — **bersih**

Keempat gerbang lulus:

```
✓ Gerbang SUMBER      — nol jejak di app/src, supabase/, tests/, electron/, android/
✓ Gerbang HASIL BUILD — nol jejak identitas di app/dist
✓ Gerbang BACKEND     — bundel hanya menunjuk project Supabase sendiri
✓ cek-kebocoran       — nol dari 14 nilai identitas hulu; nol aset kembar
✓ apply-brand         — 16 aset merek terpasang (logo, ikon, splash, notif)
```

Rahasia tak pernah ter-commit — `.gitignore` menutup `service-account.json`,
`google-services.json`, `*.jks`, `.env*`; riwayat git bersih (hanya `.env.example`).

Performa: bundle 6 MB dengan pemecahan vendor yang sudah benar. Belum diperiksa kueri N+1
di sisi Supabase.

---

# Urutan yang saya sarankan

**Sebelum data santri sungguhan masuk** (paling murah dikerjakan sekarang):

1. **Matikan pendaftaran mandiri** (#2) — satu saklar, menutup rantai terberat, dan
   sekaligus menaikkan nilai 10 policy "asal login" (#6).
2. **Gerbangi `photo` & `psb`** (#3) — tiru pola `branding` yang sudah benar.
3. **Cek `CRON_SECRET`** (#5) + ubah polanya jadi gagal-tertutup.
4. **Pasang pg_cron** (#7) — supaya notifikasi & tagihan otomatis benar-benar jalan.

**Sebelum rilis Play Store / Desktop:**

5. `maxSdkVersion` pada izin storage (#12); siapkan keystore, `google-services.json`, Data Safety.
6. `npm install` di `app/electron` (#16); putuskan soal sertifikat code-signing (#14).
7. Putuskan service worker PWA (#13).

**Ketika sempat:**

8. Privatkan bucket `photo`/`psb` + signed URL (#4); batasi ukuran & MIME (#10).
9. Redirect SSRF (#8); nyalakan perlindungan sandi bocor (#11); `search_path` (#15).
10. Baca `save_push_token` (sumbu B) dan telusuri sumbu E.

---

## Status tambalan (per 11 Agu 2026)

### ✅ Sudah diterapkan ke DB live

| Migrasi | Isi | Menutup |
|---|---|---|
| [`20260811120000_rpc_internal_cabut_publik.sql`](supabase/migrations/20260811120000_rpc_internal_cabut_publik.sql) | 13 fungsi internal dicabut dari `public`/`anon`/`authenticated`. Advisor **74 → 51** | **#1**, **#9** |
| [`20260811130000_storage_gerbang_pemilik.sql`](supabase/migrations/20260811130000_storage_gerbang_pemilik.sql) | `photo` & `psb`: upd/del bergerbang `owner = auth.uid() or auth_can_manage()` | **#3** |
| [`20260811140000_provisi_izin_grant_service_role.sql`](supabase/migrations/20260811140000_provisi_izin_grant_service_role.sql) | `service_role` diberi hak di `akun_provisi_izin` | *bug* |

Semuanya terverifikasi langsung di DB (ACL, policy, trigger, jalur login).

**Bug yang tersingkap saat menambal:** tabel `akun_provisi_izin` (dibuat 3 Agu) tak pernah
diberi hak ke `service_role`, sehingga Edge Function `provision-akun` selalu gagal di
langkah tulis izin — *"permission denied for table akun_provisi_izin"*. Artinya **sapuan
akun belum pernah berhasil sejak tabel itu ada**. Bukan masalah RLS (`service_role`
ber-`rolbypassrls`), murni GRANT tingkat tabel. Sesudah diperbaiki, sapuan berhasil.

**Catatan riwayat migrasi:** migrasi yang diterapkan lewat MCP/dashboard diberi stempel
waktu penerapan sebenarnya, bukan stempel nama berkas — sehingga `db push` sempat menolak
karena "remote migration versions not found". Dirukunkan dengan `migration repair
--status reverted` (versi remote lama) + `--status applied` (berkas lokal), bukan dengan
menjalankan ulang — empat migrasi 8–9 Agu belum tentu idempoten. Riwayat kini 1:1 dengan
nama berkas.

### ✅ Sudah diubah di kode — MENUNGGU DEPLOY

| Berkas | Perubahan | Temuan |
|---|---|---|
| [`dispatch-push/index.ts`](supabase/functions/dispatch-push/index.ts) | `CRON_SECRET` **gagal-tertutup** | #5 |
| [`auto-generate-tagihan/index.ts`](supabase/functions/auto-generate-tagihan/index.ts) | `CRON_SECRET` **gagal-tertutup** | #5 |
| [`authSupabase.js`](app/src/services/authSupabase.js) | Pesan waras saat pendaftaran mandiri dimatikan | #2 (pendukung) |

Tes **890 hijau** setelah perubahan.

### ✅ Penjadwalan cron — hidup sejak 11 Agu 2026

| Job | Jadwal | Keadaan |
|---|---|---|
| `waseela-auto-tagihan` | `0 17 * * *` UTC = **00.00 WIB** | Siap penuh — tak butuh FCM |
| `waseela-dispatch-push` | `* * * * *` | Jalan bersih (`200 {"ok":true,"processed":0}`) |

Terbukti dari `net._http_response`: 500 → **200** pada 09:33, dan lima notifikasi yang
macet `pending` sejak 9 Agu akhirnya diproses (`failed — No tokens`, wajar: belum ada
perangkat terdaftar). Antrean bersih.

**Jebakan yang memakan waktu — catat:** header kustom **`x-cron-secret` TIDAK SAMPAI** ke
Edge Function; tersaring di perjalanan pg_net → gerbang Supabase. Gejalanya 401
`unauthorized` terus-menerus padahal nilai secret sudah benar — mudah disalahartikan
sebagai salah nilai. Terbukti dengan mengirim secret yang sama lewat `?k=` dan
`Authorization: Bearer`: keduanya lolos. **Pakai `Authorization: Bearer`** — `?k=` juga
diterima fungsi tapi URL lengkap tercetak di log permintaan, jadi rahasianya mendarat di log.

### ✅ Notifikasi push — TERBUKTI SAMPAI (11 Agu 2026, 09.54)

`VAPID_KEY` diisi dari project `waseela-id`, di-build & deploy, lalu diuji ujung-ke-ujung:

```
09:53:18   beranda_post disimpan → trigger tg_beranda_post_notif → notif_queue (pending)
09:54:00   pg_cron menembak → 200 {"ok":true,"processed":1}
09:54:01   notif_queue → 'sent', tanpa galat  → notifikasi tiba di HP
```

Ini **notifikasi pertama yang pernah terkirim di project ini**, dan sekaligus membuktikan
enam hal: trigger tetap hidup setelah EXECUTE-nya dicabut (hak fungsi trigger diperiksa
saat `CREATE TRIGGER`, bukan saat menyala — persis seperti yang diklaim migrasi Batch 3);
`_enqueue_notif` tetap terpanggil dari dalam trigger karena berjalan sebagai `postgres`
= pemilik fungsi; pg_cron tepat waktu; gerbang secret lolos; OAuth FCM sah; token
perangkat terpakai.

**⚠️ Akun `admin` TIDAK BISA menerima notifikasi** — dan ini disengaja, bukan bug.
[`usePushNotifications.js:47`](app/src/composables/usePushNotifications.js:47) melewati
sesi ber-id `'admin'` karena token disimpan ke dalam baris `guru`/`santri`, sedangkan admin
bawaan tak punya baris. Gejalanya menyesatkan saat menguji: izin diminta, token didapat
dari FCM, lalu `saveToken` berhenti diam-diam tanpa galat — tampak seperti gagal, padahal
memang dilewati. **Uji push selalu dengan akun guru/santri.** Kalau kelak pemilik lembaga
perlu ikut menerima, butuh tempat simpan token yang tak bergantung baris guru/santri
(mis. di `profiles`) — perubahan rancangan kecil, bukan tambalan.

**Catatan iPhone:** web push di iOS hanya jalan bila aplikasinya ditambahkan ke Home
Screen lebih dulu, lalu dibuka dari ikon itu. Android Chrome tak punya syarat ini.

### ⚠️ URUTAN WAJIB — jangan dibalik (untuk pemasangan project baru)

Fungsi cron sekarang **gagal-tertutup**: tanpa `CRON_SECRET` ia menolak semua permintaan.
Karena itu urutannya mengikat:

1. **Pasang `CRON_SECRET`** — Supabase → Edge Functions → Secrets.
2. **Baru deploy** kedua fungsi cron.
3. **Baru pasang pg_cron** + jadwalkan, dengan secret ikut di URL/header.

Membalik 1 dan 2 tak merusak apa pun sekarang (pg_cron memang belum ada, jadi tak ada yang
memanggil), tapi akan membuat notifikasi & tagihan otomatis diam-diam menolak begitu
dijadwalkan.

### 🔑 Hanya bisa dikerjakan Kyai

| Langkah | Tempat | Untuk temuan | Status |
|---|---|---|---|
| Tekan **buat akun login** (sapuan) | app → Master Data | #2 — prasyarat | ✅ 11 Agu — 4 akun lahir |
| Matikan **pendaftaran mandiri** | Supabase → Authentication → Sign Ups | #2 — penutupnya | ✅ 11 Agu — `disable_signup: true` |
| Terapkan migrasi storage | `supabase db push` | #3 | ✅ 11 Agu |
| Pasang `CRON_SECRET` | Supabase → Edge Functions → Secrets | #5 | ⏳ |
| Deploy 2 fungsi cron (**sesudah** secret) | `supabase functions deploy` | #5 | ⏳ |
| Pasang pg_cron + jadwalkan | Supabase → Database → Extensions | #7 | ⏳ |
| Nyalakan **leaked password protection** | Supabase → Authentication → Passwords | #11 | ⏳ |

### 📌 Aturan operasional baru (sesudah pendaftaran mandiri mati)

Akun kini **hanya** lahir lewat `provision-akun`. Jalur yang sudah otomatis: tambah
guru/santri satuan, impor Excel di menu Guru, impor Excel di menu Santri, dan terima
pendaftar PPDB.

**Yang TIDAK otomatis: menu Impor Supabase** (alat migrasi data lama). Sesudah memakainya,
**wajib** tekan **"Buat akun yang belum ada"** di Master Data.

Sengaja tidak diotomatiskan: kunci akun santri = No. Induk, dan sapuan yang berjalan
sebelum No. Induk final akan melahirkan akun ber-kunci basi (yatim) — lihat peringatan di
[`SantriView.vue:1297`](app/src/views/SantriView.vue:1297). Alat itu sekali-pakai dan hanya
super_admin, jadi satu klik tombol lebih murah daripada risikonya.

**Sapuan akun wajib lebih dulu dari mematikan pendaftaran.** Sesudah pendaftaran mandiri
mati, akun hanya lahir lewat `provision-akun` — yang memakai Admin API service-role dan
**tidak** lewat endpoint pendaftaran publik, jadi jalur itu tetap hidup. Tapi santri/guru
yang belum punya akun saat saklar dimatikan tak akan bisa login sampai disapu.
