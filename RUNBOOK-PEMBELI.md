# Runbook — menyiapkan Waseela untuk satu pembeli

Kode sudah siap (single-tenant, white-label bersih, tes hijau). Yang tersisa adalah
langkah yang **butuh akun & keputusanmu** — tak bisa dikerjakan dari repo saja.

Urutan di bawah sengaja: aset → backend → data → rilis. Melompati urutan biasanya
berakhir dengan build yang gagal di tengah jalan.

---

## 0. Aset merek yang masih kurang

`node scripts/apply-brand.mjs` saat ini melaporkan tiga berkas belum ada. Ikon web &
PWA sudah memakai logo Waseela; yang kurang adalah versi **persegi** untuk native:

| Berkas | Spesifikasi | Kalau dibiarkan |
|---|---|---|
| `brand-assets/icon.png` | PERSEGI 1024×1024 | ikon aplikasi Android & Electron masih logo lembaga lain |
| `brand-assets/splash.png` | PERSEGI 2732×2732 | splash screen masih milik lembaga lain |
| `brand-assets/ic_stat.png` | 96×96, silhouette PUTIH, latar transparan | ikon notifikasi status bar salah |

Logo Waseela yang ada (`waseela.png` 560×312) berformat lanskap — kalau dipakai sebagai
ikon aplikasi ia akan terpotong atau gepeng. Perlu versi persegi tersendiri.

```bash
node scripts/apply-brand.mjs                 # sebar + audit
cd app && npx capacitor-assets generate --android   # regenerasi ikon launcher Android
```

`apply-brand.mjs` keluar dengan kode ≠ 0 selama masih ada aset yang identik dengan repo
hulu. Itu disengaja — jangan rilis sebelum bersih.

---

## 1. Supabase (data, auth, storage)

1. Buat project **baru** milik pembeli, region `ap-southeast-1` (Singapura).
2. Terapkan 41 migrasi di `supabase/migrations/` berurutan. DB kosong → tak ada
   masalah reconcile versi.
3. Deploy edge functions: `provision-akun`, `reset-user-password`,
   `auto-generate-tagihan`, `dispatch-push`, `get-link-preview`, `hiview-absen`.
   Isi secret-nya (FCM server key, dll).
4. Auth → Providers: **Email = Enabled**, **Confirm email = OFF**.
   (Domain `@waseela.local` tak bisa menerima surel, jadi konfirmasi harus mati.)

**Dua jebakan yang pernah memakan waktu berjam-jam:**

- **Settings → API → Exposed schemas**: pastikan tak me-list schema yang tak ada.
  Pernah menyisakan schema hantu → PostgREST `PGRST002` permanen; restart tak
  menyembuhkan karena ini konfigurasi, bukan warm-up.
- **Auth → Hooks**: pastikan kosong. Hook `custom_access_token_hook` yang menunjuk
  fungsi sudah di-drop membuat **login gagal 500** tanpa pesan yang jelas.

Isi `app/.env.local`:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable key>
VITE_APPCHECK_RECAPTCHA_KEY=
```

> Kalau nilai yang terbaca app tak sesuai `.env.local`, curigai variabel lingkungan
> OS/terminal yang basi — pernah terjadi dan menang atas `.env.local`. Restart terminal.

---

## 2. Firebase (notifikasi + hosting)

Firebase di sini **hanya** pipa notifikasi + App Check. Tak menyimpan data lembaga.

1. Project Firebase untuk pembeli (atau pakai `waseela-id` bila satu kanal cukup).
2. Add app → **Android**, package name **`id.waseela.app`** (harus sama persis dengan
   `applicationId` di `app/android/app/build.gradle`).
3. Unduh `google-services.json` → taruh di `app/android/app/`.
   Berkas ini sengaja tidak ada di repo — lihat `app/android/app/GOOGLE-SERVICES-README.md`.
   Tanpa itu build Android gagal; itu disengaja, lebih baik daripada terkirim memakai
   project lembaga lain.
4. Kalau project Firebase berbeda dari bawaan, samakan **dua** tempat:
   `app/src/config/brand.js` → `FIREBASE_CONFIG`, dan `app/public/firebase-messaging-sw.js`.

---

## 3. Data awal

1. **Lembaga & kelas** — seed dari `DEFAULT_LEMBAGA_SEED` di
   `app/src/composables/useLembaga.js`. Label tetap **BARE** (`Level 1`, bukan
   `Level 1 (½ Juz)`). Sesuaikan bila struktur lembaga pembeli berbeda.
2. **Akun admin pertama** — username `admin`, lewat RPC `provision_akun` / edge function.
3. **Impor data lama pembeli** — pakai importer bawaan: menu **Impor Supabase**
   (`ImporSupabaseView`). Jangan menulis skrip migrasi baru.

---

## 4. Identitas lembaga (dikerjakan PEMBELI, bukan kita)

Login sebagai admin → **Pengaturan**:

- **Kop Surat**: baris 1–4, alamat, telepon
- **Logo & Background**: 6 slot unggah — Logo Aplikasi, **Logo KOP Surat**, Logo Qiraati,
  background layar
- **Nama lembaga**, motto (tampil di layar login), nama kanal informasi

Semua tersimpan di DB dan langsung berlaku **tanpa rebuild**. Sebelum diisi, kop
tercetak kosong — bukan nama lembaga lain. Itu memang perilaku yang diinginkan.

---

## 5. Rilis

### Web
```bash
npm run deploy          # build + firebase deploy --only hosting:main
```

### Android
- **Keystore BARU** untuk Waseela — jangan pakai keystore repo hulu (identitas app
  berbeda). Simpan baik-baik: **kehilangan keystore = tak bisa lagi mengirim update**
  ke pengguna yang sudah memasang.
- Isi `app/android/key.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`).
- `npm run build:apk` (sideload) atau `npm run build:aab` (Play Store).
- Perbarui `app/public/app-version.json` (`versionCode`, `versionName`, `apkUrl`) setiap
  rilis — berkas inilah yang dibaca app untuk menawarkan pembaruan.

### Desktop
```bash
npm run electron:release
```

### Selaraskan versi di 4 tempat
`app/src/config/brand.js` (`BRAND.version`) · `app/package.json` ·
`app/android/app/build.gradle` (`versionCode`/`versionName`) · `app/public/app-version.json`.

---

## 6. Cek terakhir sebelum kirim

```bash
npm test                              # 67 berkas, ~870 tes
npm run build
node scripts/whitelabel.mjs --audit   # sumber + hasil build
node scripts/apply-brand.mjs          # aset gambar
```

Lalu di aplikasi yang sudah jalan:

1. Login `admin` → dashboard termuat, data dari Supabase.
2. **Cetak struk POS, rapor, dan rekap prestasi sebelum kop diisi** — tak boleh muncul
   identitas lembaga mana pun. Ini menangkap kebocoran gambar yang tak terlihat grep.
3. Isi kop + unggah logo → cetak ulang → identitas pembeli muncul, tanpa rebuild.
4. Guru biasa tak bisa menulis data terkunci (PTPT/keuangan); santri tak bisa membaca
   PII wali.
5. Android: pasang APK, login, cek tawaran pembaruan membaca `app-version.json` milik kita.
