# 📱 PLAY STORE LISTING — Waseela

> **Untuk:** Kyai isi di Play Console. Berkas ini sumber tunggalnya — kalau listing
> diubah di Console, ubah juga di sini supaya rilis berikutnya tak menebak-nebak.
> **Bahasa:** Indonesia, **KECUALI bagian 9 "App access"** yang WAJIB Inggris.
> **Terakhir diperbarui:** 11 Agu 2026 · target rilis perdana `versionCode 1` / `v.1.0.0`

---

## ⚠️ Baca dulu: dua jebakan yang sudah terbukti memakan waktu

**1. Kolom "Detail login" dibatasi 500 karakter.** Versi panjang bergaya langkah 1–5
pernah tembus 724 karakter dan **kolomnya sendiri yang ditolak** — bukan akunnya. Kalau
teks di bagian 9 diedit, hitung ulang.

**2. Instruksi tab TIDAK menolong kalau aplikasinya belum mendukung lintas-jalur.**
Layar login punya dua tab (Santri/Wali · Guru/Pegawai), dan tab terpilih dikirim sebagai
`p_source` ke `resolve_login`. Pada aplikasi yang belum diperbaiki, tab yang keliru
menjawab **"tidak ditemukan"** untuk akun yang jelas ada — dan peninjau membacanya sebagai
kredensial salah. Menaruh instruksi tab di kolom Detail login **tidak cukup**: pemeriksa
otomatis Play membaca kolom username/sandi, bukan kolom instruksi.

> ✅ **Waseela AMAN dari jebakan kedua sejak rilis perdana.** `resolveLoginLintasJalur`
> ([`app/src/services/authSupabase.js:79`](app/src/services/authSupabase.js:79)) mengulang
> pencarian tanpa penyaring jalur bila jalur terpilih tak menemukan apa pun, dikunci
> `tests/unit/loginLintasJalur.test.js`. Karena itu teks bagian 9 boleh berjanji
> **"either tab works"**. Kalau kelak fungsi itu diubah, teks bagian 9 **wajib** ikut
> diubah — menjanjikan "either tab" pada build yang tak mendukungnya lebih buruk daripada
> tak memberi instruksi sama sekali.

---

## 1. App name

```
Waseela
```

**7 / 30 karakter** ✓

---

## 2. Short description

```
Portal manajemen lembaga pendidikan — santri, guru, absensi, rapor, keuangan
```

**76 / 80 karakter** ✓

---

## 3. Full description

> ⚠️ Paragraf pembuka SENGAJA menegaskan bahwa aplikasi ini hanya untuk anggota lembaga
> tertentu. Waseela single-tenant: satu pemasangan melayani satu lembaga, dan pendaftaran
> mandiri **dimatikan**. Tanpa penegasan ini, orang yang tak berkepentingan akan mengunduh,
> gagal masuk, lalu meninggalkan ulasan bintang satu — dan rating itu sulit diperbaiki.

```
Waseela adalah portal manajemen lembaga pendidikan: santri, guru dan pegawai,
absensi, penilaian dan rapor, keuangan, kegiatan, serta kanal informasi — dalam
satu aplikasi.

PENTING: aplikasi ini melayani satu lembaga tertentu. Akun dibuatkan oleh
administrator lembaga; tidak ada pendaftaran mandiri. Bila Anda bukan santri,
wali santri, guru, atau pegawai di lembaga tersebut, aplikasi ini tidak dapat
digunakan.

FITUR UTAMA

• Data santri & guru — biodata, kelas, lembaga, riwayat kenaikan
• Absensi — harian, kegiatan, sekolah, dan rekap bulanan
• Penilaian & rapor — cetak rapor dan rekap prestasi
• Keuangan — tagihan/syahriyah, pembayaran, tabungan santri, kas lembaga,
  kasir POS, dan bisyaroh
• Kegiatan & kalender pendidikan
• Kanal informasi — pengumuman lembaga langsung ke ponsel
• Widget layar utama — jam hijriah dan kalender pendidikan
• Notifikasi — tagihan terbit, pembayaran terverifikasi, hasil tes kenaikan

UNTUK SIAPA

• Wali santri — memantau perkembangan, absensi, tagihan, dan tabungan anak
• Santri — melihat nilai, jadwal, dan pengumuman
• Guru & pegawai — mengisi absensi dan penilaian
• Pengurus — mengelola data, keuangan, dan laporan lembaga

Membutuhkan koneksi internet.

Dikembangkan oleh Bakafrawi Project.
```

---

## 4. Kategori & setelan dasar

| Kolom | Isi |
|---|---|
| Kategori aplikasi | **Pendidikan** (Education) |
| Tag | Manajemen sekolah, Produktivitas |
| Berisi iklan | **Tidak** |
| Pembelian dalam aplikasi | **Tidak** |
| Situs | `https://waseela.web.app` |
| Kebijakan privasi | `https://waseela.web.app/privacy.html` |
| Email kontak | *(isi email dukungan Bakafrawi Project)* |

> Pastikan URL kebijakan privasi **benar-benar hidup** sebelum mengirim. URL privasi yang
> mati (404) tercatat sebagai salah satu sebab penolakan di produk sekerabat.

---

## 5. Data safety — isian formulir

Ini tempat penolakan paling sering terjadi. Daftar di bawah diturunkan dari skema
sebenarnya (`santri`, `guru`, tabel keuangan), bukan dikira-kira.

**Semua data di bawah: Dikumpulkan = YA · Dibagikan = TIDAK · Wajib = YA · Tujuan =
Fungsi aplikasi (App functionality)**

| Kategori Play | Jenis | Isi nyata di Waseela |
|---|---|---|
| Personal info | Name | `nama` santri, guru, wali |
| Personal info | User IDs | `nis`, `nisn` |
| Personal info | Other info | `nik`, jenis kelamin, nama wali |
| Contact info | Phone number | `wa` — nomor WhatsApp santri & wali |
| Photos and videos | Photos | foto profil santri/guru, tanda tangan, bukti transfer |
| Financial info | Other financial info | tagihan, pembayaran, tabungan santri, transaksi POS |
| App activity | Other actions | absensi, nilai, rapor, riwayat kenaikan |
| **App info & performance** | **Crash logs** | **Sentry** |
| **App info & performance** | **Diagnostics** | **Sentry** |

> 🔴 **Sentry paling sering terlupa.** Aplikasi memuat SDK Sentry dan mengirim laporan
> crash + diagnostik. Tidak mendeklarasikannya = keterangan Data safety tidak akurat,
> dan itu pelanggaran kebijakan tersendiri — terlepas dari niat.

**Praktik keamanan:**

| Pertanyaan | Jawaban |
|---|---|
| Data dienkripsi saat transit | **Ya** (HTTPS ke Supabase & Firebase) |
| Pengguna dapat meminta data dihapus | **Ya** — lewat administrator lembaga |
| Data dihapus otomatis? | Tidak — dipertahankan selama santri/pegawai terdaftar |

---

## 6. Content rating

Kuesioner Play. Jawaban untuk Waseela:

- Kekerasan, seksual, bahasa kasar, narkoba, judi, kontes/undian: **tidak ada**
- Berbagi lokasi pengguna: **tidak**
- Memungkinkan pengguna berinteraksi/berkomunikasi: **ya, terbatas** — ada kanal
  pengumuman dan kritik/saran. Bukan pesan bebas antar-pengguna; jawab sesuai kenyataan,
  jangan meremehkan pertanyaan ini
- Berbagi konten buatan pengguna: **ya, terbatas** — postingan beranda oleh pengurus

Perkiraan hasil: **Rated for 3+ / Everyone**.

---

## 7. ⚠️ Target audience — KEPUTUSAN KYAI, tetapkan sebelum mengisi

Santri login sendiri. **Kalau ada santri di bawah 13 tahun**, Play menerapkan
**Families Policy** yang jauh lebih ketat (aturan iklan, SDK yang boleh dipakai, kewajiban
tambahan pada kebijakan privasi).

Pilihannya:

| Pilihan | Konsekuensi |
|---|---|
| Sasaran **13+ / dewasa** | Jalur normal. Sah bila santri di bawah 13 **tidak** diberi akun — pemantauan lewat akun wali |
| Sertakan **di bawah 13** | Families Policy berlaku; perlu telaah ulang SDK (Sentry, Firebase) dan kebijakan privasi |

**Mengubahnya belakangan merepotkan**, jadi tetapkan dulu. Kalau lembaga memang
memberi akun kepada santri kecil, jujur menyatakannya — pernyataan yang tak sesuai
kenyataan berisiko penangguhan, bukan sekadar penolakan.

---

## 8. Release checklist — berurutan

**Sebelum build**

- [ ] `google-services.json` untuk paket `id.waseela.app` dari Firebase project
      **`waseela-id`** → taruh di `app/android/app/`
- [ ] Keystore dibuat + `app/android/key.properties` terisi
- [ ] **Keystore dicadangkan ke tempat aman** — hilang = tak bisa memperbarui selamanya
- [ ] Ikut **Play App Signing** (Google memegang kunci penandatangan; Kyai cukup
      memegang upload key, yang masih bisa dipulihkan bila hilang)
- [ ] Akun peninjau dibuat (lihat bagian 9)

**Build & uji**

- [ ] `npm run build:aab`
- [ ] 🔴 **Uji AAB-nya di HP sungguhan** — bukan build debug. `minifyEnabled true`
      (R8) aktif, dan kode berbasis refleksi (jembatan JS Capacitor, plugin, widget)
      bisa patah setelah di-shrink **tanpa terlihat di debug**. Uji: login, notifikasi,
      widget Jam Hijri & Kalender, ekspor PDF, kasir POS

**Play Console**

- [ ] Buat aplikasi, isi bagian 1–4 di atas
- [ ] Data safety (bagian 5) — **jangan lupa Sentry**
- [ ] Content rating (bagian 6)
- [ ] Target audience (bagian 7) — sudah diputuskan
- [ ] **App access** (bagian 9) — kredensial peninjau
- [ ] Unggah AAB ke **Internal testing** dulu, pasang di HP, baru naik ke produksi
- [ ] Setelah rilis: perbarui `app/public/app-version.json` (`versionCode`, `versionName`,
      `apkUrl`) — dan `apkUrl` **harus** APK "Signed, universal APK" yang diunduh dari
      Play Console → App bundle explorer. APK build lokal ditandatangani kunci berbeda
      sehingga tak bisa menimpa pemasangan dari Play

---

## 9. App access — kredensial peninjau (WAJIB Inggris, maks 500 karakter)

**Play Console → Konten aplikasi → Akses aplikasi → "Detail login".**

> 🔴 **Kolom ini TIDAK BOLEH dikosongkan.** Waseela mewajibkan login dan pendaftaran
> mandiri sudah dimatikan — peninjau Google **tidak mungkin** masuk sendiri. Dikosongkan
> = hampir pasti ditolak.

**Akunnya: JANGAN pakai `admin` bawaan.** Alasannya:

| Sebab | Akibat |
|---|---|
| `admin` adalah kunci induk hardcoded (`_resolve_authkey`) | Kredensial induk lembaga tersimpan permanen di Play Console |
| Tak ada MFA | Bila bocor, siapa pun masuk sebagai super_admin ke data hidup pembeli |
| `admin` **tak bisa menerima notifikasi** — `targetDoc()` melewati sesi ber-id `'admin'` | Peninjau yang menguji notifikasi tak melihat apa-apa, dapat dibaca "fitur tak berfungsi" |
| Itu akun milik pembeli | Mengganti sandinya kelak mengunci pembeli, bukan peninjau |

**Yang benar:** buat **record guru khusus** (mis. nama "Demo Review", username
`demoreview`), status Aktif. Akun loginnya lahir sendiri lewat `provisionAkunSenyap` saat
disimpan — dan karena pendaftaran mandiri mati, memang hanya jalur itu yang tersedia.
Sandi awal `1234`.

> Waseela single-tenant, jadi akun apa pun memperlihatkan **data santri yang sebenarnya**
> kepada peninjau Google. Sampaikan ini ke pembeli lebih dulu. Peran yang luas membuat
> semua fitur bisa ditinjau — dan penolakan berulang jauh lebih mahal daripada paparan
> terbatas kepada peninjau yang terikat kebijakan Google sendiri.

**Teks yang ditempel** (ganti `demoreview` bila usernamenya berbeda):

```
Username: demoreview
Password: 1234

Type exactly as shown - no "@", no domain, no phone number. Either tab on the login screen works. Then tap "MASUK" (Sign in).

This app serves one specific school; accounts are created by its administrator, so self sign-up is disabled by design. The account above has full access to all features. Internet connection required.
```

**363 / 500 karakter** ✓ — sisa ruang cukup bila perlu menambah satu kalimat.

### Yang sudah terbukti tentang cara peninjau mengetik

Diuji pada produk sekerabat dengan rantai login yang sama:

| Yang diketik | Hasil |
|---|---|
| username, tab Guru/Pegawai | ✅ berhasil |
| Kapital (`Demoreview`) atau ada spasi | ✅ berhasil — ditoleransi |
| username, tab Santri/Wali | ✅ berhasil **di Waseela** (lintas-jalur); ❌ gagal pada build tanpa perbaikan itu |
| Nomor telepon dalam format apa pun (`+62…`, `62…`, `08…`) | ❌ **selalu gagal** |

**Karena itu berikan username, jangan nomor telepon.** Sekalipun akun demo punya nomor
WA, jangan menuliskannya di kolom ini.

---

## 10. Sesudah rilis

- Pantau **Play Console → Kualitas aplikasi → Android vitals** untuk crash rate.
- Stack trace native terbaca karena `debugSymbolLevel 'SYMBOL_TABLE'` sudah aktif di
  `build.gradle` — tak perlu unggah simbol manual.
- Crash JavaScript masuk ke **Sentry** (`sentryRelease: 'waseela'`), bukan ke Play.
  Keduanya perlu dilihat; tak saling menggantikan.
- Setiap rilis berikutnya: **`versionCode` WAJIB naik**, dan selaraskan berempat —
  `app/android/app/build.gradle`, `app/package.json`, `BRAND.version`
  (`app/src/config/brand.js`), dan `app/public/app-version.json`.
